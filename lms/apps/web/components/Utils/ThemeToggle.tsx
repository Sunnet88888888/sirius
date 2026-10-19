'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@components/Hooks/useTheme'

// Icon button that flips between the light and dark theme. `className` lets
// each host (org header, login page, dashboard menu) match its own button style.
const ThemeToggle = ({ className = '' }: { className?: string }) => {
  const { t } = useTranslation()
  const { isDark, toggle } = useTheme()
  const label = isDark
    ? t('common.theme_switch_to_light', { defaultValue: 'Switch to light theme' })
    : t('common.theme_switch_to_dark', { defaultValue: 'Switch to dark theme' })

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={
        className ||
        'flex items-center justify-center px-2.5 py-2 rounded-lg transition-colors outline-none hover:bg-gray-100 text-gray-600'
      }
    >
      {isDark ? <Sun size={16} strokeWidth={2.5} /> : <Moon size={16} strokeWidth={2.5} />}
    </button>
  )
}

export default ThemeToggle
