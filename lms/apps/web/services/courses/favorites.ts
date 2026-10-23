import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

export async function getFavoriteCourseUuids(access_token: string): Promise<string[]> {
  const result: any = await fetch(
    `${getAPIUrl()}courses/favorites/`,
    RequestBodyWithAuthHeader('GET', null, {}, access_token)
  )
  const res = await errorHandling(result)
  return Array.isArray(res?.course_uuids) ? res.course_uuids : []
}

/** Idempotent on the server: PUT adds, DELETE removes. Resolves on 204, throws otherwise. */
export async function setCourseFavorite(course_uuid: string, favorite: boolean, access_token: string): Promise<void> {
  const result = await fetch(
    `${getAPIUrl()}courses/favorites/${course_uuid}`,
    RequestBodyWithAuthHeader(favorite ? 'PUT' : 'DELETE', null, {}, access_token)
  )
  if (!result.ok) throw new Error(`favorite request failed: ${result.status}`)
}
