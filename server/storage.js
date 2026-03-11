import { Redis } from '@upstash/redis'
import { createHash } from 'node:crypto'

const SHOWCASE_INDEX_KEY = 'rgaa:vitrine:showcase:index'
const SHOWCASE_ENTRY_PREFIX = 'rgaa:vitrine:showcase:entry:'
const SHOWCASE_VOTES_PREFIX = 'rgaa:vitrine:showcase:votes:'
const SHOWCASE_CLIENT_VOTES_PREFIX = 'rgaa:vitrine:showcase:votes:client:'
const SHOWCASE_SLUG_REDIRECTS_KEY = 'rgaa:vitrine:showcase:slug-redirects'
const SITE_BLOCKLIST_KEY = 'rgaa:vitrine:moderation:blocklist:sites'
const VOTE_BLOCKLIST_KEY = 'rgaa:vitrine:moderation:blocklist:votes'
const MAINTENANCE_STATE_KEY = 'rgaa:vitrine:moderation:maintenance'
const PENDING_INDEX_KEY = 'rgaa:vitrine:moderation:pending:index'
const PENDING_ENTRY_PREFIX = 'rgaa:vitrine:moderation:pending:'
const PENDING_BY_URL_HASH_KEY = 'rgaa:vitrine:moderation:pending:by-url'
const GITHUB_NOTIFY_WINDOW_KEY_PREFIX = 'rgaa:vitrine:notifications:github:window:'
const MAX_STORED_ENTRIES = 500
const MAX_PENDING_STORED_ENTRIES = 2000
const MAX_LIST_LIMIT = MAX_STORED_ENTRIES
const DEFAULT_LIST_LIMIT = 80
const MAX_PENDING_LIST_LIMIT = 200
const DEFAULT_PENDING_LIST_LIMIT = 80
const DEFAULT_REDIS_CACHE_TTL_MS = 15_000
const MIN_REDIS_CACHE_TTL_MS = 1_000
const MAX_REDIS_CACHE_TTL_MS = 300_000
const CLIENT_VOTES_REDIS_TTL_SECONDS = 180 * 24 * 60 * 60

const ALLOWED_STATUSES = new Set(['full', 'partial', 'none'])
const ALLOWED_RGAA_BASELINES = new Set(['4.1', '5.0-ready'])
const ARCHIVE_FORMAT = 'annuaire-rgaa-archive'
const ARCHIVE_VERSION = 1
const STORAGE_COMPACT_VERSION = 2
const COMPACT_VOTE_TOKEN_PREFIX = 'h:'
const COMPLIANCE_LABEL_BY_STATUS = {
  full: 'Totalement conforme',
  partial: 'Partiellement conforme',
  none: 'Non conforme',
}
const MAX_MAINTENANCE_MESSAGE_LENGTH = 280

function resolveRedisCacheTtlMs() {
  const rawValue = Number.parseInt(process.env.REDIS_CACHE_TTL_MS ?? '', 10)
  if (Number.isNaN(rawValue)) {
    return DEFAULT_REDIS_CACHE_TTL_MS
  }

  return Math.min(Math.max(rawValue, MIN_REDIS_CACHE_TTL_MS), MAX_REDIS_CACHE_TTL_MS)
}

function normalizeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function encodeEntryId(normalizedUrl) {
  return Buffer.from(normalizedUrl, 'utf8').toString('base64url')
}

function decodeEntryId(entryId) {
  if (typeof entryId !== 'string' || !entryId.trim()) {
    return null
  }

  try {
    const decoded = Buffer.from(entryId, 'base64url').toString('utf8')
    return normalizeUrlCandidate(decoded)
  } catch {
    return null
  }
}

function entryKeyFromId(entryId) {
  return `${SHOWCASE_ENTRY_PREFIX}${entryId}`
}

function votesKeyFromId(entryId) {
  return `${SHOWCASE_VOTES_PREFIX}${entryId}`
}

function clientVotesKeyFromId(clientVoteIndexId) {
  return `${SHOWCASE_CLIENT_VOTES_PREFIX}${clientVoteIndexId}`
}

function pendingKeyFromId(entryId) {
  return `${PENDING_ENTRY_PREFIX}${entryId}`
}

function toNullableString(value) {
  return value === null || value === undefined ? null : String(value)
}

function sanitizeMaintenanceMessage(value) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.replace(/\s+/g, ' ').trim().slice(0, MAX_MAINTENANCE_MESSAGE_LENGTH)
  return normalized || null
}

function toNullableField(payload, compactKey, legacyKey) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  if (Object.hasOwn(payload, compactKey)) {
    return toNullableString(payload[compactKey])
  }

  if (legacyKey && Object.hasOwn(payload, legacyKey)) {
    return toNullableString(payload[legacyKey])
  }

  return null
}

function toNullableNumberField(payload, compactKey, legacyKey) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  if (Object.hasOwn(payload, compactKey)) {
    return toNullableNumber(payload[compactKey])
  }

  if (legacyKey && Object.hasOwn(payload, legacyKey)) {
    return toNullableNumber(payload[legacyKey])
  }

  return null
}

function toBooleanField(payload, compactKey, legacyKey) {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  if (Object.hasOwn(payload, compactKey)) {
    return toBoolean(payload[compactKey])
  }

  if (legacyKey && Object.hasOwn(payload, legacyKey)) {
    return toBoolean(payload[legacyKey])
  }

  return false
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toBoolean(value) {
  if (value === true || value === 1 || value === '1') {
    return true
  }
  if (value === false || value === 0 || value === '0') {
    return false
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === 'yes') {
      return true
    }
    if (normalized === 'false' || normalized === 'no') {
      return false
    }
  }

  return false
}

function toNonNegativeInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}

function normalizeRgaaBaseline(value) {
  const baseline = toNullableString(value)
  if (ALLOWED_RGAA_BASELINES.has(baseline ?? '')) {
    return baseline
  }

  return '4.1'
}

function normalizeVoteTokens(voterFingerprints) {
  return normalizeRawVoteTokens(voterFingerprints).map(compactVoteToken)
}

function normalizeRawVoteTokens(voterFingerprints) {
  if (!voterFingerprints || typeof voterFingerprints !== 'object') {
    return []
  }

  const values = Object.values(voterFingerprints)
  const unique = new Set()

  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }
    const trimmed = value.trim()
    if (!trimmed) {
      continue
    }
    unique.add(trimmed.slice(0, 160))
  }

  return Array.from(unique)
}

function compactVoteToken(token) {
  if (typeof token !== 'string') {
    return null
  }

  const trimmed = token.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith(COMPACT_VOTE_TOKEN_PREFIX)) {
    return trimmed.slice(0, 80)
  }

  const digest = createHash('sha256').update(trimmed, 'utf8').digest('base64url').slice(0, 27)
  return `${COMPACT_VOTE_TOKEN_PREFIX}${digest}`
}

function normalizeStoredVoteToken(token) {
  const compact = compactVoteToken(token)
  return compact ? compact : null
}

function buildVoteTokenCandidates(voterFingerprints) {
  const compact = normalizeVoteTokens(voterFingerprints)
  const raw = normalizeRawVoteTokens(voterFingerprints)
  const candidates = new Set([...compact, ...raw])
  return Array.from(candidates)
}

function readClientVoteToken(voterFingerprints) {
  if (!voterFingerprints || typeof voterFingerprints !== 'object') {
    return null
  }

  const clientToken = voterFingerprints.client
  if (typeof clientToken !== 'string') {
    return null
  }

  return normalizeStoredVoteToken(clientToken)
}

function parseStoredTimestamp(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Date(value * 1000).toISOString()
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    if (/^\d{10,13}$/.test(trimmed)) {
      const numeric = Number(trimmed)
      if (Number.isFinite(numeric) && numeric > 0) {
        const seconds = trimmed.length > 10 ? numeric / 1000 : numeric
        return new Date(seconds * 1000).toISOString()
      }
    }

    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString()
    }

    return null
  }

  return null
}

function serializeTimestamp(value) {
  const timestamp = Date.parse(String(value ?? ''))
  if (Number.isNaN(timestamp) || timestamp <= 0) {
    return Math.floor(Date.now() / 1000)
  }
  return Math.floor(timestamp / 1000)
}

function sortNormalizedUrlList(values) {
  return Array.from(values).sort((left, right) => left.localeCompare(right, 'fr'))
}

function normalizeClientVoteIndexId(clientVoteIndexId) {
  if (typeof clientVoteIndexId !== 'string') {
    return null
  }

  const trimmed = clientVoteIndexId.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.slice(0, 120)
}

function buildActiveVoteCountByUrl(clientVoteUrlCollections) {
  const countsByUrl = new Map()

  for (const collection of clientVoteUrlCollections) {
    const normalizedUrls = new Set()
    for (const rawUrl of collection ?? []) {
      const normalizedUrl = normalizeUrlCandidate(rawUrl)
      if (normalizedUrl) {
        normalizedUrls.add(normalizedUrl)
      }
    }

    for (const normalizedUrl of normalizedUrls) {
      countsByUrl.set(normalizedUrl, (countsByUrl.get(normalizedUrl) ?? 0) + 1)
    }
  }

  return countsByUrl
}

