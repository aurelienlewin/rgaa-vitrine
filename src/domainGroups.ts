export type ComplianceStatus = 'full' | 'partial' | 'none' | null
export type DomainRole = 'standalone' | 'primary' | 'child'

export type DomainStatusSummary = {
  full: number
  partial: number
  none: number
  unknown: number
}

export type DomainSiblingSummary = {
  normalizedUrl: string
  slug?: string
  profilePath?: string | null
  siteTitle: string
  updatedAt: string
  category: string
  complianceStatus: ComplianceStatus
  complianceStatusLabel: string | null
  complianceScore: number | null
  accessibilityPageUrl: string | null
  hasAccessibilityPage: boolean
}

export type DomainContext = {
  registrableDomain: string
  groupSlug: string
  groupPath: string | null
  siteCount: number
  publishedSiteCount?: number
  pendingSiteCount?: number
  siblingCount: number
  role: DomainRole
  primarySiteTitle: string | null
  primarySitePath: string | null
  primaryNormalizedUrl: string | null
  statusSummary: DomainStatusSummary
  siblings: DomainSiblingSummary[]
  pendingSiblings?: DomainSiblingSummary[]
}

export type DomainGroup = {
  groupSlug: string
  groupPath: string
  registrableDomain: string
  siteCount: number
  updatedAt: string
  statusSummary: DomainStatusSummary
  primaryEntry: DomainSiblingSummary | null
  children: DomainSiblingSummary[]
}

function readSafeGroupSlug(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  return /^[a-z0-9-]{4,120}$/.test(trimmed) ? trimmed : null
}

function toSafeString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function toSafeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toSafeComplianceStatus(value: unknown): ComplianceStatus {
  return value === 'full' || value === 'partial' || value === 'none' ? value : null
}

function toNonNegativeInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
}

function normalizeStatusSummary(value: unknown): DomainStatusSummary {
  if (!value || typeof value !== 'object') {
    return {
      full: 0,
      partial: 0,
      none: 0,
      unknown: 0,
    }
  }

  const candidate = value as Record<string, unknown>
  return {
    full: toNonNegativeInteger(candidate.full),
    partial: toNonNegativeInteger(candidate.partial),
    none: toNonNegativeInteger(candidate.none),
    unknown: toNonNegativeInteger(candidate.unknown),
  }
}

function normalizeSiblingSummary(value: unknown): DomainSiblingSummary | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.normalizedUrl !== 'string' ||
    typeof candidate.siteTitle !== 'string' ||
    typeof candidate.updatedAt !== 'string' ||
    typeof candidate.category !== 'string'
  ) {
    return null
  }

  const safeSlug = readSafeGroupSlug(candidate.slug)
  const profilePath =
    typeof candidate.profilePath === 'string' && candidate.profilePath.startsWith('/')
      ? candidate.profilePath
      : null

  return {
    normalizedUrl: candidate.normalizedUrl,
    slug: safeSlug ?? undefined,
    profilePath,
    siteTitle: candidate.siteTitle,
    updatedAt: candidate.updatedAt,
    category: candidate.category,
    complianceStatus: toSafeComplianceStatus(candidate.complianceStatus),
    complianceStatusLabel: toSafeString(candidate.complianceStatusLabel),
    complianceScore: toSafeNumber(candidate.complianceScore),
    accessibilityPageUrl: toSafeString(candidate.accessibilityPageUrl),
    hasAccessibilityPage: candidate.hasAccessibilityPage === true,
  }
}

export function normalizeDomainContext(value: unknown): DomainContext | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  const groupSlug = readSafeGroupSlug(candidate.groupSlug)
  if (!groupSlug || typeof candidate.registrableDomain !== 'string') {
    return null
  }

  const siblings = Array.isArray(candidate.siblings)
    ? candidate.siblings.map((item) => normalizeSiblingSummary(item)).filter((item): item is DomainSiblingSummary => item !== null)
    : []
  const pendingSiblings = Array.isArray(candidate.pendingSiblings)
    ? candidate.pendingSiblings
        .map((item) => normalizeSiblingSummary(item))
        .filter((item): item is DomainSiblingSummary => item !== null)
    : []
  const role: DomainRole =
    candidate.role === 'primary' || candidate.role === 'child' || candidate.role === 'standalone'
      ? candidate.role
      : 'standalone'

  return {
    registrableDomain: candidate.registrableDomain,
    groupSlug,
    groupPath:
      typeof candidate.groupPath === 'string' && candidate.groupPath.startsWith('/')
        ? candidate.groupPath
        : null,
    siteCount: toNonNegativeInteger(candidate.siteCount),
    publishedSiteCount:
      candidate.publishedSiteCount === undefined ? undefined : toNonNegativeInteger(candidate.publishedSiteCount),
    pendingSiteCount:
      candidate.pendingSiteCount === undefined ? undefined : toNonNegativeInteger(candidate.pendingSiteCount),
    siblingCount: toNonNegativeInteger(candidate.siblingCount),
    role,
    primarySiteTitle: toSafeString(candidate.primarySiteTitle),
    primarySitePath:
      typeof candidate.primarySitePath === 'string' && candidate.primarySitePath.startsWith('/')
        ? candidate.primarySitePath
        : null,
    primaryNormalizedUrl: toSafeString(candidate.primaryNormalizedUrl),
    statusSummary: normalizeStatusSummary(candidate.statusSummary),
    siblings,
    pendingSiblings,
  }
}

export function normalizeDomainGroup(value: unknown): DomainGroup | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  const groupSlug = readSafeGroupSlug(candidate.groupSlug)
  if (
    !groupSlug ||
    typeof candidate.groupPath !== 'string' ||
    !candidate.groupPath.startsWith('/') ||
    typeof candidate.registrableDomain !== 'string' ||
    typeof candidate.updatedAt !== 'string'
  ) {
    return null
  }

  const primaryEntry = normalizeSiblingSummary(candidate.primaryEntry)
  const children = Array.isArray(candidate.children)
    ? candidate.children.map((item) => normalizeSiblingSummary(item)).filter((item): item is DomainSiblingSummary => item !== null)
    : []

  return {
    groupSlug,
    groupPath: candidate.groupPath,
    registrableDomain: candidate.registrableDomain,
    siteCount: toNonNegativeInteger(candidate.siteCount),
    updatedAt: candidate.updatedAt,
    statusSummary: normalizeStatusSummary(candidate.statusSummary),
    primaryEntry,
    children,
  }
}

export function resolveDomainGroupPath(groupSlug: string) {
  const safeSlug = readSafeGroupSlug(groupSlug)
  return safeSlug ? `/domaine/${safeSlug}` : '/domaine'
}

export function readDomainGroupSlugFromPath(pathname: string) {
  const normalizedPathname = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
  const match = normalizedPathname.match(/^\/domaine\/([a-z0-9-]{4,120})$/)
  return match?.[1] ?? null
}
