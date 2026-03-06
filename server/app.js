import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import { buildSiteInsight, SiteInsightError, validatePublicHttpUrl } from './siteInsight.js'
import { isGithubNotifierEnabled, notifyPendingModerationOnGithub } from './githubNotifier.js'
import { buildSitemapXml, resolvePublicAppUrl } from './sitemap.js'
import { buildAiContextPayload } from './aiContext.js'
import {
  buildPendingSubmission,
  buildShowcaseEntry,
  createShowcaseStorage,
  sanitizeCategory,
  ShowcaseStorageError,
} from './storage.js'

const app = express()
const showcaseStorage = createShowcaseStorage()
const AUTO_PUBLISH_STATUSES = new Set(['full', 'partial'])
const MODERATION_EDITABLE_STATUSES = new Set(['full', 'partial', 'none'])
const MODERATION_EDITABLE_RGAA_BASELINES = new Set(['4.1', '5.0-ready'])
const COMPLIANCE_LABELS = {
  full: 'Totalement conforme',
  partial: 'Partiellement conforme',
  none: 'Non conforme',
}
const SUSPICIOUS_MARKETING_TOKENS = [
  'casino',
  'bet',
  'paris sportif',
  'porn',
  'viagra',
  'seo',
  'backlink',
  'linkbuilding',
  'guest post',
  'crypto airdrop',
]
const VOTE_FINGERPRINT_SALT = process.env.VOTE_FINGERPRINT_SALT ?? 'annuaire-rgaa-votes'
const MAX_ARCHIVE_IMPORT_BYTES = 2_000_000
const MAX_SHOWCASE_ENTRY_LIMIT = 500
const MAX_PENDING_ARCHIVE_SCAN_LIMIT = 200
const MIN_MODERATION_TOKEN_LENGTH = 32
const ARCHIVE_FORMAT = 'annuaire-rgaa-archive'
const ARCHIVE_VERSION = 1
const ARCHIVE_INTEGRITY_ALGORITHM = 'hmac-sha256'
const MIN_ARCHIVE_SIGNING_SECRET_LENGTH = 32
const PUBLIC_SUBMISSION_CATEGORY_FALLBACK = 'Autre'
const PUBLIC_SUBMISSION_CATEGORIES = [
  'Administration',
  'E-commerce',
  'Media',
  'Sante',
  'Education',
  'Associatif',
  'Coopérative et services',
  PUBLIC_SUBMISSION_CATEGORY_FALLBACK,
]
const PUBLIC_SUBMISSION_CATEGORY_BY_NORMALIZED = new Map(
  PUBLIC_SUBMISSION_CATEGORIES.map((category) => [normalizeForMatch(category), category]),
)
PUBLIC_SUBMISSION_CATEGORY_BY_NORMALIZED.set(
  normalizeForMatch('Cooperative et services'),
  'Coopérative et services',
)

app.disable('x-powered-by')
app.set('trust proxy', false)

function readModerationToken() {
  const value = process.env.MODERATION_API_TOKEN
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function isStrongModerationToken(token) {
  return typeof token === 'string' && token.length >= MIN_MODERATION_TOKEN_LENGTH
}

function readArchiveSigningSecret() {
  const rawValue = process.env.MODERATION_ARCHIVE_SIGNING_SECRET
  if (typeof rawValue !== 'string') {
    return null
  }

  const trimmed = rawValue.trim()
  return trimmed || null
}

function isStrongArchiveSigningSecret(secret) {
  return typeof secret === 'string' && secret.length >= MIN_ARCHIVE_SIGNING_SECRET_LENGTH
}

function sendJsonError(response, statusCode, message) {
  response.status(statusCode).json({ error: message })
}

function firstQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function isPreviewRequested(request) {
  const queryValue = firstQueryValue(request.query.preview)
  if (typeof queryValue === 'string') {
    const normalized = queryValue.trim().toLowerCase()
    if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
      return true
    }
  }

  return request.body?.preview === true
}

function parseAuthorizationToken(request) {
  const authorization = request.get('authorization')
  if (typeof authorization !== 'string') {
    return null
  }

  const [scheme, token] = authorization.split(' ')
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null
  }

  return token.trim() || null
}

function safeTokenEquals(left, right) {
  const leftBuffer = Buffer.from(left, 'utf8')
  const rightBuffer = Buffer.from(right, 'utf8')

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function stableStringify(value) {
  if (value === null || value === undefined) {
    return 'null'
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'null'
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey, 'en'))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    return `{${entries.join(',')}}`
  }

  return JSON.stringify(String(value))
}

function buildArchiveSignaturePayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {}
  const sourceData = source.data && typeof source.data === 'object' ? source.data : source
  return {
    format: typeof source.format === 'string' ? source.format : null,
    version: Number.isInteger(source.version) ? source.version : null,
    exportedAt: typeof source.exportedAt === 'string' ? source.exportedAt : null,
    storageMode: typeof source.storageMode === 'string' ? source.storageMode : null,
    data: sourceData,
  }
}

function computeArchiveIntegritySignature(payload, secret) {
  const signingPayload = buildArchiveSignaturePayload(payload)
  const canonical = stableStringify(signingPayload)
  return createHmac('sha256', secret).update(canonical, 'utf8').digest('hex')
}

