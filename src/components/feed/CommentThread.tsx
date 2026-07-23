'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/lib/router'
import { IoTrashOutline, IoCloseOutline } from 'react-icons/io5'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { userPath } from '@/lib/paths'
import {
  getComments, addComment, getReviewComments, addReviewComment, deleteComment,
  type FeedComment,
} from '@/services/commentService'
import BoringAvatar from '@/components/ui/BoringAvatar'
import DropdownMenu from '@/components/ui/DropdownMenu'
import UserHoverCard from '@/components/ui/UserHoverCard'
import UsernameCommentHover from '@/components/ui/UsernameCommentHover'

// Stop indenting past this depth so deep reply chains don't march off-screen.
// 3 → top-level plus two nested indents = three visual levels; deeper replies
// keep threading but render flush at the third level.
const MAX_DEPTH = 3

function timeAgo(at: number): string {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - at))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`
  return `${Math.floor(s / (7 * 86400))}w`
}

type PostFn = (body: string, parentId?: number) => Promise<void>

// Threaded comments on one item (nons-style: avatar, byline, reply, nested
// replies). The item is either a feed post (postId) or a media-page review
// (reviewId) — the two are separate threads server-side. The flat list from the
// API is turned into a tree by parent_id.
type Props = { postId: number; reviewId?: undefined; onCountChange?: (n: number) => void }
  | { reviewId: number; postId?: undefined; onCountChange?: (n: number) => void }

export default function CommentThread({ postId, reviewId, onCountChange }: Props) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const isReview = reviewId != null
  const id = isReview ? reviewId! : postId!
  const [comments, setComments] = useState<FeedComment[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [replyTo, setReplyTo] = useState<number | null>(null)

  useEffect(() => {
    // The thread is mounted for one fixed target, so loading starts true (above)
    // and we just resolve it here — no synchronous setState in the effect body.
    let cancelled = false
    const load = isReview ? getReviewComments(id) : getComments(id)
    load.then((rows) => {
      if (cancelled) return
      setComments(rows)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isReview])

  // Report the comment count to the parent from an effect, never from inside a
  // setState updater (that runs during render and would setState the parent
  // mid-render). Holds until the first load completes so the card's count
  // doesn't flicker through 0.
  useEffect(() => {
    if (!loading) onCountChange?.(comments.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length, loading])

  const childrenOf = useMemo(() => {
    const map = new Map<number | null, FeedComment[]>()
    for (const c of comments) {
      const arr = map.get(c.parent_id) ?? []
      arr.push(c)
      map.set(c.parent_id, arr)
    }
    return map
  }, [comments])

  // So a reply can show "@parent-author" derived from the tree, without that
  // mention ever being baked into the stored comment body.
  const byId = useMemo(() => new Map(comments.map((c) => [c.id, c])), [comments])

  const post: PostFn = async (text, parentId) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setPosting(true)
    try {
      const created = isReview
        ? await addReviewComment(id, trimmed, parentId)
        : await addComment(id, trimmed, parentId)
      setComments((prev) => [...prev, created])
      if (parentId) setReplyTo(null)
      else setBody('')
    } finally {
      setPosting(false)
    }
  }

  const remove = async (id: number) => {
    // Drop the comment and every reply nested beneath it (mirrors the server).
    const toRemove = new Set<number>([id])
    for (let changed = true; changed; ) {
      changed = false
      for (const c of comments) {
        if (c.parent_id != null && toRemove.has(c.parent_id) && !toRemove.has(c.id)) {
          toRemove.add(c.id)
          changed = true
        }
      }
    }
    await deleteComment(id)
    setComments((prev) => prev.filter((c) => !toRemove.has(c.id)))
  }

  const topLevel = childrenOf.get(null) ?? []

  return (
    <div className="mt-3 flex flex-col gap-3">
      {loading ? (
        <p className="text-xs text-[var(--text-muted)]">{t('loading')}</p>
      ) : topLevel.length > 0 ? (
        <div className="flex flex-col gap-3">
          {topLevel.map((c) => (
            <CommentNode
              key={c.id}
              comment={c}
              childrenOf={childrenOf}
              byId={byId}
              depth={0}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              onReply={post}
              onDelete={remove}
              posting={posting}
              meId={user?.id}
            />
          ))}
        </div>
      ) : null}

      {/* New top-level comment */}
      {user && (
        <div className="flex items-start gap-2.5">
          <Avatar id={user.id} name={user.name || user.username} username={user.username} avatar={user.avatar_url} />
          <div className="min-w-0 flex-1">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('writeComment')}
              rows={2}
              className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
            />
            {body.trim() && (
              <div className="mt-1.5 flex justify-end gap-2">
                <button onClick={() => setBody('')} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]">
                  {t('cancel')}
                </button>
                <button
                  onClick={() => post(body)}
                  disabled={posting}
                  className="rounded-lg bg-nonsprimary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
                >
                  {t('post')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Avatar({ id, name, username, avatar, small }: { id: number; name: string; username: string; avatar?: string; small?: boolean }) {
  const px = small ? 28 : 32
  return (
    <Link
      to={userPath(username)}
      className="inline-block flex-shrink-0 overflow-hidden rounded-full"
      style={{ width: px, height: px }}
      title={name}
    >
      {avatar
        ? <img src={avatar} alt={name} className="h-full w-full object-cover" />
        : <BoringAvatar size={px} name={`user-${id}`} />}
    </Link>
  )
}

function CommentNode({
  comment,
  childrenOf,
  byId,
  depth,
  replyTo,
  setReplyTo,
  onReply,
  onDelete,
  posting,
  meId,
}: {
  comment: FeedComment
  childrenOf: Map<number | null, FeedComment[]>
  byId: Map<number, FeedComment>
  depth: number
  replyTo: number | null
  setReplyTo: (id: number | null) => void
  onReply: PostFn
  onDelete: (id: number) => void
  posting: boolean
  meId?: number
}) {
  const { t } = useLanguage()
  const [replyBody, setReplyBody] = useState('')
  const replies = childrenOf.get(comment.id) ?? []
  const replying = replyTo === comment.id
  const isOwn = meId != null && comment.author.id === meId
  // Derived from the tree (parent_id → parent comment), not stored in the
  // body — so the mention always reflects the current username and never
  // has to be typed or stripped by the user.
  const replyingToComment = comment.parent_id != null ? byId.get(comment.parent_id) : undefined
  const replyingToUsername = replyingToComment?.author.username
  // Replies are always allowed, but indentation stops deepening past MAX_DEPTH
  // levels: a reply to an already-maxed comment renders flush at the same level
  // as its parent (so threads can't march off-screen). Indent the *replies*
  // container only while the child level is still within the cap.
  const childIndent = depth + 1 < MAX_DEPTH

  return (
    <div>
      <div className="flex items-start gap-2.5">
        <UserHoverCard username={comment.author.username}>
          <Avatar id={comment.author.id} name={comment.author.name} username={comment.author.username} avatar={comment.author.avatar_url} small />
        </UserHoverCard>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
              <UserHoverCard username={comment.author.username}>
                <Link to={userPath(comment.author.username)} className="font-semibold text-[var(--text)] hover:text-nonsprimary">
                  {comment.author.name}
                </Link>
              </UserHoverCard>
              <UserHoverCard username={comment.author.username}>
                <span className="text-[var(--text-muted)]">@{comment.author.username}</span>
              </UserHoverCard>
              <span className="text-[var(--text-muted)]">· {timeAgo(comment.created_at)}</span>
            </div>
            {isOwn && (
              <DropdownMenu
                items={[{ label: t('delete'), icon: <IoTrashOutline className="h-4 w-4" />, onClick: () => onDelete(comment.id), danger: true }]}
                buttonClassName="!p-0.5"
              />
            )}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]">
            {replyingToUsername && replyingToComment && (
              <UsernameCommentHover comment={replyingToComment}>
                <Link to={userPath(replyingToUsername)} className="mr-1 font-medium text-nonsprimary hover:underline">
                  @{replyingToUsername}
                </Link>
              </UsernameCommentHover>
            )}
            {comment.body}
          </p>

          <div className="mt-1 flex items-center gap-3 text-xs">
            <button
              onClick={() => setReplyTo(replying ? null : comment.id)}
              className="font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              {t('reply')}
            </button>
          </div>

          {replying && (
            <div className="mt-2 flex flex-col gap-1.5">
              {/* Discussion-style "replying to" header, so it's clear whose
                  comment this answers before you've typed anything. */}
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span>{t('replyingTo')}</span>
                <span className="font-semibold text-nonsprimary">@{comment.author.username}</span>
                <button
                  onClick={() => { setReplyTo(null); setReplyBody('') }}
                  className="ml-0.5 inline-flex text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                  aria-label={t('cancel')}
                >
                  <IoCloseOutline className="h-4 w-4" />
                </button>
              </div>
              <textarea
                autoFocus
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder={t('writeReply')}
                rows={2}
                className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setReplyTo(null); setReplyBody('') }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={async () => { await onReply(replyBody, comment.id); setReplyBody('') }}
                  disabled={posting || !replyBody.trim()}
                  className="rounded-lg bg-nonsprimary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
                >
                  {t('post')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Replies are a sibling of the comment row (not nested inside its avatar
          column) so indentation is controlled here and capped: within the depth
          limit they indent under a thread line; past it they render flush, at
          the same level as the comment they reply to. */}
      {replies.length > 0 && (
        <div className={`mt-3 flex flex-col gap-3 ${childIndent ? 'ml-3.5 border-l border-[var(--border-subtle)] pl-3' : ''}`}>
          {replies.map((r) => (
            <CommentNode
              key={r.id}
              comment={r}
              childrenOf={childrenOf}
              byId={byId}
              depth={depth + 1}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              onReply={onReply}
              onDelete={onDelete}
              posting={posting}
              meId={meId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
