'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BookCopy, Code2, LogIn, MessagesSquare, Sparkles, Layers, Play } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton'
import ContentPlaceHolderIfUserIsNotAdmin from '@components/Objects/ContentPlaceHolder'
import UserAvatar from '@components/Objects/UserAvatar'
import ActivityCalendar from '@components/Objects/Progress/ActivityCalendar'
import { CourseCover } from '@components/Objects/Thumbnails/CourseCardParts'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTrail } from '@/hooks/queries/useTrail'
import { getUriWithOrg } from '@services/config/config'
import { getCourseThumbnailMediaDirectory, getUserAvatarMediaDirectory } from '@services/media/media'

interface LandingClassicProps {
  courses: any[]
  orgslug: string
  org_id: string | number
}

const HOME_COURSES = 6

/** Unique active authors across the catalogue, most courses first. */
function collectTeachers(courses: any[]) {
  const map = new Map<string, { user: any; count: number }>()
  courses.forEach((course) => {
    ;(course.authors || [])
      .filter((a: any) => a.authorship_status === 'ACTIVE')
      .forEach((a: any) => {
        const entry = map.get(a.user.user_uuid)
        if (entry) entry.count += 1
        else map.set(a.user.user_uuid, { user: a.user, count: 1 })
      })
  })
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8)
}

