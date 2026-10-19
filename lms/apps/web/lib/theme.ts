export type ThemeMode = 'light' | 'dark' | 'system'

// Must match public/theme-init.js, which runs before any bundle loads.
export const THEME_STORAGE_KEY = 'sirius-theme'
export const DEFAULT_THEME: ThemeMode = 'light'

export function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_THEME
}

export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
}

// Applies a mode to <html> and persists it. Other open tabs follow through the
// `storage` event, listened to in useTheme.
export function applyTheme(mode: ThemeMode, persist = true) {
  const dark = resolveIsDark(mode)
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode)
    } catch {
      /* storage unavailable */
    }
  }
}
