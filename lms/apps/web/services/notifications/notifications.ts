import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'
import type { CommentAuthor } from '@services/comments/activityComments'

export type AppNotification = {
  notification_uuid: string
  type: 'comment_reply' | 'lesson_comment' | string
  actor: CommentAuthor | null
  course_uuid: string
  course_name: string
  activity_uuid: string
  activity_name: string
  comment_uuid: string
  snippet: string
  is_read: boolean
  creation_date: string
}

export type NotificationList = { notifications: AppNotification[]; unread_count: number }

const base = () => `${getAPIUrl()}notifications`

export async function getNotifications(token: string): Promise<NotificationList> {
  const res: any = await fetch(`${base()}/?limit=30`, RequestBodyWithAuthHeader('GET', null, {}, token))
  return await errorHandling(res)
}

export async function getUnreadNotificationCount(token: string): Promise<number> {
  const res: any = await fetch(`${base()}/unread-count`, RequestBodyWithAuthHeader('GET', null, {}, token))
  const data = await errorHandling(res)
  return data?.unread_count ?? 0
}

export async function markNotificationRead(notificationUuid: string, token: string) {
  await fetch(`${base()}/${notificationUuid}/read`, RequestBodyWithAuthHeader('POST', null, {}, token))
}

export async function markAllNotificationsRead(token: string) {
  await fetch(`${base()}/read-all`, RequestBodyWithAuthHeader('POST', null, {}, token))
}
