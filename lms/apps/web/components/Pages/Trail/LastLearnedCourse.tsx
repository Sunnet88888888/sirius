'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import Link from 'next/link'
import { BookOpen, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const time = (s?: string) => (s ? Date.parse(s) || 0 : 0)

/** The run the learner touched most recently, preferring unfinished courses. */
export function pickLastLearned(runs: any[] | undefined) {
  const items = (runs || [])
    .filter((run) => run.course)
    .map((run) => {
      const total = run.course_total_steps || 0
      const done = run.steps?.length ?? 0
      const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
      const last = Math.max(time(run.update_date), time(run.creation_date), ...(run.steps || []).map((s: any) => time(s.update_date)))
      return { run, pct, done, total, last }
    })
    .sort((a, b) => b.last - a.last)
  return items.find((i) => i.pct < 100) || items[0] || null
}

export default function LastLearnedCourse({ runs, orgslug }: { runs: any[] | undefined; orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const item = pickLastLearned(runs)

  if (!item) {
    return (
      <section className="h-full rounded-2xl bg-white nice-shadow p-5 flex flex-col items-center justify-center text-center">
        <BookOpen className="w-8 h-8 text-gray-300 mb-3" strokeWidth={1.5} />
        <p className="text-sm text-gray-500 mb-4">{t('user.start_course_to_see_progress')}</p>
        <Link href={getUriWithOrg(orgslug, '/courses')} className="rounded-lg bg-neutral-900 text-white text-sm font-semibold px-4 py-2 hover:bg-neutral-800">
          {t('home_landing.browse_courses')}
        </Link>
      </section>
    )
  }

  const { run, pct, done, total } = item
  const course = run.course
  const link = getUriWithOrg(orgslug, '/course/' + course.course_uuid.replace('course_', ''))
  const finished = pct >= 100

  return (
    <section className="h-full rounded-2xl bg-white nice-shadow overflow-hidden flex flex-col" aria-label={t('progress.last_course')}>
      <Link href={link} className="block relative aspect-video bg-gray-50 overflow-hidden">
        {course.thumbnail_image && org?.org_uuid ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={getCourseThumbnailMediaDirectory(org.org_uuid, course.course_uuid, course.thumbnail_image)} alt={course.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full w-full text-gray-300"><BookOpen size={40} strokeWidth={1.5} /></div>
        )}
      </Link>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{t('progress.last_course')}</p>
        <Link href={link} className="text-base font-bold text-gray-900 leading-tight line-clamp-2" dir="auto">{course.name}</Link>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full ${finished ? 'bg-green-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`font-semibold ${finished ? 'text-green-600' : 'text-emerald-600'}`}>{pct}%</span>
          <span className="text-gray-400 text-xs">{t('courses.completed_of', { completed: done, total })}</span>
        </div>
        <Link href={link} className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 text-white text-sm font-semibold px-4 py-2 hover:bg-neutral-800">
          {finished ? t('common.completed') : <><Play className="w-3.5 h-3.5" /> {t('courses.continue_learning')}</>}
        </Link>
      </div>
    </section>
  )
}