function readArchiveEnvelopeMetadata(payload) {
  if (!payload || typeof payload !== 'object') {
    return { error: 'Archive invalide.' }
  }

  if (payload.format !== undefined && payload.format !== ARCHIVE_FORMAT) {
    return { error: `Format d’archive invalide. Valeur attendue: ${ARCHIVE_FORMAT}.` }
  }

  if (payload.version !== undefined && payload.version !== ARCHIVE_VERSION) {
    return { error: `Version d’archive invalide. Valeur attendue: ${ARCHIVE_VERSION}.` }
  }

  if (payload.exportedAt === undefined) {
    return { exportedAtIso: null }
  }

  if (typeof payload.exportedAt !== 'string') {
    return { error: 'Champ exportedAt invalide.' }
  }

  const parsed = Date.parse(payload.exportedAt)
  if (Number.isNaN(parsed)) {
    return { error: 'Champ exportedAt invalide.' }
  }

  return { exportedAtIso: new Date(parsed).toISOString() }
}

function readArchiveIntegrity(payload) {
  if (!payload || typeof payload !== 'object') {
    return { present: false, error: null, signature: null }
  }

  if (payload.integrity === undefined) {
    return { present: false, error: null, signature: null }
  }

  const integrity = payload.integrity
  if (!integrity || typeof integrity !== 'object') {
    return { present: true, error: 'Bloc integrity invalide.', signature: null }
  }

  const algorithm = typeof integrity.algorithm === 'string' ? integrity.algorithm.trim().toLowerCase() : ''
  if (algorithm !== ARCHIVE_INTEGRITY_ALGORITHM) {
    return {
      present: true,
      error: `Algorithme integrity invalide. Valeur attendue: ${ARCHIVE_INTEGRITY_ALGORITHM}.`,
      signature: null,
    }
  }

  const signature = typeof integrity.signature === 'string' ? integrity.signature.trim().toLowerCase() : ''
  if (!/^[a-f0-9]{64}$/.test(signature)) {
    return { present: true, error: 'Signature integrity invalide.', signature: null }
  }

  return { present: true, error: null, signature }
}

function withArchiveIntegrity(payload, secret) {
  return {
    ...payload,
    integrity: {
      algorithm: ARCHIVE_INTEGRITY_ALGORITHM,
      signature: computeArchiveIntegritySignature(payload, secret),
    },
  }
}

function readNewestIsoTimestamp(candidates) {
  let latestTimestamp = 0

  for (const candidate of candidates) {
    const parsed = Date.parse(String(candidate ?? ''))
    if (Number.isNaN(parsed)) {
      continue
    }
    latestTimestamp = Math.max(latestTimestamp, parsed)
  }

  if (latestTimestamp <= 0) {
    return null
  }

  return new Date(latestTimestamp).toISOString()
}

async function readLatestStoredDataTimestampIso() {
  const [entries, pendingEntries] = await Promise.all([
    showcaseStorage.list({ limit: MAX_SHOWCASE_ENTRY_LIMIT }),
    showcaseStorage.listPending({ limit: MAX_PENDING_ARCHIVE_SCAN_LIMIT }),
  ])

  const latestEntryUpdatedAt = Array.isArray(entries) && entries[0] ? entries[0].updatedAt : null
  const latestPendingCreatedAt = Array.isArray(pendingEntries) && pendingEntries[0] ? pendingEntries[0].createdAt : null
  return readNewestIsoTimestamp([latestEntryUpdatedAt, latestPendingCreatedAt])
}

function extractSubmissionId(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 200) {
    return null
  }

  return trimmed
}

function extractNormalizedUrl(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 400) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null
    }
  } catch {
    return null
  }

  return trimmed
}

function parseScoreForModeration(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null
  }

  return Math.round(parsed * 100) / 100
}

function parseRgaaBaselineForModeration(value, fallback = '4.1') {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!MODERATION_EDITABLE_RGAA_BASELINES.has(trimmed)) {
    return null
  }

  return trimmed
}

function parseBooleanFlag(value) {
  if (value === true || value === false) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false
    }
  }

  return null
}

function parseArchiveImportMode(value) {
  if (value === 'merge' || value === 'replace') {
    return value
  }
  return null
}

function extractClientVoterId(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (!/^[a-zA-Z0-9_-]{16,120}$/.test(trimmed)) {
    return null
  }

  return trimmed
}

function readCandidateIp(rawValue) {
  if (typeof rawValue !== 'string') {
    return null
  }

  const first = rawValue.split(',')[0]?.trim().replace(/^\[|\]$/g, '')
  if (!first || first.length > 100) {
    return null
  }

  if (isIP(first) === 0) {
    return null
  }

  return first
}

function readRequestIp(request) {
  return (
    readCandidateIp(request.get('x-vercel-forwarded-for')) ||
    readCandidateIp(request.get('cf-connecting-ip')) ||
    readCandidateIp(request.get('x-forwarded-for')) ||
    readCandidateIp(request.ip) ||
    readCandidateIp(request.socket?.remoteAddress ?? '') ||
    'unknown-ip'
  )
}

function createFingerprint(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 48)
}

function buildClientVoteIndexId(clientVoterId) {
  if (!clientVoterId) {
    return null
  }

  return `client:${createFingerprint(`${VOTE_FINGERPRINT_SALT}|client-index|${clientVoterId}`)}`
}

function buildVoteFingerprints(request, clientVoterId, normalizedUrl) {
  const userAgent = request.get('user-agent')?.trim().slice(0, 220) ?? 'unknown-ua'
  const requestIp = readRequestIp(request)

  const ipFingerprint = createFingerprint(
    `${VOTE_FINGERPRINT_SALT}|${normalizedUrl}|ip|${requestIp}|ua|${userAgent}`,
  )
  const ipOnlyFingerprint = createFingerprint(`${VOTE_FINGERPRINT_SALT}|${normalizedUrl}|ip-only|${requestIp}`)

  const fingerprints = {
    ip: `ip:${ipFingerprint}`,
    ipOnly: `ip-only:${ipOnlyFingerprint}`,
  }

  if (clientVoterId) {
    const clientFingerprint = createFingerprint(
      `${VOTE_FINGERPRINT_SALT}|${normalizedUrl}|client|${clientVoterId}`,
    )
    fingerprints.client = `client:${clientFingerprint}`
  }

  return fingerprints
}

