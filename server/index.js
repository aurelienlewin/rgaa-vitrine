import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { buildSiteInsight, SiteInsightError } from './siteInsight.js'

const app = express()
const port = Number.parseInt(process.env.PORT ?? '8787', 10)

app.disable('x-powered-by')
app.set('trust proxy', false)

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
  }),
)

app.use(express.json({ limit: '2kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.post('/api/site-insight', async (request, response) => {
  const url = request.body?.url

  if (typeof url !== 'string') {
    response.status(400).json({ error: 'Le champ url est obligatoire.' })
    return
  }

  try {
    const insight = await buildSiteInsight(url)
    response.json(insight)
  } catch (error) {
    if (error instanceof SiteInsightError) {
      response.status(error.statusCode).json({ error: error.message })
      return
    }

    console.error('Unexpected error in /api/site-insight', error)
    response.status(500).json({ error: 'Erreur interne lors de lanalyse.' })
  }
})

app.listen(port, () => {
  console.log(`API RGAA Pride running on http://127.0.0.1:${port}`)
})