function parseStoredEntry(payload, context = {}) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const normalizedUrl =
    normalizeUrlCandidate(context.normalizedUrl) ??
    normalizeUrlCandidate(decodeEntryId(context.entryId)) ??
    normalizeUrlCandidate(toNullableField(payload, 'u', 'normalizedUrl'))
  const siteTitle = toNullableField(payload, 't', 'siteTitle')
  const updatedAt =
    parseStoredTimestamp(toNullableField(payload, 'ts', null)) ??
    parseStoredTimestamp(toNullableField(payload, 'updatedAt', 'updatedAt'))

  if (!normalizedUrl || !siteTitle || !updatedAt) {
    return null
  }

  const complianceStatus = toNullableField(payload, 'cs', 'complianceStatus')
  const rgaaBaselineEdited = toBooleanField(payload, 're', 'rgaaBaselineEdited')
  const persistedRgaaBaseline = normalizeRgaaBaseline(toNullableField(payload, 'rb', 'rgaaBaseline'))
  const complianceStatusLabel =
    toNullableField(payload, 'cl', 'complianceStatusLabel') ??
    COMPLIANCE_LABEL_BY_STATUS[complianceStatus ?? ''] ??
    null
  const entry = {
    normalizedUrl,
    siteTitle,
    thumbnailUrl: toNullableField(payload, 'th', 'thumbnailUrl'),
    accessibilityPageUrl: toNullableField(payload, 'ap', 'accessibilityPageUrl'),
    complianceStatus: ALLOWED_STATUSES.has(complianceStatus ?? '') ? complianceStatus : null,
    complianceStatusLabel,
    complianceScore: toNullableNumberField(payload, 'sc', 'complianceScore'),
    rgaaBaseline: rgaaBaselineEdited ? persistedRgaaBaseline : '4.1',
    rgaaBaselineEdited,
    upvoteCount: toNonNegativeInteger(toNullableNumberField(payload, 'uv', 'upvoteCount')),
    updatedAt,
    category: sanitizeCategory(toNullableField(payload, 'cg', 'category')),
  }

  return entry
}

function parsePendingEntry(payload, context = {}) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const submissionId =
    toNullableString(context.submissionId) ??
    toNullableField(payload, 'sid', 'submissionId') ??
    (normalizeUrlCandidate(context.normalizedUrl) ? encodeEntryId(context.normalizedUrl) : null)
  const normalizedUrl =
    normalizeUrlCandidate(context.normalizedUrl) ??
    normalizeUrlCandidate(decodeEntryId(submissionId)) ??
    normalizeUrlCandidate(toNullableField(payload, 'u', 'normalizedUrl'))
  const siteTitle = toNullableField(payload, 't', 'siteTitle')
  const updatedAt =
    parseStoredTimestamp(toNullableField(payload, 'ts', null)) ??
    parseStoredTimestamp(toNullableField(payload, 'updatedAt', 'updatedAt'))
  const createdAt =
    parseStoredTimestamp(toNullableField(payload, 'ct', null)) ??
    parseStoredTimestamp(toNullableField(payload, 'createdAt', 'createdAt'))

  if (!submissionId || !normalizedUrl || !siteTitle || !updatedAt || !createdAt) {
    return null
  }

  const complianceStatus = toNullableField(payload, 'cs', 'complianceStatus')
  const rgaaBaselineEdited = toBooleanField(payload, 're', 'rgaaBaselineEdited')
  const persistedRgaaBaseline = normalizeRgaaBaseline(toNullableField(payload, 'rb', 'rgaaBaseline'))
  const complianceStatusLabel =
    toNullableField(payload, 'cl', 'complianceStatusLabel') ??
    COMPLIANCE_LABEL_BY_STATUS[complianceStatus ?? ''] ??
    null
  return {
    submissionId,
    normalizedUrl,
    siteTitle,
    thumbnailUrl: toNullableField(payload, 'th', 'thumbnailUrl'),
    accessibilityPageUrl: toNullableField(payload, 'ap', 'accessibilityPageUrl'),
    complianceStatus: ALLOWED_STATUSES.has(complianceStatus ?? '') ? complianceStatus : null,
    complianceStatusLabel,
    complianceScore: toNullableNumberField(payload, 'sc', 'complianceScore'),
    rgaaBaseline: rgaaBaselineEdited ? persistedRgaaBaseline : '4.1',
    rgaaBaselineEdited,
    updatedAt,
    createdAt,
    reviewReason: toNullableField(payload, 'rr', 'reviewReason'),
    category: sanitizeCategory(toNullableField(payload, 'cg', 'category')),
  }
}

function normalizeUrlCandidate(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 400) {
    return null
  }

  return trimmed
}

function normalizeSlugCandidate(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  if (!/^[a-z0-9-]{4,120}$/.test(trimmed)) {
    return null
  }

  return trimmed
}

function normalizeVoteTokenList(values) {
  if (!Array.isArray(values)) {
    return []
  }

  const set = new Set()
  for (const value of values) {
    const token = normalizeStoredVoteToken(value)
    if (!token) {
      continue
    }
    set.add(token)
  }

  return Array.from(set)
}

function normalizeVotesByUrl(values) {
  if (!Array.isArray(values)) {
    return []
  }

  const byUrl = new Map()
  for (const item of values) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const normalizedUrl = normalizeUrlCandidate(item.normalizedUrl)
    if (!normalizedUrl) {
      continue
    }

    const tokens = normalizeVoteTokenList(item.tokens)
    if (tokens.length === 0) {
      continue
    }

    const existingTokens = byUrl.get(normalizedUrl) ?? new Set()
    for (const token of tokens) {
      existingTokens.add(token)
    }
    byUrl.set(normalizedUrl, existingTokens)
  }

  return sortNormalizedUrlList(byUrl.keys()).map((normalizedUrl) => ({
    normalizedUrl,
    tokens: Array.from(byUrl.get(normalizedUrl)),
  }))
}

function normalizeClientVotesByIndex(values) {
  if (!Array.isArray(values)) {
    return []
  }

  const byClient = new Map()
  for (const item of values) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const clientVoteIndexId = normalizeClientVoteIndexId(item.clientVoteIndexId)
    if (!clientVoteIndexId) {
      continue
    }

    const rawUrls = Array.isArray(item.urls) ? item.urls : []
    const nextUrls = new Set(byClient.get(clientVoteIndexId) ?? [])
    for (const rawUrl of rawUrls) {
      const normalizedUrl = normalizeUrlCandidate(rawUrl)
      if (normalizedUrl) {
        nextUrls.add(normalizedUrl)
      }
    }

    if (nextUrls.size > 0) {
      byClient.set(clientVoteIndexId, nextUrls)
    }
  }

  return Array.from(byClient.entries())
    .sort((left, right) => left[0].localeCompare(right[0], 'fr'))
    .map(([clientVoteIndexId, urlsSet]) => ({
      clientVoteIndexId,
      urls: sortNormalizedUrlList(urlsSet),
    }))
}

function normalizeArchiveEntries(values) {
  if (!Array.isArray(values)) {
    return []
  }

  const byUrl = new Map()
  for (const value of values) {
    const parsed = parseStoredEntry(value)
    if (!parsed) {
      continue
    }

    const previous = byUrl.get(parsed.normalizedUrl)
    const parsedTimestamp = Date.parse(parsed.updatedAt)
    const previousTimestamp = previous ? Date.parse(previous.updatedAt) : Number.NEGATIVE_INFINITY

    if (!previous || parsedTimestamp >= previousTimestamp) {
      byUrl.set(parsed.normalizedUrl, parsed)
    }
  }

  return Array.from(byUrl.values())
}

function normalizeArchivePendingEntries(values) {
  if (!Array.isArray(values)) {
    return []
  }

  const bySubmissionId = new Map()
  for (const value of values) {
    const parsed = parsePendingEntry(value)
    if (!parsed) {
      continue
    }

    const previous = bySubmissionId.get(parsed.submissionId)
    const parsedTimestamp = Date.parse(parsed.createdAt)
    const previousTimestamp = previous ? Date.parse(previous.createdAt) : Number.NEGATIVE_INFINITY
    if (!previous || parsedTimestamp >= previousTimestamp) {
      bySubmissionId.set(parsed.submissionId, parsed)
    }
  }

  return Array.from(bySubmissionId.values())
}

function normalizeArchiveUrlList(values) {
  if (!Array.isArray(values)) {
    return []
  }

  const urls = new Set()
  for (const value of values) {
    const normalizedUrl = normalizeUrlCandidate(value)
    if (normalizedUrl) {
      urls.add(normalizedUrl)
    }
  }

  return sortNormalizedUrlList(urls)
}

function buildMaintenanceState(value = {}) {
  const enabled = toBoolean(value?.enabled)
  const updatedAt = parseStoredTimestamp(value?.updatedAt)

  return {
    enabled,
    message: sanitizeMaintenanceMessage(value?.message),
    updatedAt: updatedAt ?? null,
  }
}

function normalizeArchiveMaintenanceState(value) {
  if (!value || typeof value !== 'object') {
    return buildMaintenanceState()
  }

  return buildMaintenanceState(value)
}

function normalizeArchiveImportPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const source =
    payload.data && typeof payload.data === 'object'
      ? payload.data
      : payload

  if (!source || typeof source !== 'object') {
    return null
  }

  const entries = normalizeArchiveEntries(source.entries ?? source.showcaseEntries)
  const pendingEntries = normalizeArchivePendingEntries(source.pendingEntries ?? source.pending)
  const siteBlocklist = normalizeArchiveUrlList(source.siteBlocklist)
  const voteBlocklist = normalizeArchiveUrlList(source.voteBlocklist)
  const voteTokensByUrl = normalizeVotesByUrl(source.voteTokensByUrl ?? source.votesByUrl)
  const clientVotesByIndex = normalizeClientVotesByIndex(source.clientVotesByIndex ?? source.clientVotes)
  const slugRedirects = normalizeSlugRedirects(source.slugRedirects)
  const hasMaintenanceState =
    Object.hasOwn(source, 'maintenanceState') ||
    Object.hasOwn(source, 'maintenance')
  const maintenanceState = hasMaintenanceState
    ? normalizeArchiveMaintenanceState(source.maintenanceState ?? source.maintenance)
    : null

  return {
    entries,
    pendingEntries,
    siteBlocklist,
    voteBlocklist,
    voteTokensByUrl,
    clientVotesByIndex,
    slugRedirects,
    maintenanceState,
    hasMaintenanceState,
  }
}

function normalizeSlugRedirects(values) {
  if (!Array.isArray(values)) {
    return []
  }

  const bySlug = new Map()
  for (const value of values) {
    if (!value || typeof value !== 'object') {
      continue
    }

    const slug = normalizeSlugCandidate(value.slug)
    const normalizedUrl = normalizeUrlCandidate(value.normalizedUrl)
    if (!slug || !normalizedUrl) {
      continue
    }

    bySlug.set(slug, normalizedUrl)
  }

  return Array.from(bySlug.entries())
    .sort((left, right) => left[0].localeCompare(right[0], 'fr'))
    .map(([slug, normalizedUrl]) => ({ slug, normalizedUrl }))
}