function normalizeForMatch(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function sanitizeSlugPart(value) {
  return normalizeForMatch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function computeShortHash(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash.toString(36).padStart(6, '0').slice(0, 6)
}

function buildShowcaseEntrySlug(normalizedUrl) {
  try {
    const parsed = new URL(normalizedUrl)
    const hostSlug = sanitizeSlugPart(parsed.hostname.replace(/^www\./i, '')) || 'site'
    const pathParts = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => sanitizeSlugPart(segment))
      .filter(Boolean)
      .slice(0, 2)
    const base = [hostSlug, ...pathParts].join('-').slice(0, 84).replace(/-+$/g, '')
    return `${base || hostSlug}-${computeShortHash(normalizedUrl)}`
  } catch {
    return `site-${computeShortHash(normalizedUrl)}`
  }
}

function extractShowcaseSlug(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  if (!/^[a-z0-9-]{4,120}$/.test(trimmed)) {
    return null
  }

  return trimmed
}

function withShowcasePublicMetadata(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.normalizedUrl !== 'string') {
    return entry
  }

  const slug = buildShowcaseEntrySlug(entry.normalizedUrl)
  return {
    ...entry,
    slug,
    profilePath: `/site/${slug}`,
  }
}

function sanitizePublicSubmissionCategory(value) {
  const sanitizedCategory = sanitizeCategory(value)
  const normalized = normalizeForMatch(sanitizedCategory)
  return PUBLIC_SUBMISSION_CATEGORY_BY_NORMALIZED.get(normalized) ?? PUBLIC_SUBMISSION_CATEGORY_FALLBACK
}

function requireModerationAuth(request, response, next) {
  const configuredToken = readModerationToken()
  if (!configuredToken) {
    sendJsonError(
      response,
      503,
      'Modération indisponible: définissez MODERATION_API_TOKEN pour activer la validation manuelle.',
    )
    return
  }

  if (!isStrongModerationToken(configuredToken)) {
    sendJsonError(
      response,
      503,
      `Modération indisponible: MODERATION_API_TOKEN doit contenir au moins ${MIN_MODERATION_TOKEN_LENGTH} caractères.`,
    )
    return
  }

  const providedToken =
    request.get('x-moderation-token')?.trim() ||
    parseAuthorizationToken(request)

  if (!providedToken || !safeTokenEquals(providedToken, configuredToken)) {
    sendJsonError(response, 401, 'Accès modération refusé.')
    return
  }

  next()
}

function findSuspiciousMarketingToken(siteInsight) {
  const title = typeof siteInsight.siteTitle === 'string' ? siteInsight.siteTitle.trim() : ''
  if (title.length < 3 || title.length > 120) {
    return 'title-length'
  }

  const haystack = normalizeForMatch(`${siteInsight.siteTitle} ${siteInsight.normalizedUrl}`)
  return SUSPICIOUS_MARKETING_TOKENS.find((token) => haystack.includes(token)) ?? null
}

function getManualReviewReason(siteInsight) {
  if (!siteInsight.accessibilityPageUrl) {
    return 'Aucune déclaration d’accessibilité détectée.'
  }

  if (!AUTO_PUBLISH_STATUSES.has(siteInsight.complianceStatus ?? '')) {
    return "Niveau de conformité insuffisant pour publication automatique."
  }

  return null
}

function readMostRecentUpdatedAt(entries) {
  const latestTimestamp = entries.reduce((currentLatest, entry) => {
    const updatedAt = Date.parse(entry.updatedAt)
    if (Number.isNaN(updatedAt)) {
      return currentLatest
    }
    return Math.max(currentLatest, updatedAt)
  }, 0)

  return latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : new Date().toISOString()
}

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
)

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, response, _next, options) => {
      sendJsonError(
        response,
        options.statusCode,
        'Trop de requêtes. Merci de réessayer dans quelques minutes.',
      )
    },
  }),
)

app.use(express.json({ limit: '3mb' }))

const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Trop de soumissions. Merci de réessayer dans une heure.",
  },
})

const voteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Trop de votes. Merci de réessayer dans une heure.",
  },
})

const moderationAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: 'Trop de tentatives d’accès modération. Réessayez dans quelques minutes.',
  },
})

app.use('/api/moderation', moderationAuthLimiter)

