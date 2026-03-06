import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { timingSafeEqual } from 'node:crypto'
import { buildSiteInsight, SiteInsightError } from './siteInsight.js'
import { isGithubNotifierEnabled, notifyPendingModerationOnGithub } from './githubNotifier.js'
import { buildSitemapXml, resolvePublicAppUrl } from './sitemap.js'
import { buildAiContextPayload } from './aiContext.js'
import {
  buildPendingSubmission,
  buildShowcaseEntry,
  createShowcaseStorage,
  ShowcaseStorageError,
} from './storage.js'

const app = express()
const showcaseStorage = createShowcaseStorage()
const AUTO_PUBLISH_STATUSES = new Set(['full', 'partial'])
const SUSPICIOUS_MARKETING_TOKENS = [
  'casino',
  'bet',
  'paris sportif',
  'porn',
  'viagra',
  'seo',
  'backlink',
  'linkbuilding',
  'guest post',
  'crypto airdrop',
]

app.disable('x-powered-by')
app.set('trust proxy', false)

function readModerationToken() {
  const value = process.env.MODERATION_API_TOKEN
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function sendJsonError(response, statusCode, message) {
  response.status(statusCode).json({ error: message })
}

function firstQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function parseAuthorizationToken(request) {
  const authorization = request.get('authorization')
  if (typeof authorization !== 'string') {
    return null
  }

  const [scheme, token] = authorization.split(' ')
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null
  }

  return token.trim() || null
}

function safeTokenEquals(left, right) {
  const leftBuffer = Buffer.from(left, 'utf8')
  const rightBuffer = Buffer.from(right, 'utf8')

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function extractSubmissionId(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 200) {
    return null
  }

  return trimmed
}

function normalizeForMatch(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function requireModerationAuth(request, response, next) {
  const configuredToken = readModerationToken()
  if (!configuredToken) {
    sendJsonError(
      response,
      503,
      'Modération indisponible: définissez MODERATION_API_TOKEN pour activer la validation manuelle.',
    )
    return
  }

  const providedToken =
    request.get('x-moderation-token')?.trim() ||
    request.get('x-admin-token')?.trim() ||
    parseAuthorizationToken(request)

  if (!providedToken || !safeTokenEquals(providedToken, configuredToken)) {
    sendJsonError(response, 401, 'Accès modération refusé.')
    return
  }

  next()
}

function findSuspiciousMarketingToken(siteInsight) {
  const title = typeof siteInsight.siteTitle === 'string' ? siteInsight.siteTitle.trim() : ''
  if (title.length < 3 || title.length > 120) {
    return 'title-length'
  }

  const haystack = normalizeForMatch(`${siteInsight.siteTitle} ${siteInsight.normalizedUrl}`)
  return SUSPICIOUS_MARKETING_TOKENS.find((token) => haystack.includes(token)) ?? null
}

function getManualReviewReason(siteInsight) {
  if (!siteInsight.accessibilityPageUrl) {
    return 'Aucune déclaration d’accessibilité détectée.'
  }

  if (!AUTO_PUBLISH_STATUSES.has(siteInsight.complianceStatus ?? '')) {
    return "Niveau de conformité insuffisant pour publication automatique."
  }

  return null
}

function readMostRecentUpdatedAt(entries) {
  const latestTimestamp = entries.reduce((currentLatest, entry) => {
    const updatedAt = Date.parse(entry.updatedAt)
    if (Number.isNaN(updatedAt)) {
      return currentLatest
    }
    return Math.max(currentLatest, updatedAt)
  }, 0)

  return latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : new Date().toISOString()
}

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
)

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, response, _next, options) => {
      sendJsonError(
        response,
        options.statusCode,
        'Trop de requêtes. Merci de réessayer dans quelques minutes.',
      )
    },
  }),
)

app.use(express.json({ limit: '2kb' }))

const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Trop de soumissions. Merci de réessayer dans une heure.",
  },
})

