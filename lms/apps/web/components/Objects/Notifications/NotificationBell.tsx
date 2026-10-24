'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Bell, CheckCheck } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'
import UserAvatar from '@components/Objects/UserAvatar'
import { getUriWithOrg } from '@services/config/config'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { formatRelative } from '@/lib/format'
import { getMenuColorClasses } from '@services/utils/ts/colorUtils'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  useNotificationActions,
  useNotificationList,
  useUnreadNotificationCount,
} from '@/hooks/queries/useNotifications'
import type { AppNotification } from '@services/notifications/notifications'

export default function NotificationBell({ orgslug, primaryColor = '' }: { orgslug: string; primaryColor?: string }) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const session = useLHSession() as any
  const colors = getMenuColorClasses(primaryColor)
  const [open, setOpen] = React.useState(false)
  const { data: unread = 0 } = useUnreadNotificationCount()
  const { data: list, isLoading } = useNotificationList(open)
  const { markRead, markAllRead } = useNotificationActions()

  if (session?.status !== 'authenticated') return null

  const actorName = (n: AppNotification) =>
    n.actor ? [n.actor.first_name, n.actor.last_name].filter(Boolean).join(' ') || n.actor.username : t('notifications.someone')

  const message = (n: AppNotification) =>
    n.type === 'comment_reply'
      ? t('notifications.comment_reply', { name: actorName(n) })
      : t('notifications.lesson_comment', { name: actorName(n), activity: n.activity_name })

  const openNotification = async (n: AppNotification) => {
    setOpen(false)
    if (!n.is_read) markRead(n.notification_uuid)
    const course = n.course_uuid.replace('course_', '')
    const activity = n.activity_uuid.replace('activity_', '')
    router.push(`${getUriWithOrg(orgslug, `/course/${course}/activity/${activity}`)}#comment-${n.comment_uuid}`)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? t('notifications.title_unread', { count: unread }) : t('notifications.title')}
          className={`relative flex items-center justify-center p-2 rounded-lg transition-colors outline-none cursor-pointer ${colors.iconBtn}`}
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        className="w-[22rem] max-w-[calc(100vw-1rem)] max-h-[min(32rem,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto p-0"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-sm font-bold text-gray-900">{t('notifications.title')}</h3>
          {unread > 0 && (
            <button type="button" onClick={() => markAllRead()} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 cursor-pointer">
              <CheckCheck className="w-3.5 h-3.5" /> {t('notifications.mark_all_read')}
            </button>
          )}
        </div>
        {isLoading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded bg-gray-100" />)}
          </div>
        ) : !list || list.notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">{t('notifications.empty')}</p>
        ) : (
          <ul>
            {list.notifications.map((n) => {
              const avatar = n.actor?.avatar_image ? getUserAvatarMediaDirectory(n.actor.user_uuid, n.actor.avatar_image) : ''
              return (
                <li key={n.notification_uuid}>
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className={`w-full flex gap-3 px-4 py-3 text-start hover:bg-gray-50 transition-colors cursor-pointer ${n.is_read ? '' : 'bg-blue-50/50'}`}
                  >
                    <div className="shrink-0 pt-0.5">
                      <UserAvatar width={32} rounded="rounded-full" border="border-2" avatar_url={avatar} predefined_avatar={avatar ? undefined : 'empty'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 break-words">{message(n)}</p>
                      {n.snippet && <p className="mt-0.5 text-xs text-gray-500 line-clamp-2 break-words" dir="auto">{n.snippet}</p>}
                      <p className="mt-1 text-[11px] text-gray-400 truncate">
                        {n.course_name} · {formatRelative(n.creation_date, i18n.language)}
                      </p>
                    </div>
                    {!n.is_read && <span className="mt-2 w-2 h-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
