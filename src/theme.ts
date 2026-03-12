export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'annuaire-rgaa-theme'
function updateThemeColorMeta() {
  if (typeof document === 'undefined') {
    return
  }
  const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
  if (!themeColorMeta) {
    return
  }
  themeColorMeta.setAttribute('content', '#f3f6fd')
}

export function readStoredThemePreference(): ThemePreference {
  return 'light'
}

export function resolveThemePreference(themePreference: ThemePreference): ResolvedTheme {
  void themePreference
  return 'light'
}

export function applyThemePreference(themePreference: ThemePreference): ResolvedTheme {
  void themePreference
  const resolvedTheme: ResolvedTheme = 'light'

  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.setAttribute('data-theme', 'light')
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY)
    } catch {
      // Local storage may be unavailable in strict privacy contexts.
    }
  }

  updateThemeColorMeta()
  return resolvedTheme
}

export function initializeTheme() {
  const preference = readStoredThemePreference()
  const resolved = applyThemePreference(preference)
  return { preference, resolved }
}

export function subscribeToSystemThemeChange(onChange: (theme: ResolvedTheme) => void) {
  void onChange
  return () => {}
}
