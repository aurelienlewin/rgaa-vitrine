import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { load } from 'cheerio'

const MAX_HTML_BYTES = 800_000
const MAX_HOMEPAGE_HTML_BYTES = 1_000_000
const MAX_JSON_BYTES = 400_000
const REQUIRED_FETCH_TIMEOUT_MS = 7000
const OPTIONAL_FETCH_TIMEOUT_MS = 1800
const MAX_REDIRECTS = 5
export const DEFAULT_SITE_INSIGHT_BUDGET_MS = 14_000
const MIN_REQUIRED_FETCH_BUDGET_MS = 1200
const MIN_OPTIONAL_FETCH_BUDGET_MS = 600
const DEFAULT_USER_AGENT = 'Annuaire-RGAA/1.0 (+https://www.annuaire-rgaa.fr)'
// Some WAF/CDN layers reject non-browser agents; the fallback stays identifiable.
const BROWSER_COMPATIBLE_USER_AGENT =
  'Mozilla/5.0 (compatible; Annuaire-RGAA/1.0; +https://www.annuaire-rgaa.fr) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const RETRYABLE_WITH_BROWSER_AGENT_STATUSES = new Set([401, 403, 406, 429, 503])

const COMPLIANCE_LABELS = {
  full: 'Totalement conforme',
  partial: 'Partiellement conforme',
  none: 'Non conforme',
}
const DEFAULT_RGAA_BASELINE = '4.1'
const COMPLIANCE_INCONSISTENT_FULL_REASON =
  'Incohérence détectée: la déclaration indique "Totalement conforme" avec un score inférieur à 100.'

const accessibilityKeywords = [
  'accessibilite',
  'accessibilité',
  'declaration',
  'déclaration',
  'rgaa',
  'schema pluriannuel',
  'schéma pluriannuel',
]
const commonAccessibilityPaths = [
  '/accessibilite',
  '/accessibilite-numerique',
  '/declaration-accessibilite',
  '/accessibilite-et-conformite',
]
export class SiteInsightError extends Error {
  constructor(message, statusCode = 400, code = null) {
    super(message)
    this.name = 'SiteInsightError'
    this.statusCode = statusCode
    this.code = code ?? defaultSiteInsightErrorCode(statusCode)
  }
}

function defaultSiteInsightErrorCode(statusCode) {
  if (statusCode === 504) {
    return 'fetch-timeout'
  }
  if (statusCode === 413) {
    return 'document-too-large'
  }
  if (statusCode === 422) {
    return 'invalid-content'
  }
  if (statusCode >= 500) {
    return 'fetch-failed'
  }
  return 'invalid-input'
}

function readNetworkErrorCode(error) {
  const candidates = [error?.cause?.code, error?.code, error?.cause?.cause?.code]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) {
      return candidate
    }
  }
  return ''
}

function toNetworkSiteInsightError(error) {
  const networkCode = readNetworkErrorCode(error)

  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/i.test(networkCode)) {
    return new SiteInsightError(
      'Le certificat HTTPS du site est invalide ou incomplet (chaîne de certificats non vérifiable).',
      502,
      'tls-error',
    )
  }

  if (networkCode === 'ECONNREFUSED') {
    return new SiteInsightError('Le serveur du site a refusé la connexion.', 502, 'connection-refused')
  }

  if (networkCode === 'ECONNRESET' || networkCode === 'UND_ERR_SOCKET' || networkCode === 'EPIPE') {
    return new SiteInsightError('La connexion avec le site a été interrompue.', 502, 'connection-reset')
  }

  if (networkCode === 'UND_ERR_CONNECT_TIMEOUT' || networkCode === 'ETIMEDOUT') {
    return new SiteInsightError('La récupération du site a expiré.', 504, 'fetch-timeout')
  }

  if (networkCode === 'ENOTFOUND' || networkCode === 'EAI_AGAIN') {
    return new SiteInsightError('Impossible de résoudre le nom de domaine.', 400, 'dns-unresolved')
  }

  return new SiteInsightError(
    'Impossible de récupérer les métadonnées de ce site.',
    502,
    networkCode ? `fetch-failed:${networkCode.toLowerCase().slice(0, 40)}` : 'fetch-failed',
  )
}

function readRemainingBudgetMs(context) {
  if (!context || !Number.isFinite(context.deadline)) {
    return Number.POSITIVE_INFINITY
  }
  return context.deadline - Date.now()
}

function resolveFetchTimeoutMs(timeoutMs, context, { required }) {
  const remaining = readRemainingBudgetMs(context)
  const minimum = required ? MIN_REQUIRED_FETCH_BUDGET_MS : MIN_OPTIONAL_FETCH_BUDGET_MS
  if (remaining < minimum) {
    throw new SiteInsightError(
      'L’analyse du site a dépassé le temps maximal autorisé.',
      504,
      'analysis-budget-exceeded',
    )
  }
  return Math.max(1, Math.min(timeoutMs, Math.floor(remaining)))
}

function hasOptionalBudget(context) {
  return readRemainingBudgetMs(context) >= MIN_OPTIONAL_FETCH_BUDGET_MS
}

