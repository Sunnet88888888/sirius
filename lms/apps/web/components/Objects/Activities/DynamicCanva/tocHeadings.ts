// Pure helpers for the lecture table of contents (kept free of React so they can be unit-tested).

export interface TocItem {
  level: number
  text: string
  id: string
}

/** Lower-case, hyphenated form of a heading's text; empty when nothing usable is left. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Turns the headings of a lecture, in document order, into contents entries.
 * Only levels 1-3 are listed; headings without text are skipped. Equal texts get stable, distinct ids
 * (`heading-intro`, `heading-intro-2`, ...), so every link scrolls to its own heading.
 */
export function buildToc(headings: { level: number; text: string }[], maxLevel = 3): TocItem[] {
  const used = new Map<string, number>()
  const items: TocItem[] = []
  for (const h of headings) {
    if (h.level > maxLevel) continue
    const text = h.text.trim()
    const slug = slugify(text)
    if (!slug) continue
    const n = (used.get(slug) ?? 0) + 1
    used.set(slug, n)
    items.push({ level: h.level, text, id: n === 1 ? `heading-${slug}` : `heading-${slug}-${n}` })
  }
  return items
}

/** The entry that is being read: the last heading whose top edge is at or above `offset` px from the viewport top. */
export function activeHeadingId(tops: { id: string; top: number }[], offset: number): string | null {
  let active: string | null = null
  for (const t of tops) {
    if (t.top <= offset) active = t.id
    else break
  }
  return active ?? (tops.length ? tops[0].id : null)
}
