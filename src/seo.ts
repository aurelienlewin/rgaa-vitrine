type JsonLdObject = Record<string, unknown>

type SeoConfig = {
  title: string
  description: string
  path?: string
  robots?: string
  ogType?: string
  imageUrl?: string
  imageAlt?: string
  twitterCard?: string
  locale?: string
  structuredData?: JsonLdObject | JsonLdObject[] | null
}

const DEFAULT_SITE_URL = 'https://annuaire-rgaa.fr'
const DEFAULT_SITE_NAME = 'Annuaire RGAA'
const DEFAULT_OG_IMAGE_PATH = '/logo-rgaa-vitrine.svg'
const STRUCTURED_DATA_SCRIPT_ID = 'app-jsonld'
const DEFAULT_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'

function resolvePublicSiteUrl() {
  const envValue = import.meta.env.VITE_PUBLIC_SITE_URL
  if (typeof envValue !== 'string' || !envValue.trim()) {
    return DEFAULT_SITE_URL
  }

  try {
    return new URL(envValue).origin
  } catch {
    return DEFAULT_SITE_URL
  }
}

function normalizePath(path: string | undefined) {
  if (!path || path === '/') {
    return '/'
  }

  const trimmed = path.trim()
  if (!trimmed) {
    return '/'
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') && withLeadingSlash.length > 1
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash
}

function upsertMetaByName(name: string) {
  let element = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute('name', name)
    document.head.append(element)
  }
  return element
}

function upsertMetaByProperty(property: string) {
  let element = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute('property', property)
    document.head.append(element)
  }
  return element
}

function upsertCanonicalLink() {
  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', 'canonical')
    document.head.append(element)
  }
  return element
}

function upsertAlternateLink(languageTag: string) {
  let element = document.head.querySelector(
    `link[rel="alternate"][hreflang="${languageTag}"]`,
  ) as HTMLLinkElement | null
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', 'alternate')
    element.setAttribute('hreflang', languageTag)
    document.head.append(element)
  }
  return element
}

function upsertStructuredDataScript() {
  let script = document.getElementById(STRUCTURED_DATA_SCRIPT_ID) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = STRUCTURED_DATA_SCRIPT_ID
    document.head.append(script)
  }
  return script
}

export const publicSiteUrl = resolvePublicSiteUrl()

export function createAbsoluteUrl(path = '/') {
  return new URL(normalizePath(path), `${publicSiteUrl}/`).toString()
}

export function applySeo(config: SeoConfig) {
  const canonicalUrl = createAbsoluteUrl(config.path)
  const locale = config.locale ?? 'fr-FR'
  const ogLocale = locale.replace('-', '_')
  const imageUrl = config.imageUrl ?? createAbsoluteUrl(DEFAULT_OG_IMAGE_PATH)
  const robots = config.robots ?? DEFAULT_ROBOTS
  const ogType = config.ogType ?? 'website'
  const twitterCard = config.twitterCard ?? 'summary_large_image'
  const imageAlt = config.imageAlt ?? 'Logo Annuaire RGAA'

  document.documentElement.lang = 'fr'
  document.title = config.title

  upsertMetaByName('description').setAttribute('content', config.description)
  upsertMetaByName('robots').setAttribute('content', robots)

  upsertCanonicalLink().setAttribute('href', canonicalUrl)
  upsertAlternateLink(locale).setAttribute('href', canonicalUrl)
  upsertAlternateLink('x-default').setAttribute('href', canonicalUrl)

  upsertMetaByProperty('og:locale').setAttribute('content', ogLocale)
  upsertMetaByProperty('og:type').setAttribute('content', ogType)
  upsertMetaByProperty('og:site_name').setAttribute('content', DEFAULT_SITE_NAME)
  upsertMetaByProperty('og:title').setAttribute('content', config.title)
  upsertMetaByProperty('og:description').setAttribute('content', config.description)
  upsertMetaByProperty('og:url').setAttribute('content', canonicalUrl)
  upsertMetaByProperty('og:image').setAttribute('content', imageUrl)
  upsertMetaByProperty('og:image:alt').setAttribute('content', imageAlt)

  upsertMetaByName('twitter:card').setAttribute('content', twitterCard)
  upsertMetaByName('twitter:title').setAttribute('content', config.title)
  upsertMetaByName('twitter:description').setAttribute('content', config.description)
  upsertMetaByName('twitter:image').setAttribute('content', imageUrl)

  if (config.structuredData === null) {
    const script = document.getElementById(STRUCTURED_DATA_SCRIPT_ID)
    script?.remove()
    return
  }

  if (config.structuredData) {
    const script = upsertStructuredDataScript()
    script.textContent = JSON.stringify(config.structuredData)
  }
}