function buildArchivePayload(storageMode, data) {
  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    storageMode,
    data,
  }
}

function serializeEntry(entry) {
  const payload = {
    _v: STORAGE_COMPACT_VERSION,
    t: entry.siteTitle,
    ts: serializeTimestamp(entry.updatedAt),
    cg: sanitizeCategory(entry.category),
    uv: toNonNegativeInteger(entry.upvoteCount),
  }

  if (entry.thumbnailUrl) {
    payload.th = entry.thumbnailUrl
  }
  if (entry.accessibilityPageUrl) {
    payload.ap = entry.accessibilityPageUrl
  }
  if (entry.complianceStatus && ALLOWED_STATUSES.has(entry.complianceStatus)) {
    payload.cs = entry.complianceStatus
  }
  if (entry.complianceStatusLabel) {
    payload.cl = entry.complianceStatusLabel
  }
  if (typeof entry.complianceScore === 'number' && Number.isFinite(entry.complianceScore)) {
    payload.sc = Math.round(entry.complianceScore * 100) / 100
  }
  if (toBoolean(entry.rgaaBaselineEdited)) {
    payload.re = true
    payload.rb = normalizeRgaaBaseline(entry.rgaaBaseline)
  }

  return payload
}

function serializePendingEntry(entry) {
  const payload = {
    _v: STORAGE_COMPACT_VERSION,
    t: entry.siteTitle,
    ts: serializeTimestamp(entry.updatedAt),
    ct: serializeTimestamp(entry.createdAt),
    cg: sanitizeCategory(entry.category),
  }

  if (entry.thumbnailUrl) {
    payload.th = entry.thumbnailUrl
  }
  if (entry.accessibilityPageUrl) {
    payload.ap = entry.accessibilityPageUrl
  }
  if (entry.complianceStatus && ALLOWED_STATUSES.has(entry.complianceStatus)) {
    payload.cs = entry.complianceStatus
  }
  if (entry.complianceStatusLabel) {
    payload.cl = entry.complianceStatusLabel
  }
  if (typeof entry.complianceScore === 'number' && Number.isFinite(entry.complianceScore)) {
    payload.sc = Math.round(entry.complianceScore * 100) / 100
  }
  if (toBoolean(entry.rgaaBaselineEdited)) {
    payload.re = true
    payload.rb = normalizeRgaaBaseline(entry.rgaaBaseline)
  }
  if (entry.reviewReason) {
    payload.rr = entry.reviewReason
  }

  return payload
}

function applyEntryFilters(entries, options) {
  const search = normalizeText(typeof options.search === 'string' ? options.search : '')
  const statusFilter = options.status && ALLOWED_STATUSES.has(options.status) ? options.status : null
  const categoryFilter = options.category ? sanitizeCategory(options.category) : null

  return entries.filter((entry) => {
    if (statusFilter && entry.complianceStatus !== statusFilter) {
      return false
    }

    if (categoryFilter && categoryFilter !== 'all' && entry.category !== categoryFilter) {
      return false
    }

    if (!search) {
      return true
    }

    const searchable = normalizeText(
      `${entry.siteTitle} ${entry.normalizedUrl} ${entry.category} ${entry.complianceStatusLabel ?? ''}`,
    )
    return searchable.includes(search)
  })
}

function parseLimit(rawLimit) {
  const fallback = DEFAULT_LIST_LIMIT
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    return fallback
  }

  const parsed = Number.parseInt(String(rawLimit), 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.min(parsed, MAX_LIST_LIMIT)
}

function parsePendingLimit(rawLimit) {
  const fallback = DEFAULT_PENDING_LIST_LIMIT
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    return fallback
  }

  const parsed = Number.parseInt(String(rawLimit), 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.min(parsed, MAX_PENDING_LIST_LIMIT)
}

export class ShowcaseStorageError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.name = 'ShowcaseStorageError'
    this.statusCode = statusCode
  }
}

export function sanitizeCategory(input) {
  if (typeof input !== 'string') {
    return 'Autre'
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return 'Autre'
  }

  return trimmed.slice(0, 60)
}

class InMemoryShowcaseStorage {
  constructor() {
    this.mode = 'memory'
    this.entries = new Map()
    this.pendingEntries = new Map()
    this.votesByUrl = new Map()
    this.votesByClient = new Map()
    this.siteBlocklist = new Set()
    this.voteBlocklist = new Set()
    this.maintenanceState = buildMaintenanceState()
    this.slugRedirectsBySlug = new Map()
    this.githubNotificationCountByWindow = new Map()
  }

  async upsert(entry) {
    this.entries.set(entry.normalizedUrl, entry)

    if (this.entries.size > MAX_STORED_ENTRIES) {
      const sorted = this.#sortedEntries()
      const keep = new Set(sorted.slice(0, MAX_STORED_ENTRIES).map((current) => current.normalizedUrl))
      for (const key of this.entries.keys()) {
        if (!keep.has(key)) {
          this.entries.delete(key)
        }
      }
    }

    return entry
  }

  async getByNormalizedUrl(normalizedUrl) {
    return this.entries.get(normalizedUrl) ?? null
  }

  async deleteByNormalizedUrl(normalizedUrl) {
    this.votesByUrl.delete(normalizedUrl)
    for (const votedUrls of this.votesByClient.values()) {
      votedUrls.delete(normalizedUrl)
    }
    return this.entries.delete(normalizedUrl)
  }

  async rememberSlugRedirect(slug, normalizedUrl) {
    const safeSlug = normalizeSlugCandidate(slug)
    const safeUrl = normalizeUrlCandidate(normalizedUrl)
    if (!safeSlug || !safeUrl) {
      return false
    }

    this.slugRedirectsBySlug.set(safeSlug, safeUrl)
    return true
  }

  async resolveSlugRedirect(slug) {
    const safeSlug = normalizeSlugCandidate(slug)
    if (!safeSlug) {
      return null
    }

    return this.slugRedirectsBySlug.get(safeSlug) ?? null
  }

  async listSiteBlocklist() {
    return sortNormalizedUrlList(this.siteBlocklist)
  }

  async listVoteBlocklist() {
    return sortNormalizedUrlList(this.voteBlocklist)
  }

  async isSiteBlocked(normalizedUrl) {
    return this.siteBlocklist.has(normalizedUrl)
  }

  async isVotesBlocked(normalizedUrl) {
    return this.voteBlocklist.has(normalizedUrl)
  }

  async setSiteBlocked(normalizedUrl, blocked) {
    if (blocked) {
      this.siteBlocklist.add(normalizedUrl)
      return true
    }

    this.siteBlocklist.delete(normalizedUrl)
    return false
  }

  async setVotesBlocked(normalizedUrl, blocked) {
    if (blocked) {
      this.voteBlocklist.add(normalizedUrl)
      return true
    }

    this.voteBlocklist.delete(normalizedUrl)
    return false
  }

  async getMaintenanceState() {
    return { ...this.maintenanceState }
  }

  async setMaintenanceState(nextState) {
    this.maintenanceState = buildMaintenanceState({
      ...nextState,
      updatedAt: nextState?.updatedAt ?? new Date().toISOString(),
    })

    return { ...this.maintenanceState }
  }

  async listClientVotedUrls(clientVoteIndexId) {
    const normalizedClientVoteIndexId = normalizeClientVoteIndexId(clientVoteIndexId)
    if (!normalizedClientVoteIndexId) {
      return new Set()
    }

    const votedUrls = this.votesByClient.get(normalizedClientVoteIndexId)
    return votedUrls ? new Set(votedUrls) : new Set()
  }

  async reconcileUpvoteCounts() {
    const activeVoteCounts = buildActiveVoteCountByUrl(this.votesByClient.values())
    let updatedEntries = 0

    for (const [normalizedUrl, activeVoteCount] of activeVoteCounts.entries()) {
      const entry = this.entries.get(normalizedUrl)
      if (!entry) {
        continue
      }

      const storedCount = toNonNegativeInteger(entry.upvoteCount)
      const nextCount = Math.max(storedCount, activeVoteCount)
      if (nextCount === storedCount) {
        continue
      }

      this.entries.set(normalizedUrl, {
        ...entry,
        upvoteCount: nextCount,
      })
      updatedEntries += 1
    }

    return {
      updatedEntries,
      activeVoteUrls: activeVoteCounts.size,
      scannedClientVoteGroups: this.votesByClient.size,
    }
  }

  async hasVoted(normalizedUrl, voterFingerprints) {
    const tokens = buildVoteTokenCandidates(voterFingerprints)
    if (tokens.length === 0) {
      return false
    }

    const set = this.votesByUrl.get(normalizedUrl)
    if (!set) {
      return false
    }

    return tokens.some((token) => set.has(token))
  }

