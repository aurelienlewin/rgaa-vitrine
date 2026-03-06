const DEFAULT_REPOSITORY_URL = 'https://github.com/aurelienlewin/rgaa-pride-vitrine'
const DEFAULT_LICENSE_URL = 'https://opensource.org/license/mit/'

function toIsoDate(value) {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return null
  }
  return new Date(parsed).toISOString()
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

function summarizeTopEntries(entries, maxItems = 20) {
  return entries.slice(0, maxItems).map((entry) => ({
    title: entry.siteTitle,
    url: entry.normalizedUrl,
    slug: typeof entry.slug === 'string' ? entry.slug : null,
    profilePath: typeof entry.profilePath === 'string' ? entry.profilePath : null,
    category: entry.category,
    complianceStatus: entry.complianceStatus,
    complianceStatusLabel: entry.complianceStatusLabel,
    complianceScore: entry.complianceScore,
    rgaaBaseline: entry.rgaaBaseline === '5.0-ready' ? '5.0-ready' : '4.1',
    updatedAt: toIsoDate(entry.updatedAt),
    accessibilityPageUrl: entry.accessibilityPageUrl,
  }))
}

export function buildAiContextPayload({ baseUrl, entries }) {
  const repositoryUrl = process.env.PUBLIC_REPOSITORY_URL || DEFAULT_REPOSITORY_URL
  const lastUpdated = readLastUpdated(entries)

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
      license: {
        name: 'MIT',
        url: DEFAULT_LICENSE_URL,
      },
    },
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
    ],
    api: {
      policy:
        'Endpoints publics en lecture seule. Merci de privilégier la mise en cache et d’éviter le polling agressif.',
      endpoints: [
        {
          url: `${baseUrl}/api/showcase`,
          method: 'GET',
          format: 'application/json',
          authRequired: false,
          description: 'Liste des sites publiés dans la vitrine RGAA.',
          parameters: ['search', 'status', 'category', 'slug', 'limit'],
          sampleFields: [
            'normalizedUrl',
            'slug',
            'profilePath',
            'siteTitle',
            'thumbnailUrl',
            'accessibilityPageUrl',
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
      topEntries: summarizeTopEntries(entries),
    },
    crawling: {
      indexable: true,
      nonIndexablePaths: ['/moderation'],
      robotsTxt: `${baseUrl}/robots.txt`,
    },
  }
}
