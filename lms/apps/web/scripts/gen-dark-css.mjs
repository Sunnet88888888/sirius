#!/usr/bin/env node
/**
 * Generates styles/dark.css, the dark theme for the whole app.
 *
 * Why a generator: the UI is written with hard-coded light Tailwind colors
 * (bg-white, text-gray-800, border-gray-200, ...). Tailwind v4 compiles every
 * color utility to a CSS variable (`var(--color-gray-800)`), so most of the
 * theme is a palette swap under `html.dark`. A few classes need an explicit
 * override because the same variable is used for both backgrounds and text
 * (bg-white versus text-white, bg-gray-900 versus text-gray-900); those are
 * produced here by scanning the source for the classes actually in use.
 *
 * Usage (from apps/web):  node scripts/gen-dark-css.mjs [path/to/tailwindcss/theme.css]
 * The output is committed; rerun after adding new color classes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const webRoot = path.resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
const themePath =
  process.argv[2] ||
  path.join(path.dirname(require.resolve('tailwindcss/package.json')), 'theme.css')

// ---------- surfaces ----------
const S = {
  bg: '#0f1115',
  surface: '#16181d',
  surfaceRgb: '22 24 29',
  raised: '#1d2027',
  raised2: '#262a32',
  line: '#2d313a',
  fg: '#e6e8ec',
  fgMuted: '#b6bbc5',
}

// ---------- palette ----------
const theme = fs.readFileSync(themePath, 'utf8')
const palette = {}
for (const m of theme.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) {
  ;(palette[m[1]] ||= {})[m[2]] = m[3].trim()
}
const NEUTRAL = ['slate', 'gray', 'zinc', 'neutral', 'stone']
const COLORED = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]
const FAMILIES = [...NEUTRAL, ...COLORED]
const SWAP = { 50: 950, 100: 900, 200: 800, 300: 700, 700: 300, 800: 200, 900: 100, 950: 50 }
const LIGHT_SHADES = ['50', '100', '200', '300']
const DARK_SHADES = ['700', '800', '900', '950']

// neutral scales get hand-tuned dark surfaces for the light end so panels
// stay layered (page < card < raised) instead of collapsing to near-black.
const NEUTRAL_LIGHT_END = { 50: S.raised, 100: S.raised, 200: S.raised2, 300: S.line }

// ---------- scanning ----------
const SRC_DIRS = ['app', 'components', 'lib', 'hooks']
const files = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue
      walk(p)
    } else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) files.push(p)
  }
})(webRoot)
const scanFiles = files.filter((f) =>
  SRC_DIRS.some((d) => f.startsWith(path.join(webRoot, d) + path.sep))
)

const PROPS = 'bg|text|border|ring|outline|divide|from|via|to|fill|stroke|shadow|placeholder|decoration|accent|caret'
const FAM = FAMILIES.join('|')
const TOKEN = new RegExp(
  String.raw`(?<![\w\-/\[])((?:[\w\-\[\]>&=*.()]+:)*)(${PROPS})-(white|black|(?:${FAM})-(?:50|100|200|300|600|700|800|900|950)|\[#[0-9a-fA-F]{3,8}\])(\/\d+)?(?![\w\-\/])`,
  'g'
)

// token key -> { variants, prop, color, alpha }
const found = new Map()
// A className literal that carries its own `dark:` variant for a property has
// been themed by hand; do not override it.
for (const f of scanFiles) {
  const src = fs.readFileSync(f, 'utf8')
  for (const lit of src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/gs)) {
    const text = lit[2]
    if (!/(bg|text|border|ring|divide|from|via|to)-/.test(text)) continue
    const darkProps = new Set(
      [...text.matchAll(/(?:^|\s)dark:(?:[\w\-\[\]>&=*.()]+:)*(bg|text|border|ring|divide|from|via|to|outline)-/g)].map((m) => m[1])
    )
    for (const m of text.matchAll(TOKEN)) {
      const [full, variants, prop, color, alpha] = m
      if (/(^|:)dark:/.test(variants + 'x') || variants.split(':').includes('dark')) continue
      if (darkProps.has(prop)) continue
      found.set(full, { variants, prop, color, alpha: alpha ? alpha.slice(1) : null })
    }
  }
}

// ---------- helpers ----------
const esc = (s) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c)
const BREAK = { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem', '2xl': '96rem' }
const PSEUDO = {
  hover: ':hover', focus: ':focus', 'focus-visible': ':focus-visible',
  'focus-within': ':focus-within', active: ':active', disabled: ':disabled',
  first: ':first-child', last: ':last-child', odd: ':nth-child(odd)',
  even: ':nth-child(even)', checked: ':checked', open: '[open]',
}

function hexToRgb(h) {
  h = h.replace('#', '')
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

function colorWithAlpha(css, alpha) {
  if (alpha == null) return css
  return `color-mix(in oklab, ${css} ${alpha}%, transparent)`
}
function rgbVarAlpha(rgbTriple, alpha) {
  return alpha == null ? `rgb(${rgbTriple})` : `rgb(${rgbTriple} / ${Number(alpha) / 100})`
}

// What a given color token should become in dark mode, or null to leave it.
function darkValue({ prop, color, alpha }) {
  const isBgLike = ['bg', 'from', 'via', 'to', 'fill'].includes(prop)
  const isLine = ['border', 'ring', 'outline', 'divide'].includes(prop)
  const isText = ['text', 'placeholder', 'decoration', 'caret', 'accent', 'stroke'].includes(prop)
  if (color === 'white') {
    // translucent white (<50%) is a highlight over a colored/dark backdrop: keep
    if (isBgLike) return alpha != null && Number(alpha) < 50 ? null : rgbVarAlpha(S.surfaceRgb, alpha)
    if (isLine && alpha == null) return S.surface
    return null // text-white etc. stays white
  }
  if (color === 'black') {
    if (prop === 'text') return colorWithAlpha(S.fg, alpha)
    if (prop === 'bg' && alpha == null) return S.raised2
    if (isLine && alpha != null) return `rgb(255 255 255 / ${Number(alpha) / 100})`
    if (isLine) return S.line
    return null // black overlays/shadows stay black
  }
  const arb = color.match(/^\[#([0-9a-fA-F]{3,8})\]$/)
  if (arb) {
    const l = lum(hexToRgb(arb[1]))
    if (isBgLike) {
      if (l > 0.93) return rgbVarAlpha(S.surfaceRgb, alpha)
      if (l > 0.85) return colorWithAlpha(S.raised, alpha)
      if (l > 0.7) return colorWithAlpha(S.raised2, alpha)
      return null
    }
    if (isLine) return l > 0.7 ? colorWithAlpha(S.line, alpha) : null
    if (isText) {
      if (l < 0.2) return colorWithAlpha(S.fg, alpha)
      if (l < 0.45) return colorWithAlpha(S.fgMuted, alpha)
    }
    return null
  }
  // palette shades: the swap handles most; these are the exceptions where the
  // same variable is used for a role the swap would break.
  const [fam, shade] = color.split(/-(?=\d)/)
  const orig = palette[fam]?.[shade]
  if (!orig) return null
  const darkShades = NEUTRAL.includes(fam) ? [...DARK_SHADES, '600'] : DARK_SHADES
  if (isBgLike && darkShades.includes(shade)) return colorWithAlpha(orig, alpha) // dark panels/buttons stay dark
  if (isText && LIGHT_SHADES.includes(shade)) return colorWithAlpha(orig, alpha) // light text on dark buttons stays light
  return null
}

const CSS_PROP = {
  bg: 'background-color', text: 'color', border: 'border-color', ring: '--tw-ring-color',
  outline: 'outline-color', divide: 'border-color', from: '--tw-gradient-from',
  via: '--tw-gradient-via', to: '--tw-gradient-to', fill: 'fill', stroke: 'stroke',
  placeholder: 'color', decoration: 'text-decoration-color', accent: 'accent-color', caret: 'caret-color',
}

const rules = []
const byMedia = new Map()
for (const [full, t] of found) {
  const val = darkValue(t)
  if (!val) continue
  let variants = t.variants ? t.variants.split(':').filter(Boolean) : []
  let sel = '.' + esc(full)
  let pseudo = ''
  let media = null
  let ok = true
  let prefix = 'html.dark '
  for (const v of variants) {
    if (BREAK[v]) media = BREAK[v]
    else if (PSEUDO[v]) pseudo += PSEUDO[v]
    else if (v === 'placeholder') pseudo += '::placeholder'
    else if (v === 'group-hover') prefix += '.group:hover '
    else if (v === 'group-focus') prefix += '.group:focus '
    else if (v === 'rtl') prefix += '[dir=rtl] '
    else if (v === 'ltr') prefix += '[dir=ltr] '
    else { ok = false; break }
  }
  if (!ok) continue
  let selector = prefix + sel + pseudo
  let decl
  if (t.prop === 'divide') {
    selector = prefix + sel + pseudo + ' > :not(:last-child)'
    decl = `${CSS_PROP.divide}: ${val}`
  } else if (t.prop === 'placeholder') {
    selector = prefix + sel + pseudo + '::placeholder'
    decl = `color: ${val}`
  } else if (t.prop === 'ring') {
    decl = `--tw-ring-color: ${val}`
  } else {
    decl = `${CSS_PROP[t.prop]}: ${val}`
  }
  const rule = `${selector} { ${decl}; }`
  if (media) {
    if (!byMedia.has(media)) byMedia.set(media, [])
    byMedia.get(media).push(rule)
  } else rules.push(rule)
}

// ---------- palette swap block ----------
const swapVars = []
for (const fam of FAMILIES) {
  for (const [from, to] of Object.entries(SWAP)) {
    const target = palette[fam]?.[to]
    if (!target) continue
    let value = target
    if (NEUTRAL.includes(fam) && NEUTRAL_LIGHT_END[from]) value = NEUTRAL_LIGHT_END[from]
    swapVars.push(`  --color-${fam}-${from}: ${value};`)
  }
  // neutral 600 is secondary text on light; on dark it needs the lighter 400
  if (NEUTRAL.includes(fam) && palette[fam]?.['400']) swapVars.push(`  --color-${fam}-600: ${palette[fam]['400']};`)
}

const out = `/*
 * GENERATED by scripts/gen-dark-css.mjs. Do not edit by hand.
 * Dark theme: active when <html> has the "dark" class (see public/theme-init.js).
 */

