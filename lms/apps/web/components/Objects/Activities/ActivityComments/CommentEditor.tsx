'use client'

import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Bold, Code, Italic, Link2, List, ListOrdered, Send, Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { lowlight } from '@components/Objects/Editor/editorLowlight'
import { EMPTY_DOC } from './CommentRichText'

export const MAX_COMMENT_LENGTH = 2000
const SAFE_URI = /^(https?:|mailto:)/i

type Props = {
  initialDoc?: any
  placeholder: string
  submitLabel: string
  autoFocus?: boolean
  /** content is the editor document as a JSON string (format "tiptap") */
  onSubmit: (content: string) => Promise<void>
  onCancel?: () => void
}

function ToolButton(props: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      aria-pressed={!!props.active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
      className={`p-1.5 rounded cursor-pointer transition-colors ${props.active ? 'bg-neutral-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
    >
      {props.children}
    </button>
  )
}

/** Formatted comment box: bold, italic, inline code, links, lists and code blocks. */
export default function CommentEditor(props: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = React.useState(false)
  const [linkOpen, setLinkOpen] = React.useState(false)
  const [linkValue, setLinkValue] = React.useState('')
  const [length, setLength] = React.useState(0)
  const submitRef = React.useRef<() => void>(() => {})

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    autofocus: props.autoFocus ? 'end' : false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ['mailto'],
          isAllowedUri: (url: string) => SAFE_URI.test(url),
          HTMLAttributes: { rel: 'noopener noreferrer nofollow ugc', target: '_blank' },
        },
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder: props.placeholder }),
    ],
    content: props.initialDoc || EMPTY_DOC,
    editorProps: {
      attributes: { class: 'comment-rich outline-none min-h-[4.5rem] max-h-80 overflow-y-auto', 'aria-label': props.placeholder, dir: 'auto' },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          submitRef.current()
          return true
        }
        return false
      },
    },
    onCreate: ({ editor }) => setLength(editor.getText().trim().length),
    onUpdate: ({ editor }) => setLength(editor.getText().trim().length),
  })

  const empty = length === 0
  const tooLong = length > MAX_COMMENT_LENGTH

  const submit = async () => {
    if (!editor || empty || tooLong || busy) return
    setBusy(true)
    try {
      await props.onSubmit(JSON.stringify(editor.getJSON()))
      editor.commands.clearContent(true)
    } finally {
      setBusy(false)
    }
  }
  submitRef.current = submit

  const applyLink = () => {
    if (!editor) return
    let href = linkValue.trim()
    if (href && !/^[a-z][a-z0-9+.-]*:/i.test(href)) href = `https://${href}`
    if (SAFE_URI.test(href)) {
      if (editor.state.selection.empty) {
        editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()
      } else {
        editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
      }
    }
    setLinkOpen(false)
    setLinkValue('')
  }

  const f = (key: string, def: string) => t(`comments.format.${key}`, { defaultValue: def })

  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-white nice-shadow focus-within:ring-2 focus-within:ring-black/70">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 px-1.5 py-1" role="toolbar" aria-label={f('toolbar', 'Formatting')}>
          <ToolButton label={f('bold', 'Bold')} active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></ToolButton>
          <ToolButton label={f('italic', 'Italic')} active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></ToolButton>
          <ToolButton label={f('code', 'Inline code')} active={editor?.isActive('code')} onClick={() => editor?.chain().focus().toggleCode().run()}><Code className="w-4 h-4" /></ToolButton>
          <ToolButton
            label={f('link', 'Link')}
            active={editor?.isActive('link')}
            onClick={() => {
              if (editor?.isActive('link')) editor.chain().focus().extendMarkRange('link').unsetLink().run()
              else setLinkOpen((o) => !o)
            }}
          >
            <Link2 className="w-4 h-4" />
          </ToolButton>
          <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden="true" />
          <ToolButton label={f('bullet_list', 'Bulleted list')} active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></ToolButton>
          <ToolButton label={f('ordered_list', 'Numbered list')} active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></ToolButton>
          <ToolButton label={f('code_block', 'Code block')} active={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Terminal className="w-4 h-4" /></ToolButton>
        </div>
        {linkOpen && (
          <div className="flex items-center gap-2 border-b border-gray-100 px-2 py-1.5">
            <input
              autoFocus
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); applyLink() }
                if (e.key === 'Escape') setLinkOpen(false)
              }}
              placeholder="https://"
              aria-label={f('link_url', 'Link address')}
              className="flex-1 min-w-0 bg-transparent text-sm outline-none"
            />
            <button type="button" onClick={applyLink} className="text-sm font-semibold text-gray-900 cursor-pointer">{f('link_add', 'Add')}</button>
          </div>
        )}
        <div className="px-3 py-2.5 text-sm text-gray-900">
          <EditorContent editor={editor} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs ${tooLong ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{length}/{MAX_COMMENT_LENGTH}</span>
        <div className="flex items-center gap-2">
          {props.onCancel && (
            <button type="button" onClick={props.onCancel} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 cursor-pointer">
              {t('common.cancel')}
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={empty || tooLong || busy}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <Send className="w-4 h-4" />
            {props.submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