  async registerUpvote(normalizedUrl, voterFingerprints, clientVoteIndexId) {
    const entry = this.entries.get(normalizedUrl) ?? null
    if (!entry) {
      return null
    }

    const writeTokens = normalizeVoteTokens(voterFingerprints)
    const checkTokens = buildVoteTokenCandidates(voterFingerprints)
    const normalizedClientVoteIndexId = normalizeClientVoteIndexId(clientVoteIndexId)
    const clientVoteToken = readClientVoteToken(voterFingerprints)
    if (!normalizedClientVoteIndexId || writeTokens.length === 0 || checkTokens.length === 0 || !clientVoteToken) {
      throw new ShowcaseStorageError('Identifiant de vote invalide.', 400)
    }

    let set = this.votesByUrl.get(normalizedUrl)
    if (!set) {
      set = new Set()
      this.votesByUrl.set(normalizedUrl, set)
    }

    const votedUrls = this.votesByClient.get(normalizedClientVoteIndexId) ?? new Set()
    const alreadyOwnedByClient = votedUrls.has(normalizedUrl) || set.has(clientVoteToken)
    if (alreadyOwnedByClient) {
      votedUrls.add(normalizedUrl)
      this.votesByClient.set(normalizedClientVoteIndexId, votedUrls)
      return {
        accepted: false,
        alreadyVoted: true,
        hasUpvoted: true,
        entry,
      }
    }

    const alreadyVoted = checkTokens.some((token) => set.has(token))
    if (alreadyVoted) {
      return {
        accepted: false,
        alreadyVoted: true,
        hasUpvoted: false,
        entry,
      }
    }

    for (const token of writeTokens) {
      set.add(token)
    }

    votedUrls.add(normalizedUrl)
    this.votesByClient.set(normalizedClientVoteIndexId, votedUrls)

    const updatedEntry = {
      ...entry,
      upvoteCount: toNonNegativeInteger(entry.upvoteCount) + 1,
    }

    this.entries.set(normalizedUrl, updatedEntry)

    return {
      accepted: true,
      alreadyVoted: false,
      hasUpvoted: true,
      entry: updatedEntry,
    }
  }

  async unregisterUpvote(normalizedUrl, voterFingerprints, clientVoteIndexId) {
    const entry = this.entries.get(normalizedUrl) ?? null
    if (!entry) {
      return null
    }

    const writeTokens = normalizeVoteTokens(voterFingerprints)
    const normalizedClientVoteIndexId = normalizeClientVoteIndexId(clientVoteIndexId)
    const clientVoteToken = readClientVoteToken(voterFingerprints)
    if (!normalizedClientVoteIndexId || writeTokens.length === 0 || !clientVoteToken) {
      throw new ShowcaseStorageError('Identifiant de vote invalide.', 400)
    }

    const set = this.votesByUrl.get(normalizedUrl)
    const votedUrls = this.votesByClient.get(normalizedClientVoteIndexId) ?? new Set()
    const ownsVote = Boolean(set?.has(clientVoteToken))

    if (!ownsVote) {
      if (votedUrls.delete(normalizedUrl)) {
        if (votedUrls.size === 0) {
          this.votesByClient.delete(normalizedClientVoteIndexId)
        } else {
          this.votesByClient.set(normalizedClientVoteIndexId, votedUrls)
        }
      }

      return {
        removed: false,
        hasUpvoted: false,
        entry,
      }
    }

    for (const token of writeTokens) {
      set.delete(token)
    }
    if (set.size === 0) {
      this.votesByUrl.delete(normalizedUrl)
    }

    votedUrls.delete(normalizedUrl)
    if (votedUrls.size === 0) {
      this.votesByClient.delete(normalizedClientVoteIndexId)
    } else {
      this.votesByClient.set(normalizedClientVoteIndexId, votedUrls)
    }

    const updatedEntry = {
      ...entry,
      upvoteCount: Math.max(0, toNonNegativeInteger(entry.upvoteCount) - 1),
    }

    this.entries.set(normalizedUrl, updatedEntry)

    return {
      removed: true,
      hasUpvoted: false,
      entry: updatedEntry,
    }
  }

  async list(options = {}) {
    const entries = this.#sortedEntries()
    const filtered = applyEntryFilters(entries, options)
    const limit = parseLimit(options.limit)
    return filtered.slice(0, limit)
  }

  async upsertPending(entry) {
    this.pendingEntries.set(entry.submissionId, entry)

    if (this.pendingEntries.size > MAX_PENDING_STORED_ENTRIES) {
      const sorted = this.#sortedPendingEntries()
      const keep = new Set(sorted.slice(0, MAX_PENDING_STORED_ENTRIES).map((current) => current.submissionId))
      for (const key of this.pendingEntries.keys()) {
        if (!keep.has(key)) {
          this.pendingEntries.delete(key)
        }
      }
    }

    return entry
  }

  async reserveGithubNotificationSlot({ limit, windowMs }) {
    const currentWindow = Math.floor(Date.now() / windowMs)

    for (const bucket of this.githubNotificationCountByWindow.keys()) {
      if (bucket !== currentWindow) {
        this.githubNotificationCountByWindow.delete(bucket)
      }
    }

    const nextCount = (this.githubNotificationCountByWindow.get(currentWindow) ?? 0) + 1
    this.githubNotificationCountByWindow.set(currentWindow, nextCount)

    return {
      allowed: nextCount <= limit,
      remaining: Math.max(0, limit - nextCount),
      resetAt: new Date((currentWindow + 1) * windowMs).toISOString(),
    }
  }

  async getPendingById(submissionId) {
    return this.pendingEntries.get(submissionId) ?? null
  }

  async getPendingByNormalizedUrl(normalizedUrl) {
    return this.pendingEntries.get(encodeEntryId(normalizedUrl)) ?? null
  }

  async deletePendingById(submissionId) {
    return this.pendingEntries.delete(submissionId)
  }

  async listPending(options = {}) {
    const entries = this.#sortedPendingEntries()
    const limit = parsePendingLimit(options.limit)
    return entries.slice(0, limit)
  }

  async exportArchive() {
    const entries = this.#sortedEntries()
    const pendingEntries = this.#sortedPendingEntries()
    const siteBlocklist = sortNormalizedUrlList(this.siteBlocklist)
    const voteBlocklist = sortNormalizedUrlList(this.voteBlocklist)
    const maintenanceState = await this.getMaintenanceState()
    const voteTokensByUrl = sortNormalizedUrlList(this.votesByUrl.keys()).map((normalizedUrl) => ({
      normalizedUrl,
      tokens: Array.from(this.votesByUrl.get(normalizedUrl) ?? []),
    }))
    const clientVotesByIndex = Array.from(this.votesByClient.entries())
      .sort((left, right) => left[0].localeCompare(right[0], 'fr'))
      .map(([clientVoteIndexId, urlsSet]) => ({
        clientVoteIndexId,
        urls: sortNormalizedUrlList(urlsSet),
      }))
    const slugRedirects = Array.from(this.slugRedirectsBySlug.entries())
      .sort((left, right) => left[0].localeCompare(right[0], 'fr'))
      .map(([slug, normalizedUrl]) => ({
        slug,
        normalizedUrl,
      }))

    return buildArchivePayload(this.mode, {
      entries,
      pendingEntries,
      siteBlocklist,
      voteBlocklist,
      maintenanceState,
      voteTokensByUrl,
      clientVotesByIndex,
      slugRedirects,
    })
  }

  async importArchive(payload, mode = 'merge') {
    if (mode !== 'merge' && mode !== 'replace') {
      throw new ShowcaseStorageError('Mode d’import invalide. Utilisez merge ou replace.', 400)
    }

    const normalized = normalizeArchiveImportPayload(payload)
    if (!normalized) {
      throw new ShowcaseStorageError('Archive invalide.', 400)
    }

    if (mode === 'replace') {
      this.entries.clear()
      this.pendingEntries.clear()
      this.votesByUrl.clear()
      this.votesByClient.clear()
      this.siteBlocklist.clear()
      this.voteBlocklist.clear()
      this.maintenanceState = buildMaintenanceState()
      this.slugRedirectsBySlug.clear()
    }

    for (const entry of normalized.entries) {
      await this.upsert(entry)
    }
    for (const pendingEntry of normalized.pendingEntries) {
      await this.upsertPending(pendingEntry)
    }
    for (const normalizedUrl of normalized.siteBlocklist) {
      this.siteBlocklist.add(normalizedUrl)
    }
    for (const normalizedUrl of normalized.voteBlocklist) {
      this.voteBlocklist.add(normalizedUrl)
    }

    for (const voteEntry of normalized.voteTokensByUrl) {
      const existing = this.votesByUrl.get(voteEntry.normalizedUrl) ?? new Set()
      for (const token of voteEntry.tokens) {
        existing.add(token)
      }
      this.votesByUrl.set(voteEntry.normalizedUrl, existing)
    }

    for (const clientVoteEntry of normalized.clientVotesByIndex) {
      const existing = this.votesByClient.get(clientVoteEntry.clientVoteIndexId) ?? new Set()
      for (const normalizedUrl of clientVoteEntry.urls) {
        existing.add(normalizedUrl)
      }
      this.votesByClient.set(clientVoteEntry.clientVoteIndexId, existing)
    }
    for (const slugRedirectEntry of normalized.slugRedirects) {
      this.slugRedirectsBySlug.set(slugRedirectEntry.slug, slugRedirectEntry.normalizedUrl)
    }
    if (normalized.hasMaintenanceState && normalized.maintenanceState) {
      this.maintenanceState = buildMaintenanceState(normalized.maintenanceState)
    }

    await this.reconcileUpvoteCounts()

    return {
      mode,
      imported: {
        entries: normalized.entries.length,
        pendingEntries: normalized.pendingEntries.length,
        siteBlocklist: normalized.siteBlocklist.length,
        voteBlocklist: normalized.voteBlocklist.length,
        maintenanceState: normalized.hasMaintenanceState ? 1 : 0,
        voteTokenGroups: normalized.voteTokensByUrl.length,
        clientVoteGroups: normalized.clientVotesByIndex.length,
        slugRedirects: normalized.slugRedirects.length,
      },
      totals: {
        entries: this.entries.size,
        pendingEntries: this.pendingEntries.size,
        siteBlocklist: this.siteBlocklist.size,
        voteBlocklist: this.voteBlocklist.size,
        maintenanceEnabled: this.maintenanceState.enabled ? 1 : 0,
        slugRedirects: this.slugRedirectsBySlug.size,
      },
    }
  }

  #sortedEntries() {
    return Array.from(this.entries.values()).sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt)
      const rightTime = Date.parse(right.updatedAt)
      return rightTime - leftTime
    })
  }

  #sortedPendingEntries() {
    return Array.from(this.pendingEntries.values()).sort((left, right) => {
      const leftTime = Date.parse(left.createdAt)
      const rightTime = Date.parse(right.createdAt)
      return rightTime - leftTime
    })
  }
}