function looksLikeHtmlDocument(text) {
  return /^\s*(?:<!--[\s\S]*?-->\s*)*(?:<!doctype html|<html[\s>]|<head[\s>])/i.test(text.slice(0, 4096))
}

function normalizeForMatch(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeSubmittedUrl(rawValue) {
  if (typeof rawValue !== 'string') {
    throw new SiteInsightError('URL invalide.', 400)
  }

  const trimmed = rawValue.trim()
  if (!trimmed) {
    throw new SiteInsightError('Veuillez saisir une URL.', 400)
  }

  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed
  try {
    parsed = new URL(withProtocol)
  } catch {
    throw new SiteInsightError('Format URL non reconnu.', 400)
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new SiteInsightError('Seules les URL HTTP(S) sont autorisées.', 400)
  }

  if (parsed.username || parsed.password) {
    throw new SiteInsightError("Les URL avec identifiants intégrés ne sont pas autorisées.", 400)
  }

  return parsed
}

export async function validatePublicHttpUrl(rawValue) {
  if (typeof rawValue !== 'string') {
    throw new SiteInsightError('URL invalide.', 400)
  }

  const trimmed = rawValue.trim()
  if (!trimmed) {
    throw new SiteInsightError('URL invalide.', 400)
  }

  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new SiteInsightError('Format URL non reconnu.', 400)
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new SiteInsightError('Seules les URL HTTP(S) sont autorisées.', 400)
  }

  if (parsed.username || parsed.password) {
    throw new SiteInsightError("Les URL avec identifiants intégrés ne sont pas autorisées.", 400)
  }

  await validatePublicHost(parsed.hostname)
  return parsed.toString()
}

function createSiteInsightContext(budgetMs) {
  return {
    validatedHosts: new Map(),
    deadline: Number.isFinite(budgetMs) && budgetMs > 0 ? Date.now() + budgetMs : Number.POSITIVE_INFINITY,
  }
}

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true
  }

  const [a, b] = parts

  if (a === 10 || a === 127 || a === 0) {
    return true
  }

  if (a === 169 && b === 254) {
    return true
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true
  }

  if (a === 192 && b === 168) {
    return true
  }

  if (a === 100 && b >= 64 && b <= 127) {
    return true
  }

  if (a >= 224) {
    return true
  }

  return false
}

function isPrivateIpv6(ip) {
  const value = ip.toLowerCase()

  if (value === '::1' || value === '::') {
    return true
  }

  if (value.startsWith('fc') || value.startsWith('fd')) {
    return true
  }

  if (value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb')) {
    return true
  }

  if (value.startsWith('::ffff:')) {
    const mappedIpv4 = value.replace('::ffff:', '')
    return isPrivateIpv4(mappedIpv4)
  }

  return false
}

function isBlockedAddress(hostOrIp) {
  const ipVersion = isIP(hostOrIp)
  if (ipVersion === 0) {
    return ['localhost', 'localhost.localdomain'].includes(hostOrIp.toLowerCase())
  }

  if (ipVersion === 4) {
    return isPrivateIpv4(hostOrIp)
  }

  return isPrivateIpv6(hostOrIp)
}

async function validatePublicHost(hostname, context) {
  const normalizedHost = hostname.toLowerCase()

  if (normalizedHost.endsWith('.local') || normalizedHost.endsWith('.internal')) {
    throw new SiteInsightError('Hôte non autorisé.', 400, 'forbidden-host')
  }

  if (isBlockedAddress(normalizedHost)) {
    throw new SiteInsightError('Adresse locale ou privée non autorisée.', 400, 'forbidden-host')
  }

  if (isIP(normalizedHost) !== 0) {
    return
  }

  const cachedValidation = context?.validatedHosts?.get(normalizedHost)
  if (cachedValidation) {
    await cachedValidation
    return
  }

  const validationPromise = (async () => {
    let resolved
    try {
      resolved = await lookup(normalizedHost, { all: true, verbatim: true })
    } catch {
      throw new SiteInsightError('Impossible de résoudre le nom de domaine.', 400, 'dns-unresolved')
    }

    if (!Array.isArray(resolved) || resolved.length === 0) {
      throw new SiteInsightError('Nom de domaine introuvable.', 400, 'dns-unresolved')
    }

    for (const record of resolved) {
      if (isBlockedAddress(record.address)) {
        throw new SiteInsightError('Domaine résolu vers une adresse non autorisée.', 400, 'forbidden-host')
      }
    }
  })()

  context?.validatedHosts?.set(normalizedHost, validationPromise)

  try {
    await validationPromise
  } catch (error) {
    context?.validatedHosts?.delete(normalizedHost)
    throw error
  }
}