html.dark {
  color-scheme: dark;

  /* component-library tokens */
  --background: 222 14% 7%;
  --foreground: 220 14% 91%;
  --card: 222 13% 10%;
  --card-foreground: 220 14% 91%;
  --popover: 222 13% 10%;
  --popover-foreground: 220 14% 91%;
  --primary: 220 14% 91%;
  --primary-foreground: 222 14% 9%;
  --secondary: 222 11% 15%;
  --secondary-foreground: 220 14% 91%;
  --muted: 222 11% 15%;
  --muted-foreground: 220 9% 65%;
  --accent: 222 11% 15%;
  --accent-foreground: 220 14% 91%;
  --destructive: 0 62% 50%;
  --destructive-foreground: 0 0% 98%;
  --border: 222 11% 19%;
  --input: 222 11% 19%;
  --ring: 220 14% 80%;

  /* palette swap: light tints become dark tints and the other way round,
     mid tones (400-600) are unchanged */
${swapVars.join('\n')}
}

html.dark body {
  background: ${S.bg};
  color: ${S.fg};
}

html.dark {
  background: ${S.bg};
}

/* ---- class overrides found by scanning the source ---- */
${rules.join('\n')}
${[...byMedia.entries()]
  .map(([bp, rs]) => `@media (min-width: ${bp}) {\n${rs.map((r) => '  ' + r).join('\n')}\n}`)
  .join('\n')}
`

fs.writeFileSync(path.join(webRoot, 'styles/dark.css'), out)
console.log(`scanned ${scanFiles.length} files, ${found.size} distinct color classes`)
console.log(`dark.css: ${rules.length} base rules, ${[...byMedia.values()].flat().length} responsive rules, ${(out.length / 1024).toFixed(0)} KB`)
