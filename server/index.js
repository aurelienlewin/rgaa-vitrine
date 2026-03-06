import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { buildSiteInsight, SiteInsightError } from './siteInsight.js'

const app = express()
const port = Number.parseInt(process.env.PORT ?? '8787', 10)

app.disable('x-powered-by')
app.set('trust proxy', false)

function sendJsonError(response, statusCode, message) {
  response.status(statusCode).json({ error: message })
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
        'Trop de requetes. Merci de reessayer dans quelques minutes.',
      )
    },
  }),
)

app.use(express.json({ limit: '2kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.post('/api/site-insight', async (request, response) => {
  const url = request.body?.url

  if (typeof url !== 'string') {
    sendJsonError(response, 400, 'Le champ url est obligatoire.')
    return
  }

  try {
    const insight = await buildSiteInsight(url)
    response.json(insight)
  } catch (error) {
    if (error instanceof SiteInsightError) {
      sendJsonError(response, error.statusCode, error.message)
      return
    }

    console.error('Unexpected error in /api/site-insight', error)
    sendJsonError(response, 500, 'Erreur interne lors de lanalyse.')
  }
})

app.use('/api', (_request, response) => {
  sendJsonError(response, 404, 'Endpoint API introuvable.')
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
