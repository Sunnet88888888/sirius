'use client'

import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getMyActivityCalendar } from '@services/users/activityCalendar'

export function useMyActivityCalendar() {
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token as string | undefined
  return useQuery({
    queryKey: ['activity-calendar', 'me'],
    queryFn: () => getMyActivityCalendar(token as string),
    enabled: !!token,
    staleTime: 60_000,
  })
}
