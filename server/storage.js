import { Redis } from '@upstash/redis'

const SHOWCASE_INDEX_KEY = 'rgaa:vitrine:showcase:index'
const SHOWCASE_ENTRY_PREFIX = 'rgaa:vitrine:showcase:entry:'
const SHOWCASE_VOTES_PREFIX = 'rgaa:vitrine:showcase:votes:'
const SHOWCASE_CLIENT_VOTES_PREFIX = 'rgaa:vitrine:showcase:votes:client:'
const SITE_BLOCKLIST_KEY = 'rgaa:vitrine:moderation:blocklist:sites'
const VOTE_BLOCKLIST_KEY = 'rgaa:vitrine:moderation:blocklist:votes'
const PENDING_INDEX_KEY = 'rgaa:vitrine:moderation:pending:index'
const PENDING_ENTRY_PREFIX = 'rgaa:vitrine:moderation:pending:'
const PENDING_BY_URL_HASH_KEY = 'rgaa:vitrine:moderation:pending:by-url'
const MAX_STORED_ENTRIES = 500
const MAX_PENDING_STORED_ENTRIES = 2000
const MAX_LIST_LIMIT = 200
const DEFAULT_LIST_LIMIT = 80
const MAX_PENDING_LIST_LIMIT = 200
const DEFAULT_PENDING_LIST_LIMIT = 80
const DEFAULT_REDIS_CACHE_TTL_MS = 15_000
const MIN_REDIS_CACHE_TTL_MS = 1_000
const MAX_REDIS_CACHE_TTL_MS = 300_000
const CLIENT_VOTES_REDIS_TTL_SECONDS = 180 * 24 * 60 * 60

const ALLOWED_STATUSES = new Set(['full', 'partial', 'none'])

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

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toNonNegativeInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}

function normalizeVoteTokens(voterFingerprints) {
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

function parseStoredEntry(payload) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const normalizedUrl = toNullableString(payload.normalizedUrl)
  const siteTitle = toNullableString(payload.siteTitle)
  const updatedAt = toNullableString(payload.updatedAt)

  if (!normalizedUrl || !siteTitle || !updatedAt) {
    return null
  }

  const complianceStatus = toNullableString(payload.complianceStatus)
  const entry = {
    normalizedUrl,
    siteTitle,
    thumbnailUrl: toNullableString(payload.thumbnailUrl),
    accessibilityPageUrl: toNullableString(payload.accessibilityPageUrl),
    complianceStatus: ALLOWED_STATUSES.has(complianceStatus ?? '') ? complianceStatus : null,
    complianceStatusLabel: toNullableString(payload.complianceStatusLabel),
    complianceScore: toNullableNumber(payload.complianceScore),
    upvoteCount: toNonNegativeInteger(payload.upvoteCount),
    updatedAt,
    category: sanitizeCategory(payload.category),
  }

  return entry
}

function parsePendingEntry(payload) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const submissionId = toNullableString(payload.submissionId)
  const normalizedUrl = toNullableString(payload.normalizedUrl)
  const siteTitle = toNullableString(payload.siteTitle)
  const updatedAt = toNullableString(payload.updatedAt)
  const createdAt = toNullableString(payload.createdAt)

  if (!submissionId || !normalizedUrl || !siteTitle || !updatedAt || !createdAt) {
    return null
  }

  const complianceStatus = toNullableString(payload.complianceStatus)
  return {
    submissionId,
    normalizedUrl,
    siteTitle,
    thumbnailUrl: toNullableString(payload.thumbnailUrl),
    accessibilityPageUrl: toNullableString(payload.accessibilityPageUrl),
    complianceStatus: ALLOWED_STATUSES.has(complianceStatus ?? '') ? complianceStatus : null,
    complianceStatusLabel: toNullableString(payload.complianceStatusLabel),
    complianceScore: toNullableNumber(payload.complianceScore),
    updatedAt,
    createdAt,
    reviewReason: toNullableString(payload.reviewReason),
    category: sanitizeCategory(payload.category),
  }
}

