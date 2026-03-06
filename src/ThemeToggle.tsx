import { useCallback, useEffect, useState } from 'react'
import {
  applyThemePreference,
  readStoredThemePreference,
  resolveThemePreference,
  subscribeToSystemThemeChange,
  type ResolvedTheme,
  type ThemePreference,
} from './theme'

type ThemeToggleProps = {
  className: string
}

function ThemeToggle({ className }: ThemeToggleProps) {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => readStoredThemePreference())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveThemePreference(readStoredThemePreference()),
  )

  useEffect(() => {
    setResolvedTheme(applyThemePreference(themePreference))
  }, [themePreference])

  useEffect(() => {
    if (themePreference !== 'system') {
      return
    }

    return subscribeToSystemThemeChange(() => {
      setResolvedTheme(applyThemePreference('system'))
    })
  }, [themePreference])

  const handleToggle = useCallback(() => {
    setThemePreference((currentPreference) => {
      const currentResolvedTheme = resolveThemePreference(currentPreference)
      return currentResolvedTheme === 'dark' ? 'light' : 'dark'
    })
  }, [])

  const nextModeLabel = resolvedTheme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'
  const currentModeLabel = resolvedTheme === 'dark' ? 'Mode sombre actif' : 'Mode clair actif'

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={resolvedTheme === 'dark'}
      aria-label={nextModeLabel}
      className={className}
    >
      {currentModeLabel}
    </button>
  )
}

export default ThemeToggle
