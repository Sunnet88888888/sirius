'use client'

import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getFavoriteCourseUuids, setCourseFavorite } from '@services/courses/favorites'

export const FAVORITES_KEY = ['course-favorites'] as const

/** Course uuids the signed-in user has favourited. Empty (and no request) for anonymous visitors. */
export function useFavoriteCourseUuids() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: FAVORITES_KEY,
    queryFn: () => getFavoriteCourseUuids(accessToken as string),
    enabled: !!accessToken,
    staleTime: 60_000,
  })
}

/** [isFavorite, toggle] for one course. Updates optimistically and rolls back if the request fails. */
export function useFavoriteCourse(courseUuid: string, orgslug: string): [boolean, (e: React.MouseEvent) => void] {
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const { data: uuids } = useFavoriteCourseUuids()
  const favorite = !!uuids?.includes(courseUuid)

  const toggle = async (e: React.MouseEvent) => {
    // The heart sits on top of the card link
    e.preventDefault()
    e.stopPropagation()
    if (!accessToken) {
      toast(t('courses.login_to_favorite'))
      router.push(getUriWithOrg(orgslug, '/login'))
      return
    }
    const next = !favorite
    const previous = queryClient.getQueryData<string[]>(FAVORITES_KEY) ?? []
    queryClient.setQueryData<string[]>(FAVORITES_KEY, next
      ? [courseUuid, ...previous.filter((id) => id !== courseUuid)]
      : previous.filter((id) => id !== courseUuid))
    try {
      await setCourseFavorite(courseUuid, next, accessToken)
    } catch {
      queryClient.setQueryData(FAVORITES_KEY, previous)
      toast.error(t('courses.favorite_error'))
    }
  }
  return [favorite, toggle]
}
