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
const port = Number.parseInt(process.env.PORT ?? '8787', 10)
const showcaseStorage = createShowcaseStorage()

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

app.post('/api/site-insight', async (request, response) => {
  const url = request.body?.url
  const category = request.body?.category

  if (typeof url !== 'string') {
    sendJsonError(response, 400, 'Le champ URL est obligatoire.')
    return
  }

  try {
    const insight = await buildSiteInsight(url)
    const showcaseEntry = buildShowcaseEntry(insight, category)
    const persistedEntry = await showcaseStorage.upsert(showcaseEntry)
    response.json(persistedEntry)
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

app.listen(port, () => {
  console.log(`API RGAA Pride running on http://127.0.0.1:${port}`)
})
