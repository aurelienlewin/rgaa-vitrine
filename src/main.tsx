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
import { initializeTheme } from './theme'

initializeTheme()

const isModerationRoute = window.location.pathname.startsWith('/moderation')
const RootComponent = isModerationRoute ? ModerationPage : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>,
)
