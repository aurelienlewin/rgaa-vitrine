import { buildAccessibilityStatementSnapshot } from '../shared/accessibilityStatement.js'

const DEFAULT_REPOSITORY_URL = 'https://github.com/aurelienlewin/rgaa-pride-vitrine'
const DEFAULT_LICENSE_URL = 'https://opensource.org/license/mit/'

function toIsoDate(value) {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return null
  }
  return new Date(parsed).toISOString()
}

function resolveProfilePath(entry) {
  if (typeof entry?.profilePath === 'string' && entry.profilePath.startsWith('/')) {
    return entry.profilePath
  }

  if (typeof entry?.slug === 'string' && /^[a-z0-9-]{4,120}$/.test(entry.slug)) {
    return `/site/${entry.slug}`
  }

  return null
}

function createAbsoluteUrl(baseUrl, path) {
  try {
    return new URL(path, `${baseUrl}/`).toString()
  } catch {
    return null
  }
}

function readLastUpdated(entries) {
  const timestamps = entries
    .map((entry) => Date.parse(entry.updatedAt))
    .filter((timestamp) => !Number.isNaN(timestamp))

  if (timestamps.length === 0) {
    return new Date().toISOString()
  }

  return new Date(Math.max(...timestamps)).toISOString()
}

function readStatusBreakdown(entries) {
  const breakdown = {
    full: 0,
    partial: 0,
    none: 0,
    unknown: 0,
  }

  for (const entry of entries) {
    if (entry.complianceStatus === 'full') {
      breakdown.full += 1
      continue
    }

    if (entry.complianceStatus === 'partial') {
      breakdown.partial += 1
      continue
    }

    if (entry.complianceStatus === 'none') {
      breakdown.none += 1
      continue
    }

    breakdown.unknown += 1
  }

  return breakdown
}

function summarizeTopEntries(entries, baseUrl, maxItems = 20) {
  return entries.slice(0, maxItems).map((entry) => ({
    title: entry.siteTitle,
    url: entry.normalizedUrl,
    siteHost: typeof entry.siteHost === 'string' ? entry.siteHost : null,
    siteOrigin: typeof entry.siteOrigin === 'string' ? entry.siteOrigin : null,
    slug: typeof entry.slug === 'string' ? entry.slug : null,
    profilePath: resolveProfilePath(entry),
    profileUrl: createAbsoluteUrl(baseUrl, resolveProfilePath(entry) ?? '/'),
    category: entry.category,
    complianceStatus: entry.complianceStatus,
    complianceStatusLabel: entry.complianceStatusLabel,
    complianceScore: entry.complianceScore,
    rgaaBaseline: entry.rgaaBaseline === '5.0-ready' ? '5.0-ready' : '4.1',
    updatedAt: toIsoDate(entry.updatedAt),
    accessibilityPageUrl: entry.accessibilityPageUrl,
    hasAccessibilityPage: entry.hasAccessibilityPage === true,
  }))
}

export function buildAiContextPayload({ baseUrl, entries }) {
  const repositoryUrl = process.env.PUBLIC_REPOSITORY_URL || DEFAULT_REPOSITORY_URL
  const lastUpdated = readLastUpdated(entries)
  const accessibilityStatement = buildAccessibilityStatementSnapshot(baseUrl)
  const sampleProfileUrls = entries
    .map((entry) => createAbsoluteUrl(baseUrl, resolveProfilePath(entry) ?? '/'))
    .filter((value) => typeof value === 'string' && value.includes('/site/'))
    .slice(0, 30)
  const samplePublicPages = sampleProfileUrls.slice(0, 3).map((url) => ({
    url,
    title: 'Exemple de fiche site référencé',
    description: 'Page publique dédiée à un site de la vitrine RGAA.',
  }))

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    language: 'fr-FR',
    site: {
      name: 'Annuaire RGAA',
      url: `${baseUrl}/`,
      description:
        'Annuaire francophone de sites web affichant un niveau de conformité RGAA et des ressources officielles d’accessibilité.',
      repositoryUrl,
      accessibilityStatementUrl: accessibilityStatement.url,
      license: {
        name: 'MIT',
        url: DEFAULT_LICENSE_URL,
      },
    },
    accessibilityStatement,
    discovery: {
      sitemap: `${baseUrl}/sitemap.xml`,
      llms: `${baseUrl}/llms.txt`,
      llmsFull: `${baseUrl}/llms-full.txt`,
      siteMapPage: `${baseUrl}/plan-du-site`,
    },
    publicPages: [
      {
        url: `${baseUrl}/`,
        title: 'Annuaire RGAA',
        description: 'Page principale: recherche, filtres et soumission de site.',
      },
      {
        url: `${baseUrl}/plan-du-site`,
        title: 'Plan du site',
        description: 'Vue d’ensemble des pages et ressources techniques publiques.',
      },
      {
        url: `${baseUrl}/accessibilite`,
        title: 'Déclaration d’accessibilité',
        description: 'Score, non-conformités et contact du service.',
      },
      {
        url: `${baseUrl}/site/{slug}`,
        title: 'Fiche site référencé',
        description: 'Page publique dédiée à un site référencé, avec liens sortants et métadonnées.',
      },
      ...samplePublicPages,
    ],
    siteProfiles: {
      pagePattern: `${baseUrl}/site/{slug}`,
      apiPattern: `${baseUrl}/api/showcase?slug={slug}`,
      totalIndexedProfiles: entries.length,
      sampleUrls: sampleProfileUrls,
    },
    api: {
      policy:
        'Endpoints publics en lecture seule. Merci de privilégier la mise en cache et d’éviter le polling agressif.',
      endpoints: [
        {
          url: `${baseUrl}/api/showcase`,
          method: 'GET',
          format: 'application/json',
          authRequired: false,
          description: 'Liste des sites publiés dans la vitrine RGAA, avec accès direct par slug.',
          parameters: ['search', 'status', 'category', 'slug', 'limit'],
          sampleFields: [
            'normalizedUrl',
            'siteHost',
            'siteOrigin',
            'slug',
            'profilePath',
            'siteTitle',
            'thumbnailUrl',
            'accessibilityPageUrl',
            'hasAccessibilityPage',
            'complianceStatus',
            'complianceStatusLabel',
            'complianceScore',
            'rgaaBaseline',
            'updatedAt',
            'category',
          ],
        },
        {
          url: `${baseUrl}/api/health`,
          method: 'GET',
          format: 'application/json',
          authRequired: false,
          description: 'État du service et du mode de stockage.',
        },
      ],
    },
    dataset: {
      name: 'Vitrine RGAA - entrées publiques',
      url: `${baseUrl}/api/showcase`,
      totalEntries: entries.length,
      lastUpdated,
      complianceBreakdown: readStatusBreakdown(entries),
      topEntries: summarizeTopEntries(entries, baseUrl),
    },
    crawling: {
      indexable: true,
      nonIndexablePaths: ['/moderation'],
      robotsTxt: `${baseUrl}/robots.txt`,
      crawlSeeds: [
        `${baseUrl}/`,
        `${baseUrl}/plan-du-site`,
        `${baseUrl}/sitemap.xml`,
        ...sampleProfileUrls,
      ],
    },
  }
}