async function readBodyWithLimit(response, maxBytes, { truncateOnLimit = false } = {}) {
  const reader = response.body?.getReader()
  if (!reader) {
    return ''
  }

  const chunks = []
  let byteLength = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    if (byteLength + value.byteLength > maxBytes) {
      if (!truncateOnLimit) {
        await reader.cancel().catch(() => {})
        throw new SiteInsightError('Le document est trop volumineux pour être analysé.', 413)
      }

      // Metadata lives in <head>: keep the leading bytes and stop downloading.
      const remainingBytes = maxBytes - byteLength
      if (remainingBytes > 0) {
        chunks.push(value.subarray(0, remainingBytes))
        byteLength += remainingBytes
      }
      await reader.cancel().catch(() => {})
      break
    }

    byteLength += value.byteLength
    chunks.push(value)
  }

  const merged = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(merged)
}

function isRedirectStatus(statusCode) {
  return statusCode >= 300 && statusCode < 400
}

async function fetchTextDocument(
  url,
  {
    acceptHeader,
    invalidContentMessage,
    isExpectedContentType,
    sniffContent = null,
    maxBytes,
    truncateOnLimit = false,
    timeoutMs = REQUIRED_FETCH_TIMEOUT_MS,
    required = true,
    context,
  },
  redirectCount = 0,
  userAgent = DEFAULT_USER_AGENT,
) {
  const effectiveTimeoutMs = resolveFetchTimeoutMs(timeoutMs, context, { required })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), effectiveTimeoutMs)
  const options = {
    acceptHeader,
    invalidContentMessage,
    isExpectedContentType,
    sniffContent,
    maxBytes,
    truncateOnLimit,
    timeoutMs,
    required,
    context,
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': userAgent,
        accept: acceptHeader,
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.6',
      },
    })

    if (isRedirectStatus(response.status)) {
      await response.body?.cancel().catch(() => {})
      if (redirectCount >= MAX_REDIRECTS) {
        throw new SiteInsightError('Trop de redirections lors de la récupération du site.', 502, 'too-many-redirects')
      }

      const locationHeader = response.headers.get('location')?.trim() ?? ''
      const nextUrl = toAbsoluteUrl(locationHeader, url)
      if (!nextUrl) {
        throw new SiteInsightError('Redirection invalide vers une URL non prise en charge.', 502, 'invalid-redirect')
      }

      const nextParsedUrl = new URL(nextUrl)
      await validatePublicHost(nextParsedUrl.hostname, context)
      return fetchTextDocument(nextUrl, options, redirectCount + 1, userAgent)
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      if (userAgent === DEFAULT_USER_AGENT && RETRYABLE_WITH_BROWSER_AGENT_STATUSES.has(response.status)) {
        clearTimeout(timeout)
        try {
          return await fetchTextDocument(url, options, redirectCount, BROWSER_COMPATIBLE_USER_AGENT)
        } catch (retryError) {
          if (!(retryError instanceof SiteInsightError) || retryError.code === 'analysis-budget-exceeded') {
            throw new SiteInsightError(
              `Le site a répondu avec le statut ${response.status}.`,
              502,
              `http-${response.status}`,
            )
          }
          throw retryError
        }
      }

      throw new SiteInsightError(
        response.status === 401 || response.status === 403 || response.status === 429
          ? `Le site a répondu avec le statut ${response.status} (accès refusé à notre robot d’analyse, probablement par un pare-feu applicatif).`
          : `Le site a répondu avec le statut ${response.status}.`,
        502,
        `http-${response.status}`,
      )
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    const hasExpectedContentType = isExpectedContentType(contentType)
    // Servers that omit Content-Type are accepted when the payload itself matches.
    if (!hasExpectedContentType && (contentType.trim() || typeof sniffContent !== 'function')) {
      await response.body?.cancel().catch(() => {})
      throw new SiteInsightError(invalidContentMessage, 422, 'invalid-content-type')
    }

    const text = await readBodyWithLimit(response, maxBytes, { truncateOnLimit })
    if (!hasExpectedContentType && !sniffContent(text)) {
      throw new SiteInsightError(invalidContentMessage, 422, 'invalid-content-type')
    }

    return { finalUrl: url, text }
  } catch (error) {
    if (error instanceof SiteInsightError) {
      throw error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SiteInsightError('La récupération du site a expiré.', 504, 'fetch-timeout')
    }

    throw toNetworkSiteInsightError(error)
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchHtml(url, options = {}) {
  const {
    redirectCount = 0,
    timeoutMs = REQUIRED_FETCH_TIMEOUT_MS,
    context,
    maxBytes = MAX_HTML_BYTES,
    truncateOnLimit = false,
    required = timeoutMs >= REQUIRED_FETCH_TIMEOUT_MS,
  } = options
  const { finalUrl, text } = await fetchTextDocument(
    url,
    {
      acceptHeader: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      invalidContentMessage: 'Le contenu cible n’est pas une page HTML.',
      isExpectedContentType: (contentType) =>
        contentType.includes('text/html') || contentType.includes('application/xhtml+xml'),
      sniffContent: looksLikeHtmlDocument,
      maxBytes,
      truncateOnLimit,
      timeoutMs,
      required,
      context,
    },
    redirectCount,
  )

  return {
    finalUrl,
    html: text,
  }
}

async function fetchJson(url, options = {}) {
  const { redirectCount = 0, timeoutMs = REQUIRED_FETCH_TIMEOUT_MS, context } = options
  const { finalUrl, text } = await fetchTextDocument(
    url,
    {
      acceptHeader: 'application/json,application/ld+json',
      invalidContentMessage: 'Le contenu cible n’est pas un JSON exploitable.',
      isExpectedContentType: (contentType) =>
        contentType.includes('application/json') || contentType.includes('+json'),
      maxBytes: MAX_JSON_BYTES,
      timeoutMs,
      required: false,
      context,
    },
    redirectCount,
  )

  try {
    return {
      finalUrl,
      json: JSON.parse(text),
    }
  } catch {
    throw new SiteInsightError('Le contenu JSON détecté est invalide.', 422)
  }
}

function toAbsoluteUrl(candidate, baseUrl) {
  if (!candidate) {
    return null
  }

  try {
    const parsed = new URL(candidate, baseUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

function canonicalizeListingUrl(rawUrl) {
  const parsed = new URL(rawUrl)
  const protocol = parsed.protocol === 'https:' ? 'https:' : parsed.protocol
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
  const isDefaultPort =
    (protocol === 'https:' && parsed.port === '443') ||
    (protocol === 'http:' && parsed.port === '80')
  const portSegment = parsed.port && !isDefaultPort ? `:${parsed.port}` : ''

  return `${protocol}//${hostname}${portSegment}/`
}

function findAccessibilityPageUrl($, baseUrl) {
  let bestMatch = null

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')?.trim() ?? ''
    const text = $(element).text().trim()
    const combined = normalizeForMatch(`${href} ${text}`)

    const matches = accessibilityKeywords.some((keyword) => combined.includes(normalizeForMatch(keyword)))
    if (!matches) {
      return
    }

    const absolute = toAbsoluteUrl(href, baseUrl)
    if (!absolute) {
      return
    }

    if (!bestMatch || /accessibil/i.test(href)) {
      bestMatch = absolute
    }
  })

  return bestMatch
}

function findAiContextUrl($, baseUrl) {
  let bestMatch = null

  $('link[href]').each((_, element) => {
    const href = $(element).attr('href')?.trim() ?? ''
    const rel = normalizeForMatch($(element).attr('rel') ?? '')
    const type = normalizeForMatch($(element).attr('type') ?? '')

    if (!rel.includes('alternate')) {
      return
    }

    if (!normalizeForMatch(href).includes('ai-context')) {
      return
    }

    if (type && !type.includes('json')) {
      return
    }

    const absolute = toAbsoluteUrl(href, baseUrl)
    if (!absolute) {
      return
    }

    bestMatch = absolute
  })

  return bestMatch
}

function findFirstAbsoluteUrl(baseUrl, ...candidates) {
  for (const candidate of candidates) {
    const absolute = toAbsoluteUrl(typeof candidate === 'string' ? candidate.trim() : '', baseUrl)
    if (absolute) {
      return absolute
    }
  }

  return null
}

function findLogoValueInStructuredData(value, depth = 0) {
  if (depth > 8 || value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    return null
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = findLogoValueInStructuredData(entry, depth + 1)
      if (nested) {
        return nested
      }
    }
    return null
  }

  if (typeof value !== 'object') {
    return null
  }

  const directLogo = value.logo
  if (typeof directLogo === 'string' && directLogo.trim()) {
    return directLogo.trim()
  }

  if (directLogo && typeof directLogo === 'object') {
    if (typeof directLogo.url === 'string' && directLogo.url.trim()) {
      return directLogo.url.trim()
    }

    if (typeof directLogo.contentUrl === 'string' && directLogo.contentUrl.trim()) {
      return directLogo.contentUrl.trim()
    }

    const recursiveDirectLogo = findLogoValueInStructuredData(directLogo, depth + 1)
    if (recursiveDirectLogo) {
      return recursiveDirectLogo
    }
  }

  for (const nestedValue of Object.values(value)) {
    const nested = findLogoValueInStructuredData(nestedValue, depth + 1)
    if (nested) {
      return nested
    }
  }

  return null
}

function findStructuredDataLogoUrl($, baseUrl) {
  let bestMatch = null

  $('script[type="application/ld+json"]').each((_, element) => {
    if (bestMatch) {
      return
    }

    const rawJson = $(element).contents().text().trim()
    if (!rawJson) {
      return
    }

    try {
      const parsed = JSON.parse(rawJson)
      const logoValue = findLogoValueInStructuredData(parsed)
      const absolute = findFirstAbsoluteUrl(baseUrl, logoValue)
      if (absolute) {
        bestMatch = absolute
        return false
      }
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  })

  return bestMatch
}

function findHtmlLogoUrl($, baseUrl) {
  const selectors = [
    'img[itemprop="logo"]',
    'img[alt*="logo" i]',
    'img[class*="logo" i]',
    'img[id*="logo" i]',
    '[class*="logo" i] img',
    '[id*="logo" i] img',
    'img[src*="logo" i]',
    'header img',
  ]

  for (const selector of selectors) {
    let bestMatch = null

    $(selector).each((_, element) => {
      if (bestMatch) {
        return
      }

      const absolute = findFirstAbsoluteUrl(
        baseUrl,
        $(element).attr('src'),
        $(element).attr('data-src'),
        $(element).attr('data-lazy-src'),
      )

      if (absolute) {
        bestMatch = absolute
        return false
      }
    })

    if (bestMatch) {
      return bestMatch
    }
  }

  return null
}

function findSiteIconUrl($, baseUrl) {
  return findFirstAbsoluteUrl(
    baseUrl,
    $('link[rel="apple-touch-icon"]').attr('href'),
    $('link[rel="apple-touch-icon-precomposed"]').attr('href'),
    $('link[rel="shortcut icon"]').attr('href'),
    $('link[rel~="icon"]').attr('href'),
    '/favicon.ico',
  )
}

function findThumbnailUrl($, baseUrl) {
  return (
    findFirstAbsoluteUrl(
      baseUrl,
      $('meta[property="og:image"]').attr('content'),
      $('meta[property="og:image:secure_url"]').attr('content'),
      $('meta[name="twitter:image"]').attr('content'),
    ) ||
    findStructuredDataLogoUrl($, baseUrl) ||
    findHtmlLogoUrl($, baseUrl) ||
    findSiteIconUrl($, baseUrl)
  )
}

function extractCompliance(text) {
  const normalized = normalizeForMatch(text)

  const explicitStatus = extractExplicitComplianceStatus(normalized)
  const complianceScore = extractComplianceScore(normalized)
  const complianceStatus = resolveComplianceStatus(explicitStatus, complianceScore, normalized)
  const complianceConsistencyIssue = readComplianceConsistencyIssue(explicitStatus, complianceScore)

  return { complianceStatus, complianceScore, complianceConsistencyIssue }
}

function extractExplicitComplianceStatus(normalizedText) {
  if (normalizedText.includes('totalement conforme')) {
    return 'full'
  }

  if (normalizedText.includes('partiellement conforme')) {
    return 'partial'
  }

  if (normalizedText.includes('non conforme')) {
    return 'none'
  }

  return null
}

function parseScoreValue(rawValue) {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return null
  }

  const normalized = rawValue.replace(',', '.').trim()
  const parsed = Number(normalized)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null
  }

  return Math.round(parsed * 100) / 100
}

