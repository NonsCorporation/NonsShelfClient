import { useEffect, useState } from 'react'
import { Link } from '@/lib/router'
import { getComments, type FeedComment } from '@/services/commentService'
import { userPath } from '@/lib/paths'
import { isHorizon } from '@/lib/horizon'
import HorizonBadge from '@/components/badges/HorizonBadge'
import { useLanguage } from '@/contexts/LanguageContext'
import BoringAvatar from '@/components/ui/BoringAvatar'
import CommentMenu from '@/components/feed/CommentMenu'

// The post's top (oldest) comment, shown under the like/comment footer as a
// preview — full text (clamped with "show more" past a few lines, not cut off
// mid-sentence), a link to open the full thread and a three-dots menu (copy /
// reply / report).
export default function CommentPreview({
  postId,
  commentCount,
  onViewAll,
  collapsed = false,
}: {
  postId: number
  commentCount: number
  onViewAll: () => void
  /** The full thread is open: fold the preview away (animated) instead of removing it. */
  collapsed?: boolean
}) {
  const { t } = useLanguage()
  const [comment, setComment] = useState<FeedComment | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getComments(postId).then((rows) => {
      if (cancelled) return
      setComment(rows.find((c) => c.parent_id == null) ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [postId])

  if (!comment) return null

  return (
    // Collapses (rather than vanishing) while the full thread opens below it, so the
    // post doesn't jump: the thread grows as this shrinks. Inert while collapsed.
    <div
      aria-hidden={collapsed}
      {...({ inert: collapsed } as object)}
      className={`grid transition-[grid-template-rows] duration-300 ease-out ${collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}
    >
    <div className={`overflow-hidden transition-opacity duration-200 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
    {/* Same avatar size and gap as a comment in the thread, so it stays put when the thread opens. */}
    <div className="mt-2 flex items-start gap-2.5">
      <span className="flex-shrink-0 overflow-hidden rounded-full" style={{ width: 28, height: 28 }}>
        {comment.author.avatar_url ? (
          <img src={comment.author.avatar_url} alt={comment.author.name} className="h-full w-full object-cover" />
        ) : (
          <BoringAvatar size={28} name={`user-${comment.author.id}`} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-6 text-[var(--text)]">
          <Link to={userPath(comment.author.username)} className="font-semibold hover:underline">
            {comment.author.name}
          </Link>
          {isHorizon(comment.author.horizon) && <HorizonBadge className="ml-1 inline-block h-3.5 w-3.5 align-[-2px]" />}{' '}
          <span className={`whitespace-pre-wrap break-words text-[var(--text-muted)] ${expanded ? '' : 'line-clamp-3'}`}>
            {comment.body}
          </span>
          {!expanded && comment.body.length > 140 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="ml-1 font-medium text-nonsprimary hover:underline"
            >
              {t('showMore')}
            </button>
          )}
        </p>

        <div className="mt-1 flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={onViewAll}
            className="font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            {t('viewAllComments', { count: commentCount })}
          </button>
        </div>
      </div>
      <CommentMenu body={comment.body} onReply={onViewAll} className="flex-shrink-0" />
    </div>
    </div>
    </div>
  )
}
