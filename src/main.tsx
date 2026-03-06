import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ModerationPage from './ModerationPage.tsx'

const isModerationRoute = window.location.pathname.startsWith('/moderation')
const RootComponent = isModerationRoute ? ModerationPage : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>,
)
