'use client'

import React from 'react'

/**
 * Draws a lesson comment. Formatted comments are Tiptap JSON that the server has
 * already validated against a whitelist; they are drawn here as React elements
 * (no HTML from users is ever inserted into the page), and anything unexpected
 * is skipped. Plain comments (older ones) are shown as text.
 */

type Mark = { type: string; attrs?: { href?: string } }
type RNode = { type: string; text?: string; marks?: Mark[]; content?: RNode[]; attrs?: Record<string, any> }

// Same rule as the server: only http(s) and mailto links.
const SAFE_HREF = /^(https?:\/\/|mailto:)[^\s<>"'\u0000-\u001f]+$/i
const MAX_DEPTH = 10

export const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }

/** Plain text -> an editor document (one paragraph per line), for editing old comments. */
export function plainToDoc(text: string) {
  const lines = (text || '').split('\n')
  return {
    type: 'doc',
    content: lines.map((l) => (l ? { type: 'paragraph', content: [{ type: 'text', text: l }] } : { type: 'paragraph' })),
  }
}

export function parseCommentDoc(content: string, format?: string) {
  if (format !== 'tiptap') return plainToDoc(content)
  try {
    const doc = JSON.parse(content)
    return doc && doc.type === 'doc' ? doc : EMPTY_DOC
  } catch {
    return EMPTY_DOC
  }
}

function applyMarks(text: string, marks: Mark[] = [], key: string): React.ReactNode {
  let el: React.ReactNode = text
  for (const m of marks) {
    if (m.type === 'bold') el = <strong key={key + 'b'}>{el}</strong>
    else if (m.type === 'italic') el = <em key={key + 'i'}>{el}</em>
    else if (m.type === 'code') el = <code key={key + 'c'}>{el}</code>
    else if (m.type === 'link') {
      const href = m.attrs?.href
      if (typeof href === 'string' && SAFE_HREF.test(href)) {
        el = (
          <a key={key + 'l'} href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
            {el}
          </a>
        )
      }
    }
  }
  return el
}

function renderInline(nodes: RNode[] | undefined, path: string): React.ReactNode[] {
  return (nodes || []).map((n, i) => {
    const key = `${path}.${i}`
    if (n.type === 'text' && typeof n.text === 'string') {
      return <React.Fragment key={key}>{applyMarks(n.text, n.marks, key)}</React.Fragment>
    }
    if (n.type === 'hardBreak') return <br key={key} />
    return null
  })
}

// hast (lowlight) -> React. Only <span class="hljs-*"> elements are produced.
function hastToReact(node: any, key: string): React.ReactNode {
  if (node.type === 'text') return node.value
  if (node.type === 'element' && node.tagName === 'span') {
    const cls = Array.isArray(node.properties?.className) ? node.properties.className.join(' ') : undefined
    return (
      <span key={key} className={cls}>
        {(node.children || []).map((c: any, i: number) => hastToReact(c, `${key}.${i}`))}
      </span>
    )
  }
  return null
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [tree, setTree] = React.useState<any>(null)
  React.useEffect(() => {
    let cancelled = false
    import('@components/Objects/Editor/editorLowlight')
      .then(({ lowlight }) => {
        try {
          let result: any = null
          if (language && lowlight.registered(language)) result = lowlight.highlight(language, code)
          else {
            const auto: any = lowlight.highlightAuto(code)
            if ((auto?.data?.relevance ?? 0) >= 5) result = auto
          }
          if (!cancelled) setTree(result)
        } catch {
          /* keep plain text */
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [code, language])
  return (
    <pre>
      <code>{tree ? (tree.children || []).map((c: any, i: number) => hastToReact(c, `h${i}`)) : code}</code>
    </pre>
  )
}

function renderBlocks(nodes: RNode[] | undefined, path: string, depth: number): React.ReactNode[] {
  if (depth > MAX_DEPTH) return []
  return (nodes || []).map((n, i) => {
    const key = `${path}.${i}`
    switch (n.type) {
      case 'paragraph':
        return <p key={key} dir="auto">{renderInline(n.content, key)}</p>
      case 'bulletList':
        return <ul key={key}>{renderBlocks(n.content, key, depth + 1)}</ul>
      case 'orderedList': {
        const start = typeof n.attrs?.start === 'number' ? n.attrs.start : undefined
        return <ol key={key} start={start}>{renderBlocks(n.content, key, depth + 1)}</ol>
      }
      case 'listItem':
        return <li key={key}>{renderBlocks(n.content, key, depth + 1)}</li>
      case 'codeBlock': {
        const code = (n.content || []).map((t) => (typeof t.text === 'string' ? t.text : '')).join('')
        const lang = typeof n.attrs?.language === 'string' ? n.attrs.language : undefined
        return <CodeBlock key={key} code={code} language={lang} />
      }
      default:
        return null
    }
  })
}

export function CommentBody({ content, format }: { content: string; format?: string }) {
  if (format !== 'tiptap') {
    return <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words" dir="auto">{content}</p>
  }
  const doc = parseCommentDoc(content, format) as RNode
  return <div className="comment-rich mt-1 text-sm text-gray-800 break-words">{renderBlocks(doc.content, 'r', 0)}</div>
}
