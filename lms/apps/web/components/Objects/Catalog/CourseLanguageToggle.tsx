'use client'
import React from 'react'
import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface CourseLanguageToggleProps {
  showOther: boolean
  onChange: (value: boolean) => void
  /** Courses currently hidden because of their language. */
  hiddenCount: number
  className?: string
}

/** "Show courses in other languages". Hidden when the org has nothing in another language. */
export default function CourseLanguageToggle({ showOther, onChange, hiddenCount, className = '' }: CourseLanguageToggleProps) {
  const { t } = useTranslation()
  if (!showOther && hiddenCount === 0) return null

  return (
    <button
      type="button"
      onClick={() => onChange(!showOther)}
      aria-pressed={showOther}
      className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold nice-shadow transition-colors ${
        showOther ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
      } ${className}`}
    >
      <Languages className="w-4 h-4" />
      {showOther
        ? t('courses.language.hide_other')
        : t('courses.language.show_other', { count: hiddenCount })}
    </button>
  )
}
