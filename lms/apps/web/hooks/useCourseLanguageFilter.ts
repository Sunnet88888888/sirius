'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'lh_show_other_course_languages'

type WithLanguage = { language?: string | null }

/** `pt-BR` -> `pt`; courses and the interface both compare on the primary subtag. */
export const primaryLanguage = (code?: string | null): string =>
  String(code || '').split('-')[0].toLowerCase()

/**
 * Public course lists show courses in the visitor's language (the interface language,
 * which starts from the browser language and is changed with the language switcher).
 * Courses without a language belong to everyone. "Show other languages" is remembered
 * in this browser. Dashboard lists do not use this: authors and admins see everything.
 */
export function useCourseLanguageFilter() {
  const { i18n } = useTranslation()
  const visitorLanguage = primaryLanguage(i18n.resolvedLanguage || i18n.language) || 'en'

  // Read after mount so server and client render the same first paint.
  const [showOther, setShowOtherState] = useState(false)
  useEffect(() => {
    try {
      setShowOtherState(localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      // storage blocked: keep the default
    }
  }, [])

  const setShowOther = useCallback((value: boolean) => {
    setShowOtherState(value)
    try {
      if (value) localStorage.setItem(STORAGE_KEY, '1')
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // storage blocked: the choice lasts until reload
    }
  }, [])

  const matches = useCallback(
    (course: WithLanguage) => !course.language || primaryLanguage(course.language) === visitorLanguage,
    [visitorLanguage]
  )

  const filter = useCallback(
    <T extends WithLanguage>(courses: T[]): T[] => (showOther ? courses : courses.filter(matches)),
    [showOther, matches]
  )

  const hiddenCount = useCallback(
    (courses: WithLanguage[]): number => courses.filter((c) => !matches(c)).length,
    [matches]
  )

  return { visitorLanguage, showOther, setShowOther, filter, hiddenCount }
}
