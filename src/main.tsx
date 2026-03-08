import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import './index.css'
import App from './App.tsx'
import { ensureCssColorPairs } from './ensureCssColorPairs'
import { initializeTheme } from './theme'

const canUseDom = typeof window !== 'undefined' && typeof document !== 'undefined'

function scheduleCssColorPairsCheck() {
  const run = () => {
    ensureCssColorPairs()
    window.setTimeout(() => {
      ensureCssColorPairs()
    }, 250)
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 2200 })
    return
  }

  window.setTimeout(run, 700)
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
  scheduleCssColorPairsCheck()
}

const ModerationPage = lazy(() => import('./ModerationPage.tsx'))
const SiteMapPage = lazy(() => import('./SiteMapPage.tsx'))
const AccessibilityPage = lazy(() => import('./AccessibilityPage.tsx'))
const SiteProfilePage = lazy(() => import('./SiteProfilePage.tsx'))

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

const RootComponent = isModerationRoute
  ? ModerationPage
  : isSiteMapRoute
    ? SiteMapPage
    : isAccessibilityRoute
      ? AccessibilityPage
      : isSiteProfileRoute
        ? SiteProfilePage
      : App

if (canUseDom) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Suspense
        fallback={
          <div className="min-h-screen bg-brand-surface px-4 py-6 text-brand-ink" role="status" aria-live="polite">
            Chargement…
          </div>
        }
      >
        <RootComponent />
      </Suspense>
    </StrictMode>,
  )

  scheduleAnalyticsLoad()
}
