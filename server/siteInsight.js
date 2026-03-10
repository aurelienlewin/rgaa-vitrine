import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { load } from 'cheerio'

const MAX_HTML_BYTES = 800_000
const MAX_JSON_BYTES = 400_000
const REQUIRED_FETCH_TIMEOUT_MS = 7000
const OPTIONAL_FETCH_TIMEOUT_MS = 1800
const MAX_REDIRECTS = 5

const COMPLIANCE_LABELS = {
  full: 'Totalement conforme',
  partial: 'Partiellement conforme',
  none: 'Non conforme',
}
const DEFAULT_RGAA_BASELINE = '4.1'

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
  constructor(message, statusCode = 400) {
    super(message)
    this.name = 'SiteInsightError'
    this.statusCode = statusCode
  }
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

function createSiteInsightContext() {
  return {
    validatedHosts: new Map(),
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
    throw new SiteInsightError('Hôte non autorisé.', 400)
  }

  if (isBlockedAddress(normalizedHost)) {
    throw new SiteInsightError('Adresse locale ou privée non autorisée.', 400)
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
      throw new SiteInsightError('Impossible de résoudre le nom de domaine.', 400)
    }

    if (!Array.isArray(resolved) || resolved.length === 0) {
      throw new SiteInsightError('Nom de domaine introuvable.', 400)
    }

    for (const record of resolved) {
      if (isBlockedAddress(record.address)) {
        throw new SiteInsightError('Domaine résolu vers une adresse non autorisée.', 400)
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

async function readBodyWithLimit(response, maxBytes) {
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

    byteLength += value.byteLength
    if (byteLength > maxBytes) {
      throw new SiteInsightError('Le document est trop volumineux pour être analysé.', 413)
    }

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
    maxBytes,
    timeoutMs = REQUIRED_FETCH_TIMEOUT_MS,
    context,
  },
  redirectCount = 0,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'Annuaire-RGAA/1.0 (+https://annuaire-rgaa.fr)',
        accept: acceptHeader,
      },
    })

    if (isRedirectStatus(response.status)) {
      if (redirectCount >= MAX_REDIRECTS) {
        throw new SiteInsightError('Trop de redirections lors de la récupération du site.', 502)
      }

      const locationHeader = response.headers.get('location')?.trim() ?? ''
      const nextUrl = toAbsoluteUrl(locationHeader, url)
      if (!nextUrl) {
        throw new SiteInsightError('Redirection invalide vers une URL non prise en charge.', 502)
      }

      const nextParsedUrl = new URL(nextUrl)
      await validatePublicHost(nextParsedUrl.hostname, context)
      return fetchTextDocument(
        nextUrl,
        {
          acceptHeader,
          invalidContentMessage,
          isExpectedContentType,
          maxBytes,
          timeoutMs,
          context,
        },
        redirectCount + 1,
      )
    }

    if (!response.ok) {
      throw new SiteInsightError(`Le site a répondu avec le statut ${response.status}.`, 502)
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (!isExpectedContentType(contentType)) {
      throw new SiteInsightError(invalidContentMessage, 422)
    }

    const text = await readBodyWithLimit(response, maxBytes)
    return { finalUrl: url, text }
  } catch (error) {
    if (error instanceof SiteInsightError) {
      throw error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SiteInsightError('La récupération du site a expiré.', 504)
    }

    throw new SiteInsightError('Impossible de récupérer les métadonnées de ce site.', 502)
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchHtml(url, options = {}) {
  const { redirectCount = 0, timeoutMs = REQUIRED_FETCH_TIMEOUT_MS, context } = options
  const { finalUrl, text } = await fetchTextDocument(
    url,
    {
      acceptHeader: 'text/html,application/xhtml+xml',
      invalidContentMessage: 'Le contenu cible n’est pas une page HTML.',
      isExpectedContentType: (contentType) =>
        contentType.includes('text/html') || contentType.includes('application/xhtml+xml'),
      maxBytes: MAX_HTML_BYTES,
      timeoutMs,
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

  return { complianceStatus, complianceScore }
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

function resolveComplianceStatus(explicitStatus, score, normalizedText) {
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

  for (const path of commonAccessibilityPaths) {
    const candidateUrl = toAbsoluteUrl(path, baseUrl)
    if (!candidateUrl) {
      continue
    }

    try {
      const parsedCandidate = new URL(candidateUrl)
      await validatePublicHost(parsedCandidate.hostname, context)
      const { html } = await fetchHtml(candidateUrl, {
        timeoutMs: OPTIONAL_FETCH_TIMEOUT_MS,
        context,
      })

      if (looksLikeAccessibilityPage(html)) {
        return candidateUrl
      }
    } catch {
      // Tentative suivante.
    }
  }

  return null
}

function looksLikeAiContextPayload(payload) {
  return Boolean(payload && typeof payload === 'object' && !Array.isArray(payload))
}

async function resolveAiContextUrl(_baseUrl, detectedAiContextUrl, context) {
  if (!detectedAiContextUrl) {
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

  return {
    complianceStatus,
    complianceScore,
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

export async function buildSiteInsight(inputUrl) {
  const context = createSiteInsightContext()
  const parsed = normalizeSubmittedUrl(inputUrl)
  await validatePublicHost(parsed.hostname, context)

  const homepage = await fetchHtml(parsed.toString(), { context })
  const metadata = extractMetaInformation(homepage.html, homepage.finalUrl)
  const accessibilityPageUrl = await resolveAccessibilityPageUrl(
    homepage.finalUrl,
    metadata.accessibilityPageUrl,
    context,
  )
  const aiContextUrl = await resolveAiContextUrl(homepage.finalUrl, metadata.aiContextUrl, context)

  let complianceStatus = null
  let complianceScore = null
  let rgaaBaseline = null
  let accessibilityPageScoreSource = null

  try {
    const compliance = await extractComplianceFromAccessibilityPage(accessibilityPageUrl, context)
    complianceStatus = compliance.complianceStatus
    complianceScore = compliance.complianceScore
    rgaaBaseline = compliance.rgaaBaseline
    accessibilityPageScoreSource = compliance.scoreSource
  } catch {
    // Accessibility page parsing is best effort and should not fail the main result.
  }

  try {
    const aiContextCompliance = await extractComplianceFromAiContext(aiContextUrl, context)

    if (aiContextCompliance.complianceScore !== null && accessibilityPageScoreSource !== 'text') {
      complianceScore = aiContextCompliance.complianceScore
    }

    if (aiContextCompliance.complianceStatus && accessibilityPageScoreSource !== 'text') {
      complianceStatus = aiContextCompliance.complianceStatus
    }

    rgaaBaseline = rgaaBaseline ?? aiContextCompliance.rgaaBaseline
  } catch {
    // AI context parsing is best effort and should not fail the main result.
  }

  if (!complianceStatus || complianceScore === null) {
    const fallback = extractCompliance(load(homepage.html).text())
    complianceStatus = complianceStatus ?? fallback.complianceStatus
    complianceScore = complianceScore ?? fallback.complianceScore
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
    rgaaBaseline: rgaaBaseline ?? DEFAULT_RGAA_BASELINE,
    updatedAt: new Date().toISOString(),
  }
}
