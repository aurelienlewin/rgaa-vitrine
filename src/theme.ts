export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'annuaire-rgaa-theme'
const SYSTEM_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia(SYSTEM_DARK_MEDIA_QUERY).matches ? 'dark' : 'light'
}

function updateThemeColorMeta(theme: ResolvedTheme) {
  if (typeof document === 'undefined') {
    return
  }
  const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
  if (!themeColorMeta) {
    return
  }
  themeColorMeta.setAttribute('content', theme === 'dark' ? '#050913' : '#f3f6fd')
}

export function readStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system'
  }

  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(raw) ? raw : 'system'
  } catch {
    return 'system'
  }
}

export function resolveThemePreference(themePreference: ThemePreference): ResolvedTheme {
  if (themePreference === 'system') {
    return readSystemTheme()
  }
  return themePreference
}

export function applyThemePreference(themePreference: ThemePreference): ResolvedTheme {
  const resolvedTheme = resolveThemePreference(themePreference)

  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.setAttribute('data-theme', resolvedTheme)
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
  }

  if (typeof window !== 'undefined') {
    try {
      if (themePreference === 'system') {
        window.localStorage.removeItem(THEME_STORAGE_KEY)
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)
      }
    } catch {
      // Local storage may be unavailable in strict privacy contexts.
    }
  }

  updateThemeColorMeta(resolvedTheme)
  return resolvedTheme
}

export function initializeTheme() {
  const preference = readStoredThemePreference()
  const resolved = applyThemePreference(preference)
  return { preference, resolved }
}

export function subscribeToSystemThemeChange(onChange: (theme: ResolvedTheme) => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }

  const mediaQueryList = window.matchMedia(SYSTEM_DARK_MEDIA_QUERY)
  const handleChange = () => {
    onChange(mediaQueryList.matches ? 'dark' : 'light')
  }

  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', handleChange)
    return () => mediaQueryList.removeEventListener('change', handleChange)
  }

  mediaQueryList.addListener(handleChange)
  return () => mediaQueryList.removeListener(handleChange)
}
