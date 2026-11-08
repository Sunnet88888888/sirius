'use client'
import React, { useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote,
  Link as LinkIcon, Image as ImageIcon, Loader2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { uploadCourseAboutImage } from '@services/courses/courses'
import { getCourseAboutImageUrl } from '@services/media/media'
import { AboutImage, parseAbout } from '@/lib/aboutContent'

interface CourseAboutEditorProps {
  /** Stored `about` value: Tiptap JSON string or legacy plain text. */
  value: string
  orgUuid: string
  courseUuid: string
  editable?: boolean
  /** Called with the JSON string on every edit. */
  onChange?: (value: string) => void
  disabled?: boolean
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

// Module level so React keeps component identity across renders.
const ToolbarButton = ({
  onClick, isActive, children, title, disabled,
}: {
  onClick: () => void
  isActive?: boolean
  children: React.ReactNode
  title: string
  disabled?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    disabled={disabled}
    className={`p-1.5 rounded transition-colors disabled:opacity-40 ${
      isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
    }`}
  >
    {children}
  </button>
)

export function CourseAboutEditor({
  value, orgUuid, courseUuid, editable = false, onChange, disabled = false,
}: CourseAboutEditorProps) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        link: false,
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
        strike: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: !editable,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      AboutImage.configure({
        resolveUrl: (file: string) => getCourseAboutImageUrl(orgUuid, courseUuid, file),
      }),
      Placeholder.configure({ placeholder: t('dashboard.courses.general.form.about_placeholder', { defaultValue: 'Describe the course: who it is for, what it covers, how it is taught...' }) }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editable, orgUuid, courseUuid]
  )

  const editor = useEditor(
    {
      extensions,
      // Content is read once; the editor is the source of truth while editing.
      content: parseAbout(value),
      editable: editable && !disabled,
      immediatelyRender: false,
      onUpdate: ({ editor }) => onChange?.(JSON.stringify(editor.getJSON())),
    },
    [extensions]
  )

  React.useEffect(() => {
    editor?.setEditable(editable && !disabled)
  }, [editor, editable, disabled])

  if (!editor) return null

  const setLink = () => {
    const previous = editor.getAttributes('link').href
    const url = window.prompt('URL', previous)
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadError('')
    if (!file.type.startsWith('image/')) {
      setUploadError(t('dashboard.courses.general.about_image_invalid', { defaultValue: 'Choose an image file.' }))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError(t('dashboard.courses.general.about_image_too_big', { defaultValue: 'The image is larger than 10 MB.' }))
      return
    }
    setUploading(true)
    try {
      const res: any = await uploadCourseAboutImage(courseUuid, file, session?.data?.tokens?.access_token)
      const name = res?.data?.file
      if (!res?.success || !name) throw new Error('upload failed')
      editor.chain().focus().insertContent({ type: 'aboutImage', attrs: { file: name, alt: '' } }).run()
    } catch {
      setUploadError(t('dashboard.courses.general.about_image_failed', { defaultValue: 'The image could not be uploaded. Try again.' }))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={editable ? 'course-about course-about-editable' : 'course-about'}>
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 p-2 border border-gray-200 bg-gray-50 rounded-t-lg">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold (Ctrl+B)" disabled={disabled}>
            <Bold size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic (Ctrl+I)" disabled={disabled}>
            <Italic size={16} />
          </ToolbarButton>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading" disabled={disabled}>
            <Heading2 size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="Subheading" disabled={disabled}>
            <Heading3 size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet list" disabled={disabled}>
            <List size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered list" disabled={disabled}>
            <ListOrdered size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Quote" disabled={disabled}>
            <Quote size={16} />
          </ToolbarButton>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <ToolbarButton onClick={setLink} isActive={editor.isActive('link')} title="Link" disabled={disabled}>
            <LinkIcon size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => fileInput.current?.click()} title="Image" disabled={disabled || uploading}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
          </ToolbarButton>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        </div>
      )}
      <EditorContent editor={editor} />
      {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}

      <style jsx global>{`
        .course-about .ProseMirror { outline: none; line-height: 1.7; overflow-wrap: anywhere; }
        .course-about-editable .ProseMirror {
          background: #fff; border: 1px solid #e5e7eb; border-top: none;
          border-radius: 0 0 0.5rem 0.5rem; padding: 14px 16px; min-height: 220px;
        }
        .course-about .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af; content: attr(data-placeholder); float: left; height: 0; pointer-events: none;
        }
        .course-about .ProseMirror > * + * { margin-top: 0.75rem; }
        .course-about .ProseMirror h2 { font-size: 1.4rem; font-weight: 700; margin-top: 1.5rem; line-height: 1.3; }
        .course-about .ProseMirror h3 { font-size: 1.15rem; font-weight: 600; margin-top: 1.25rem; line-height: 1.35; }
        .course-about .ProseMirror ul { list-style: disc; padding-inline-start: 1.5rem; }
        .course-about .ProseMirror ol { list-style: decimal; padding-inline-start: 1.5rem; }
        .course-about .ProseMirror li { margin-top: 0.25rem; }
        .course-about .ProseMirror li > p { margin: 0; }
        .course-about .ProseMirror blockquote {
          border-inline-start: 4px solid #d1d5db; padding: 0.25rem 1rem; color: #4b5563; font-style: italic;
        }
        .course-about .ProseMirror a { color: #2563eb; text-decoration: underline; cursor: pointer; }
        .course-about .ProseMirror strong { font-weight: 700; }
        .course-about .ProseMirror img.about-image {
          display: block; max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1rem 0;
        }
        .course-about .ProseMirror img.about-image.ProseMirror-selectednode { outline: 2px solid #2563eb; }
      `}</style>
    </div>
  )
}

export default CourseAboutEditor