class UpstashShowcaseStorage {
  constructor(redis) {
    this.mode = 'redis'
    this.redis = redis
    this.cacheTtlMs = resolveRedisCacheTtlMs()
    this.showcaseCacheEntries = null
    this.showcaseCacheByUrl = new Map()
    this.showcaseCacheExpiresAt = 0
    this.pendingCacheEntries = null
    this.pendingCacheById = new Map()
    this.pendingCacheExpiresAt = 0
    this.clientVotesCacheById = new Map()
    this.siteBlocklistCache = null
    this.siteBlocklistCacheExpiresAt = 0
    this.voteBlocklistCache = null
    this.voteBlocklistCacheExpiresAt = 0
    this.maintenanceStateCache = null
    this.maintenanceStateCacheExpiresAt = 0
  }

  _isShowcaseCacheFresh() {
    return Array.isArray(this.showcaseCacheEntries) && Date.now() < this.showcaseCacheExpiresAt
  }

  _setShowcaseCache(entries) {
    this.showcaseCacheEntries = entries
    this.showcaseCacheByUrl = new Map(entries.map((entry) => [entry.normalizedUrl, entry]))
    this.showcaseCacheExpiresAt = Date.now() + this.cacheTtlMs
  }

  _invalidateShowcaseCache() {
    this.showcaseCacheEntries = null
    this.showcaseCacheByUrl.clear()
    this.showcaseCacheExpiresAt = 0
  }

  _isPendingCacheFresh() {
    return Array.isArray(this.pendingCacheEntries) && Date.now() < this.pendingCacheExpiresAt
  }

  _setPendingCache(entries) {
    this.pendingCacheEntries = entries
    this.pendingCacheById = new Map(entries.map((entry) => [entry.submissionId, entry]))
    this.pendingCacheExpiresAt = Date.now() + this.cacheTtlMs
  }

  _invalidatePendingCache() {
    this.pendingCacheEntries = null
    this.pendingCacheById.clear()
    this.pendingCacheExpiresAt = 0
  }

  _getCachedClientVotedUrls(clientVoteIndexId) {
    const cached = this.clientVotesCacheById.get(clientVoteIndexId)
    if (!cached) {
      return null
    }

    if (Date.now() >= cached.expiresAt) {
      this.clientVotesCacheById.delete(clientVoteIndexId)
      return null
    }

    return new Set(cached.urls)
  }

  _setClientVotesCache(clientVoteIndexId, votedUrlsSet) {
    this.clientVotesCacheById.set(clientVoteIndexId, {
      urls: Array.from(votedUrlsSet),
      expiresAt: Date.now() + this.cacheTtlMs,
    })
  }

  _isSiteBlocklistCacheFresh() {
    return this.siteBlocklistCache instanceof Set && Date.now() < this.siteBlocklistCacheExpiresAt
  }

  _setSiteBlocklistCache(values) {
    this.siteBlocklistCache = new Set(values)
    this.siteBlocklistCacheExpiresAt = Date.now() + this.cacheTtlMs
  }

  _invalidateSiteBlocklistCache() {
    this.siteBlocklistCache = null
    this.siteBlocklistCacheExpiresAt = 0
  }

  _isVoteBlocklistCacheFresh() {
    return this.voteBlocklistCache instanceof Set && Date.now() < this.voteBlocklistCacheExpiresAt
  }

  _setVoteBlocklistCache(values) {
    this.voteBlocklistCache = new Set(values)
    this.voteBlocklistCacheExpiresAt = Date.now() + this.cacheTtlMs
  }

  _invalidateVoteBlocklistCache() {
    this.voteBlocklistCache = null
    this.voteBlocklistCacheExpiresAt = 0
  }

  _isMaintenanceStateCacheFresh() {
    return this.maintenanceStateCache !== null && Date.now() < this.maintenanceStateCacheExpiresAt
  }

  _setMaintenanceStateCache(value) {
    this.maintenanceStateCache = buildMaintenanceState(value)
    this.maintenanceStateCacheExpiresAt = Date.now() + this.cacheTtlMs
  }

  _invalidateMaintenanceStateCache() {
    this.maintenanceStateCache = null
    this.maintenanceStateCacheExpiresAt = 0
  }

  _invalidateAllCaches() {
    this._invalidateShowcaseCache()
    this._invalidatePendingCache()
    this._invalidateSiteBlocklistCache()
    this._invalidateVoteBlocklistCache()
    this._invalidateMaintenanceStateCache()
    this.clientVotesCacheById.clear()
  }

  _extractScanResult(scanResult) {
    if (Array.isArray(scanResult) && scanResult.length >= 2) {
      return {
        cursor: String(scanResult[0] ?? '0'),
        keys: Array.isArray(scanResult[1]) ? scanResult[1] : [],
      }
    }

    if (scanResult && typeof scanResult === 'object') {
      const cursor = String(scanResult.cursor ?? scanResult[0] ?? '0')
      const keys = Array.isArray(scanResult.keys)
        ? scanResult.keys
        : Array.isArray(scanResult[1])
          ? scanResult[1]
          : []
      return { cursor, keys }
    }

    return { cursor: '0', keys: [] }
  }

  async _scanKeysByPattern(pattern) {
    const keys = []
    let cursor = '0'

    try {
      do {
        const scanResult = await this.redis.scan(cursor, { match: pattern, count: 200 })
        const parsed = this._extractScanResult(scanResult)
        cursor = parsed.cursor
        for (const key of parsed.keys) {
          if (typeof key === 'string' && key.trim()) {
            keys.push(key)
          }
        }
      } while (cursor !== '0')
    } catch (error) {
      console.error('Redis scan failed', error)
      return []
    }

    return keys
  }

  async _listClientVoteKeys() {
    return this._scanKeysByPattern(`${SHOWCASE_CLIENT_VOTES_PREFIX}*`)
  }

  async reconcileUpvoteCounts() {
    try {
      const clientVoteKeys = await this._listClientVoteKeys()
      if (clientVoteKeys.length === 0) {
        return {
          updatedEntries: 0,
          activeVoteUrls: 0,
          scannedClientVoteGroups: 0,
        }
      }

      const activeVoteCounts = new Map()
      for (const key of clientVoteKeys) {
        const rawUrls = await this.redis.smembers(key)
        const countsForClient = buildActiveVoteCountByUrl([rawUrls])
        for (const [normalizedUrl, count] of countsForClient.entries()) {
          activeVoteCounts.set(normalizedUrl, (activeVoteCounts.get(normalizedUrl) ?? 0) + count)
        }
      }

      const writeOperations = this.redis.multi()
      let updatedEntries = 0

      for (const [normalizedUrl, activeVoteCount] of activeVoteCounts.entries()) {
        const entryId = encodeEntryId(normalizedUrl)
        const entryKey = entryKeyFromId(entryId)
        const rawEntry = await this.redis.hgetall(entryKey)
        const entry = parseStoredEntry(rawEntry, { entryId, normalizedUrl })
        if (!entry) {
          continue
        }

        const storedCount = toNonNegativeInteger(entry.upvoteCount)
        const nextCount = Math.max(storedCount, activeVoteCount)
        if (nextCount === storedCount) {
          continue
        }

        writeOperations.hset(entryKey, { uv: nextCount })
        updatedEntries += 1
      }

      if (updatedEntries > 0) {
        await writeOperations.exec()
        this._invalidateShowcaseCache()
      }

      return {
        updatedEntries,
        activeVoteUrls: activeVoteCounts.size,
        scannedClientVoteGroups: clientVoteKeys.length,
      }
    } catch (error) {
      console.error('Redis reconcileUpvoteCounts failed', error)
      throw new ShowcaseStorageError('Réconciliation Redis des votes indisponible.', 503)
    }
  }

  async _clearAllData() {
    const entryIds = await this.redis.zrange(SHOWCASE_INDEX_KEY, 0, MAX_STORED_ENTRIES - 1)
    const pendingIds = await this.redis.zrange(PENDING_INDEX_KEY, 0, MAX_PENDING_STORED_ENTRIES - 1)
    const clientVoteKeys = await this._listClientVoteKeys()

    const cleanup = this.redis
      .multi()
      .del(SHOWCASE_INDEX_KEY)
      .del(PENDING_INDEX_KEY)
      .del(PENDING_BY_URL_HASH_KEY)
      .del(SITE_BLOCKLIST_KEY)
      .del(VOTE_BLOCKLIST_KEY)
      .del(MAINTENANCE_STATE_KEY)
      .del(SHOWCASE_SLUG_REDIRECTS_KEY)

    for (const entryId of Array.isArray(entryIds) ? entryIds : []) {
      if (typeof entryId !== 'string' || !entryId.trim()) {
        continue
      }
      cleanup.del(entryKeyFromId(entryId))
      cleanup.del(votesKeyFromId(entryId))
    }

    for (const pendingId of Array.isArray(pendingIds) ? pendingIds : []) {
      if (typeof pendingId !== 'string' || !pendingId.trim()) {
        continue
      }
      cleanup.del(pendingKeyFromId(pendingId))
    }

    for (const key of clientVoteKeys) {
      cleanup.del(key)
    }

    await cleanup.exec()
    this._invalidateAllCaches()
  }

  async upsert(entry) {
    const entryId = encodeEntryId(entry.normalizedUrl)
    const key = entryKeyFromId(entryId)
    const timestampScore = Date.parse(entry.updatedAt) || Date.now()

    try {
      await this.redis.multi()
        .hset(key, serializeEntry(entry))
        .zadd(SHOWCASE_INDEX_KEY, { score: timestampScore, member: entryId })
        .exec()

      const totalEntries = await this.redis.zcard(SHOWCASE_INDEX_KEY)
      if (typeof totalEntries === 'number' && totalEntries > MAX_STORED_ENTRIES) {
        const overflow = totalEntries - MAX_STORED_ENTRIES
        await this.redis.zremrangebyrank(SHOWCASE_INDEX_KEY, 0, overflow - 1)
      }

      this._invalidateShowcaseCache()
      return entry
    } catch (error) {
      console.error('Redis upsert failed', error)
      throw new ShowcaseStorageError('Échec de persistance Redis.', 503)
    }
  }