app.get(['/sitemap.xml', '/api/sitemap'], async (_request, response) => {
  const baseUrl = resolvePublicAppUrl()
  let lastModified = new Date().toISOString()

  try {
    const entries = await showcaseStorage.list({ limit: 500 })
    lastModified = readMostRecentUpdatedAt(entries)
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      console.error('Sitemap uses fallback date because storage is unavailable', error.message)
    } else {
      console.error('Unexpected sitemap generation error', error)
    }
  }

  const sitemapXml = buildSitemapXml(baseUrl, [
    {
      path: '/',
      lastModified,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      path: '/plan-du-site',
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      path: '/accessibilite',
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      path: '/ai-context.json',
      lastModified,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      path: '/llms.txt',
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      path: '/llms-full.txt',
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ])

  response.setHeader('content-type', 'application/xml; charset=utf-8')
  response.setHeader('cache-control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600')
  response.status(200).send(sitemapXml)
})

app.get(['/ai-context.json', '/api/ai-context'], async (_request, response) => {
  const baseUrl = resolvePublicAppUrl()
  let entries = []

  try {
    entries = await showcaseStorage.list({ limit: 500 })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      console.error('AI context uses empty dataset because storage is unavailable', error.message)
    } else {
      console.error('Unexpected AI context generation error', error)
    }
  }

  const payload = buildAiContextPayload({ baseUrl, entries })
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600')
  response.status(200).json(payload)
})

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    storage: showcaseStorage.mode,
    moderation: {
      enabled: Boolean(readModerationToken()),
    },
    notifications: {
      githubIssues: isGithubNotifierEnabled(),
    },
  })
})

