import { useEffect, useState } from 'react'
import { Link } from '@/lib/router'
import { IoCopyOutline, IoCheckmark } from 'react-icons/io5'
import { getComments, type FeedComment } from '@/services/commentService'
import { userPath } from '@/lib/paths'
import { useLanguage } from '@/contexts/LanguageContext'
import BoringAvatar from '@/components/ui/BoringAvatar'

// The post's top (oldest) comment, shown under the like/comment footer as a
// preview — full text (clamped with "show more" past a few lines, not cut off
// mid-sentence), a copy action, and a link to open the full thread.
export default function CommentPreview({
  postId,
  commentCount,
  onViewAll,
}: {
  postId: number
  commentCount: number
  onViewAll: () => void
}) {
  const { t } = useLanguage()
  const [comment, setComment] = useState<FeedComment | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

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

  const copyComment = () => {
    navigator.clipboard?.writeText(comment.body).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <div className="mt-2 flex items-start gap-2">
      <span className="flex-shrink-0 overflow-hidden rounded-full" style={{ width: 24, height: 24 }}>
        {comment.author.avatar_url ? (
          <img src={comment.author.avatar_url} alt={comment.author.name} className="h-full w-full object-cover" />
        ) : (
          <BoringAvatar size={24} name={`user-${comment.author.id}`} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-6 text-[var(--text)]">
          <Link to={userPath(comment.author.username)} className="font-semibold hover:underline">
            {comment.author.name}
          </Link>{' '}
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
          <button
            type="button"
            onClick={copyComment}
            className="inline-flex items-center gap-1 font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            {copied ? <IoCheckmark className="h-3.5 w-3.5 text-nonsprimary" /> : <IoCopyOutline className="h-3.5 w-3.5" />}
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
      </div>
    </div>
  )
}
