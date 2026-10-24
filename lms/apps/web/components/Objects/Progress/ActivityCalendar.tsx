'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Flame, CalendarCheck, Trophy, Zap } from 'lucide-react'
import { useMyActivityCalendar } from '@/hooks/queries/useActivityCalendar'
import { formatDate } from '@/lib/format'

const CELL = 12
const GAP = 3

// 0 = no activity, then four green steps
const LEVEL_CLASS = [
  'bg-gray-200/80',
  'bg-emerald-200',
  'bg-emerald-300',
  'bg-emerald-500',
  'bg-emerald-700',
]

const levelOf = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4)

const iso = (d: Date) => d.toISOString().slice(0, 10)

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="shrink-0 w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">{icon}</span>
      <div className="min-w-0">
        <div className="text-lg font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-[11px] text-gray-500 leading-tight truncate">{label}</div>
      </div>
    </div>
  )
}

export default function ActivityCalendar({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = useMyActivityCalendar()
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const { weeks, months } = React.useMemo(() => {
    if (!data) return { weeks: [] as { date: string; count: number; future: boolean }[][], months: [] as { label: string; col: number }[] }
    const counts = new Map(data.days.map((d) => [d.date, d.count]))
    const start = new Date(data.start + 'T00:00:00Z')
    const end = new Date(data.end + 'T00:00:00Z')
    // weeks start on Monday
    const lead = (start.getUTCDay() + 6) % 7
    const cells: ({ date: string; count: number; future: boolean } | null)[] = Array(lead).fill(null)
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      cells.push({ date: iso(d), count: counts.get(iso(d)) || 0, future: false })
    }
    const cols: any[][] = []
    for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7))
    const monthMarks: { label: string; col: number }[] = []
    let lastMonth = -1
    cols.forEach((col, ci) => {
      const first = col.find(Boolean)
      if (!first) return
      const m = new Date(first.date + 'T00:00:00Z').getUTCMonth()
      if (m !== lastMonth) {
        lastMonth = m
        monthMarks.push({ label: new Intl.DateTimeFormat(i18n.language, { month: 'short', timeZone: 'UTC' }).format(new Date(first.date + 'T00:00:00Z')), col: ci })
      }
    })
    return { weeks: cols, months: monthMarks }
  }, [data, i18n.language])

  // open on the most recent weeks
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [weeks.length])

  const width = weeks.length * (CELL + GAP)

  return (
    <section className={`rounded-2xl bg-white nice-shadow p-4 sm:p-5 ${className}`} aria-label={t('progress.title')}>
      <h3 className="text-base font-bold text-gray-900 mb-4">{t('progress.title')}</h3>
      {isLoading || !data ? (
        <div className="h-32 rounded-lg bg-gray-100 animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <Stat icon={<Flame className="w-4 h-4" />} value={data.current_streak} label={t('progress.current_streak')} />
            <Stat icon={<Trophy className="w-4 h-4" />} value={data.longest_streak} label={t('progress.longest_streak')} />
            <Stat icon={<CalendarCheck className="w-4 h-4" />} value={data.active_days} label={t('progress.active_days')} />
            <Stat icon={<Zap className="w-4 h-4" />} value={data.total_actions} label={t('progress.actions')} />
          </div>

          <div ref={scrollRef} className="overflow-x-auto pb-1" dir="ltr">
            <div style={{ width }} className="relative">
              <div className="relative h-4 mb-1 text-[10px] text-gray-400">
                {months.map((m) => (
                  <span key={m.col} className="absolute" style={{ left: m.col * (CELL + GAP) }}>{m.label}</span>
                ))}
              </div>
              <div className="flex" style={{ gap: GAP }} role="img" aria-label={t('progress.calendar_aria', { days: data.active_days })}>
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                    {week.map((cell, di) =>
                      cell ? (
                        <span
                          key={di}
                          title={`${cell.count > 0 ? t('progress.n_actions', { count: cell.count }) : t('progress.no_activity')} · ${formatDate(cell.date + 'T00:00:00Z', i18n.language, { dateStyle: 'medium', timeZone: 'UTC' })}`}
                          className={`rounded-[3px] ${LEVEL_CLASS[levelOf(cell.count)]}`}
                          style={{ width: CELL, height: CELL }}
                        />
                      ) : (
                        <span key={di} style={{ width: CELL, height: CELL }} />
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-gray-400">
            <span>{t('progress.less')}</span>
            {LEVEL_CLASS.map((c, i) => <span key={i} className={`rounded-[3px] ${c}`} style={{ width: 10, height: 10 }} />)}
            <span>{t('progress.more')}</span>
          </div>
        </>
      )}
    </section>
  )
}
