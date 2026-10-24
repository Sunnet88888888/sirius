'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Loader2, AlertTriangle, XCircle, Lightbulb, History } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { formatRelative } from '@/lib/format'
import {
  CodeReview,
  ReviewError,
  ReviewQuota,
  ReviewTestResult,
  getCodeReviewHistory,
  getCodeReviewsForGrading,
  requestCodeReview,
} from '@services/ai/codeReview'

type Props = {
  assignmentTaskUuid: string
  /** student: can request a review; teacher: read-only list of that student's reviews */
  mode: 'student' | 'teacher'
  /** teacher mode: the student whose reviews are shown */
  userId?: string
  code?: string
  results?: ReviewTestResult[]
}

const SCORE_KEYS = ['correctness', 'readability', 'efficiency', 'style'] as const

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-gray-600">{label}</span>
      <span className="flex items-center gap-1" role="img" aria-label={`${value}/5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`w-3.5 h-1.5 rounded-full ${i <= value ? 'bg-emerald-500' : 'bg-gray-200'}`} />
        ))}
      </span>
    </div>
  )
}

function ReviewBody({ review }: { review: CodeReview }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{review.summary}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
        {SCORE_KEYS.map((key) => (
          <ScoreRow key={key} label={t(`code_review.score_${key}`)} value={review.scores[key]} />
        ))}
      </div>

      {review.issues.length > 0 && (
        <ul className="space-y-2">
          {review.issues.map((issue, i) => {
            const tone =
              issue.severity === 'error'
                ? { box: 'border-red-200 bg-red-50', icon: <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> }
                : issue.severity === 'warning'
                  ? { box: 'border-amber-200 bg-amber-50', icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /> }
                  : { box: 'border-blue-200 bg-blue-50', icon: <Lightbulb className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" /> }
            return (
              <li key={i} className={`flex gap-2.5 rounded-lg border p-3 ${tone.box}`}>
                {tone.icon}
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-gray-900 break-words">
                    {issue.line != null && (
                      <span className="me-2 px-1.5 py-0.5 rounded bg-white/70 text-xs font-mono text-gray-600">
                        {t('code_review.line', { line: issue.line })}
                      </span>
                    )}
                    {issue.title}
                  </p>
                  <p className="mt-0.5 text-gray-700 break-words">{issue.detail}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {review.tips.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">{t('code_review.tips')}</h4>
          <ul className="list-disc ps-5 space-y-1 text-sm text-gray-800">
            {review.tips.map((tip, i) => <li key={i} className="break-words">{tip}</li>)}
          </ul>
        </div>
      )}

      {review.improved_snippet && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">{t('code_review.improved')}</h4>
          <pre dir="ltr" className="overflow-x-auto rounded-lg bg-[#1a1b26] text-gray-100 text-xs p-3 font-mono">{review.improved_snippet}</pre>
        </div>
      )}
    </div>
  )
}

export default function AICodeReviewCard({ assignmentTaskUuid, mode, userId, code = '', results = [] }: Props) {
  const { t, i18n } = useTranslation()
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token as string | undefined
  const [reviews, setReviews] = React.useState<CodeReview[]>([])
  const [quota, setQuota] = React.useState<ReviewQuota | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [showOlder, setShowOlder] = React.useState(false)

  React.useEffect(() => {
    if (!token || !assignmentTaskUuid) return
    const load = mode === 'teacher'
      ? userId ? getCodeReviewsForGrading(assignmentTaskUuid, userId, token) : null
      : getCodeReviewHistory(assignmentTaskUuid, token)
    load?.then((h) => { setReviews(h.reviews); setQuota(h.quota) }).catch(() => { /* the card simply stays empty */ })
  }, [token, assignmentTaskUuid, mode, userId])

  const message = (e: unknown) => {
    const detail = e instanceof ReviewError ? e.message : ''
    if (detail === 'daily_review_limit_reached') return t('code_review.limit_daily')
    if (detail === 'monthly_review_limit_reached') return t('code_review.limit_monthly')
    if (detail === 'review_in_progress') return t('code_review.in_progress')
    if (e instanceof ReviewError && e.status === 429) return t('code_review.too_fast')
    if (e instanceof ReviewError && e.status === 403) return t('code_review.unavailable')
    return t('code_review.failed')
  }

  const ask = async () => {
    if (!token || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await requestCodeReview(
        { assignment_task_uuid: assignmentTaskUuid, source_code: code, results, locale: i18n.language },
        token
      )
      setReviews((prev) => [res.review, ...prev].slice(0, 5))
      setQuota(res.quota)
      setShowOlder(false)
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  const limitReached = !!quota && (
    (quota.daily_limit > 0 && quota.daily_used >= quota.daily_limit) ||
    (quota.monthly_limit > 0 && quota.monthly_used >= quota.monthly_limit)
  )
  const [latest, ...older] = reviews

  if (mode === 'teacher' && reviews.length === 0) return null

  return (
    <section className="rounded-xl bg-white nice-shadow p-4 sm:p-5 space-y-4" aria-labelledby={`ai-review-${assignmentTaskUuid}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={`ai-review-${assignmentTaskUuid}`} className="flex items-center gap-2 text-base font-bold text-gray-900">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          {t('code_review.title')}
        </h3>
        {mode === 'student' && (
          <div className="flex items-center gap-3">
            {quota && quota.daily_limit > 0 && (
              <span className="text-xs text-gray-500">
                {t('code_review.quota_today', { used: quota.daily_used, limit: quota.daily_limit })}
              </span>
            )}
            <button
              type="button"
              onClick={ask}
              disabled={busy || limitReached || !code.trim()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy ? t('code_review.reviewing') : t('code_review.ask')}
            </button>
          </div>
        )}
      </div>

      {mode === 'student' && !latest && !busy && !error && (
        <p className="text-sm text-gray-500">{t('code_review.intro')}</p>
      )}
      {limitReached && quota && (
        <p className="text-sm text-amber-700">
          {quota.daily_limit > 0 && quota.daily_used >= quota.daily_limit ? t('code_review.limit_daily') : t('code_review.limit_monthly')}
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {latest && (
        <div>
          <p className="mb-3 text-xs text-gray-400">
            {formatRelative(latest.creation_date + 'Z', i18n.language)}
            {latest.tests_total > 0 && ` · ${t('code_review.tests', { passed: latest.tests_passed, total: latest.tests_total })}`}
          </p>
          <ReviewBody review={latest} />
        </div>
      )}

      {older.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowOlder((v) => !v)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 cursor-pointer">
            <History className="w-3.5 h-3.5" /> {t('code_review.previous', { count: older.length })}
          </button>
          {showOlder && (
            <div className="mt-3 space-y-5 divide-y divide-gray-100">
              {older.map((r) => (
                <div key={r.review_uuid} className="pt-4 first:pt-0">
                  <p className="mb-2 text-xs text-gray-400">{formatRelative(r.creation_date + 'Z', i18n.language)}</p>
                  <ReviewBody review={r} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-gray-400">{t('code_review.disclaimer')}</p>
    </section>
  )
}