function parseComplianceStatusValue(rawValue) {
  if (typeof rawValue !== 'string') {
    return null
  }

  const normalized = normalizeForMatch(rawValue)
  if (!normalized) {
    return null
  }

  if (normalized === 'full' || normalized.includes('totalement conforme')) {
    return 'full'
  }

  if (normalized === 'partial' || normalized.includes('partiellement conforme')) {
    return 'partial'
  }

  if (normalized === 'none' || normalized.includes('non conforme')) {
    return 'none'
  }

  return null
}

function detectRgaaBaseline(normalizedText) {
  if (typeof normalizedText !== 'string' || !normalizedText.trim()) {
    return null
  }

  if (/(?:\brgaa\s*(?:v|version)?\s*5(?:[.,]0)?\b)|(?:\brgaa5\b)/.test(normalizedText)) {
    return '5.0-ready'
  }

  if (/(?:\brgaa\s*(?:v|version)?\s*4(?:[.,]1(?:[.,]2)?)?\b)|(?:\brgaa4\b)/.test(normalizedText)) {
    return '4.1'
  }

  return null
}

function readComplianceConsistencyIssue(explicitStatus, score) {
  if (explicitStatus === 'full' && typeof score === 'number' && Number.isFinite(score) && score < 100) {
    return COMPLIANCE_INCONSISTENT_FULL_REASON
  }

  return null
}

