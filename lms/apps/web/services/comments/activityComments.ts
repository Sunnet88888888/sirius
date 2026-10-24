import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

export type CommentAuthor = {
  id: number
  user_uuid: string
  username: string
  first_name: string
  last_name: string
  avatar_image?: string
}

export type ActivityComment = {
  comment_uuid: string
  parent_uuid: string | null
  content: string
  is_pinned: boolean
  is_edited: boolean
  upvote_count: number
  has_voted: boolean
  can_edit: boolean
  can_delete: boolean
  author: CommentAuthor
  creation_date: string
  update_date: string
}

export type ActivityCommentList = {
  comments: ActivityComment[]
  can_comment: boolean
  can_moderate: boolean
}

const base = () => `${getAPIUrl()}comments`

async function send(method: string, url: string, body: any, token?: string) {
  const res = await fetch(url, RequestBodyWithAuthHeader(method, body, {}, token))
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.detail } catch { /* no body */ }
    throw new Error(detail || `request failed: ${res.status}`)
  }
  return res
}

export async function getActivityComments(activityUuid: string, token?: string): Promise<ActivityCommentList> {
  const res: any = await fetch(`${base()}/activity/${activityUuid}`, RequestBodyWithAuthHeader('GET', null, {}, token))
  return await errorHandling(res)
}

export async function createActivityComment(activityUuid: string, content: string, parentUuid: string | null, token: string): Promise<ActivityComment> {
  const res = await send('POST', `${base()}/activity/${activityUuid}`, { content, parent_uuid: parentUuid }, token)
  return await res.json()
}

export async function updateActivityComment(commentUuid: string, content: string, token: string) {
  await send('PUT', `${base()}/${commentUuid}`, { content }, token)
}

export async function deleteActivityComment(commentUuid: string, token: string) {
  await send('DELETE', `${base()}/${commentUuid}`, null, token)
}

export async function toggleCommentVote(commentUuid: string, token: string): Promise<{ upvote_count: number; has_voted: boolean }> {
  const res = await send('POST', `${base()}/${commentUuid}/vote`, null, token)
  return await res.json()
}

export async function toggleCommentPin(commentUuid: string, token: string) {
  await send('POST', `${base()}/${commentUuid}/pin`, null, token)
}