app.get(['/sitemap.xml', '/api/sitemap'], async (_request, response) => {
  const baseUrl = resolvePublicAppUrl()
  let lastModified = new Date().toISOString()
  let siteProfileEntries = []

  try {
    const [entries, blockedUrls] = await Promise.all([
      showcaseStorage.list({ limit: MAX_SHOWCASE_ENTRY_LIMIT }),
      showcaseStorage.listSiteBlocklist(),
    ])
    const blockedSet = new Set(blockedUrls)
    const visibleEntries = entries.filter((entry) => !blockedSet.has(entry.normalizedUrl))
    lastModified = readMostRecentUpdatedAt(entries)

    const profileBySlug = new Map()
    for (const entry of visibleEntries) {
      const slug = buildShowcaseEntrySlug(entry.normalizedUrl)
      const current = profileBySlug.get(slug)
      if (!current || Date.parse(entry.updatedAt) > Date.parse(current.updatedAt)) {
        profileBySlug.set(slug, entry)
      }
    }

    siteProfileEntries = Array.from(profileBySlug.entries()).map(([slug, entry]) => ({
      path: `/site/${slug}`,
      lastModified: entry.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.7,
    }))
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      console.error('Sitemap uses fallback date because storage is unavailable', error.message)
    } else {
      console.error('Unexpected sitemap generation error', error)
    }
  }

  const sitemapXml = buildSitemapXml(baseUrl, [
    {
      path: '/',
      lastModified,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      path: '/plan-du-site',
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      path: '/accessibilite',
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      path: '/ai-context.json',
      lastModified,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      path: '/api/showcase',
      lastModified,
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      path: '/llms.txt',
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      path: '/llms-full.txt',
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...siteProfileEntries,
  ])

  response.setHeader('content-type', 'application/xml; charset=utf-8')
  response.setHeader('cache-control', 'no-store, max-age=0')
  response.status(200).send(sitemapXml)
})

app.get(['/ai-context.json', '/api/ai-context'], async (_request, response) => {
  const baseUrl = resolvePublicAppUrl()
  let entries = []

  try {
    entries = (await showcaseStorage.list({ limit: MAX_SHOWCASE_ENTRY_LIMIT }))
      .map((entry) => withShowcasePublicMetadata(entry))
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      console.error('AI context uses empty dataset because storage is unavailable', error.message)
    } else {
      console.error('Unexpected AI context generation error', error)
    }
  }

  const payload = buildAiContextPayload({ baseUrl, entries })
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600')
  response.status(200).json(payload)
})

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    storage: showcaseStorage.mode,
    moderation: {
      enabled: Boolean(readModerationToken()),
    },
    notifications: {
      githubIssues: isGithubNotifierEnabled(),
    },
  })
})

