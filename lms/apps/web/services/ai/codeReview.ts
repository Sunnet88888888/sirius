import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

export type ReviewScores = { correctness: number; readability: number; efficiency: number; style: number }
export type ReviewIssue = { severity: 'error' | 'warning' | 'suggestion' | string; line: number | null; title: string; detail: string }

export type CodeReview = {
  review_uuid: string
  summary: string
  scores: ReviewScores
  issues: ReviewIssue[]
  tips: string[]
  improved_snippet: string | null
  tests_passed: number
  tests_total: number
  creation_date: string
}

export type ReviewQuota = { daily_limit: number; daily_used: number; monthly_limit: number; monthly_used: number }
export type ReviewHistory = { reviews: CodeReview[]; quota: ReviewQuota }

export type ReviewTestResult = {
  label: string
  passed: boolean
  actual?: string | null
  expected?: string | null
  error?: string | null
}

/** Error carrying the API's `detail` code (e.g. daily_review_limit_reached). */
export class ReviewError extends Error {
  status: number
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
  }
}

async function call(method: string, url: string, body: any, token: string) {
  const res = await fetch(url, RequestBodyWithAuthHeader(method, body, {}, token))
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.detail } catch { /* no body */ }
    throw new ReviewError(res.status, typeof detail === 'string' ? detail : '')
  }
  return res.json()
}

const base = () => `${getAPIUrl()}ai/code-review`

export const requestCodeReview = (
  body: { assignment_task_uuid: string; source_code: string; results: ReviewTestResult[]; locale: string },
  token: string
): Promise<{ review: CodeReview; quota: ReviewQuota }> => call('POST', base(), body, token)

export const getCodeReviewHistory = (assignmentTaskUuid: string, token: string): Promise<ReviewHistory> =>
  call('GET', `${base()}/history?assignment_task_uuid=${encodeURIComponent(assignmentTaskUuid)}`, null, token)

export const getCodeReviewsForGrading = (assignmentTaskUuid: string, userId: string, token: string): Promise<ReviewHistory> =>
  call('GET', `${base()}/grading?assignment_task_uuid=${encodeURIComponent(assignmentTaskUuid)}&user_id=${encodeURIComponent(userId)}`, null, token)
