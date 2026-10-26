'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import Link from 'next/link'
import { BookOpen, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const SHOWN = 3
const time = (s?: string) => (s ? Date.parse(s) || 0 : 0)

/** Most recently touched runs, unfinished ones first, finished ones only fill spare slots. */
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
  return [...items.filter((i) => i.pct < 100), ...items.filter((i) => i.pct >= 100)].slice(0, SHOWN)
}

export default function LastLearnedCourse({ runs, orgslug }: { runs: any[] | undefined; orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const items = pickLastLearned(runs)

  if (items.length === 0) {
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

  return (
    <section className="h-full flex flex-col" aria-label={t('progress.last_course')}>
      <h3 className="text-base font-bold text-gray-900 mb-3">{t('progress.last_course')}</h3>
      <ul className="flex flex-col gap-3">
        {items.map(({ run, pct, done, total }) => {
          const course = run.course
          const link = getUriWithOrg(orgslug, '/course/' + course.course_uuid.replace('course_', ''))
          const finished = pct >= 100
          return (
            <li key={course.course_uuid}>
              <Link href={link} className="group flex items-center gap-3 rounded-2xl bg-white nice-shadow p-3 hover:-translate-y-0.5 transition-transform">
                <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center text-gray-300">
                  {course.thumbnail_image && org?.org_uuid ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getCourseThumbnailMediaDirectory(org.org_uuid, course.course_uuid, course.thumbnail_image)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen size={24} strokeWidth={1.5} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate" dir="auto">{course.name}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className={`h-full rounded-full ${finished ? 'bg-green-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    <span className={`font-semibold ${finished ? 'text-green-600' : 'text-emerald-600'}`}>{pct}%</span>
                    {' · '}{t('courses.completed_of', { completed: done, total })}
                  </p>
                </div>
                <span className="shrink-0 hidden sm:flex items-center gap-1.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold px-3 py-2 group-hover:bg-neutral-800">
                  {finished ? t('common.completed') : <><Play className="w-3.5 h-3.5" /> {t('courses.continue_learning')}</>}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
