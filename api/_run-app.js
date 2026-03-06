import app from '../server/app.js'

export default function runApiApp(request, response) {
  if (typeof request.url === 'string') {
    const normalizedPath = request.url.startsWith('/') ? request.url : `/${request.url}`

    if (normalizedPath !== '/api' && !normalizedPath.startsWith('/api/')) {
      const queryIndex = normalizedPath.indexOf('?')
      const pathname = queryIndex >= 0 ? normalizedPath.slice(0, queryIndex) : normalizedPath
      const querySuffix = queryIndex >= 0 ? normalizedPath.slice(queryIndex) : ''

      if (pathname === '/sitemap.xml') {
        request.url = `/api/sitemap${querySuffix}`
      } else if (pathname === '/ai-context.json') {
        request.url = `/api/ai-context${querySuffix}`
      } else {
        request.url = `/api${pathname}${querySuffix}`
      }
    } else {
      request.url = normalizedPath
    }
  }

  return app(request, response)
}
