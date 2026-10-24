import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

export type ActivityCalendarData = {
  start: string
  end: string
  days: { date: string; count: number }[]
  total_actions: number
  active_days: number
  current_streak: number
  longest_streak: number
}

export async function getMyActivityCalendar(token: string): Promise<ActivityCalendarData> {
  const res: any = await fetch(`${getAPIUrl()}activity-calendar/me`, RequestBodyWithAuthHeader('GET', null, {}, token))
  return await errorHandling(res)
}
