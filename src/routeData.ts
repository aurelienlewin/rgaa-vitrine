export type RouteApiResult = {
  ok: boolean
  payload: Record<string, unknown>
}

type RouteApiCacheEntry = {
  promise: Promise<RouteApiResult>
  status: 'pending' | 'fulfilled' | 'rejected'
  result: RouteApiResult | null
}

const routeApiCache = new Map<string, RouteApiCacheEntry>()

async function readApiPayload(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const rawBody = await response.text()

  if (!rawBody.trim()) {
    return {}
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return { error: 'Réponse JSON invalide du serveur.' }
    }
  }

  const compactBody = rawBody.trim().replace(/\s+/g, ' ')
  if (/<!doctype html|<html[\s>]/i.test(compactBody)) {
    return {
      error:
        'Réponse HTML reçue à la place de JSON API. Vérifiez le routage des endpoints /api/*.',
    }
  }

  return { error: compactBody.slice(0, 220) || 'Réponse serveur non JSON.' }
}

export function preloadRouteApi(url: string) {
  const cached = routeApiCache.get(url)
  if (cached) {
    return cached.promise
  }

  const cacheEntry: RouteApiCacheEntry = {
    promise: Promise.resolve({ ok: false, payload: { error: 'Chargement non initialisé.' } }),
    status: 'pending',
    result: null,
  }

  const request: Promise<RouteApiResult> = fetch(url, {
    headers: {
      accept: 'application/json',
    },
  })
    .then(async (response) => {
      const result = {
        ok: response.ok,
        payload: await readApiPayload(response),
      }
      cacheEntry.status = 'fulfilled'
      cacheEntry.result = result
      return result
    })
    .catch((error: unknown) => {
      const result = {
        ok: false,
        payload: {
          error: error instanceof Error ? error.message : 'Erreur réseau lors du chargement.',
        },
      }
      cacheEntry.status = 'rejected'
      cacheEntry.result = result
      return result
    })

  cacheEntry.promise = request
  routeApiCache.set(url, cacheEntry)
  return request
}

export function readPreloadedRouteApi(url: string) {
  const cached = routeApiCache.get(url)
  if (!cached || cached.status === 'pending' || !cached.result) {
    return null
  }

  return cached.result
}
