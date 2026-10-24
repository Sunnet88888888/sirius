'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@services/notifications/notifications'

const COUNT_KEY = ['notifications', 'unread-count'] as const
const LIST_KEY = ['notifications', 'list'] as const

function useToken() {
  const session = useLHSession() as any
  return session?.data?.tokens?.access_token as string | undefined
}

/** Unread badge number; polled once a minute while the tab is open. */
export function useUnreadNotificationCount() {
  const token = useToken()
  return useQuery({
    queryKey: COUNT_KEY,
    queryFn: () => getUnreadNotificationCount(token as string),
    enabled: !!token,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

/** The list itself is only fetched while the panel is open. */
export function useNotificationList(open: boolean) {
  const token = useToken()
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => getNotifications(token as string),
    enabled: !!token && open,
    staleTime: 0,
  })
}

export function useNotificationActions() {
  const token = useToken()
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: COUNT_KEY })
    queryClient.invalidateQueries({ queryKey: LIST_KEY })
  }
  return {
    markRead: async (uuid: string) => {
      if (!token) return
      await markNotificationRead(uuid, token)
      refresh()
    },
    markAllRead: async () => {
      if (!token) return
      await markAllNotificationsRead(token)
      refresh()
    },
  }
}
