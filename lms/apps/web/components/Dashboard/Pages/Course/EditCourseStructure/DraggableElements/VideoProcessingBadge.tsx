import React, { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Loader2, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { getAPIUrl } from '@services/config/config'
import { getActivity } from '@services/courses/activities'

type HlsMeta = {
  status?: 'queued' | 'processing' | 'ready' | 'failed' | 'unsupported'
  progress?: number
  eta_seconds?: number | null
  error?: string
} | null

const POLL_MS = 10000

/**
 * Processing state of a hosted video (HLS transcoding), for authors and admins
 * in the course structure editor: queued, progress with time left, ready,
 * failed (with a reason and a Retry button). Polls while the video is in progress.
 */
export default function VideoProcessingBadge({
  activity,
  accessToken,
}: {
  activity: any
  accessToken: string
}) {
  const { t } = useTranslation()
  const isHosted = activity?.activity_sub_type === 'SUBTYPE_VIDEO_HOSTED'
  const [hls, setHls] = useState<HlsMeta>(activity?.extra_metadata?.hls ?? null)
  const [retrying, setRetrying] = useState(false)
  const status = hls?.status
  const inProgress = status === 'queued' || status === 'processing'

  // Follow the activity prop when the structure reloads.
  useEffect(() => {
    setHls(activity?.extra_metadata?.hls ?? null)
  }, [activity?.extra_metadata?.hls])

  // Refresh once on mount when no status is known yet (a fresh upload), and keep
  // polling while the video is queued or processing.
  useEffect(() => {
    if (!isHosted || !accessToken) return
    let cancelled = false
    const refresh = async () => {
      try {
        const res = await getActivity(activity.activity_uuid, null, accessToken)
        if (!cancelled && res?.extra_metadata) setHls(res.extra_metadata.hls ?? null)
      } catch {
        /* keep the last known state */
      }
    }
    if (!status) refresh()
    if (!inProgress) return () => { cancelled = true }
    const id = setInterval(refresh, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [isHosted, accessToken, activity?.activity_uuid, status, inProgress])

  if (!isHosted || !status) return null

  const base = 'dashboard.courses.structure.activity.video_processing'
  const tr = (key: string, def: string, opts: Record<string, unknown> = {}) =>
    t(`${base}.${key}`, { defaultValue: def, ...opts })

  async function retry() {
    setRetrying(true)
    try {
      const res = await fetch(
        `${getAPIUrl()}activities/video/${activity.activity_uuid}/hls/retry`,
        { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, credentials: 'include' }
      )
      if (res.ok) {
        setHls({ status: 'queued' })
      } else {
        const body = await res.json().catch(() => null)
        toast.error(body?.detail || tr('retry_error', 'Could not restart processing'))
      }
    } finally {
      setRetrying(false)
    }
  }

  const minutes = (s: number) => Math.max(1, Math.round(s / 60))

  if (status === 'queued') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0" title={tr('queued_hint', 'The video is waiting for its turn to be processed. It already plays in the original quality.')}>
        <Clock size={12} /> {tr('queued', 'In queue')}
      </span>
    )
  }

  if (status === 'processing') {
    const pct = typeof hls?.progress === 'number' ? hls.progress : null
    const eta = typeof hls?.eta_seconds === 'number' ? hls.eta_seconds : null
    return (
      <span className="flex items-center gap-2 text-[11px] text-blue-700 flex-shrink-0" title={tr('processing_hint', 'Creating adaptive quality versions. The video already plays in the original quality.')}>
        <Loader2 size={12} className="animate-spin" />
        <span className="whitespace-nowrap">
          {pct === null
            ? tr('processing_start', 'Processing…')
            : eta !== null
              ? tr('processing_eta', 'Processing {{pct}}% · about {{min}} min left', { pct, min: minutes(eta) })
              : tr('processing_pct', 'Processing {{pct}}%', { pct })}
        </span>
        <span className="hidden sm:block w-16 h-1.5 rounded-full bg-blue-100 overflow-hidden">
          <span className="block h-full bg-blue-500 transition-all" style={{ width: `${pct ?? 3}%` }} />
        </span>
      </span>
    )
  }

  if (status === 'ready') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-green-700 flex-shrink-0" title={tr('ready_hint', 'Adaptive quality is ready.')}>
        <CheckCircle2 size={12} /> {tr('ready', 'Ready')}
      </span>
    )
  }

  if (status === 'unsupported') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0" title={tr('unsupported_hint', 'This file has no video track, so no quality versions were created.')}>
        <AlertTriangle size={12} /> {tr('unsupported', 'Not processed')}
      </span>
    )
  }

  // failed
  const reasons: Record<string, string> = {
    source_unavailable: tr('err_source', 'the uploaded file could not be read'),
    transcode_failed: tr('err_transcode', 'the video could not be converted'),
    upload_failed: tr('err_upload', 'the result could not be saved to storage'),
    timeout: tr('err_timeout', 'processing took too long'),
    exception: tr('err_exception', 'an unexpected error occurred'),
  }
  const reason = (hls?.error && reasons[hls.error]) || tr('err_unknown', 'unknown error')
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-red-700 flex-shrink-0" title={tr('failed_hint', 'The video still plays in the original quality.')}>
      <AlertTriangle size={12} />
      <span className="whitespace-nowrap">{tr('failed', 'Processing failed: {{reason}}', { reason })}</span>
      <button
        onClick={retry}
        disabled={retrying}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50"
      >
        <RotateCw size={11} className={retrying ? 'animate-spin' : ''} /> {tr('retry', 'Retry')}
      </button>
    </span>
  )
}