app.get('/api/showcase', async (request, response) => {
  try {
    const slugFilter = extractShowcaseSlug(firstQueryValue(request.query.slug))
    const entries = await showcaseStorage.list({
      search: firstQueryValue(request.query.search),
      status: firstQueryValue(request.query.status),
      category: firstQueryValue(request.query.category),
      limit: slugFilter ? MAX_SHOWCASE_ENTRY_LIMIT : firstQueryValue(request.query.limit),
    })
    const siteBlocklist = new Set(await showcaseStorage.listSiteBlocklist())
    const voteBlocklist = new Set(await showcaseStorage.listVoteBlocklist())
    const visibleEntries = entries.filter((entry) => !siteBlocklist.has(entry.normalizedUrl))

    const clientVoterId = extractClientVoterId(firstQueryValue(request.query.clientVoterId))
    const clientVoteIndexId = buildClientVoteIndexId(clientVoterId)
    const votedUrls = clientVoteIndexId ? await showcaseStorage.listClientVotedUrls(clientVoteIndexId) : new Set()
    const entriesWithVoteState = visibleEntries.map((entry) => ({
      ...entry,
      hasUpvoted: clientVoteIndexId ? votedUrls.has(entry.normalizedUrl) : false,
      votesBlocked: voteBlocklist.has(entry.normalizedUrl),
    })).map((entry) => withShowcasePublicMetadata(entry))
    const filteredEntries = slugFilter
      ? entriesWithVoteState.filter((entry) => entry.slug === slugFilter)
      : entriesWithVoteState
    const lastModifiedSource = filteredEntries.length > 0 ? filteredEntries : entriesWithVoteState

    response.setHeader('cache-control', 'public, max-age=120, s-maxage=120, stale-while-revalidate=600')
    response.setHeader('last-modified', readMostRecentUpdatedAt(lastModifiedSource))
    response.json({
      entries: filteredEntries,
      total: filteredEntries.length,
      storage: showcaseStorage.mode,
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/showcase', error)
    sendJsonError(response, 500, 'Erreur lors de la lecture de la vitrine.')
  }
})

app.post('/api/showcase/upvote', voteLimiter, async (request, response) => {
  const normalizedUrl = extractNormalizedUrl(request.body?.normalizedUrl)
  if (!normalizedUrl) {
    sendJsonError(response, 400, 'normalizedUrl est obligatoire.')
    return
  }

  const clientVoterId = extractClientVoterId(request.body?.clientVoterId)
  if (!clientVoterId) {
    sendJsonError(response, 400, 'clientVoterId est obligatoire.')
    return
  }

  try {
    const isSiteBlocked = await showcaseStorage.isSiteBlocked(normalizedUrl)
    if (isSiteBlocked) {
      sendJsonError(response, 423, 'Votes indisponibles: ce site est bloqué par la modération.')
      return
    }

    const isVotesBlocked = await showcaseStorage.isVotesBlocked(normalizedUrl)
    if (isVotesBlocked) {
      sendJsonError(response, 423, 'Votes temporairement indisponibles pour ce site.')
      return
    }

    const fingerprints = buildVoteFingerprints(request, clientVoterId, normalizedUrl)
    const clientVoteIndexId = buildClientVoteIndexId(clientVoterId)
    const voteResult = await showcaseStorage.registerUpvote(normalizedUrl, fingerprints, clientVoteIndexId)
    if (!voteResult) {
      sendJsonError(response, 404, 'Entrée introuvable dans l’annuaire.')
      return
    }

    response.json({
      ...withShowcasePublicMetadata(voteResult.entry),
      hasUpvoted: true,
      votesBlocked: false,
      alreadyVoted: voteResult.alreadyVoted,
      upvoteAccepted: voteResult.accepted,
      message: voteResult.accepted ? 'Vote enregistré.' : 'Vote déjà pris en compte.',
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/showcase/upvote', error)
    sendJsonError(response, 500, 'Erreur interne lors de l’enregistrement du vote.')
  }
})

app.post('/api/site-insight', submissionLimiter, async (request, response) => {
  const url = request.body?.url
  const category = request.body?.category
  const honeypot = request.body?.website
  const previewMode = isPreviewRequested(request)

  if (typeof url !== 'string') {
    sendJsonError(response, 400, 'Le champ URL est obligatoire.')
    return
  }

  if (typeof honeypot === 'string' && honeypot.trim()) {
    sendJsonError(response, 400, 'Soumission invalide.')
    return
  }

  try {
    const insight = await buildSiteInsight(url)
    const normalizedInsight = {
      ...insight,
      rgaaBaseline: '4.1',
      rgaaBaselineEdited: false,
    }
    const isBlocked = await showcaseStorage.isSiteBlocked(normalizedInsight.normalizedUrl)
    if (isBlocked) {
      sendJsonError(
        response,
        423,
        'Soumission refusée: ce site est actuellement bloqué par la modération.',
      )
      return
    }

    const sanitizedCategory = sanitizePublicSubmissionCategory(category)
    const existingEntry = await showcaseStorage.getByNormalizedUrl(normalizedInsight.normalizedUrl)

    if (existingEntry) {
      response.json({
        ...withShowcasePublicMetadata(existingEntry),
        submissionStatus: 'duplicate',
        preview: previewMode,
        message: 'Ce site est déjà référencé dans la vitrine.',
      })
      return
    }

    const existingPending = await showcaseStorage.getPendingByNormalizedUrl(normalizedInsight.normalizedUrl)
    if (existingPending) {
      response.status(202).json({
        ...withShowcasePublicMetadata(existingPending),
        submissionStatus: 'pending',
        preview: previewMode,
        message: 'Ce site est déjà en attente de validation manuelle.',
      })
      return
    }

    const suspiciousToken = findSuspiciousMarketingToken(normalizedInsight)
    if (suspiciousToken) {
      sendJsonError(
        response,
        422,
        'Soumission rejetée: le site ne correspond pas aux critères qualité de la vitrine RGAA.',
      )
      return
    }

    const manualReviewReason = getManualReviewReason(normalizedInsight)
    if (previewMode) {
      const previewStatus = manualReviewReason ? 'pending' : 'approved'
      const previewMessage = manualReviewReason
        ? `Pré-analyse terminée: ${manualReviewReason}`
        : 'Pré-analyse terminée. Le site est prêt pour confirmation.'

      response.status(previewStatus === 'pending' ? 202 : 200).json({
        ...withShowcasePublicMetadata(normalizedInsight),
        category: sanitizedCategory,
        submissionStatus: previewStatus,
        preview: true,
        message: previewMessage,
      })
      return
    }

    if (manualReviewReason) {
      const pendingSubmission = buildPendingSubmission(normalizedInsight, sanitizedCategory, manualReviewReason)
      const savedPendingSubmission = await showcaseStorage.upsertPending(pendingSubmission)

      if (isGithubNotifierEnabled()) {
        try {
          await notifyPendingModerationOnGithub(savedPendingSubmission)
        } catch (notificationError) {
          console.error('GitHub moderation notification failed', notificationError)
        }
      }

      response.status(202).json({
        ...withShowcasePublicMetadata(savedPendingSubmission),
        submissionStatus: 'pending',
        message:
          'Soumission reçue. Elle est enregistrée en file de validation manuelle avant publication.',
      })
      return
    }

    const showcaseEntry = buildShowcaseEntry(normalizedInsight, sanitizedCategory)
    const persistedEntry = await showcaseStorage.upsert(showcaseEntry)
    response.json({
      ...withShowcasePublicMetadata(persistedEntry),
      submissionStatus: 'approved',
      message: 'Site publié dans la vitrine.',
    })
  } catch (error) {
    if (error instanceof SiteInsightError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/site-insight', error)
    sendJsonError(response, 500, 'Erreur interne lors de l’analyse.')
  }
})

app.get('/api/moderation/pending', requireModerationAuth, async (request, response) => {
  try {
    const pendingEntries = await showcaseStorage.listPending({
      limit: firstQueryValue(request.query.limit),
    })

    response.json({
      entries: pendingEntries,
      total: pendingEntries.length,
      storage: showcaseStorage.mode,
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/pending', error)
    sendJsonError(response, 500, 'Erreur interne lors de la lecture de la file de modération.')
  }
})

app.get('/api/moderation/showcase', requireModerationAuth, async (request, response) => {
  try {
    const entries = await showcaseStorage.list({
      search: firstQueryValue(request.query.search),
      status: firstQueryValue(request.query.status),
      category: firstQueryValue(request.query.category),
      limit: firstQueryValue(request.query.limit ?? 200),
    })
    const siteBlocklist = new Set(await showcaseStorage.listSiteBlocklist())
    const voteBlocklist = new Set(await showcaseStorage.listVoteBlocklist())
    const entriesWithModerationState = entries.map((entry) => ({
      ...withShowcasePublicMetadata(entry),
      siteBlocked: siteBlocklist.has(entry.normalizedUrl),
      votesBlocked: voteBlocklist.has(entry.normalizedUrl),
    }))

    response.json({
      entries: entriesWithModerationState,
      total: entriesWithModerationState.length,
      storage: showcaseStorage.mode,
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/showcase', error)
    sendJsonError(response, 500, 'Erreur interne lors de la lecture de l’annuaire.')
  }
})

app.get('/api/moderation/blocklist', requireModerationAuth, async (_request, response) => {
  try {
    const siteBlocklist = await showcaseStorage.listSiteBlocklist()
    const voteBlocklist = await showcaseStorage.listVoteBlocklist()

    response.json({
      siteBlocklist,
      voteBlocklist,
      storage: showcaseStorage.mode,
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/blocklist', error)
    sendJsonError(response, 500, 'Erreur interne lors de la lecture des listes de blocage.')
  }
})

app.post('/api/moderation/blocklist/site', requireModerationAuth, async (request, response) => {
  const normalizedUrl = extractNormalizedUrl(request.body?.normalizedUrl)
  if (!normalizedUrl) {
    sendJsonError(response, 400, 'normalizedUrl est obligatoire.')
    return
  }

  const blocked = parseBooleanFlag(request.body?.blocked)
  if (blocked === null) {
    sendJsonError(response, 400, 'blocked doit être un booléen.')
    return
  }

  try {
    await showcaseStorage.setSiteBlocked(normalizedUrl, blocked)
    const currentBlocklist = await showcaseStorage.listSiteBlocklist()

    response.json({
      normalizedUrl,
      blocked,
      siteBlocklist: currentBlocklist,
      message: blocked
        ? 'Site ajouté à la blocklist.'
        : 'Site retiré de la blocklist.',
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/blocklist/site', error)
    sendJsonError(response, 500, 'Erreur interne lors de la mise à jour de la blocklist.')
  }
})

app.post('/api/moderation/blocklist/votes', requireModerationAuth, async (request, response) => {
  const normalizedUrl = extractNormalizedUrl(request.body?.normalizedUrl)
  if (!normalizedUrl) {
    sendJsonError(response, 400, 'normalizedUrl est obligatoire.')
    return
  }

  const blocked = parseBooleanFlag(request.body?.blocked)
  if (blocked === null) {
    sendJsonError(response, 400, 'blocked doit être un booléen.')
    return
  }

  try {
    await showcaseStorage.setVotesBlocked(normalizedUrl, blocked)
    const currentVoteBlocklist = await showcaseStorage.listVoteBlocklist()

    response.json({
      normalizedUrl,
      blocked,
      voteBlocklist: currentVoteBlocklist,
      message: blocked
        ? 'Votes bloqués pour ce site.'
        : 'Blocage des votes levé pour ce site.',
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/blocklist/votes', error)
    sendJsonError(response, 500, 'Erreur interne lors de la mise à jour du blocage des votes.')
  }
})

app.get('/api/moderation/archive', requireModerationAuth, async (_request, response) => {
  try {
    const archivePayload = await showcaseStorage.exportArchive()
    const archiveSigningSecret = readArchiveSigningSecret()
    if (archiveSigningSecret && !isStrongArchiveSigningSecret(archiveSigningSecret)) {
      sendJsonError(
        response,
        503,
        `Archivage signé indisponible: MODERATION_ARCHIVE_SIGNING_SECRET doit contenir au moins ${MIN_ARCHIVE_SIGNING_SECRET_LENGTH} caractères.`,
      )
      return
    }

    const responsePayload =
      archiveSigningSecret && isStrongArchiveSigningSecret(archiveSigningSecret)
        ? withArchiveIntegrity(archivePayload, archiveSigningSecret)
        : archivePayload
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.setHeader('content-disposition', `attachment; filename="annuaire-rgaa-archive-${timestamp}.json"`)
    response.setHeader('cache-control', 'no-store')
    response.status(200).json(responsePayload)
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/archive', error)
    sendJsonError(response, 500, 'Erreur lors de l’export de la base.')
  }
})

app.post('/api/moderation/archive/import', requireModerationAuth, async (request, response) => {
  const mode = parseArchiveImportMode(request.body?.mode)
  if (!mode) {
    sendJsonError(response, 400, 'Mode d’import invalide. Utilisez merge ou replace.')
    return
  }

  const archivePayload =
    request.body?.archive && typeof request.body.archive === 'object'
      ? request.body.archive
      : request.body

  if (!archivePayload || typeof archivePayload !== 'object') {
    sendJsonError(response, 400, 'Archive invalide.')
    return
  }

  const envelope = readArchiveEnvelopeMetadata(archivePayload)
  if (envelope.error) {
    sendJsonError(response, 400, envelope.error)
    return
  }

  const allowRollbackRaw = request.body?.allowRollback
  const allowRollbackFlag = parseBooleanFlag(allowRollbackRaw)
  if (allowRollbackRaw !== undefined && allowRollbackFlag === null) {
    sendJsonError(response, 400, 'allowRollback doit être un booléen.')
    return
  }
  const allowRollback = allowRollbackFlag === true

  const archiveSigningSecret = readArchiveSigningSecret()
  if (archiveSigningSecret && !isStrongArchiveSigningSecret(archiveSigningSecret)) {
    sendJsonError(
      response,
      503,
      `Import signé indisponible: MODERATION_ARCHIVE_SIGNING_SECRET doit contenir au moins ${MIN_ARCHIVE_SIGNING_SECRET_LENGTH} caractères.`,
    )
    return
  }

  if (archiveSigningSecret) {
    const integrity = readArchiveIntegrity(archivePayload)
    if (integrity.error) {
      sendJsonError(response, 400, integrity.error)
      return
    }

    if (!integrity.present || !integrity.signature) {
      sendJsonError(response, 400, 'Signature d’archive requise pour cet environnement.')
      return
    }

    const expectedSignature = computeArchiveIntegritySignature(archivePayload, archiveSigningSecret)
    if (!safeTokenEquals(integrity.signature, expectedSignature)) {
      sendJsonError(response, 400, 'Signature d’archive invalide.')
      return
    }
  }

  const payloadSize = Buffer.byteLength(JSON.stringify(archivePayload), 'utf8')
  if (payloadSize > MAX_ARCHIVE_IMPORT_BYTES) {
    sendJsonError(response, 413, 'Archive trop volumineuse pour import.')
    return
  }

  try {
    if (mode === 'replace' && !allowRollback) {
      if (!envelope.exportedAtIso) {
        sendJsonError(
          response,
          400,
          'Le champ exportedAt est requis pour un import replace sécurisé (ou activez allowRollback).',
        )
        return
      }

      const currentLatestTimestampIso = await readLatestStoredDataTimestampIso()
      if (currentLatestTimestampIso) {
        const archiveTimestamp = Date.parse(envelope.exportedAtIso)
        const currentTimestamp = Date.parse(currentLatestTimestampIso)
        if (!Number.isNaN(archiveTimestamp) && !Number.isNaN(currentTimestamp) && archiveTimestamp < currentTimestamp) {
          sendJsonError(
            response,
            409,
            'Archive plus ancienne que les données actuelles. Définissez allowRollback=true pour forcer ce remplacement.',
          )
          return
        }
      }
    }

    const importResult = await showcaseStorage.importArchive(archivePayload, mode)
    response.json({
      mode,
      ...importResult,
      message:
        mode === 'replace'
          ? 'Archive importée en mode remplacement.'
          : 'Archive importée en mode fusion.',
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/archive/import', error)
    sendJsonError(response, 500, 'Erreur lors de l’import de la base.')
  }
})

app.post('/api/moderation/approve', requireModerationAuth, async (request, response) => {
  const submissionId = extractSubmissionId(request.body?.submissionId)
  if (!submissionId) {
    sendJsonError(response, 400, 'submissionId est obligatoire.')
    return
  }

  try {
    const pendingEntry = await showcaseStorage.getPendingById(submissionId)
    if (!pendingEntry) {
      sendJsonError(response, 404, 'Soumission en attente introuvable.')
      return
    }

    const isBlocked = await showcaseStorage.isSiteBlocked(pendingEntry.normalizedUrl)
    if (isBlocked) {
      sendJsonError(response, 423, 'Impossible d’approuver: ce site est dans la blocklist.')
      return
    }

    const existingEntry = await showcaseStorage.getByNormalizedUrl(pendingEntry.normalizedUrl)
    if (existingEntry) {
      await showcaseStorage.deletePendingById(submissionId)
      response.json({
        ...withShowcasePublicMetadata(existingEntry),
        submissionStatus: 'duplicate',
        message: 'Le site était déjà publié. La soumission en attente a été supprimée.',
      })
      return
    }

    const approvedEntry = buildShowcaseEntry(
      {
        normalizedUrl: pendingEntry.normalizedUrl,
        siteTitle: pendingEntry.siteTitle,
        thumbnailUrl: pendingEntry.thumbnailUrl,
        accessibilityPageUrl: pendingEntry.accessibilityPageUrl,
        complianceStatus: pendingEntry.complianceStatus,
        complianceStatusLabel: pendingEntry.complianceStatusLabel,
        complianceScore: pendingEntry.complianceScore,
        rgaaBaseline: pendingEntry.rgaaBaseline,
        updatedAt: new Date().toISOString(),
      },
      pendingEntry.category,
    )

    const savedEntry = await showcaseStorage.upsert(approvedEntry)
    await showcaseStorage.deletePendingById(submissionId)

    response.json({
      ...withShowcasePublicMetadata(savedEntry),
      submissionStatus: 'approved',
      message: 'Soumission approuvée et publiée dans l’annuaire.',
      moderation: {
        submissionId,
      },
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/approve', error)
    sendJsonError(response, 500, 'Erreur interne lors de la validation.')
  }
})

app.post('/api/moderation/reject', requireModerationAuth, async (request, response) => {
  const submissionId = extractSubmissionId(request.body?.submissionId)
  if (!submissionId) {
    sendJsonError(response, 400, 'submissionId est obligatoire.')
    return
  }

  const rawReason = request.body?.reason
  const reason = typeof rawReason === 'string' && rawReason.trim() ? rawReason.trim().slice(0, 300) : null

  try {
    const pendingEntry = await showcaseStorage.getPendingById(submissionId)
    if (!pendingEntry) {
      sendJsonError(response, 404, 'Soumission en attente introuvable.')
      return
    }

    await showcaseStorage.deletePendingById(submissionId)
    response.json({
      submissionStatus: 'rejected',
      submissionId,
      normalizedUrl: pendingEntry.normalizedUrl,
      message: reason
        ? `Soumission rejetée: ${reason}`
        : 'Soumission rejetée et supprimée de la file de modération.',
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/reject', error)
    sendJsonError(response, 500, 'Erreur interne lors du rejet.')
  }
})

app.post('/api/moderation/showcase/update', requireModerationAuth, async (request, response) => {
  const normalizedUrl = extractNormalizedUrl(request.body?.normalizedUrl)
  if (!normalizedUrl) {
    sendJsonError(response, 400, 'normalizedUrl est obligatoire.')
    return
  }

  try {
    const existingEntry = await showcaseStorage.getByNormalizedUrl(normalizedUrl)
    if (!existingEntry) {
      sendJsonError(response, 404, 'Entrée introuvable dans l’annuaire.')
      return
    }

    const nextSiteTitleRaw = request.body?.siteTitle
    const nextSiteTitle = typeof nextSiteTitleRaw === 'string' ? nextSiteTitleRaw.trim().slice(0, 160) : ''
    if (!nextSiteTitle) {
      sendJsonError(response, 400, 'siteTitle est obligatoire.')
      return
    }

    const nextCategory = sanitizeCategory(request.body?.category)
    const rawStatus = request.body?.complianceStatus
    const statusCandidate = typeof rawStatus === 'string' ? rawStatus.trim() : ''
    const nextComplianceStatus = MODERATION_EDITABLE_STATUSES.has(statusCandidate) ? statusCandidate : null

    const scoreCandidate = parseScoreForModeration(request.body?.complianceScore)
    if (request.body?.complianceScore !== null && request.body?.complianceScore !== undefined && request.body?.complianceScore !== '' && scoreCandidate === null) {
      sendJsonError(response, 400, 'complianceScore doit être un nombre entre 0 et 100.')
      return
    }
    const nextRgaaBaseline = parseRgaaBaselineForModeration(request.body?.rgaaBaseline, existingEntry.rgaaBaseline ?? '4.1')
    if (!nextRgaaBaseline) {
      sendJsonError(response, 400, 'rgaaBaseline doit être `4.1` ou `5.0-ready`.')
      return
    }

    const thumbnailRaw = typeof request.body?.thumbnailUrl === 'string' ? request.body.thumbnailUrl.trim() : ''
    const accessibilityRaw =
      typeof request.body?.accessibilityPageUrl === 'string' ? request.body.accessibilityPageUrl.trim() : ''

    let nextThumbnailUrl = null
    let nextAccessibilityPageUrl = null

    if (thumbnailRaw) {
      nextThumbnailUrl = await validatePublicHttpUrl(thumbnailRaw)
    }

    if (accessibilityRaw) {
      nextAccessibilityPageUrl = await validatePublicHttpUrl(accessibilityRaw)
    }

    const updatedEntry = {
      ...existingEntry,
      siteTitle: nextSiteTitle,
      category: nextCategory,
      thumbnailUrl: nextThumbnailUrl,
      accessibilityPageUrl: nextAccessibilityPageUrl,
      complianceStatus: nextComplianceStatus,
      complianceStatusLabel: nextComplianceStatus ? COMPLIANCE_LABELS[nextComplianceStatus] : null,
      complianceScore: scoreCandidate,
      rgaaBaseline: nextRgaaBaseline,
      rgaaBaselineEdited: true,
      updatedAt: new Date().toISOString(),
    }

    const persistedEntry = await showcaseStorage.upsert(updatedEntry)
    response.json({
      ...withShowcasePublicMetadata(persistedEntry),
      message: 'Entrée mise à jour.',
    })
  } catch (error) {
    if (error instanceof SiteInsightError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/showcase/update', error)
    sendJsonError(response, 500, 'Erreur interne lors de la mise à jour.')
  }
})

app.post('/api/moderation/showcase/delete', requireModerationAuth, async (request, response) => {
  const normalizedUrl = extractNormalizedUrl(request.body?.normalizedUrl)
  if (!normalizedUrl) {
    sendJsonError(response, 400, 'normalizedUrl est obligatoire.')
    return
  }

  try {
    const existingEntry = await showcaseStorage.getByNormalizedUrl(normalizedUrl)
    if (!existingEntry) {
      sendJsonError(response, 404, 'Entrée introuvable dans l’annuaire.')
      return
    }

    await showcaseStorage.deleteByNormalizedUrl(normalizedUrl)
    response.json({
      normalizedUrl,
      message: 'Entrée supprimée de l’annuaire.',
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/showcase/delete', error)
    sendJsonError(response, 500, 'Erreur interne lors de la suppression.')
  }
})

app.post('/api/moderation/showcase/delete-and-block', requireModerationAuth, async (request, response) => {
  const normalizedUrl = extractNormalizedUrl(request.body?.normalizedUrl)
  if (!normalizedUrl) {
    sendJsonError(response, 400, 'normalizedUrl est obligatoire.')
    return
  }

  try {
    await showcaseStorage.setSiteBlocked(normalizedUrl, true)

    const existingEntry = await showcaseStorage.getByNormalizedUrl(normalizedUrl)
    if (existingEntry) {
      await showcaseStorage.deleteByNormalizedUrl(normalizedUrl)
    }

    const pendingEntry = await showcaseStorage.getPendingByNormalizedUrl(normalizedUrl)
    if (pendingEntry) {
      await showcaseStorage.deletePendingById(pendingEntry.submissionId)
    }

    response.json({
      normalizedUrl,
      blocked: true,
      deletedFromShowcase: Boolean(existingEntry),
      deletedFromPending: Boolean(pendingEntry),
      message: 'Site supprimé et ajouté à la blocklist.',
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/showcase/delete-and-block', error)
    sendJsonError(response, 500, 'Erreur interne lors de la suppression avec blocklist.')
  }
})

app.use('/api', (_request, response) => {
  sendJsonError(response, 404, 'Point d’accès API introuvable.')
})

app.use((error, _request, response, next) => {
  if (response.headersSent) {
    next(error)
    return
  }

  if (error?.type === 'entity.parse.failed') {
    sendJsonError(response, 400, 'Corps JSON invalide.')
    return
  }

  console.error('Unhandled API middleware error', error)
  sendJsonError(response, 500, 'Erreur interne serveur.')
})

export default app
