export function normalizeTextForSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function sanitizeSlugPart(value: string) {
  const normalized = normalizeTextForSlug(value)
  return normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function shortHash(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash.toString(36).padStart(6, '0').slice(0, 6)
}

export function buildShowcaseEntrySlug(normalizedUrl: string) {
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
    return `${base || hostSlug}-${shortHash(normalizedUrl)}`
  } catch {
    return `site-${shortHash(normalizedUrl)}`
  }
}

export function resolveShowcaseProfilePath(normalizedUrl: string, slug?: string | null) {
  const safeSlug = typeof slug === 'string' && /^[a-z0-9-]{4,120}$/.test(slug)
    ? slug
    : buildShowcaseEntrySlug(normalizedUrl)
  return `/site/${safeSlug}`
}

export function readSiteSlugFromPath(pathname: string) {
  const normalizedPathname = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
  const match = normalizedPathname.match(/^\/site\/([a-z0-9-]{4,120})$/)
  return match?.[1] ?? null
}
