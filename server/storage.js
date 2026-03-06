import { Redis } from '@upstash/redis'

const SHOWCASE_INDEX_KEY = 'rgaa:vitrine:showcase:index'
const SHOWCASE_ENTRY_PREFIX = 'rgaa:vitrine:showcase:entry:'
const PENDING_INDEX_KEY = 'rgaa:vitrine:moderation:pending:index'
const PENDING_ENTRY_PREFIX = 'rgaa:vitrine:moderation:pending:'
const MAX_STORED_ENTRIES = 500
const MAX_PENDING_STORED_ENTRIES = 2000
const MAX_LIST_LIMIT = 200
const DEFAULT_LIST_LIMIT = 80
const MAX_PENDING_LIST_LIMIT = 200
const DEFAULT_PENDING_LIST_LIMIT = 80

const ALLOWED_STATUSES = new Set(['full', 'partial', 'none'])

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

      return entry
    } catch (error) {
      console.error('Redis upsert failed', error)
      throw new ShowcaseStorageError('Échec de persistance Redis.', 503)
    }
  }

  async getByNormalizedUrl(normalizedUrl) {
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
    try {
      const entryIds = await this.redis.zrange(SHOWCASE_INDEX_KEY, 0, MAX_STORED_ENTRIES - 1, { rev: true })
      if (!Array.isArray(entryIds) || entryIds.length === 0) {
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

      const filtered = applyEntryFilters(entries, options)
      const limit = parseLimit(options.limit)
      return filtered.slice(0, limit)
    } catch (error) {
      console.error('Redis list failed', error)
      throw new ShowcaseStorageError('Lecture Redis indisponible.', 503)
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

      return entry
    } catch (error) {
      console.error('Redis upsertPending failed', error)
      throw new ShowcaseStorageError('Échec de persistance de la file de modération.', 503)
    }
  }

  async getPendingById(submissionId) {
    try {
      const rawEntry = await this.redis.hgetall(pendingKeyFromId(submissionId))
      return parsePendingEntry(rawEntry)
    } catch (error) {
      console.error('Redis getPendingById failed', error)
      throw new ShowcaseStorageError('Lecture Redis de modération indisponible.', 503)
    }
  }

  async getPendingByNormalizedUrl(normalizedUrl) {
    const entries = await this.listPending({ limit: MAX_PENDING_STORED_ENTRIES })
    return entries.find((entry) => entry.normalizedUrl === normalizedUrl) ?? null
  }

  async deletePendingById(submissionId) {
    try {
      await this.redis.multi().del(pendingKeyFromId(submissionId)).zrem(PENDING_INDEX_KEY, submissionId).exec()
      return true
    } catch (error) {
      console.error('Redis deletePendingById failed', error)
      throw new ShowcaseStorageError('Suppression Redis de modération indisponible.', 503)
    }
  }

  async listPending(options = {}) {
    try {
      const entryIds = await this.redis.zrange(PENDING_INDEX_KEY, 0, MAX_PENDING_STORED_ENTRIES - 1, { rev: true })
      if (!Array.isArray(entryIds) || entryIds.length === 0) {
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