function resolveComplianceStatus(explicitStatus, score, normalizedText) {
  if (explicitStatus === 'full' && typeof score === 'number' && Number.isFinite(score) && score < 100) {
    return 'partial'
  }

  if (explicitStatus) {
    return explicitStatus
  }

  if (typeof score === 'number') {
    if (score >= 100) {
      return 'full'
    }
    if (score <= 0) {
      return 'none'
    }
    return 'partial'
  }

  if (
    normalizedText.includes('accessibilite') &&
    normalizedText.includes('declaration') &&
    normalizedText.includes('non-conformit')
  ) {
    return 'partial'
  }

  if (
    normalizedText.includes('accessibilite') &&
    (normalizedText.includes('conformite') || normalizedText.includes('rgaa')) &&
    (normalizedText.includes('declaration') || normalizedText.includes('score'))
  ) {
    return 'partial'
  }

  return null
}

function extractComplianceScore(normalizedText) {
  const prioritizedPatterns = [
    /taux\s+moyen\s+de\s+conformite[^\d]{0,120}(\d{1,3}(?:[.,]\d{1,2})?)\s*%/,
    /taux(?:\s+\w+){0,4}\s+de\s+conformite[^\d]{0,120}(\d{1,3}(?:[.,]\d{1,2})?)\s*%/,
    /conformite[^\d]{0,120}taux[^\d]{0,120}(\d{1,3}(?:[.,]\d{1,2})?)\s*%/,
    /score(?:\s+\w+){0,4}[^\d]{0,120}(\d{1,3}(?:[.,]\d{1,2})?)\s*%/,
    /(\d{1,3}(?:[.,]\d{1,2})?)\s*%\s*(?:des\s+)?criteres[^\n]{0,80}respectes/,
  ]

  for (const pattern of prioritizedPatterns) {
    const matched = normalizedText.match(pattern)
    if (!matched) {
      continue
    }

    const parsed = parseScoreValue(matched[1])
    if (parsed !== null) {
      return parsed
    }
  }

  const percentPattern = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%/g
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  let bestCandidate = null

  for (const line of lines) {
    let match
    while ((match = percentPattern.exec(line)) !== null) {
      const parsed = parseScoreValue(match[1])
      if (parsed === null) {
        continue
      }

      let weight = 0
      if (line.includes('taux moyen de conformite')) {
        weight += 120
      } else if (line.includes('taux de conformite')) {
        weight += 90
      } else if (line.includes('score')) {
        weight += 85
      } else if (line.includes('taux') && line.includes('conformite')) {
        weight += 75
      } else if (line.includes('conformite')) {
        weight += 40
      }

      if (line.includes('accessibilite') || line.includes('rgaa')) {
        weight += 12
      }

      if (line.includes('criteres') || line.includes('respectes')) {
        weight -= 25
      }

      const nextCandidate = {
        weight,
        value: parsed,
      }

      if (
        !bestCandidate ||
        nextCandidate.weight > bestCandidate.weight ||
        (nextCandidate.weight === bestCandidate.weight && nextCandidate.value > bestCandidate.value)
      ) {
        bestCandidate = nextCandidate
      }
    }

    percentPattern.lastIndex = 0
  }

  return bestCandidate?.value ?? null
}

