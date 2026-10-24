'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Play, RotateCcw } from 'lucide-react'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { getUriWithOrg } from '@services/config/config'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'

/**
 * Where a student who already started a course should go next: the first lesson
 * (in chapter order) without a completed step. Steps are matched the same way
 * CourseProgress does it: step.activity_id === activity.id.
 */
export function getResumePoint(course: any, trailData: any, cleanCourseUuid: string) {
  const run = trailData?.runs?.find(
    (r: any) => r.course?.course_uuid?.replace('course_', '') === cleanCourseUuid
  )
  const activities: any[] = (course?.chapters || []).flatMap((chapter: any) => chapter.activities || [])
  const done = new Set<number>(
    (run?.steps || []).filter((step: any) => step.complete).map((step: any) => step.activity_id)
  )
  const completed = activities.filter((activity) => done.has(activity.id)).length
  const next = activities.find((activity) => !done.has(activity.id))
  return {
    completed,
    total: activities.length,
    target: next || activities[0],
    finished: activities.length > 0 && !next,
  }
}

type Props = {
  course: any
  courseuuid: string
  orgslug: string
  trailData: any
  /** Leaves the course (the page's existing start/leave handler). */
  onLeave: () => void | Promise<void>
  compact?: boolean
}

export default function ContinueCourseActions({ course, courseuuid, orgslug, trailData, onLeave, compact = false }: Props) {
  const { t } = useTranslation()
  const { track } = useLHAnalytics('learner')
  const cleanCourseUuid = course.course_uuid?.replace('course_', '')
  const { completed, total, target, finished } = getResumePoint(course, trailData, cleanCourseUuid)

  const href = target
    ? getUriWithOrg(orgslug, `/course/${courseuuid}/activity/${target.activity_uuid.replace('activity_', '')}`)
    : null
  const Icon = finished ? RotateCcw : Play

  return (
    <div className="space-y-2">
      {href && (
        <Link
          prefetch={false}
          href={href}
          onClick={() => track(AnalyticsEvent.CourseContinued, {
            course_uuid: cleanCourseUuid,
            completed_activities: completed,
            total_activities: total,
            finished,
          })}
          className={`w-full rounded-lg nice-shadow font-semibold transition-colors flex items-center justify-center gap-2 bg-neutral-900 text-white hover:bg-neutral-800 ${
            compact ? 'py-2 px-4 text-sm' : 'py-3'
          }`}
        >
          <Icon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
          <span>
            {finished
              ? t('courses.restart_course')
              : t('courses.continue_course', { completed, total })}
          </span>
        </Link>
      )}
      <div className="flex justify-center">
        <ConfirmationModal
          confirmationButtonText={t('courses.leave_course')}
          confirmationMessage={t('courses.leave_course_confirm')}
          dialogTitle={t('courses.leave_course')}
          dialogTrigger={
            <button type="button" className="text-xs text-gray-400 hover:text-red-500 underline underline-offset-2 transition-colors cursor-pointer">
              {t('courses.leave_course')}
            </button>
          }
          functionToExecute={onLeave}
          status="warning"
        />
      </div>
    </div>
  )
}
