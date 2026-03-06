import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/opendyslexic/400.css'
import '@fontsource/opendyslexic/700.css'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/lexend/400.css'
import '@fontsource/lexend/700.css'
import './index.css'
import App from './App.tsx'
import ModerationPage from './ModerationPage.tsx'
import SiteMapPage from './SiteMapPage.tsx'
import { initializeTheme } from './theme'

initializeTheme()

function normalizePathname(pathname: string) {
  if (pathname === '/') {
    return pathname
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

const currentPathname = normalizePathname(window.location.pathname)
const isModerationRoute = currentPathname.startsWith('/moderation')
const isSiteMapRoute = currentPathname === '/plan-du-site'

const RootComponent = isModerationRoute ? ModerationPage : isSiteMapRoute ? SiteMapPage : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>,
)