function looksLikeAccessibilityPage(html) {
  const normalizedText = normalizeForMatch(load(html).text())
  const hasAccessibilitySignal =
    normalizedText.includes('accessibilite') || normalizedText.includes('declaration') || normalizedText.includes('rgaa')
  const hasComplianceSignal = normalizedText.includes('conformite') || normalizedText.includes('conforme')

  return hasAccessibilitySignal && hasComplianceSignal
}

async function resolveAccessibilityPageUrl(baseUrl, detectedAccessibilityPageUrl, context) {
  if (detectedAccessibilityPageUrl) {
    return detectedAccessibilityPageUrl
  }

  if (!hasOptionalBudget(context)) {
    return null
  }

  const candidateUrls = commonAccessibilityPaths
    .map((path) => toAbsoluteUrl(path, baseUrl))
    .filter(Boolean)

  // Probe the conventional paths concurrently; keep the first one in declared order.
  const probeResults = await Promise.all(
    candidateUrls.map(async (candidateUrl) => {
      try {
        const parsedCandidate = new URL(candidateUrl)
        await validatePublicHost(parsedCandidate.hostname, context)
        const { html } = await fetchHtml(candidateUrl, {
          timeoutMs: OPTIONAL_FETCH_TIMEOUT_MS,
          context,
        })
        return looksLikeAccessibilityPage(html) ? candidateUrl : null
      } catch {
        return null
      }
    }),
  )

  return probeResults.find(Boolean) ?? null
}

function looksLikeAiContextPayload(payload) {
  return Boolean(payload && typeof payload === 'object' && !Array.isArray(payload))
}

async function resolveAiContextUrl(_baseUrl, detectedAiContextUrl, context) {
  if (!detectedAiContextUrl || !hasOptionalBudget(context)) {
    return null
  }

  try {
    const parsedCandidate = new URL(detectedAiContextUrl)
    await validatePublicHost(parsedCandidate.hostname, context)
    const { finalUrl, json } = await fetchJson(detectedAiContextUrl, {
      timeoutMs: OPTIONAL_FETCH_TIMEOUT_MS,
      context,
    })

    if (looksLikeAiContextPayload(json)) {
      return finalUrl
    }
  } catch {
    // AI context is optional and should not slow down the main analysis path.
  }

  return null
}

function extractMetaInformation(html, baseUrl) {
  const $ = load(html)

  const siteTitle =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('meta[name="twitter:title"]').attr('content')?.trim() ||
    $('title').first().text().trim() ||
    new URL(baseUrl).hostname

  const thumbnailUrl = findThumbnailUrl($, baseUrl)

  const accessibilityPageUrl = findAccessibilityPageUrl($, baseUrl)
  const aiContextUrl = findAiContextUrl($, baseUrl)

  return {
    siteTitle,
    thumbnailUrl,
    accessibilityPageUrl,
    aiContextUrl,
  }
}

