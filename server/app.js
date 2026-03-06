import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { buildSiteInsight, SiteInsightError } from './siteInsight.js'
import {
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

function sendJsonError(response, statusCode, message) {
  response.status(statusCode).json({ error: message })
}

function firstQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function normalizeForMatch(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
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
    return "Aucune déclaration d'accessibilité détectée."
  }

  if (!AUTO_PUBLISH_STATUSES.has(siteInsight.complianceStatus ?? '')) {
    return "Niveau de conformité insuffisant pour publication automatique."
  }

  return null
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

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, storage: showcaseStorage.mode })
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
      response.status(202).json({
        submissionStatus: 'pending',
        message: `Soumission reçue, en attente de vérification humaine. Motif: ${manualReviewReason}`,
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
    sendJsonError(response, 500, "Erreur interne lors de l'analyse.")
  }
})

app.use('/api', (_request, response) => {
  sendJsonError(response, 404, "Point d'accès API introuvable.")
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
