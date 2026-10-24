'use client'

import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getActivityComments } from '@services/comments/activityComments'

export const activityCommentsKey = (activityUuid: string) => ['activity-comments', activityUuid] as const

export function useActivityComments(activityUuid: string) {
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token as string | undefined
  return useQuery({
    queryKey: activityCommentsKey(activityUuid),
    queryFn: () => getActivityComments(activityUuid, token),
    enabled: !!activityUuid,
    staleTime: 15_000,
  })
}
