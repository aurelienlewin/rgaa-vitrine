export type RouteApiResult = {
  ok: boolean
  payload: Record<string, unknown>
}

const routeApiCache = new Map<string, Promise<RouteApiResult>>()

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
    return cached
  }

  const request: Promise<RouteApiResult> = fetch(url, {
    headers: {
      accept: 'application/json',
    },
  })
    .then(async (response) => ({
      ok: response.ok,
      payload: await readApiPayload(response),
    }))
    .catch((error: unknown) => ({
      ok: false,
      payload: {
        error: error instanceof Error ? error.message : 'Erreur réseau lors du chargement.',
      },
    }))

  routeApiCache.set(url, request)
  return request
}
