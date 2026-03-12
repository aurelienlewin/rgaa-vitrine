import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
import { initializeTheme } from './theme'

const canUseDom = typeof window !== 'undefined' && typeof document !== 'undefined'
const DOMAIN_GROUP_PATH_PATTERN = /^\/domaine\/([a-z0-9-]{4,120})$/
const SITE_PROFILE_PATH_PATTERN = /^\/site\/([a-z0-9-]{4,120})$/

declare global {
  interface Window {
    __ANNUAIRE_RGAA_MAINTENANCE__?: {
      enabled?: boolean
    }
    __ANNUAIRE_RGAA_MAINTENANCE_PROMISE__?: Promise<void>
    __ANNUAIRE_RGAA_PRELOADED_SHOWCASE_RESPONSE__?: Promise<Response> | null
  }
}

function scheduleAnalyticsLoad() {
  if (!import.meta.env.PROD) {
    return
  }

  const loadAnalytics = () => {
    void import('@vercel/analytics/react')
      .then(({ Analytics }) => {
        if (!document.body || document.getElementById('annuaire-rgaa-analytics-root')) {
          return
        }

        const analyticsRoot = document.createElement('div')
        analyticsRoot.id = 'annuaire-rgaa-analytics-root'
        analyticsRoot.setAttribute('aria-hidden', 'true')
        document.body.append(analyticsRoot)
        createRoot(analyticsRoot).render(<Analytics />)
      })
      .catch((error: unknown) => {
        console.error('Unable to load analytics', error)
      })
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(loadAnalytics, { timeout: 3500 })
    return
  }

  window.setTimeout(loadAnalytics, 1800)
}

if (canUseDom) {
  initializeTheme()
}

function normalizePathname(pathname: string) {
  if (pathname === '/') {
    return pathname
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

const currentPathname = normalizePathname(canUseDom ? window.location.pathname : '/')
const isModerationRoute = currentPathname.startsWith('/moderation')
const isSiteMapRoute = currentPathname === '/plan-du-site'
const isAccessibilityRoute = currentPathname === '/accessibilite'
const isSiteProfileRoute = currentPathname.startsWith('/site/')
const isDomainGroupRoute = currentPathname.startsWith('/domaine/')
const isHomepageRoute = currentPathname === '/'

function preloadHomepageShowcase() {
  if (!canUseDom || !isHomepageRoute) {
    return
  }

  if (window.__ANNUAIRE_RGAA_PRELOADED_SHOWCASE_RESPONSE__) {
    return
  }

  window.__ANNUAIRE_RGAA_PRELOADED_SHOWCASE_RESPONSE__ = fetch('/api/showcase', {
    credentials: 'omit',
    headers: {
      accept: 'application/json',
    },
  })
}

function readDomainGroupSlugFromPath(pathname: string) {
  const match = pathname.match(DOMAIN_GROUP_PATH_PATTERN)
  return match?.[1] ?? null
}

function readSiteSlugFromPath(pathname: string) {
  const match = pathname.match(SITE_PROFILE_PATH_PATTERN)
  return match?.[1] ?? null
}

async function preloadInitialRouteData(pathname: string) {
  const domainGroupSlug = readDomainGroupSlugFromPath(pathname)
  if (domainGroupSlug) {
    const { preloadRouteApi } = await import('./routeData')
    void preloadRouteApi(`/api/domain-groups?slug=${encodeURIComponent(domainGroupSlug)}`)
    return
  }

  const siteSlug = readSiteSlugFromPath(pathname)
  if (siteSlug) {
    const { preloadRouteApi } = await import('./routeData')
    void preloadRouteApi(`/api/showcase?slug=${encodeURIComponent(siteSlug)}&limit=500`)
  }
}

async function resolveRootModule() {
  if (isModerationRoute) {
    return import('./ModerationPage.tsx')
  }
  if (isSiteMapRoute) {
    return import('./SiteMapPage.tsx')
  }
  if (isAccessibilityRoute) {
    return import('./AccessibilityPage.tsx')
  }
  if (isDomainGroupRoute) {
    return import('./DomainGroupPage.tsx')
  }
  if (isSiteProfileRoute) {
    return import('./SiteProfilePage.tsx')
  }

  return import('./App.tsx')
}

preloadHomepageShowcase()

if (canUseDom) {
  const maintenanceProbePromise = (window.__ANNUAIRE_RGAA_MAINTENANCE_PROMISE__ ?? Promise.resolve()).catch(
    () => undefined,
  )
  const rootModulePromise = resolveRootModule()

  await maintenanceProbePromise
  if (!(window.__ANNUAIRE_RGAA_MAINTENANCE__?.enabled === true && !isModerationRoute)) {
    void preloadInitialRouteData(currentPathname)
    const RootComponent = (await rootModulePromise).default
    if (!(window.__ANNUAIRE_RGAA_MAINTENANCE__?.enabled === true && !isModerationRoute)) {
      createRoot(document.getElementById('root')!).render(
        <StrictMode>
          <RootComponent />
        </StrictMode>,
      )

      scheduleAnalyticsLoad()
    }
  }
}