function serializeEntry(entry) {
  return {
    normalizedUrl: entry.normalizedUrl,
    siteTitle: entry.siteTitle,
    thumbnailUrl: entry.thumbnailUrl ?? '',
    accessibilityPageUrl: entry.accessibilityPageUrl ?? '',
    complianceStatus: entry.complianceStatus ?? '',
    complianceStatusLabel: entry.complianceStatusLabel ?? '',
    complianceScore: entry.complianceScore ?? '',
    upvoteCount: toNonNegativeInteger(entry.upvoteCount),
    updatedAt: entry.updatedAt,
    category: entry.category,
  }
}

function serializePendingEntry(entry) {
  return {
    submissionId: entry.submissionId,
    normalizedUrl: entry.normalizedUrl,
    siteTitle: entry.siteTitle,
    thumbnailUrl: entry.thumbnailUrl ?? '',
    accessibilityPageUrl: entry.accessibilityPageUrl ?? '',
    complianceStatus: entry.complianceStatus ?? '',
    complianceStatusLabel: entry.complianceStatusLabel ?? '',
    complianceScore: entry.complianceScore ?? '',
    updatedAt: entry.updatedAt,
    createdAt: entry.createdAt,
    reviewReason: entry.reviewReason ?? '',
    category: entry.category,
  }
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

  async listClientVotedUrls(clientVoteIndexId) {
    const normalizedClientVoteIndexId = normalizeClientVoteIndexId(clientVoteIndexId)
    if (!normalizedClientVoteIndexId) {
      return new Set()
    }

    const votedUrls = this.votesByClient.get(normalizedClientVoteIndexId)
    return votedUrls ? new Set(votedUrls) : new Set()
  }

  async hasVoted(normalizedUrl, voterFingerprints) {
    const tokens = normalizeVoteTokens(voterFingerprints)
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

    const tokens = normalizeVoteTokens(voterFingerprints)
    const normalizedClientVoteIndexId = normalizeClientVoteIndexId(clientVoteIndexId)
    if (tokens.length === 0) {
      throw new ShowcaseStorageError('Identifiant de vote invalide.', 400)
    }

    let set = this.votesByUrl.get(normalizedUrl)
    if (!set) {
      set = new Set()
      this.votesByUrl.set(normalizedUrl, set)
    }

    const alreadyVoted = tokens.some((token) => set.has(token))
    if (alreadyVoted) {
      if (normalizedClientVoteIndexId) {
        const votedUrls = this.votesByClient.get(normalizedClientVoteIndexId) ?? new Set()
        votedUrls.add(normalizedUrl)
        this.votesByClient.set(normalizedClientVoteIndexId, votedUrls)
      }
      return {
        accepted: false,
        alreadyVoted: true,
        entry,
      }
    }

    for (const token of tokens) {
      set.add(token)
    }

    if (normalizedClientVoteIndexId) {
      const votedUrls = this.votesByClient.get(normalizedClientVoteIndexId) ?? new Set()
      votedUrls.add(normalizedUrl)
      this.votesByClient.set(normalizedClientVoteIndexId, votedUrls)
    }

    const updatedEntry = {
      ...entry,
      upvoteCount: toNonNegativeInteger(entry.upvoteCount) + 1,
    }

    this.entries.set(normalizedUrl, updatedEntry)

    return {
      accepted: true,
      alreadyVoted: false,
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

  async getPendingById(submissionId) {
    return this.pendingEntries.get(submissionId) ?? null
  }

  async getPendingByNormalizedUrl(normalizedUrl) {
    for (const entry of this.pendingEntries.values()) {
      if (entry.normalizedUrl === normalizedUrl) {
        return entry
      }
    }
    return null
  }

  async deletePendingById(submissionId) {
    return this.pendingEntries.delete(submissionId)
  }

  async listPending(options = {}) {
    const entries = this.#sortedPendingEntries()
    const limit = parsePendingLimit(options.limit)
    return entries.slice(0, limit)
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
      return parseStoredEntry(rawEntry)
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
        const parsed = parseStoredEntry(rawEntry)
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
    const tokens = normalizeVoteTokens(voterFingerprints)
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

    const tokens = normalizeVoteTokens(voterFingerprints)
    const normalizedClientVoteIndexId = normalizeClientVoteIndexId(clientVoteIndexId)
    const clientVoteKey = normalizedClientVoteIndexId
      ? clientVotesKeyFromId(normalizedClientVoteIndexId)
      : null
    if (tokens.length === 0) {
      throw new ShowcaseStorageError('Identifiant de vote invalide.', 400)
    }

    const entryId = encodeEntryId(normalizedUrl)
    const voteKey = votesKeyFromId(entryId)

    try {
      for (const token of tokens) {
        const isMember = await this.redis.sismember(voteKey, token)
        if (isMember === 1 || isMember === true) {
          if (clientVoteKey) {
            await this.redis.sadd(clientVoteKey, normalizedUrl)
            await this.redis.expire(clientVoteKey, CLIENT_VOTES_REDIS_TTL_SECONDS)
            const cachedClientVotes =
              this._getCachedClientVotedUrls(normalizedClientVoteIndexId) ?? new Set()
            cachedClientVotes.add(normalizedUrl)
            this._setClientVotesCache(normalizedClientVoteIndexId, cachedClientVotes)
          }

          return {
            accepted: false,
            alreadyVoted: true,
            entry,
          }
        }
      }

      const writeOperations = this.redis.multi().sadd(voteKey, ...tokens)
      if (clientVoteKey) {
        writeOperations.sadd(clientVoteKey, normalizedUrl)
      }

      const nextCount = toNonNegativeInteger(entry.upvoteCount) + 1
      writeOperations.hset(entryKeyFromId(entryId), { upvoteCount: nextCount })
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

  async upsertPending(entry) {
    const key = pendingKeyFromId(entry.submissionId)
    const timestampScore = Date.parse(entry.createdAt) || Date.now()

    try {
      const pendingByUrlField = {
        [entry.normalizedUrl]: entry.submissionId,
      }

      await this.redis
        .multi()
        .hset(key, serializePendingEntry(entry))
        .hset(PENDING_BY_URL_HASH_KEY, pendingByUrlField)
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

  async getPendingById(submissionId) {
    if (this._isPendingCacheFresh()) {
      const cachedEntry = this.pendingCacheById.get(submissionId)
      if (cachedEntry) {
        return cachedEntry
      }
    }

    try {
      const rawEntry = await this.redis.hgetall(pendingKeyFromId(submissionId))
      const parsed = parsePendingEntry(rawEntry)
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
      const pendingSubmissionId = toNullableString(await this.redis.hget(PENDING_BY_URL_HASH_KEY, normalizedUrl))
      if (!pendingSubmissionId) {
        return null
      }

      const rawEntry = await this.redis.hgetall(pendingKeyFromId(pendingSubmissionId))
      const parsed = parsePendingEntry(rawEntry)
      if (!parsed) {
        await this.redis.multi().hdel(PENDING_BY_URL_HASH_KEY, normalizedUrl).zrem(PENDING_INDEX_KEY, pendingSubmissionId).exec()
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
      const rawEntry = await this.redis.hgetall(pendingKeyFromId(submissionId))
      const parsed = parsePendingEntry(rawEntry)
      const cleanup = this.redis.multi().del(pendingKeyFromId(submissionId)).zrem(PENDING_INDEX_KEY, submissionId)
      if (parsed?.normalizedUrl) {
        cleanup.hdel(PENDING_BY_URL_HASH_KEY, parsed.normalizedUrl)
      }
      await cleanup.exec()
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
        const parsed = parsePendingEntry(rawEntry)
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
    updatedAt: siteInsight.updatedAt,
    createdAt: new Date().toISOString(),
    reviewReason: typeof rawReason === 'string' ? rawReason : null,
    category: sanitizeCategory(rawCategory),
  }
}
