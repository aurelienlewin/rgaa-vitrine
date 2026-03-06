import app from '../server/app.js'

function normalizePathAndQuery(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return '/api'
  }

  let candidate = rawUrl.trim()

  // Some platforms may provide an absolute URL instead of a path.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    try {
      const parsed = new URL(candidate)
      candidate = `${parsed.pathname}${parsed.search}`
    } catch {
      return '/api'
    }
  }

  if (!candidate.startsWith('/')) {
    candidate = `/${candidate}`
  }

  return candidate.replace(/^\/{2,}/, '/')
}

export default function runApiApp(request, response) {
  const normalizedPath = normalizePathAndQuery(request.url)
  const queryIndex = normalizedPath.indexOf('?')
  const pathname = queryIndex >= 0 ? normalizedPath.slice(0, queryIndex) : normalizedPath
  const querySuffix = queryIndex >= 0 ? normalizedPath.slice(queryIndex) : ''

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    request.url = `${pathname}${querySuffix}`
    return app(request, response)
  }

  if (pathname === '/sitemap.xml') {
    request.url = `/api/sitemap${querySuffix}`
    return app(request, response)
  }

  if (pathname === '/ai-context.json') {
    request.url = `/api/ai-context${querySuffix}`
    return app(request, response)
  }

  request.url = `/api${pathname}${querySuffix}`
  return app(request, response)
}
