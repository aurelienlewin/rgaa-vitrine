import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { load } from 'cheerio'

const MAX_HTML_BYTES = 800_000
const FETCH_TIMEOUT_MS = 7000
const MAX_REDIRECTS = 5

const COMPLIANCE_LABELS = {
  full: 'Totalement conforme',
  partial: 'Partiellement conforme',
  none: 'Non conforme',
}

const accessibilityKeywords = [
  'accessibilite',
  'accessibilité',
  'declaration',
  'déclaration',
  'rgaa',
  'schema pluriannuel',
  'schéma pluriannuel',
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

async function validatePublicHost(hostname) {
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

async function fetchHtml(url, redirectCount = 0) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'Annuaire-RGAA/1.0 (+https://example.invalid)',
        accept: 'text/html,application/xhtml+xml',
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
      await validatePublicHost(nextParsedUrl.hostname)
      return fetchHtml(nextUrl, redirectCount + 1)
    }

    if (!response.ok) {
      throw new SiteInsightError(`Le site a répondu avec le statut ${response.status}.`, 502)
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml')
    if (!isHtml) {
      throw new SiteInsightError('Le contenu cible n’est pas une page HTML.', 422)
    }

    const html = await readBodyWithLimit(response, MAX_HTML_BYTES)
    return { finalUrl: url, html }
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

function extractCompliance(text) {
  const normalized = normalizeForMatch(text)

  let complianceStatus = null
  if (normalized.includes('totalement conforme')) {
    complianceStatus = 'full'
  } else if (normalized.includes('partiellement conforme')) {
    complianceStatus = 'partial'
  } else if (normalized.includes('non conforme')) {
    complianceStatus = 'none'
  }

  let complianceScore = null
  const scoreMatch = normalized.match(/taux de conformite[^\d]{0,40}(\d{1,3})(?:[.,]\d+)?\s*%/)
  if (scoreMatch) {
    const parsedScore = Number(scoreMatch[1])
    if (!Number.isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 100) {
      complianceScore = parsedScore
    }
  }

  return { complianceStatus, complianceScore }
}

function extractMetaInformation(html, baseUrl) {
  const $ = load(html)

  const siteTitle =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('meta[name="twitter:title"]').attr('content')?.trim() ||
    $('title').first().text().trim() ||
    new URL(baseUrl).hostname

  const thumbnailUrl =
    toAbsoluteUrl($('meta[property="og:image"]').attr('content')?.trim() ?? '', baseUrl) ||
    toAbsoluteUrl($('meta[name="twitter:image"]').attr('content')?.trim() ?? '', baseUrl)

  const accessibilityPageUrl = findAccessibilityPageUrl($, baseUrl)

  return {
    siteTitle,
    thumbnailUrl,
    accessibilityPageUrl,
  }
}

async function extractComplianceFromAccessibilityPage(accessibilityPageUrl) {
  if (!accessibilityPageUrl) {
    return {
      complianceStatus: null,
      complianceScore: null,
    }
  }

  const parsed = new URL(accessibilityPageUrl)
  await validatePublicHost(parsed.hostname)

  const { html } = await fetchHtml(accessibilityPageUrl)
  const text = load(html).text()
  return extractCompliance(text)
}

export async function buildSiteInsight(inputUrl) {
  const parsed = normalizeSubmittedUrl(inputUrl)
  await validatePublicHost(parsed.hostname)

  const homepage = await fetchHtml(parsed.toString())
  const metadata = extractMetaInformation(homepage.html, homepage.finalUrl)

  let complianceStatus = null
  let complianceScore = null

  try {
    const compliance = await extractComplianceFromAccessibilityPage(metadata.accessibilityPageUrl)
    complianceStatus = compliance.complianceStatus
    complianceScore = compliance.complianceScore
  } catch {
    // Accessibility page parsing is best effort and should not fail the main result.
  }

  if (!complianceStatus || complianceScore === null) {
    const fallback = extractCompliance(load(homepage.html).text())
    complianceStatus = complianceStatus ?? fallback.complianceStatus
    complianceScore = complianceScore ?? fallback.complianceScore
  }

  return {
    normalizedUrl: canonicalizeListingUrl(homepage.finalUrl),
    siteTitle: metadata.siteTitle,
    thumbnailUrl: metadata.thumbnailUrl,
    accessibilityPageUrl: metadata.accessibilityPageUrl,
    complianceStatus,
    complianceStatusLabel: complianceStatus ? COMPLIANCE_LABELS[complianceStatus] : null,
    complianceScore,
    updatedAt: new Date().toISOString(),
  }
}