function extractComplianceFromMetaTags($) {
  const statusMetaSelectors = [
    'meta[name="rgaa:compliance-status"]',
    'meta[name="rgaa:status"]',
    'meta[name="accessibility:compliance-status"]',
    'meta[name="accessibility:status"]',
  ]

  const scoreMetaSelectors = [
    'meta[name="rgaa:compliance-score"]',
    'meta[name="rgaa:score"]',
    'meta[name="accessibility:compliance-score"]',
    'meta[name="accessibility:score"]',
  ]
  const baselineMetaSelectors = [
    'meta[name="rgaa:baseline"]',
    'meta[name="rgaa:version"]',
    'meta[name="rgaa:referential"]',
    'meta[name="accessibility:rgaa-baseline"]',
    'meta[name="accessibility:rgaa-version"]',
    'meta[name="accessibility:referential"]',
    'meta[property="rgaa:baseline"]',
    'meta[property="rgaa:version"]',
  ]

  let explicitStatus = null
  for (const selector of statusMetaSelectors) {
    const value = $(selector).attr('content')?.trim()
    const parsed = parseComplianceStatusValue(value)
    if (parsed) {
      explicitStatus = parsed
      break
    }
  }

  let complianceScore = null
  for (const selector of scoreMetaSelectors) {
    const value = $(selector).attr('content')?.trim()
    const parsed = parseScoreValue(value)
    if (parsed !== null) {
      complianceScore = parsed
      break
    }
  }

  let rgaaBaseline = null
  for (const selector of baselineMetaSelectors) {
    const value = $(selector).attr('content')?.trim()
    const parsed = detectRgaaBaseline(normalizeForMatch(value ?? ''))
    if (parsed) {
      rgaaBaseline = parsed
      break
    }
  }

  return {
    explicitStatus,
    complianceScore,
    rgaaBaseline,
  }
}

function extractDocumentSignalText($) {
  const parts = []

  const bodyText = $.text()
  if (bodyText) {
    parts.push(bodyText)
  }

  const title = $('title').first().text()
  if (title) {
    parts.push(title)
  }

  $('meta[content]').each((_, element) => {
    const content = $(element).attr('content')?.trim()
    if (content) {
      parts.push(content)
    }
  })

  return parts.join('\n')
}

async function extractComplianceFromAccessibilityPage(accessibilityPageUrl, context) {
  if (!accessibilityPageUrl) {
    return {
      complianceStatus: null,
      complianceScore: null,
    }
  }

  const parsed = new URL(accessibilityPageUrl)
  await validatePublicHost(parsed.hostname, context)

  const { html } = await fetchHtml(accessibilityPageUrl, { context })
  const $ = load(html)
  const signalText = extractDocumentSignalText($)
  const normalizedSignalText = normalizeForMatch(signalText)
  const textBased = extractCompliance(signalText)
  const metaBased = extractComplianceFromMetaTags($)
  const textBasedRgaaBaseline = detectRgaaBaseline(normalizedSignalText)
  const metaBasedConsistencyIssue = readComplianceConsistencyIssue(
    metaBased.explicitStatus,
    metaBased.complianceScore,
  )

  const complianceScore = textBased.complianceScore ?? metaBased.complianceScore
  const complianceStatus = resolveComplianceStatus(
    textBased.complianceStatus ?? metaBased.explicitStatus,
    complianceScore,
    normalizedSignalText,
  )
  const rgaaBaseline = textBasedRgaaBaseline ?? metaBased.rgaaBaseline

  return {
    complianceStatus,
    complianceScore,
    complianceConsistencyIssue:
      textBased.complianceConsistencyIssue ?? metaBasedConsistencyIssue ?? null,
    rgaaBaseline,
    scoreSource:
      textBased.complianceScore !== null ? 'text' : metaBased.complianceScore !== null ? 'meta' : null,
  }
}

function extractComplianceFromAiContextPayload(payload) {
  const statement =
    payload && typeof payload === 'object' && typeof payload.accessibilityStatement === 'object'
      ? payload.accessibilityStatement
      : null

  if (!statement) {
    return {
      complianceStatus: null,
      complianceScore: null,
      rgaaBaseline: null,
    }
  }

  const explicitStatus = parseComplianceStatusValue(
    statement.complianceStatus ?? statement.complianceStatusLabel ?? statement.status,
  )
  const rawScore =
    typeof statement.complianceScore === 'number' || typeof statement.complianceScore === 'string'
      ? `${statement.complianceScore}`
      : typeof statement.scoreLabel === 'string'
        ? statement.scoreLabel.match(/(\d{1,3}(?:[.,]\d{1,2})?)/)?.[1] ?? ''
        : ''
  const complianceScore = parseScoreValue(rawScore)
  const rgaaBaseline = detectRgaaBaseline(
    normalizeForMatch(`${statement.rgaaBaseline ?? statement.baseline ?? ''}`),
  )
  const normalizedStatementText = normalizeForMatch(JSON.stringify(statement))
  const complianceStatus = resolveComplianceStatus(explicitStatus, complianceScore, normalizedStatementText)
  const complianceConsistencyIssue = readComplianceConsistencyIssue(explicitStatus, complianceScore)

  return {
    complianceStatus,
    complianceScore,
    complianceConsistencyIssue,
    rgaaBaseline,
  }
}

async function extractComplianceFromAiContext(aiContextUrl, context) {
  if (!aiContextUrl) {
    return {
      complianceStatus: null,
      complianceScore: null,
      rgaaBaseline: null,
    }
  }

  const parsed = new URL(aiContextUrl)
  await validatePublicHost(parsed.hostname, context)

  const { json } = await fetchJson(aiContextUrl, {
    timeoutMs: OPTIONAL_FETCH_TIMEOUT_MS,
    context,
  })
  return extractComplianceFromAiContextPayload(json)
}