  async getByNormalizedUrl(normalizedUrl) {
    if (this._isShowcaseCacheFresh()) {
      const cachedEntry = this.showcaseCacheByUrl.get(normalizedUrl)
      if (cachedEntry) {
        return cachedEntry
      }
    }

    const entryId = encodeEntryId(normalizedUrl)

    try {
      const rawEntry = await this.redis.hgetall(entryKeyFromId(entryId))
      return parseStoredEntry(rawEntry, { entryId, normalizedUrl })
    } catch (error) {
      console.error('Redis getByNormalizedUrl failed', error)
      throw new ShowcaseStorageError('Lecture Redis indisponible.', 503)
    }
  }

  async list(options = {}) {
    if (this._isShowcaseCacheFresh()) {
      const filtered = applyEntryFilters(this.showcaseCacheEntries, options)
      const limit = parseLimit(options.limit)
      return filtered.slice(0, limit)
    }

    try {
      const entryIds = await this.redis.zrange(SHOWCASE_INDEX_KEY, 0, MAX_STORED_ENTRIES - 1, { rev: true })
      if (!Array.isArray(entryIds) || entryIds.length === 0) {
        this._setShowcaseCache([])
        return []
      }

      const entries = []
      for (const entryId of entryIds) {
        const rawEntry = await this.redis.hgetall(entryKeyFromId(entryId))
        const parsed = parseStoredEntry(rawEntry, { entryId })
        if (parsed) {
          entries.push(parsed)
        }
      }

      this._setShowcaseCache(entries)
      const filtered = applyEntryFilters(entries, options)
      const limit = parseLimit(options.limit)
      return filtered.slice(0, limit)
    } catch (error) {
      console.error('Redis list failed', error)
      throw new ShowcaseStorageError('Lecture Redis indisponible.', 503)
    }
  }

  async deleteByNormalizedUrl(normalizedUrl) {
    const entryId = encodeEntryId(normalizedUrl)

    try {
      await this.redis
        .multi()
        .del(entryKeyFromId(entryId))
        .del(votesKeyFromId(entryId))
        .zrem(SHOWCASE_INDEX_KEY, entryId)
        .exec()
      this._invalidateShowcaseCache()
      for (const [clientVoteIndexId, cached] of this.clientVotesCacheById.entries()) {
        if (!cached.urls.includes(normalizedUrl)) {
          continue
        }

        const nextSet = new Set(cached.urls)
        nextSet.delete(normalizedUrl)
        this._setClientVotesCache(clientVoteIndexId, nextSet)
      }
      return true
    } catch (error) {
      console.error('Redis deleteByNormalizedUrl failed', error)
      throw new ShowcaseStorageError('Suppression Redis indisponible.', 503)
    }
  }

  async rememberSlugRedirect(slug, normalizedUrl) {
    const safeSlug = normalizeSlugCandidate(slug)
    const safeUrl = normalizeUrlCandidate(normalizedUrl)
    if (!safeSlug || !safeUrl) {
      return false
    }

    try {
      await this.redis.hset(SHOWCASE_SLUG_REDIRECTS_KEY, { [safeSlug]: safeUrl })
      return true
    } catch (error) {
      console.error('Redis rememberSlugRedirect failed', error)
      throw new ShowcaseStorageError('Écriture Redis des redirections indisponible.', 503)
    }
  }

  async resolveSlugRedirect(slug) {
    const safeSlug = normalizeSlugCandidate(slug)
    if (!safeSlug) {
      return null
    }

    try {
      const normalizedUrl = await this.redis.hget(SHOWCASE_SLUG_REDIRECTS_KEY, safeSlug)
      return normalizeUrlCandidate(normalizedUrl) ?? null
    } catch (error) {
      console.error('Redis resolveSlugRedirect failed', error)
      throw new ShowcaseStorageError('Lecture Redis des redirections indisponible.', 503)
    }
  }

  async listSiteBlocklist() {
    if (this._isSiteBlocklistCacheFresh()) {
      return sortNormalizedUrlList(this.siteBlocklistCache)
    }

    try {
      const members = await this.redis.smembers(SITE_BLOCKLIST_KEY)
      const values = new Set(
        Array.isArray(members) ? members.filter((value) => typeof value === 'string' && value.trim()) : [],
      )
      this._setSiteBlocklistCache(values)
      return sortNormalizedUrlList(values)
    } catch (error) {
      console.error('Redis listSiteBlocklist failed', error)
      throw new ShowcaseStorageError('Lecture Redis de la blocklist indisponible.', 503)
    }
  }

  async listVoteBlocklist() {
    if (this._isVoteBlocklistCacheFresh()) {
      return sortNormalizedUrlList(this.voteBlocklistCache)
    }

    try {
      const members = await this.redis.smembers(VOTE_BLOCKLIST_KEY)
      const values = new Set(
        Array.isArray(members) ? members.filter((value) => typeof value === 'string' && value.trim()) : [],
      )
      this._setVoteBlocklistCache(values)
      return sortNormalizedUrlList(values)
    } catch (error) {
      console.error('Redis listVoteBlocklist failed', error)
      throw new ShowcaseStorageError('Lecture Redis du blocage des votes indisponible.', 503)
    }
  }

  async isSiteBlocked(normalizedUrl) {
    if (this._isSiteBlocklistCacheFresh()) {
      return this.siteBlocklistCache.has(normalizedUrl)
    }

    try {
      const isMember = await this.redis.sismember(SITE_BLOCKLIST_KEY, normalizedUrl)
      return isMember === 1 || isMember === true
    } catch (error) {
      console.error('Redis isSiteBlocked failed', error)
      throw new ShowcaseStorageError('Lecture Redis de la blocklist indisponible.', 503)
    }
  }

  async isVotesBlocked(normalizedUrl) {
    if (this._isVoteBlocklistCacheFresh()) {
      return this.voteBlocklistCache.has(normalizedUrl)
    }

    try {
      const isMember = await this.redis.sismember(VOTE_BLOCKLIST_KEY, normalizedUrl)
      return isMember === 1 || isMember === true
    } catch (error) {
      console.error('Redis isVotesBlocked failed', error)
      throw new ShowcaseStorageError('Lecture Redis du blocage des votes indisponible.', 503)
    }
  }

  async setSiteBlocked(normalizedUrl, blocked) {
    try {
      if (blocked) {
        await this.redis.sadd(SITE_BLOCKLIST_KEY, normalizedUrl)
      } else {
        await this.redis.srem(SITE_BLOCKLIST_KEY, normalizedUrl)
      }

      this._invalidateSiteBlocklistCache()
      return blocked
    } catch (error) {
      console.error('Redis setSiteBlocked failed', error)
      throw new ShowcaseStorageError('Écriture Redis de la blocklist indisponible.', 503)
    }
  }

  async setVotesBlocked(normalizedUrl, blocked) {
    try {
      if (blocked) {
        await this.redis.sadd(VOTE_BLOCKLIST_KEY, normalizedUrl)
      } else {
        await this.redis.srem(VOTE_BLOCKLIST_KEY, normalizedUrl)
      }

      this._invalidateVoteBlocklistCache()
      return blocked
    } catch (error) {
      console.error('Redis setVotesBlocked failed', error)
      throw new ShowcaseStorageError('Écriture Redis du blocage des votes indisponible.', 503)
    }
  }

  async getMaintenanceState() {
    if (this._isMaintenanceStateCacheFresh()) {
      return { ...this.maintenanceStateCache }
    }

    try {
      const rawValue = await this.redis.get(MAINTENANCE_STATE_KEY)
      let parsedValue = null

      if (typeof rawValue === 'string') {
        try {
          parsedValue = JSON.parse(rawValue)
        } catch {
          parsedValue = null
        }
      } else if (rawValue && typeof rawValue === 'object') {
        parsedValue = rawValue
      }

      const normalized = buildMaintenanceState(parsedValue)
      this._setMaintenanceStateCache(normalized)
      return { ...normalized }
    } catch (error) {
      console.error('Redis getMaintenanceState failed', error)
      throw new ShowcaseStorageError('Lecture Redis du mode maintenance indisponible.', 503)
    }
  }

  async setMaintenanceState(nextState) {
    const normalized = buildMaintenanceState({
      ...nextState,
      updatedAt: nextState?.updatedAt ?? new Date().toISOString(),
    })

    try {
      await this.redis.set(MAINTENANCE_STATE_KEY, JSON.stringify(normalized))
      this._setMaintenanceStateCache(normalized)
      return { ...normalized }
    } catch (error) {
      console.error('Redis setMaintenanceState failed', error)
      throw new ShowcaseStorageError('Écriture Redis du mode maintenance indisponible.', 503)
    }
  }

  async listClientVotedUrls(clientVoteIndexId) {
    const normalizedClientVoteIndexId = normalizeClientVoteIndexId(clientVoteIndexId)
    if (!normalizedClientVoteIndexId) {
      return new Set()
    }

    const cached = this._getCachedClientVotedUrls(normalizedClientVoteIndexId)
    if (cached) {
      return cached
    }

    const key = clientVotesKeyFromId(normalizedClientVoteIndexId)

    try {
      const rawUrls = await this.redis.smembers(key)
      const votedUrls = new Set(
        Array.isArray(rawUrls) ? rawUrls.filter((value) => typeof value === 'string' && value.trim()) : [],
      )
      this._setClientVotesCache(normalizedClientVoteIndexId, votedUrls)
      return votedUrls
    } catch (error) {
      console.error('Redis listClientVotedUrls failed', error)
      throw new ShowcaseStorageError('Lecture Redis des votes client indisponible.', 503)
    }
  }

  async hasVoted(normalizedUrl, voterFingerprints) {
    const tokens = buildVoteTokenCandidates(voterFingerprints)
    if (tokens.length === 0) {
      return false
    }

    const entryId = encodeEntryId(normalizedUrl)
    const key = votesKeyFromId(entryId)

    try {
      for (const token of tokens) {
        const isMember = await this.redis.sismember(key, token)
        if (isMember === 1 || isMember === true) {
          return true
        }
      }
      return false
    } catch (error) {
      console.error('Redis hasVoted failed', error)
      throw new ShowcaseStorageError('Lecture Redis des votes indisponible.', 503)
    }
  }

