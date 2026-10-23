'use client'

// Building blocks of the SIRIUS course card (styles/course-card.css):
// the sculpted outline, the generated planet cover and the favourites hook.

import React from 'react'

const svg = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>
)

export const SCARD_ICON = {
  users: svg(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  cal: svg(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  arrow: svg(<><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>),
  heart: svg(<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />),
}

/* ─── Sculpted card outline: rounded corners plus a notch top-right for the ♥ button ─── */
const R = 26, Q = 20, NW = 76, NH = 66

function cardShape(w: number, h: number) {
  return `M${R} 0H${w - NW - Q}A${Q} ${Q} 0 0 1 ${w - NW} ${Q}V${NH - Q}A${Q} ${Q} 0 0 0 ${w - NW + Q} ${NH}` +
    `H${w - R}A${R} ${R} 0 0 1 ${w} ${NH + R}V${h - R}A${R} ${R} 0 0 1 ${w - R} ${h}` +
    `H${R}A${R} ${R} 0 0 1 0 ${h - R}V${R}A${R} ${R} 0 0 1 ${R} 0Z`
}

export function CourseCardShape({ className, children }: { className: string; children: React.ReactNode }) {
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const pathRef = React.useRef<SVGPathElement>(null)
  const edgeRef = React.useRef<SVGSVGElement>(null)

  React.useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const apply = () => {
      const w = el.offsetWidth, h = el.offsetHeight
      if (!w || !h) return
      const d = cardShape(w, h)
      el.style.clipPath = `path('${d}')`
      edgeRef.current?.setAttribute('viewBox', `0 0 ${w} ${h}`)
      pathRef.current?.setAttribute('d', d)
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={bodyRef} className={className} style={{ '--bloom': '56,245,125' } as React.CSSProperties}>
      {children}
      <svg ref={edgeRef} className="scard__edge" aria-hidden="true"><path ref={pathRef} /></svg>
    </div>
  )
}

/* ─── Cover used when a course has no thumbnail: a small planet, tinted by the course id ─── */
const TONES = [
  { hi: '#6fe0b5', mid: '#1d6b52', bg: '#0a1f19' },
  { hi: '#b8e86a', mid: '#4a7a22', bg: '#121c0a' },
  { hi: '#62d3d6', mid: '#1c6670', bg: '#09212a' },
  { hi: '#b4d2c0', mid: '#4a6b58', bg: '#101a15' },
  { hi: '#8be3b0', mid: '#25805a', bg: '#0a2018' },
]

function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function CourseCover({ seed }: { seed: string }) {
  const n = hash(seed)
  const r = rng(n)
  const t = TONES[n % TONES.length]
  const id = `scv-${seed.replace(/[^a-zA-Z0-9]/g, '')}`
  const cx = 130 + r() * 90
  const cy = 92 + r() * 24
  const rad = 46 + r() * 16
  const tilt = -28 + r() * 40
  const ox = rad * (2.1 + r() * 0.5)
  const oy = rad * (0.42 + r() * 0.2)
  const stars = Array.from({ length: 16 }, (_, i) => (
    <circle key={i} cx={(r() * 320).toFixed(1)} cy={(r() * 200).toFixed(1)} r={(0.5 + r() * 0.8).toFixed(2)} fill="#fff" opacity={(0.2 + r() * 0.5).toFixed(2)} />
  ))
  return (
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#050807" /><stop offset="1" stopColor={t.bg} /></linearGradient>
        <radialGradient id={`${id}-p`} cx="34%" cy="30%" r="78%"><stop offset="0" stopColor={t.hi} /><stop offset=".42" stopColor={t.mid} /><stop offset=".85" stopColor="#030706" /></radialGradient>
        <radialGradient id={`${id}-h`} cx="50%" cy="50%" r="50%"><stop offset=".55" stopColor={t.hi} stopOpacity=".28" /><stop offset="1" stopColor={t.hi} stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}-o`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".34" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <clipPath id={`${id}-c`}><circle cx={cx} cy={cy} r={rad} /></clipPath>
      </defs>
      <rect width="320" height="200" fill={`url(#${id}-bg)`} />
      {stars}
      <circle cx={cx} cy={cy} r={rad * 1.9} fill={`url(#${id}-h)`} />
      <g transform={`rotate(${tilt.toFixed(1)} ${cx} ${cy})`}><ellipse cx={cx} cy={cy} rx={ox.toFixed(1)} ry={oy.toFixed(1)} fill="none" stroke={`url(#${id}-o)`} strokeWidth=".9" /></g>
      <circle cx={cx} cy={cy} r={rad} fill={`url(#${id}-p)`} />
      <g clipPath={`url(#${id}-c)`}><circle cx={cx + rad * 0.5} cy={cy + rad * 0.55} r={rad * 1.2} fill="#000" opacity=".5" /></g>
      <g transform={`rotate(${tilt.toFixed(1)} ${cx} ${cy})`}>
        <path d={`M ${(cx - ox).toFixed(1)} ${cy} A ${ox.toFixed(1)} ${oy.toFixed(1)} 0 0 0 ${(cx + ox).toFixed(1)} ${cy}`} fill="none" stroke={`url(#${id}-o)`} strokeWidth="1" />
        <circle cx={(cx + ox * 0.72).toFixed(1)} cy={(cy + oy * 0.69).toFixed(1)} r="2" fill="#effff8" />
      </g>
    </svg>
  )
}