export async function buildSiteInsight(inputUrl, { budgetMs = DEFAULT_SITE_INSIGHT_BUDGET_MS } = {}) {
  const context = createSiteInsightContext(budgetMs)
  const parsed = normalizeSubmittedUrl(inputUrl)
  await validatePublicHost(parsed.hostname, context)

  // Homepages often embed large inline CSS/JS while secondary documents stay smaller:
  // oversized homepages are truncated since the metadata lives in the leading <head>.
  const homepage = await fetchHtml(parsed.toString(), {
    context,
    maxBytes: MAX_HOMEPAGE_HTML_BYTES,
    truncateOnLimit: true,
  })
  const metadata = extractMetaInformation(homepage.html, homepage.finalUrl)
  const [accessibilityPageUrl, aiContextUrl] = await Promise.all([
    resolveAccessibilityPageUrl(homepage.finalUrl, metadata.accessibilityPageUrl, context),
    resolveAiContextUrl(homepage.finalUrl, metadata.aiContextUrl, context),
  ])

  let complianceStatus = null
  let complianceScore = null
  let complianceConsistencyIssue = null
  let rgaaBaseline = null
  let accessibilityPageScoreSource = null

  // Both sources are best effort and should not fail the main result.
  const [accessibilityPageResult, aiContextResult] = await Promise.allSettled([
    extractComplianceFromAccessibilityPage(accessibilityPageUrl, context),
    extractComplianceFromAiContext(aiContextUrl, context),
  ])

  if (accessibilityPageResult.status === 'fulfilled') {
    const compliance = accessibilityPageResult.value
    complianceStatus = compliance.complianceStatus
    complianceScore = compliance.complianceScore
    complianceConsistencyIssue = compliance.complianceConsistencyIssue ?? null
    rgaaBaseline = compliance.rgaaBaseline
    accessibilityPageScoreSource = compliance.scoreSource
  }

  if (aiContextResult.status === 'fulfilled') {
    const aiContextCompliance = aiContextResult.value

    if (aiContextCompliance.complianceScore !== null && accessibilityPageScoreSource !== 'text') {
      complianceScore = aiContextCompliance.complianceScore
    }

    if (aiContextCompliance.complianceStatus && accessibilityPageScoreSource !== 'text') {
      complianceStatus = aiContextCompliance.complianceStatus
    }

    if (aiContextCompliance.complianceConsistencyIssue) {
      complianceConsistencyIssue = complianceConsistencyIssue ?? aiContextCompliance.complianceConsistencyIssue
    }

    rgaaBaseline = rgaaBaseline ?? aiContextCompliance.rgaaBaseline
  }

  if (!complianceStatus || complianceScore === null) {
    const fallback = extractCompliance(load(homepage.html).text())
    complianceStatus = complianceStatus ?? fallback.complianceStatus
    complianceScore = complianceScore ?? fallback.complianceScore
    complianceConsistencyIssue = complianceConsistencyIssue ?? fallback.complianceConsistencyIssue ?? null
  }

  if (!rgaaBaseline) {
    const homepageText = normalizeForMatch(load(homepage.html).text())
    rgaaBaseline = detectRgaaBaseline(homepageText)
  }

  return {
    normalizedUrl: canonicalizeListingUrl(homepage.finalUrl),
    siteTitle: metadata.siteTitle,
    thumbnailUrl: metadata.thumbnailUrl,
    accessibilityPageUrl,
    complianceStatus,
    complianceStatusLabel: complianceStatus ? COMPLIANCE_LABELS[complianceStatus] : null,
    complianceScore,
    complianceConsistencyIssue,
    rgaaBaseline: rgaaBaseline ?? DEFAULT_RGAA_BASELINE,
    updatedAt: new Date().toISOString(),
  }
}

// Remote-access failures that do not invalidate the submission itself: the site exists
// but refuses or delays automated analysis (WAF, bot protection, slow origin, TLS chain).
const MANUAL_REVIEW_FALLBACK_ERROR_CODES = new Set([
  'http-401',
  'http-403',
  'http-406',
  'http-429',
  'http-503',
  'fetch-timeout',
  'analysis-budget-exceeded',
  'connection-reset',
  'tls-error',
])

export function isManualReviewFallbackError(error) {
  return error instanceof SiteInsightError && MANUAL_REVIEW_FALLBACK_ERROR_CODES.has(error.code)
}

export function buildUnreachableSiteInsight(inputUrl) {
  const parsed = normalizeSubmittedUrl(inputUrl)
  return {
    normalizedUrl: canonicalizeListingUrl(parsed.toString()),
    siteTitle: parsed.hostname.toLowerCase().replace(/^www\./, ''),
    thumbnailUrl: null,
    accessibilityPageUrl: null,
    complianceStatus: null,
    complianceStatusLabel: null,
    complianceScore: null,
    complianceConsistencyIssue: null,
    rgaaBaseline: DEFAULT_RGAA_BASELINE,
    updatedAt: new Date().toISOString(),
  }
}
