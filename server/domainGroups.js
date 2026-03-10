import { getDomain } from 'tldts'

const MAX_SIBLING_PREVIEW = 6

function normalizeForSlug(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function sanitizeSlugPart(value) {
  return normalizeForSlug(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function computeShortHash(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash.toString(36).padStart(6, '0').slice(0, 6)
}

function summarizeStatuses(entries) {
  const summary = {
    full: 0,
    partial: 0,
    none: 0,
    unknown: 0,
  }

  for (const entry of entries) {
    if (entry.complianceStatus === 'full') {
      summary.full += 1
      continue
    }
    if (entry.complianceStatus === 'partial') {
      summary.partial += 1
      continue
    }
    if (entry.complianceStatus === 'none') {
      summary.none += 1
      continue
    }

    summary.unknown += 1
  }

  return summary
}

function toSiblingSummary(entry) {
  return {
    normalizedUrl: entry.normalizedUrl,
    slug: typeof entry.slug === 'string' ? entry.slug : null,
    profilePath: typeof entry.profilePath === 'string' ? entry.profilePath : null,
    siteTitle: typeof entry.siteTitle === 'string' ? entry.siteTitle : entry.normalizedUrl,
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : new Date().toISOString(),
    category: typeof entry.category === 'string' ? entry.category : 'Autre',
    complianceStatus:
      entry.complianceStatus === 'full' || entry.complianceStatus === 'partial' || entry.complianceStatus === 'none'
        ? entry.complianceStatus
        : null,
    complianceStatusLabel:
      typeof entry.complianceStatusLabel === 'string' ? entry.complianceStatusLabel : null,
    complianceScore:
      typeof entry.complianceScore === 'number' && Number.isFinite(entry.complianceScore)
        ? entry.complianceScore
        : null,
    accessibilityPageUrl:
      typeof entry.accessibilityPageUrl === 'string' ? entry.accessibilityPageUrl : null,
    hasAccessibilityPage: Boolean(entry.accessibilityPageUrl),
  }
}

function readUrlParts(normalizedUrl) {
  try {
    return new URL(normalizedUrl)
  } catch {
    return null
  }
}

function compareEntriesForPrimary(left, right, registrableDomain) {
  const leftUrl = readUrlParts(left.normalizedUrl)
  const rightUrl = readUrlParts(right.normalizedUrl)
  const leftHost = leftUrl?.hostname.replace(/^www\./i, '') ?? ''
  const rightHost = rightUrl?.hostname.replace(/^www\./i, '') ?? ''
  const leftPath = leftUrl?.pathname ?? '/'
  const rightPath = rightUrl?.pathname ?? '/'

  if (leftHost === registrableDomain && rightHost !== registrableDomain) {
    return -1
  }
  if (rightHost === registrableDomain && leftHost !== registrableDomain) {
    return 1
  }

  if ((leftPath === '/' || leftPath === '') && rightPath !== '/' && rightPath !== '') {
    return -1
  }
  if ((rightPath === '/' || rightPath === '') && leftPath !== '/' && leftPath !== '') {
    return 1
  }

  if (leftPath.length !== rightPath.length) {
    return leftPath.length - rightPath.length
  }

  const leftUpdatedAt = Date.parse(left.updatedAt)
  const rightUpdatedAt = Date.parse(right.updatedAt)
  if (!Number.isNaN(leftUpdatedAt) && !Number.isNaN(rightUpdatedAt) && leftUpdatedAt !== rightUpdatedAt) {
    return rightUpdatedAt - leftUpdatedAt
  }

  return left.normalizedUrl.localeCompare(right.normalizedUrl, 'fr')
}

function compareChildrenForDisplay(left, right, registrableDomain, primaryNormalizedUrl) {
  if (left.normalizedUrl === primaryNormalizedUrl && right.normalizedUrl !== primaryNormalizedUrl) {
    return -1
  }
  if (right.normalizedUrl === primaryNormalizedUrl && left.normalizedUrl !== primaryNormalizedUrl) {
    return 1
  }

  return compareEntriesForPrimary(left, right, registrableDomain)
}

export function normalizeDomainGroupSlug(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  if (!/^[a-z0-9-]{4,120}$/.test(trimmed)) {
    return null
  }

  return trimmed
}

export function readSiteHost(normalizedUrl) {
  const parsed = readUrlParts(normalizedUrl)
  return parsed ? parsed.hostname.replace(/^www\./i, '') : null
}

export function readSiteOrigin(normalizedUrl) {
  const parsed = readUrlParts(normalizedUrl)
  return parsed ? parsed.origin : null
}

export function readRegistrableDomain(normalizedUrl) {
  const siteHost = readSiteHost(normalizedUrl)
  if (!siteHost) {
    return null
  }

  return getDomain(siteHost, {
    allowPrivateDomains: false,
    detectIp: true,
    validateHostname: false,
  }) ?? siteHost
}

export function buildDomainGroupSlug(registrableDomain) {
  const safeDomain = typeof registrableDomain === 'string' ? registrableDomain.trim().toLowerCase() : ''
  const base = sanitizeSlugPart(safeDomain) || 'domaine'
  return `${base}-${computeShortHash(safeDomain || base)}`
}

export function resolveDomainGroupPath(groupSlug) {
  const safeSlug = normalizeDomainGroupSlug(groupSlug)
  return safeSlug ? `/domaine/${safeSlug}` : null
}

export function buildDomainGroups(entries) {
  const groupsBySlug = new Map()
  const groupsByUrl = new Map()

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || typeof entry.normalizedUrl !== 'string') {
      continue
    }

    const registrableDomain = readRegistrableDomain(entry.normalizedUrl)
    if (!registrableDomain) {
      continue
    }

    const groupSlug = buildDomainGroupSlug(registrableDomain)
    const siteHost = readSiteHost(entry.normalizedUrl)
    const siteOrigin = readSiteOrigin(entry.normalizedUrl)
    const group = groupsBySlug.get(groupSlug) ?? {
      groupSlug,
      groupPath: resolveDomainGroupPath(groupSlug),
      registrableDomain,
      entries: [],
    }

    group.entries.push({
      ...entry,
      registrableDomain,
      domainGroupSlug: groupSlug,
      domainGroupPath: group.groupPath,
      siteHost,
      siteOrigin,
    })
    groupsBySlug.set(groupSlug, group)
  }

  const groups = Array.from(groupsBySlug.values())
    .map((group) => {
      const sortedForPrimary = [...group.entries].sort((left, right) =>
        compareEntriesForPrimary(left, right, group.registrableDomain),
      )
      const primaryEntry = sortedForPrimary[0] ?? null
      const sortedChildren = [...group.entries].sort((left, right) =>
        compareChildrenForDisplay(
          left,
          right,
          group.registrableDomain,
          primaryEntry?.normalizedUrl ?? '',
        ),
      )
      const updatedAt = sortedChildren.reduce((latest, entry) => {
        const currentTimestamp = Date.parse(entry.updatedAt)
        const latestTimestamp = Date.parse(latest)
        if (Number.isNaN(currentTimestamp)) {
          return latest
        }
        if (Number.isNaN(latestTimestamp) || currentTimestamp > latestTimestamp) {
          return entry.updatedAt
        }
        return latest
      }, sortedChildren[0]?.updatedAt ?? new Date().toISOString())

      const finalizedGroup = {
        groupSlug: group.groupSlug,
        groupPath: group.groupPath,
        registrableDomain: group.registrableDomain,
        siteCount: sortedChildren.length,
        updatedAt,
        statusSummary: summarizeStatuses(sortedChildren),
        primaryEntry: primaryEntry ? toSiblingSummary(primaryEntry) : null,
        children: sortedChildren.map((entry) => toSiblingSummary(entry)),
        siblingPreviewLimit: MAX_SIBLING_PREVIEW,
        entries: sortedChildren,
      }

      for (const entry of sortedChildren) {
        groupsByUrl.set(entry.normalizedUrl, finalizedGroup)
      }

      return finalizedGroup
    })
    .sort((left, right) => {
      const leftTimestamp = Date.parse(left.updatedAt)
      const rightTimestamp = Date.parse(right.updatedAt)
      if (!Number.isNaN(leftTimestamp) && !Number.isNaN(rightTimestamp) && leftTimestamp !== rightTimestamp) {
        return rightTimestamp - leftTimestamp
      }

      return left.registrableDomain.localeCompare(right.registrableDomain, 'fr')
    })

  return {
    groups,
    groupsBySlug,
    groupsByUrl,
  }
}