function Hero({ orgslug, courseCount, teacherCount }: { orgslug: string; courseCount: number; teacherCount: number }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'

  return (
    <section className="relative isolate overflow-hidden rounded-3xl text-white px-6 py-12 sm:px-12 sm:py-20 mb-10"
      style={{ background: 'linear-gradient(135deg, #07110d 0%, #0a1f19 55%, #050807 100%)' }}>
      {/* glow + stars */}
      <div aria-hidden="true" className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 80% at 85% 0%, rgba(53,217,143,.28), transparent 65%), radial-gradient(40% 60% at 0% 100%, rgba(94,230,168,.12), transparent 70%)',
        }} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 12% 22%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 38% 68%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 62% 30%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 78% 80%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 90% 45%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 24% 88%, #fff 50%, transparent 51%)',
        }} />

      <div className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1 text-xs font-semibold text-emerald-300">
          <Sparkles className="w-3.5 h-3.5" /> {t('home_landing.badge')}
        </span>
        <h1 className="mt-5 text-4xl sm:text-6xl leading-[1.05] tracking-tight break-words"
          style={{ fontFamily: 'var(--font-display), var(--font-default), sans-serif', fontWeight: 500 }}>
          {org?.name || 'SIRIUS'}
        </h1>
        <p className="mt-5 max-w-xl text-base sm:text-lg text-gray-300">
          {org?.description || t('home_landing.hero_subtitle')}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={getUriWithOrg(orgslug, '/courses')}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-[#03140c] transition-transform hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #5ee6a8 0%, #35d98f 100%)', boxShadow: '0 12px 30px rgba(53,217,143,.35)' }}>
            {t('home_landing.browse_courses')} <ArrowRight className="w-4 h-4" />
          </Link>
          {!isAuthenticated && (
            <Link href={getUriWithOrg(orgslug, '/signup')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              {t('home_landing.get_started')}
            </Link>
          )}
        </div>

        <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
          {[
            [courseCount, t('home_landing.stat_courses')],
            [teacherCount, t('home_landing.stat_teachers')],
          ].map(([value, label]) => (
            <div key={String(label)}>
              <dt className="text-xs uppercase tracking-wider text-gray-400">{label}</dt>
              <dd className="text-3xl font-semibold text-emerald-300" style={{ fontFamily: 'var(--font-display), var(--font-default), sans-serif' }}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function ContinueLearning({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const { data: trail } = useTrail(org?.id)

  const inProgress = (trail?.runs || [])
    .map((run: any) => {
      const total = run.course_total_steps || 0
      const done = run.steps?.filter((s: any) => s.complete).length ?? run.steps?.length ?? 0
      return { run, pct: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0 }
    })
    .filter(({ run, pct }: any) => run.course && pct < 100)
    .slice(0, 3)

  return (
    <section className="mb-12">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {inProgress.length > 0 && (
          <div className="xl:col-span-2">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('home_landing.continue_title')}</h2>
            <ul className="space-y-3">
              {inProgress.map(({ run, pct }: any) => {
                const course = run.course
                const uuid = course.course_uuid.replace('course_', '')
                return (
                  <li key={course.course_uuid}>
                    <Link href={getUriWithOrg(orgslug, `/course/${uuid}`)}
                      className="group flex items-center gap-4 rounded-2xl bg-white nice-shadow p-3 hover:-translate-y-0.5 transition-transform">
                      <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gray-100">
                        {course.thumbnail_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <CourseCover seed={course.course_uuid} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 truncate" dir="auto">{course.name}</p>
                        <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{t('home_landing.progress_pct', { pct })}</p>
                      </div>
                      <span className="shrink-0 hidden sm:flex items-center gap-1.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold px-3 py-2 group-hover:bg-neutral-800">
                        <Play className="w-3.5 h-3.5" /> {t('home_landing.continue')}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        <div className={inProgress.length > 0 ? 'xl:col-span-3' : 'xl:col-span-5'}>
          <ActivityCalendar />
        </div>
      </div>
    </section>
  )
}

function Features() {
  const { t } = useTranslation()
  const items = [
    { icon: <Layers className="w-5 h-5" />, title: t('home_landing.f1_title'), text: t('home_landing.f1_text') },
    { icon: <Code2 className="w-5 h-5" />, title: t('home_landing.f2_title'), text: t('home_landing.f2_text') },
    { icon: <Sparkles className="w-5 h-5" />, title: t('home_landing.f3_title'), text: t('home_landing.f3_text') },
    { icon: <MessagesSquare className="w-5 h-5" />, title: t('home_landing.f4_title'), text: t('home_landing.f4_text') },
  ]
  return (
    <section className="mb-12">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{t('home_landing.features_title')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.title} className="rounded-2xl bg-white nice-shadow p-5">
            <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">{item.icon}</span>
            <h3 className="mt-4 font-bold text-gray-900">{item.title}</h3>
            <p className="mt-1.5 text-sm text-gray-500">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Teachers({ teachers, orgslug }: { teachers: { user: any; count: number }[]; orgslug: string }) {
  const { t } = useTranslation()
  if (teachers.length === 0) return null
  return (
    <section className="mb-12">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{t('home_landing.teachers_title')}</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
        {teachers.map(({ user, count }) => {
          const avatar = user.avatar_image ? getUserAvatarMediaDirectory(user.user_uuid, user.avatar_image) : ''
          const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
          return (
            <li key={user.user_uuid}>
              <Link href={getUriWithOrg(orgslug, `/user/${user.username}`)}
                className="flex items-center gap-3 rounded-2xl bg-white nice-shadow p-3 hover:-translate-y-0.5 transition-transform">
                <UserAvatar width={44} rounded="rounded-full" border="border-2" avatar_url={avatar} predefined_avatar={avatar ? undefined : 'empty'} />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{name}</p>
                  <p className="text-xs text-gray-500">{t('home_landing.teacher_courses', { count })}</p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function LandingClassic({ courses, orgslug, org_id }: LandingClassicProps) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'

  const displayed = courses.slice(0, HOME_COURSES)
  const teachers = React.useMemo(() => collectTeachers(courses), [courses])

  return (
    <div className="w-full">
      <GeneralWrapperStyled>
        <Hero orgslug={orgslug} courseCount={courses.length} teacherCount={teachers.length} />

        {isAuthenticated && <ContinueLearning orgslug={orgslug} />}

        {/* Courses */}
        <section className="mb-12">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t('home_landing.popular_title')}</h2>
            <div className="flex items-center gap-3">
              <AuthenticatedClientElement ressourceType="courses" action="create" checkMethod="roles" orgId={org_id}>
                <Link href={getUriWithOrg(orgslug, '/courses?new=true')}>
                  <NewCourseButton />
                </Link>
              </AuthenticatedClientElement>
              {courses.length > 0 && (
                <Link href={getUriWithOrg(orgslug, '/courses')}
                  className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
                  {t('home_landing.view_all')} <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {displayed.map((course: any, index: number) => (
              <div key={course.course_uuid} className="flex">
                <CourseThumbnail course={course} orgslug={orgslug} isPriority={index < 3} />
              </div>
            ))}
            {courses.length === 0 && (
              <div className="col-span-full flex flex-col justify-center items-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
                <div className="p-4 bg-white rounded-full nice-shadow mb-4">
                  {isAuthenticated ? (
                    <BookCopy className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
                  ) : (
                    <LogIn className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-600 mb-2">
                  {isAuthenticated
                    ? t('courses.no_courses')
                    : t('courses.sign_in_to_see_courses', 'Log in to see your courses')}
                </h2>
                {/* Anonymous visitors only ever receive PUBLIC courses from the API,
                    so an empty list here usually means "sign in", not "empty academy". */}
                <p className="text-md text-gray-400 mb-6 text-center max-w-xs">
                  {isAuthenticated ? (
                    <ContentPlaceHolderIfUserIsNotAdmin text={t('courses.create_courses_placeholder')} />
                  ) : (
                    t(
                      'courses.sign_in_to_see_courses_description',
                      'Courses in this academy may only be visible once you are signed in.',
                    )
                  )}
                </p>
                {!isAuthenticated && (
                  <Link
                    href={getUriWithOrg(orgslug, '/login')}
                    className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
                  >
                    <LogIn size={16} />
                    {t('auth.sign_in', 'Sign in')}
                  </Link>
                )}
              </div>
            )}
          </div>

          {courses.length > HOME_COURSES && (
            <div className="mt-5 text-center">
              <Link href={getUriWithOrg(orgslug, '/courses')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white nice-shadow text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors">
                {t('courses.view_all_courses')} ({courses.length})
              </Link>
            </div>
          )}
        </section>

        <Features />
        <Teachers teachers={teachers} orgslug={orgslug} />

        {!isAuthenticated && (
          <section className="relative overflow-hidden rounded-3xl px-6 py-10 sm:px-12 sm:py-14 text-center text-white mb-6"
            style={{ background: 'linear-gradient(135deg, #0a1f19 0%, #07110d 100%)' }}>
            <div aria-hidden="true" className="absolute inset-0" style={{ background: 'radial-gradient(50% 90% at 50% 0%, rgba(53,217,143,.25), transparent 70%)' }} />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-semibold" style={{ fontFamily: 'var(--font-display), var(--font-default), sans-serif' }}>{t('home_landing.cta_title')}</h2>
              <p className="mt-3 text-gray-300 max-w-md mx-auto">{t('home_landing.cta_text')}</p>
              <Link href={getUriWithOrg(orgslug, '/signup')}
                className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-[#03140c]"
                style={{ background: 'linear-gradient(135deg, #5ee6a8 0%, #35d98f 100%)' }}>
                {t('home_landing.get_started')} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>
        )}
      </GeneralWrapperStyled>
    </div>
  )
}

export default LandingClassic
