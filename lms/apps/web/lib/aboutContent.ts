import { Node, mergeAttributes } from '@tiptap/core'

/**
 * The course "About" text is stored in the existing `about` string column.
 * New content is a Tiptap document serialised as JSON; older courses hold
 * plain text, which is shown as paragraphs and converted on first edit.
 */

export type TiptapDoc = { type: 'doc'; content: any[] }

const FILE_NAME = /^[A-Za-z0-9_.-]+$/

export function plainTextToDoc(text: string): TiptapDoc {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+$/g, ''))
    .filter((block) => block.trim() !== '')
  if (paragraphs.length === 0) return { type: 'doc', content: [{ type: 'paragraph' }] }
  return {
    type: 'doc',
    content: paragraphs.map((block) => {
      const lines = block.split('\n')
      const content: any[] = []
      lines.forEach((line, i) => {
        if (i > 0) content.push({ type: 'hardBreak' })
        if (line !== '') content.push({ type: 'text', text: line })
      })
      return { type: 'paragraph', content }
    }),
  }
}

/** Turns the stored `about` value (JSON document or legacy plain text) into a document. */
export function parseAbout(value: string | null | undefined): TiptapDoc {
  const raw = (value ?? '').toString()
  if (raw.trim() === '') return { type: 'doc', content: [{ type: 'paragraph' }] }
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && parsed.type === 'doc' && Array.isArray(parsed.content)) return parsed
    } catch {
      // not JSON: fall through to plain text
    }
  }
  return plainTextToDoc(raw)
}

function nodeHasContent(node: any): boolean {
  if (!node || typeof node !== 'object') return false
  if (node.type === 'aboutImage') return true
  if (node.type === 'text') return typeof node.text === 'string' && node.text.trim() !== ''
  return Array.isArray(node.content) && node.content.some(nodeHasContent)
}

export function isAboutEmpty(value: string | null | undefined): boolean {
  return !nodeHasContent(parseAbout(value))
}

export type AboutImageOptions = {
  /** Builds the public URL for a stored file name. */
  resolveUrl: (file: string) => string
}

/**
 * Minimal image node. Only the stored file name is kept in the document; the
 * URL is built from it when rendering, so the media host can change freely.
 */
export const AboutImage = Node.create<AboutImageOptions>({
  name: 'aboutImage',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { resolveUrl: (file: string) => file }
  },

  addAttributes() {
    return {
      file: { default: null },
      alt: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'img[data-about-image]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const file = typeof node.attrs.file === 'string' && FILE_NAME.test(node.attrs.file) ? node.attrs.file : null
    if (!file) return ['span']
    return [
      'img',
      mergeAttributes({
        'data-about-image': '',
        src: this.options.resolveUrl(file),
        alt: node.attrs.alt || '',
        loading: 'lazy',
        class: 'about-image',
      }),
    ]
  },
})