  async registerUpvote(normalizedUrl, voterFingerprints, clientVoteIndexId) {
    const entry = await this.getByNormalizedUrl(normalizedUrl)
    if (!entry) {
      return null
    }

    const writeTokens = normalizeVoteTokens(voterFingerprints)
    const checkTokens = buildVoteTokenCandidates(voterFingerprints)
    const normalizedClientVoteIndexId = normalizeClientVoteIndexId(clientVoteIndexId)
    const clientVoteToken = readClientVoteToken(voterFingerprints)
    const clientVoteKey = normalizedClientVoteIndexId
      ? clientVotesKeyFromId(normalizedClientVoteIndexId)
      : null
    if (!normalizedClientVoteIndexId || !clientVoteKey || writeTokens.length === 0 || checkTokens.length === 0 || !clientVoteToken) {
      throw new ShowcaseStorageError('Identifiant de vote invalide.', 400)
    }

    const entryId = encodeEntryId(normalizedUrl)
    const voteKey = votesKeyFromId(entryId)

    try {
      const [clientUrlExists, clientTokenExists] = await Promise.all([
        this.redis.sismember(clientVoteKey, normalizedUrl),
        this.redis.sismember(voteKey, clientVoteToken),
      ])

      if (clientUrlExists === 1 || clientUrlExists === true || clientTokenExists === 1 || clientTokenExists === true) {
        if (clientUrlExists !== 1 && clientUrlExists !== true) {
          await this.redis.sadd(clientVoteKey, normalizedUrl)
          await this.redis.expire(clientVoteKey, CLIENT_VOTES_REDIS_TTL_SECONDS)
        }

        const cachedClientVotes = this._getCachedClientVotedUrls(normalizedClientVoteIndexId) ?? new Set()
        cachedClientVotes.add(normalizedUrl)
        this._setClientVotesCache(normalizedClientVoteIndexId, cachedClientVotes)

        return {
          accepted: false,
          alreadyVoted: true,
          hasUpvoted: true,
          entry,
        }
      }

      for (const token of checkTokens) {
        const isMember = await this.redis.sismember(voteKey, token)
        if (isMember === 1 || isMember === true) {
          return {
            accepted: false,
            alreadyVoted: true,
            hasUpvoted: false,
            entry,
          }
        }
      }

      const writeOperations = this.redis.multi().sadd(voteKey, ...writeTokens)
      if (clientVoteKey) {
        writeOperations.sadd(clientVoteKey, normalizedUrl)
      }

      const nextCount = toNonNegativeInteger(entry.upvoteCount) + 1
      writeOperations.hset(entryKeyFromId(entryId), { uv: nextCount })
      await writeOperations.exec()

      if (clientVoteKey) {
        await this.redis.expire(clientVoteKey, CLIENT_VOTES_REDIS_TTL_SECONDS)
        const cachedClientVotes =
          this._getCachedClientVotedUrls(normalizedClientVoteIndexId) ?? new Set()
        cachedClientVotes.add(normalizedUrl)
        this._setClientVotesCache(normalizedClientVoteIndexId, cachedClientVotes)
      }

      this._invalidateShowcaseCache()

      return {
        accepted: true,
        alreadyVoted: false,
        hasUpvoted: true,
        entry: {
          ...entry,
          upvoteCount: nextCount,
        },
      }
    } catch (error) {
      console.error('Redis registerUpvote failed', error)
      throw new ShowcaseStorageError('Persistance Redis des votes indisponible.', 503)
    }
  }

  async unregisterUpvote(normalizedUrl, voterFingerprints, clientVoteIndexId) {
    const entry = await this.getByNormalizedUrl(normalizedUrl)
    if (!entry) {
      return null
    }

    const writeTokens = normalizeVoteTokens(voterFingerprints)
    const normalizedClientVoteIndexId = normalizeClientVoteIndexId(clientVoteIndexId)
    const clientVoteToken = readClientVoteToken(voterFingerprints)
    const clientVoteKey = normalizedClientVoteIndexId
      ? clientVotesKeyFromId(normalizedClientVoteIndexId)
      : null
    if (!normalizedClientVoteIndexId || !clientVoteKey || writeTokens.length === 0 || !clientVoteToken) {
      throw new ShowcaseStorageError('Identifiant de vote invalide.', 400)
    }

    const entryId = encodeEntryId(normalizedUrl)
    const voteKey = votesKeyFromId(entryId)

    try {
      const [clientUrlExists, clientTokenExists] = await Promise.all([
        this.redis.sismember(clientVoteKey, normalizedUrl),
        this.redis.sismember(voteKey, clientVoteToken),
      ])

      if (clientTokenExists !== 1 && clientTokenExists !== true) {
        if (clientUrlExists === 1 || clientUrlExists === true) {
          await this.redis.srem(clientVoteKey, normalizedUrl)
        }

        const cachedClientVotes = this._getCachedClientVotedUrls(normalizedClientVoteIndexId) ?? new Set()
        cachedClientVotes.delete(normalizedUrl)
        this._setClientVotesCache(normalizedClientVoteIndexId, cachedClientVotes)

        return {
          removed: false,
          hasUpvoted: false,
          entry,
        }
      }

      const nextCount = Math.max(0, toNonNegativeInteger(entry.upvoteCount) - 1)
      await this.redis
        .multi()
        .srem(voteKey, ...writeTokens)
        .srem(clientVoteKey, normalizedUrl)
        .hset(entryKeyFromId(entryId), { uv: nextCount })
        .exec()

      const cachedClientVotes = this._getCachedClientVotedUrls(normalizedClientVoteIndexId) ?? new Set()
      cachedClientVotes.delete(normalizedUrl)
      this._setClientVotesCache(normalizedClientVoteIndexId, cachedClientVotes)
      this._invalidateShowcaseCache()

      return {
        removed: true,
        hasUpvoted: false,
        entry: {
          ...entry,
          upvoteCount: nextCount,
        },
      }
    } catch (error) {
      console.error('Redis unregisterUpvote failed', error)
      throw new ShowcaseStorageError('Persistance Redis des votes indisponible.', 503)
    }
  }

  async upsertPending(entry) {
    const key = pendingKeyFromId(entry.submissionId)
    const timestampScore = Date.parse(entry.createdAt) || Date.now()

    try {
      await this.redis
        .multi()
        .hset(key, serializePendingEntry(entry))
        .zadd(PENDING_INDEX_KEY, { score: timestampScore, member: entry.submissionId })
        .exec()

      const totalEntries = await this.redis.zcard(PENDING_INDEX_KEY)
      if (typeof totalEntries === 'number' && totalEntries > MAX_PENDING_STORED_ENTRIES) {
        const overflow = totalEntries - MAX_PENDING_STORED_ENTRIES
        const expiredEntryIds = await this.redis.zrange(PENDING_INDEX_KEY, 0, overflow - 1)
        const cleanup = this.redis.multi()
        cleanup.zremrangebyrank(PENDING_INDEX_KEY, 0, overflow - 1)
        for (const entryId of expiredEntryIds) {
          cleanup.del(pendingKeyFromId(entryId))
        }
        await cleanup.exec()
      }

      this._invalidatePendingCache()
      return entry
    } catch (error) {
      console.error('Redis upsertPending failed', error)
      throw new ShowcaseStorageError('Échec de persistance de la file de modération.', 503)
    }
  }

