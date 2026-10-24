'use client'

import React from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { MessageCircle, ThumbsUp, Reply, Pencil, Trash2, Pin, Send, Lock } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import UserAvatar from '@components/Objects/UserAvatar'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { getUriWithOrg } from '@services/config/config'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { formatRelative } from '@/lib/format'
import { activityCommentsKey, useActivityComments } from '@/hooks/queries/useActivityComments'
import {
  ActivityComment,
  createActivityComment,
  deleteActivityComment,
  toggleCommentPin,
  toggleCommentVote,
  updateActivityComment,
} from '@services/comments/activityComments'

const MAX_LENGTH = 2000

type Props = {
  /** activity.activity_uuid, including the "activity_" prefix */
  activityUuid: string
  orgslug: string
}

const authorName = (c: ActivityComment) =>
  [c.author.first_name, c.author.last_name].filter(Boolean).join(' ') || c.author.username

/** Textarea + send button, shared by new comments, replies and edits. */
function Composer(props: {
  initial?: string
  placeholder: string
  submitLabel: string
  autoFocus?: boolean
  onSubmit: (text: string) => Promise<void>
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = React.useState(props.initial || '')
  const [busy, setBusy] = React.useState(false)
  const empty = !text.trim()

  const submit = async () => {
    if (empty || busy) return
    setBusy(true)
    try {
      await props.onSubmit(text.trim())
      setText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        autoFocus={props.autoFocus}
        maxLength={MAX_LENGTH}
        rows={3}
        placeholder={props.placeholder}
        aria-label={props.placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
        }}
        className="w-full resize-y rounded-lg bg-white nice-shadow px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/70"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-400">{text.length}/{MAX_LENGTH}</span>
        <div className="flex items-center gap-2">
          {props.onCancel && (
            <button type="button" onClick={props.onCancel} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 cursor-pointer">
              {t('common.cancel')}
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={empty || busy}
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

function CommentItem(props: {
  comment: ActivityComment
  canComment: boolean
  canModerate: boolean
  isReply?: boolean
  highlighted: boolean
  replyingTo: string | null
  editing: string | null
  onReply: (uuid: string | null) => void
  onEdit: (uuid: string | null) => void
  onVote: (c: ActivityComment) => void
  onPin: (c: ActivityComment) => void
  onDelete: (c: ActivityComment) => void
  onSave: (c: ActivityComment, text: string) => Promise<void>
  onSubmitReply: (c: ActivityComment, text: string) => Promise<void>
  signedIn: boolean
}) {
  const { t, i18n } = useTranslation()
  const { comment: c } = props
  const avatar = c.author.avatar_image ? getUserAvatarMediaDirectory(c.author.user_uuid, c.author.avatar_image) : ''
  const isEditing = props.editing === c.comment_uuid
  const isReplying = props.replyingTo === c.comment_uuid

  return (
    <div
      id={`comment-${c.comment_uuid}`}
      className={`flex gap-3 rounded-lg transition-colors duration-700 ${props.highlighted ? 'bg-amber-50 ring-2 ring-amber-200 p-2 -m-2' : ''}`}
    >
      <div className="shrink-0 pt-0.5">
        <UserAvatar
          width={props.isReply ? 28 : 36}
          rounded="rounded-full"
          border="border-2"
          avatar_url={avatar}
          predefined_avatar={avatar ? undefined : 'empty'}
          showProfilePopup={true}
          userId={String(c.author.id)}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-gray-900 break-words">{authorName(c)}</span>
          <span className="text-xs text-gray-400">{formatRelative(c.creation_date, i18n.language)}</span>
          {c.is_edited && <span className="text-xs text-gray-400">· {t('comments.edited')}</span>}
          {c.is_pinned && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <Pin className="w-3 h-3" /> {t('comments.pinned')}
            </span>
          )}
        </div>

        {isEditing ? (
          <div className="mt-2">
            <Composer
              initial={c.content}
              autoFocus
              placeholder={t('comments.edit_placeholder')}
              submitLabel={t('common.save')}
              onSubmit={(text) => props.onSave(c, text)}
              onCancel={() => props.onEdit(null)}
            />
          </div>
        ) : (
          <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words" dir="auto">{c.content}</p>
        )}

        {!isEditing && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <button
              type="button"
              onClick={() => props.onVote(c)}
              aria-pressed={c.has_voted}
              aria-label={t('comments.upvote')}
              className={`flex items-center gap-1 cursor-pointer hover:text-gray-900 ${c.has_voted ? 'text-emerald-600 font-semibold' : ''}`}
            >
              <ThumbsUp className="w-3.5 h-3.5" fill={c.has_voted ? 'currentColor' : 'none'} />
              {c.upvote_count > 0 && c.upvote_count}
            </button>
            {props.canComment && (
              <button type="button" onClick={() => props.onReply(isReplying ? null : c.comment_uuid)} className="flex items-center gap-1 cursor-pointer hover:text-gray-900">
                <Reply className="w-3.5 h-3.5" /> {t('comments.reply')}
              </button>
            )}
            {c.can_edit && (
              <button type="button" onClick={() => props.onEdit(c.comment_uuid)} className="flex items-center gap-1 cursor-pointer hover:text-gray-900">
                <Pencil className="w-3.5 h-3.5" /> {t('comments.edit')}
              </button>
            )}
            {props.canModerate && !props.isReply && (
              <button type="button" onClick={() => props.onPin(c)} className="flex items-center gap-1 cursor-pointer hover:text-gray-900">
                <Pin className="w-3.5 h-3.5" /> {c.is_pinned ? t('comments.unpin') : t('comments.pin')}
              </button>
            )}
            {c.can_delete && (
              <ConfirmationModal
                confirmationButtonText={t('common.delete')}
                confirmationMessage={t('comments.delete_confirm')}
                dialogTitle={t('comments.delete_title')}
                dialogTrigger={
                  <button type="button" className="flex items-center gap-1 cursor-pointer hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                  </button>
                }
                functionToExecute={() => props.onDelete(c)}
                status="warning"
              />
            )}
          </div>
        )}

        {isReplying && (
          <div className="mt-3">
            <Composer
              autoFocus
              placeholder={t('comments.reply_placeholder', { name: authorName(c) })}
              submitLabel={t('comments.reply')}
              onSubmit={(text) => props.onSubmitReply(c, text)}
              onCancel={() => props.onReply(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function ActivityComments({ activityUuid, orgslug }: Props) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token as string | undefined
  const signedIn = !!token
  const queryClient = useQueryClient()
  const { data, isLoading } = useActivityComments(activityUuid)
  const [replyingTo, setReplyingTo] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<string | null>(null)
  const [highlighted, setHighlighted] = React.useState<string | null>(null)

  const comments = data?.comments || []
  const canComment = !!data?.can_comment
  const canModerate = !!data?.can_moderate

  const topLevel = React.useMemo(
    () =>
      comments
        .filter((c) => !c.parent_uuid)
        .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.creation_date.localeCompare(a.creation_date)),
    [comments]
  )
  const repliesOf = React.useMemo(() => {
    const map = new Map<string, ActivityComment[]>()
    comments.filter((c) => c.parent_uuid).forEach((c) => {
      map.set(c.parent_uuid as string, [...(map.get(c.parent_uuid as string) || []), c])
    })
    return map
  }, [comments])

  // Opened from a notification: /…/activity/<id>#comment-<uuid>
  React.useEffect(() => {
    if (!comments.length || typeof window === 'undefined') return
    const match = window.location.hash.match(/^#comment-(.+)$/)
    if (!match) return
    const el = document.getElementById(`comment-${match[1]}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlighted(match[1])
    const timer = setTimeout(() => setHighlighted(null), 4000)
    return () => clearTimeout(timer)
  }, [comments.length])

  const refresh = () => queryClient.invalidateQueries({ queryKey: activityCommentsKey(activityUuid) })
  const guard = async (action: () => Promise<unknown>) => {
    try {
      await action()
      await refresh()
    } catch (e: any) {
      toast.error(e?.message || t('comments.error'))
      throw e
    }
  }

  const post = (text: string, parentUuid: string | null) =>
    guard(() => createActivityComment(activityUuid, text, parentUuid, token as string))

  const itemProps = {
    canComment,
    canModerate,
    signedIn,
    replyingTo,
    editing,
    onReply: setReplyingTo,
    onEdit: setEditing,
    onVote: (c: ActivityComment) => guard(() => toggleCommentVote(c.comment_uuid, token as string)).catch(() => {}),
    onPin: (c: ActivityComment) => guard(() => toggleCommentPin(c.comment_uuid, token as string)).catch(() => {}),
    onDelete: (c: ActivityComment) => guard(() => deleteActivityComment(c.comment_uuid, token as string)).catch(() => {}),
    onSave: async (c: ActivityComment, text: string) => {
      await guard(() => updateActivityComment(c.comment_uuid, text, token as string))
      setEditing(null)
    },
    onSubmitReply: async (c: ActivityComment, text: string) => {
      await post(text, c.comment_uuid)
      setReplyingTo(null)
    },
  }

  return (
    <section className="mt-8 w-full" aria-labelledby="activity-comments-title">
      <h2 id="activity-comments-title" className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
        <MessageCircle className="w-5 h-5" />
        {t('comments.discussion')}
        {comments.length > 0 && <span className="text-sm font-medium text-gray-400">{comments.length}</span>}
      </h2>

      <div className="mb-6">
        {!signedIn ? (
          <p className="text-sm text-gray-500">
            <Link href={getUriWithOrg(orgslug, '/login')} className="font-semibold text-gray-900 underline underline-offset-2">
              {t('auth.login')}
            </Link>{' '}
            {t('comments.login_to_comment')}
          </p>
        ) : canComment ? (
          <Composer
            placeholder={t('comments.placeholder')}
            submitLabel={t('comments.post')}
            onSubmit={(text) => post(text, null)}
          />
        ) : (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Lock className="w-4 h-4" /> {t('comments.enroll_to_comment')}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/4 rounded bg-gray-200" />
                <div className="h-3 w-3/4 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : topLevel.length === 0 ? (
        <p className="text-sm text-gray-400">{t('comments.empty')}</p>
      ) : (
        <ul className="space-y-6">
          {topLevel.map((c) => (
            <li key={c.comment_uuid}>
              <CommentItem comment={c} highlighted={highlighted === c.comment_uuid} {...itemProps} />
              {(repliesOf.get(c.comment_uuid) || []).length > 0 && (
                <ul className="mt-4 ms-5 ps-4 sm:ms-12 border-s-2 border-gray-100 space-y-4">
                  {(repliesOf.get(c.comment_uuid) || []).map((r) => (
                    <li key={r.comment_uuid}>
                      <CommentItem comment={r} isReply highlighted={highlighted === r.comment_uuid} {...itemProps} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
