import app from '../server/app.js'

function normalizePathAndQuery(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return '/api'
  }

  const candidate = rawUrl.trim()

  try {
    const parsed = new URL(candidate, 'http://localhost')
    const rewrittenPath = parsed.searchParams.get('__rgaa_path')

    if (typeof rewrittenPath === 'string' && rewrittenPath.trim()) {
      parsed.searchParams.delete('__rgaa_path')

      let normalizedPath = rewrittenPath.trim()
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalizedPath)) {
        normalizedPath = new URL(normalizedPath).pathname
      }
      if (!normalizedPath.startsWith('/')) {
        normalizedPath = `/${normalizedPath}`
      }
      normalizedPath = normalizedPath.replace(/^\/{2,}/, '/')

      const query = parsed.searchParams.toString()
      return query ? `${normalizedPath}?${query}` : normalizedPath
    }

    const pathname = parsed.pathname.startsWith('/') ? parsed.pathname : `/${parsed.pathname}`
    const query = parsed.search
    return `${pathname.replace(/^\/{2,}/, '/')}${query}`
  } catch {
    return '/api'
  }
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
