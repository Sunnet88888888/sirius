import { useCallback, useEffect, useRef, useState } from 'react'
import { Editor } from '@tiptap/react'
import { List } from 'lucide-react'
import { TocItem, activeHeadingId, buildToc } from './tocHeadings'

interface TableOfContentsProps {
  editor: Editor | null
}

// A heading counts as "being read" once its top edge has passed this distance from the top of the window
// (the course header is sticky, so it must be a bit below the top).
const READING_OFFSET = 130
const CLOSE_DELAY_MS = 250

/**
 * Lecture table of contents. It stays out of the way (the lecture uses the full width) and slides in from the left
 * edge while the pointer is over the small tab, or when the tab is tapped on touch devices.
 */
const TableOfContents = ({ editor }: TableOfContentsProps) => {
  const [items, setItems] = useState<TocItem[]>([])
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hoverCapable, setHoverCapable] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)
  const tabRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    setHoverCapable(window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  }, [])

  // Collect h1-h3 from the rendered lecture and give each a unique, stable id.
  useEffect(() => {
    if (!editor) return
    let observer: MutationObserver | null = null
    let frame = 0

    const collect = () => {
      const root = editor.view?.dom as HTMLElement | undefined
      if (!root) return
      const nodes = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3'))
      const toc = buildToc(nodes.map((n) => ({ level: Number(n.tagName[1]), text: n.textContent || '' })))
      // buildToc skips empty headings, so walk the nodes again in the same way to attach the ids
      let k = 0
      for (const n of nodes) {
        if (toc[k] && n.textContent?.trim() === toc[k].text && Number(n.tagName[1]) === toc[k].level) {
          n.id = toc[k].id
          k++
        }
      }
      setItems((prev) => (JSON.stringify(prev) === JSON.stringify(toc) ? prev : toc))
    }

    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(collect)
    }

    const attach = () => {
      const root = editor.view?.dom as HTMLElement | undefined
      if (!root) return false
      collect()
      observer = new MutationObserver(schedule)
      observer.observe(root, { childList: true, subtree: true, characterData: true })
      return true
    }

    let retry: ReturnType<typeof setTimeout> | undefined
    if (!attach()) retry = setTimeout(attach, 200)
    editor.on('update', schedule)
    return () => {
      editor.off('update', schedule)
      observer?.disconnect()
      cancelAnimationFrame(frame)
      if (retry) clearTimeout(retry)
    }
  }, [editor])

  // Track the section that is being read.
  useEffect(() => {
    if (items.length === 0) return
    let frame = 0
    const update = () => {
      frame = 0
      const tops = items
        .map((i) => {
          const el = document.getElementById(i.id)
          return el ? { id: i.id, top: el.getBoundingClientRect().top } : null
        })
        .filter((t): t is { id: string; top: number } => t !== null)
      setActiveId(activeHeadingId(tops, READING_OFFSET))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [items])

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])
  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }, [cancelClose])
  useEffect(() => cancelClose, [cancelClose])

  // Touch devices: a tap outside the panel closes it. Esc closes it everywhere.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        tabRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (items.length < 2) return null

  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (!hoverCapable) setOpen(false)
  }

  return (
    <div
      ref={rootRef}
      className="toc-root"
      onMouseEnter={() => {
        if (hoverCapable) {
          cancelClose()
          setOpen(true)
        }
      }}
      onMouseLeave={() => hoverCapable && scheduleClose()}
      onFocus={(e) => {
        // keyboard focus opens the panel; a tap on a touch screen is handled by the tab's click
        if (!(e.target as HTMLElement).matches(':focus-visible')) return
        cancelClose()
        setOpen(true)
      }}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) scheduleClose()
      }}
    >
      <button
        ref={tabRef}
        type="button"
        className="toc-tab"
        aria-label="Table of contents"
        aria-expanded={open}
        aria-controls="lecture-toc-panel"
        onClick={() => !hoverCapable && setOpen((v) => !v)}
      >
        <List size={16} strokeWidth={2} />
      </button>
      <nav id="lecture-toc-panel" className="toc-panel" data-open={open} aria-label="Table of contents" aria-hidden={!open}>
        <ul>
          {items.map((item) => (
            <li key={item.id} style={{ paddingInlineStart: `${(item.level - 1) * 0.9}rem` }}>
              <a
                href={`#${item.id}`}
                tabIndex={open ? 0 : -1}
                className={`toc-link toc-link-h${item.level}`}
                aria-current={activeId === item.id ? 'location' : undefined}
                onClick={(e) => go(e, item.id)}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export default TableOfContents