  async reserveGithubNotificationSlot({ limit, windowMs }) {
    const currentWindow = Math.floor(Date.now() / windowMs)
    const key = `${GITHUB_NOTIFY_WINDOW_KEY_PREFIX}${currentWindow}`
    const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000) + 60)

    try {
      const nextCount = await this.redis.incr(key)
      if (nextCount === 1) {
        await this.redis.expire(key, ttlSeconds)
      }

      return {
        allowed: nextCount <= limit,
        remaining: Math.max(0, limit - nextCount),
        resetAt: new Date((currentWindow + 1) * windowMs).toISOString(),
      }
    } catch (error) {
      console.error('Redis reserveGithubNotificationSlot failed', error)
      throw new ShowcaseStorageError('Protection anti-abus des notifications indisponible.', 503)
    }
  }

  async getPendingById(submissionId) {
    if (this._isPendingCacheFresh()) {
      const cachedEntry = this.pendingCacheById.get(submissionId)
      if (cachedEntry) {
        return cachedEntry
      }
    }

    try {
      const rawEntry = await this.redis.hgetall(pendingKeyFromId(submissionId))
      const parsed = parsePendingEntry(rawEntry, { submissionId })
      if (parsed && this._isPendingCacheFresh()) {
        this.pendingCacheById.set(parsed.submissionId, parsed)
      }
      return parsed
    } catch (error) {
      console.error('Redis getPendingById failed', error)
      throw new ShowcaseStorageError('Lecture Redis de modération indisponible.', 503)
    }
  }

  async getPendingByNormalizedUrl(normalizedUrl) {
    if (this._isPendingCacheFresh()) {
      const cachedEntry = this.pendingCacheEntries.find((entry) => entry.normalizedUrl === normalizedUrl)
      if (cachedEntry) {
        return cachedEntry
      }
    }

    try {
      const pendingSubmissionId = encodeEntryId(normalizedUrl)
      const rawEntry = await this.redis.hgetall(pendingKeyFromId(pendingSubmissionId))
      const parsed = parsePendingEntry(rawEntry, { submissionId: pendingSubmissionId, normalizedUrl })
      if (!parsed) {
        await this.redis.zrem(PENDING_INDEX_KEY, pendingSubmissionId)
        return null
      }

      if (this._isPendingCacheFresh()) {
        this.pendingCacheById.set(parsed.submissionId, parsed)
      }
      return parsed
    } catch (error) {
      console.error('Redis getPendingByNormalizedUrl failed', error)
      throw new ShowcaseStorageError('Lecture Redis de modération indisponible.', 503)
    }
  }

  async deletePendingById(submissionId) {
    try {
      await this.redis.multi().del(pendingKeyFromId(submissionId)).zrem(PENDING_INDEX_KEY, submissionId).exec()
      this._invalidatePendingCache()
      return true
    } catch (error) {
      console.error('Redis deletePendingById failed', error)
      throw new ShowcaseStorageError('Suppression Redis de modération indisponible.', 503)
    }
  }

  async listPending(options = {}) {
    if (this._isPendingCacheFresh()) {
      const limit = parsePendingLimit(options.limit)
      return this.pendingCacheEntries.slice(0, limit)
    }

    try {
      const entryIds = await this.redis.zrange(PENDING_INDEX_KEY, 0, MAX_PENDING_STORED_ENTRIES - 1, { rev: true })
      if (!Array.isArray(entryIds) || entryIds.length === 0) {
        this._setPendingCache([])
        return []
      }

      const entries = []
      for (const entryId of entryIds) {
        const rawEntry = await this.redis.hgetall(pendingKeyFromId(entryId))
        const parsed = parsePendingEntry(rawEntry, { submissionId: entryId })
        if (parsed) {
          entries.push(parsed)
        }
      }

      this._setPendingCache(entries)
      const limit = parsePendingLimit(options.limit)
      return entries.slice(0, limit)
    } catch (error) {
      console.error('Redis listPending failed', error)
      throw new ShowcaseStorageError('Lecture Redis de modération indisponible.', 503)
    }
  }

  async exportArchive() {
    try {
      const [entries, pendingEntries, siteBlocklist, voteBlocklist, maintenanceState] = await Promise.all([
        this.list({ limit: MAX_STORED_ENTRIES }),
        this.listPending({ limit: MAX_PENDING_STORED_ENTRIES }),
        this.listSiteBlocklist(),
        this.listVoteBlocklist(),
        this.getMaintenanceState(),
      ])

      const voteTokensByUrl = []
      for (const entry of entries) {
        const voteKey = votesKeyFromId(encodeEntryId(entry.normalizedUrl))
        const rawTokens = await this.redis.smembers(voteKey)
        const tokens = normalizeVoteTokenList(rawTokens)
        if (tokens.length > 0) {
          voteTokensByUrl.push({
            normalizedUrl: entry.normalizedUrl,
            tokens,
          })
        }
      }

      const clientVotesByIndex = []
      const clientVoteKeys = await this._listClientVoteKeys()
      for (const key of clientVoteKeys) {
        if (!key.startsWith(SHOWCASE_CLIENT_VOTES_PREFIX)) {
          continue
        }

        const rawClientVoteIndexId = key.slice(SHOWCASE_CLIENT_VOTES_PREFIX.length)
        const clientVoteIndexId = normalizeClientVoteIndexId(rawClientVoteIndexId)
        if (!clientVoteIndexId) {
          continue
        }

        const rawUrls = await this.redis.smembers(key)
        const urls = normalizeArchiveUrlList(rawUrls)
        if (urls.length > 0) {
          clientVotesByIndex.push({
            clientVoteIndexId,
            urls,
          })
        }
      }

      const rawSlugRedirects = await this.redis.hgetall(SHOWCASE_SLUG_REDIRECTS_KEY)
      const slugRedirects = []
      if (rawSlugRedirects && typeof rawSlugRedirects === 'object') {
        for (const [slug, rawUrl] of Object.entries(rawSlugRedirects)) {
          const safeSlug = normalizeSlugCandidate(slug)
          const normalizedUrl = normalizeUrlCandidate(rawUrl)
          if (!safeSlug || !normalizedUrl) {
            continue
          }
          slugRedirects.push({ slug: safeSlug, normalizedUrl })
        }
      }
      slugRedirects.sort((left, right) => left.slug.localeCompare(right.slug, 'fr'))

      return buildArchivePayload(this.mode, {
        entries,
        pendingEntries,
        siteBlocklist,
        voteBlocklist,
        maintenanceState,
        voteTokensByUrl,
        clientVotesByIndex,
        slugRedirects,
      })
    } catch (error) {
      console.error('Redis exportArchive failed', error)
      throw new ShowcaseStorageError('Export de la base indisponible.', 503)
    }
  }

  async importArchive(payload, mode = 'merge') {
    if (mode !== 'merge' && mode !== 'replace') {
      throw new ShowcaseStorageError('Mode d’import invalide. Utilisez merge ou replace.', 400)
    }

    const normalized = normalizeArchiveImportPayload(payload)
    if (!normalized) {
      throw new ShowcaseStorageError('Archive invalide.', 400)
    }

    try {
      if (mode === 'replace') {
        await this._clearAllData()
      }

      for (const entry of normalized.entries) {
        await this.upsert(entry)
      }
      for (const pendingEntry of normalized.pendingEntries) {
        await this.upsertPending(pendingEntry)
      }

      if (normalized.siteBlocklist.length > 0) {
        await this.redis.sadd(SITE_BLOCKLIST_KEY, ...normalized.siteBlocklist)
      }
      if (normalized.voteBlocklist.length > 0) {
        await this.redis.sadd(VOTE_BLOCKLIST_KEY, ...normalized.voteBlocklist)
      }
      if (normalized.hasMaintenanceState && normalized.maintenanceState) {
        await this.redis.set(MAINTENANCE_STATE_KEY, JSON.stringify(buildMaintenanceState(normalized.maintenanceState)))
      }

      const voteWrite = this.redis.multi()
      for (const voteEntry of normalized.voteTokensByUrl) {
        if (voteEntry.tokens.length === 0) {
          continue
        }
        const voteKey = votesKeyFromId(encodeEntryId(voteEntry.normalizedUrl))
        voteWrite.sadd(voteKey, ...voteEntry.tokens)
      }
      await voteWrite.exec()

      const clientVotesWrite = this.redis.multi()
      for (const clientVoteEntry of normalized.clientVotesByIndex) {
        if (clientVoteEntry.urls.length === 0) {
          continue
        }
        const clientVoteKey = clientVotesKeyFromId(clientVoteEntry.clientVoteIndexId)
        clientVotesWrite.sadd(clientVoteKey, ...clientVoteEntry.urls)
        clientVotesWrite.expire(clientVoteKey, CLIENT_VOTES_REDIS_TTL_SECONDS)
      }
      await clientVotesWrite.exec()

      if (normalized.slugRedirects.length > 0) {
        const slugRedirectPayload = {}
        for (const entry of normalized.slugRedirects) {
          slugRedirectPayload[entry.slug] = entry.normalizedUrl
        }
        await this.redis.hset(SHOWCASE_SLUG_REDIRECTS_KEY, slugRedirectPayload)
      }

      await this.reconcileUpvoteCounts()

      this._invalidateAllCaches()

      const [entriesCount, pendingCount, siteBlocklistCount, voteBlocklistCount, slugRedirectsCount] = await Promise.all([
        this.redis.zcard(SHOWCASE_INDEX_KEY),
        this.redis.zcard(PENDING_INDEX_KEY),
        this.redis.scard(SITE_BLOCKLIST_KEY),
        this.redis.scard(VOTE_BLOCKLIST_KEY),
        this.redis.hlen(SHOWCASE_SLUG_REDIRECTS_KEY),
      ])

      return {
        mode,
        imported: {
          entries: normalized.entries.length,
          pendingEntries: normalized.pendingEntries.length,
          siteBlocklist: normalized.siteBlocklist.length,
          voteBlocklist: normalized.voteBlocklist.length,
          maintenanceState: normalized.hasMaintenanceState ? 1 : 0,
          voteTokenGroups: normalized.voteTokensByUrl.length,
          clientVoteGroups: normalized.clientVotesByIndex.length,
          slugRedirects: normalized.slugRedirects.length,
        },
        totals: {
          entries: toNonNegativeInteger(entriesCount),
          pendingEntries: toNonNegativeInteger(pendingCount),
          siteBlocklist: toNonNegativeInteger(siteBlocklistCount),
          voteBlocklist: toNonNegativeInteger(voteBlocklistCount),
          maintenanceEnabled:
            normalized.hasMaintenanceState && normalized.maintenanceState?.enabled
              ? 1
              : (await this.getMaintenanceState()).enabled
                ? 1
                : 0,
          slugRedirects: toNonNegativeInteger(slugRedirectsCount),
        },
      }
    } catch (error) {
      console.error('Redis importArchive failed', error)
      if (error instanceof ShowcaseStorageError) {
        throw error
      }
      throw new ShowcaseStorageError('Import de la base indisponible.', 503)
    }
  }
}

export function createShowcaseStorage() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

  if (url && token) {
    const redis = new Redis({ url, token })
    return new UpstashShowcaseStorage(redis)
  }

  return new InMemoryShowcaseStorage()
}

export function buildShowcaseEntry(siteInsight, rawCategory) {
  return {
    ...siteInsight,
    rgaaBaseline: '4.1',
    rgaaBaselineEdited: false,
    upvoteCount: toNonNegativeInteger(siteInsight.upvoteCount),
    category: sanitizeCategory(rawCategory),
  }
}

export function buildPendingSubmission(siteInsight, rawCategory, rawReason) {
  return {
    submissionId: encodeEntryId(siteInsight.normalizedUrl),
    normalizedUrl: siteInsight.normalizedUrl,
    siteTitle: siteInsight.siteTitle,
    thumbnailUrl: siteInsight.thumbnailUrl ?? null,
    accessibilityPageUrl: siteInsight.accessibilityPageUrl ?? null,
    complianceStatus: siteInsight.complianceStatus ?? null,
    complianceStatusLabel: siteInsight.complianceStatusLabel ?? null,
    complianceScore: siteInsight.complianceScore ?? null,
    rgaaBaseline: '4.1',
    rgaaBaselineEdited: false,
    updatedAt: siteInsight.updatedAt,
    createdAt: new Date().toISOString(),
    reviewReason: typeof rawReason === 'string' ? rawReason : null,
    category: sanitizeCategory(rawCategory),
  }
}
