'use client'
import { useCallback, useEffect, useState } from 'react'
import {
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredTheme,
  resolveIsDark,
  type ThemeMode,
} from '@/lib/theme'

// `mode` is what the user chose; `isDark` is what is actually showing (they
// differ for 'system'). Both start as the light defaults so server and first
// client render agree, then sync from storage on mount.
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>('light')
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const stored = readStoredTheme()
    setModeState(stored)
    setIsDark(resolveIsDark(stored))

    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return
      const next = readStoredTheme()
      setModeState(next)
      applyTheme(next, false)
      setIsDark(resolveIsDark(next))
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystem = () => {
      if (readStoredTheme() === 'system') {
        applyTheme('system', false)
        setIsDark(resolveIsDark('system'))
      }
    }
    window.addEventListener('storage', onStorage)
    mq.addEventListener('change', onSystem)
    return () => {
      window.removeEventListener('storage', onStorage)
      mq.removeEventListener('change', onSystem)
    }
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    applyTheme(next)
    setModeState(next)
    setIsDark(resolveIsDark(next))
  }, [])

  const toggle = useCallback(() => {
    setMode(document.documentElement.classList.contains('dark') ? 'light' : 'dark')
  }, [setMode])

  return { mode, isDark, setMode, toggle }
}
