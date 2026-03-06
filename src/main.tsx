import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import './index.css'
import App from './App.tsx'
import { initializeTheme } from './theme'

initializeTheme()

const ModerationPage = lazy(() => import('./ModerationPage.tsx'))
const SiteMapPage = lazy(() => import('./SiteMapPage.tsx'))
const AccessibilityPage = lazy(() => import('./AccessibilityPage.tsx'))

function loadSecondaryFonts() {
  return Promise.all([
    import('@fontsource/opendyslexic/latin-400.css'),
    import('@fontsource/opendyslexic/latin-700.css'),
    import('@fontsource/lexend/latin-400.css'),
    import('@fontsource/lexend/latin-700.css'),
  ])
}

function scheduleSecondaryFontsLoad() {
  const load = () => {
    void loadSecondaryFonts()
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(load, { timeout: 1800 })
    return
  }

  window.setTimeout(load, 1000)
}

function normalizePathname(pathname: string) {
  if (pathname === '/') {
    return pathname
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

const currentPathname = normalizePathname(window.location.pathname)
const isModerationRoute = currentPathname.startsWith('/moderation')
const isSiteMapRoute = currentPathname === '/plan-du-site'
const isAccessibilityRoute = currentPathname === '/accessibilite'

const RootComponent = isModerationRoute
  ? ModerationPage
  : isSiteMapRoute
    ? SiteMapPage
    : isAccessibilityRoute
      ? AccessibilityPage
      : App

scheduleSecondaryFontsLoad()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense
      fallback={
        <div className="min-h-screen bg-brand-surface px-4 py-6 text-brand-ink">
          Chargement…
        </div>
      }
    >
      <RootComponent />
    </Suspense>
  </StrictMode>,
)
