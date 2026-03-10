import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import './index.css'
import { initializeTheme } from './theme'
import { readDomainGroupSlugFromPath } from './domainGroups'
import { preloadRouteApi } from './routeData'
import { readSiteSlugFromPath } from './siteProfiles'

const canUseDom = typeof window !== 'undefined' && typeof document !== 'undefined'

declare global {
  interface Window {
    __ANNUAIRE_RGAA_MAINTENANCE__?: {
      enabled?: boolean
    }
    __ANNUAIRE_RGAA_MAINTENANCE_PROMISE__?: Promise<void>
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

function preloadInitialRouteData(pathname: string) {
  const domainGroupSlug = readDomainGroupSlugFromPath(pathname)
  if (domainGroupSlug) {
    void preloadRouteApi(`/api/domain-groups?slug=${encodeURIComponent(domainGroupSlug)}`)
    return
  }

  const siteSlug = readSiteSlugFromPath(pathname)
  if (siteSlug) {
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

if (canUseDom) {
  await window.__ANNUAIRE_RGAA_MAINTENANCE_PROMISE__
  if (!(window.__ANNUAIRE_RGAA_MAINTENANCE__?.enabled === true && !isModerationRoute)) {
    preloadInitialRouteData(currentPathname)
    const RootComponent = (await resolveRootModule()).default
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <RootComponent />
      </StrictMode>,
    )

    scheduleAnalyticsLoad()
  }
}
