import app from '../server/app.js'

export default function runApiApp(request, response) {
  if (typeof request.url === 'string' && !request.url.startsWith('/api/')) {
    const normalizedPath = request.url.startsWith('/') ? request.url : `/${request.url}`
    request.url = `/api${normalizedPath}`
  }

  return app(request, response)
}
