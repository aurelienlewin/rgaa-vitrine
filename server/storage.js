import { Redis } from '@upstash/redis'

const SHOWCASE_INDEX_KEY = 'rgaa:vitrine:showcase:index'
const SHOWCASE_ENTRY_PREFIX = 'rgaa:vitrine:showcase:entry:'
const MAX_STORED_ENTRIES = 500
const MAX_LIST_LIMIT = 200
const DEFAULT_LIST_LIMIT = 80

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

  async list(options = {}) {
    const entries = this.#sortedEntries()
    const filtered = applyEntryFilters(entries, options)
    const limit = parseLimit(options.limit)
    return filtered.slice(0, limit)
  }

  #sortedEntries() {
    return Array.from(this.entries.values()).sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt)
      const rightTime = Date.parse(right.updatedAt)
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
      throw new ShowcaseStorageError('Echec de persistence Redis.', 503)
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
}

export function createShowcaseStorage() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

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