app.get('/api/showcase', async (request, response) => {
  try {
    const entries = await showcaseStorage.list({
      search: firstQueryValue(request.query.search),
      status: firstQueryValue(request.query.status),
      category: firstQueryValue(request.query.category),
      limit: firstQueryValue(request.query.limit),
    })
    response.json({
      entries,
      total: entries.length,
      storage: showcaseStorage.mode,
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/showcase', error)
    sendJsonError(response, 500, 'Erreur lors de la lecture de la vitrine.')
  }
})

app.post('/api/site-insight', submissionLimiter, async (request, response) => {
  const url = request.body?.url
  const category = request.body?.category
  const honeypot = request.body?.website

  if (typeof url !== 'string') {
    sendJsonError(response, 400, 'Le champ URL est obligatoire.')
    return
  }

  if (typeof honeypot === 'string' && honeypot.trim()) {
    sendJsonError(response, 400, 'Soumission invalide.')
    return
  }

  try {
    const insight = await buildSiteInsight(url)
    const existingEntry = await showcaseStorage.getByNormalizedUrl(insight.normalizedUrl)

    if (existingEntry) {
      response.json({
        ...existingEntry,
        submissionStatus: 'duplicate',
        message: 'Ce site est déjà référencé dans la vitrine.',
      })
      return
    }

    const existingPending = await showcaseStorage.getPendingByNormalizedUrl(insight.normalizedUrl)
    if (existingPending) {
      response.status(202).json({
        ...existingPending,
        submissionStatus: 'pending',
        message: 'Ce site est déjà en attente de validation manuelle.',
      })
      return
    }

    const suspiciousToken = findSuspiciousMarketingToken(insight)
    if (suspiciousToken) {
      sendJsonError(
        response,
        422,
        'Soumission rejetée: le site ne correspond pas aux critères qualité de la vitrine RGAA.',
      )
      return
    }

    const manualReviewReason = getManualReviewReason(insight)
    if (manualReviewReason) {
      const pendingSubmission = buildPendingSubmission(insight, category, manualReviewReason)
      const savedPendingSubmission = await showcaseStorage.upsertPending(pendingSubmission)

      if (isGithubNotifierEnabled()) {
        try {
          await notifyPendingModerationOnGithub(savedPendingSubmission)
        } catch (notificationError) {
          console.error('GitHub moderation notification failed', notificationError)
        }
      }

      response.status(202).json({
        ...savedPendingSubmission,
        submissionStatus: 'pending',
        message:
          'Soumission reçue. Elle est enregistrée en file de validation manuelle avant publication.',
      })
      return
    }

    const showcaseEntry = buildShowcaseEntry(insight, category)
    const persistedEntry = await showcaseStorage.upsert(showcaseEntry)
    response.json({
      ...persistedEntry,
      submissionStatus: 'approved',
      message: 'Site publié dans la vitrine.',
    })
  } catch (error) {
    if (error instanceof SiteInsightError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/site-insight', error)
    sendJsonError(response, 500, 'Erreur interne lors de l’analyse.')
  }
})

app.get('/api/moderation/pending', requireModerationAuth, async (request, response) => {
  try {
    const pendingEntries = await showcaseStorage.listPending({
      limit: firstQueryValue(request.query.limit),
    })

    response.json({
      entries: pendingEntries,
      total: pendingEntries.length,
      storage: showcaseStorage.mode,
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/pending', error)
    sendJsonError(response, 500, 'Erreur interne lors de la lecture de la file de modération.')
  }
})

app.post('/api/moderation/approve', requireModerationAuth, async (request, response) => {
  const submissionId = extractSubmissionId(request.body?.submissionId)
  if (!submissionId) {
    sendJsonError(response, 400, 'submissionId est obligatoire.')
    return
  }

  try {
    const pendingEntry = await showcaseStorage.getPendingById(submissionId)
    if (!pendingEntry) {
      sendJsonError(response, 404, 'Soumission en attente introuvable.')
      return
    }

    const existingEntry = await showcaseStorage.getByNormalizedUrl(pendingEntry.normalizedUrl)
    if (existingEntry) {
      await showcaseStorage.deletePendingById(submissionId)
      response.json({
        ...existingEntry,
        submissionStatus: 'duplicate',
        message: 'Le site était déjà publié. La soumission en attente a été supprimée.',
      })
      return
    }

    const approvedEntry = buildShowcaseEntry(
      {
        normalizedUrl: pendingEntry.normalizedUrl,
        siteTitle: pendingEntry.siteTitle,
        thumbnailUrl: pendingEntry.thumbnailUrl,
        accessibilityPageUrl: pendingEntry.accessibilityPageUrl,
        complianceStatus: pendingEntry.complianceStatus,
        complianceStatusLabel: pendingEntry.complianceStatusLabel,
        complianceScore: pendingEntry.complianceScore,
        updatedAt: new Date().toISOString(),
      },
      pendingEntry.category,
    )

    const savedEntry = await showcaseStorage.upsert(approvedEntry)
    await showcaseStorage.deletePendingById(submissionId)

    response.json({
      ...savedEntry,
      submissionStatus: 'approved',
      message: 'Soumission approuvée et publiée dans l’annuaire.',
      moderation: {
        submissionId,
      },
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/approve', error)
    sendJsonError(response, 500, 'Erreur interne lors de la validation.')
  }
})

app.post('/api/moderation/reject', requireModerationAuth, async (request, response) => {
  const submissionId = extractSubmissionId(request.body?.submissionId)
  if (!submissionId) {
    sendJsonError(response, 400, 'submissionId est obligatoire.')
    return
  }

  const rawReason = request.body?.reason
  const reason = typeof rawReason === 'string' && rawReason.trim() ? rawReason.trim().slice(0, 300) : null

  try {
    const pendingEntry = await showcaseStorage.getPendingById(submissionId)
    if (!pendingEntry) {
      sendJsonError(response, 404, 'Soumission en attente introuvable.')
      return
    }

    await showcaseStorage.deletePendingById(submissionId)
    response.json({
      submissionStatus: 'rejected',
      submissionId,
      normalizedUrl: pendingEntry.normalizedUrl,
      message: reason
        ? `Soumission rejetée: ${reason}`
        : 'Soumission rejetée et supprimée de la file de modération.',
    })
  } catch (error) {
    if (error instanceof ShowcaseStorageError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/moderation/reject', error)
    sendJsonError(response, 500, 'Erreur interne lors du rejet.')
  }
})

app.use('/api', (_request, response) => {
  sendJsonError(response, 404, 'Point d’accès API introuvable.')
})

app.use((error, _request, response, next) => {
  if (response.headersSent) {
    next(error)
    return
  }

  if (error?.type === 'entity.parse.failed') {
    sendJsonError(response, 400, 'Corps JSON invalide.')
    return
  }

  console.error('Unhandled API middleware error', error)
  sendJsonError(response, 500, 'Erreur interne serveur.')
})

export default app
