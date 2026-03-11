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
  className?: string
}

const baseClassName =
  'app-theme-toggle inline-flex min-h-11 items-center rounded-xl border border-slate-600 dark:border-slate-500 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800'

function ThemeToggle({ className = '' }: ThemeToggleProps) {
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
      className={`${baseClassName} ${className}`.trim()}
    >
      {currentModeLabel}
    </button>
  )
}

export default ThemeToggle
