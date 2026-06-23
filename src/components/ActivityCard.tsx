import { useState } from 'react'
import { Link } from '@/lib/router'
import type { Activity, ActivityType } from '../services/activityService'
import { deletePost } from '../services/commentService'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { initials } from '../lib/user'
import { mediaPath, userPath } from '../lib/paths'
import { IoHeart, IoHeartOutline, IoChatbubbleOutline, IoTrashOutline } from 'react-icons/io5'
import { IoMdStar, IoMdStarHalf, IoMdStarOutline } from 'react-icons/io'
import TypeBadge from './TypeBadge'
import CommentThread from './CommentThread'
import DropdownMenu from './DropdownMenu'
import ConfirmModal from './ConfirmModal'

const VERB_KEY: Record<ActivityType, string> = {
  rated: 'verbRated',
  finished: 'verbFinished',
  started: 'verbStarted',
  added: 'verbAdded',
  reviewed: 'verbReviewed',
  progress: 'verbProgress',
  dnf: 'verbDnf',
}

// Five-star display from a 0–10 rating, with half-star steps (matches StarsSelector).
function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex text-nonsprimary">
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = (i + 1) * 2
        const isFull = rating >= starValue
        const isHalf = rating === starValue - 1
        return isFull ? (
          <IoMdStar key={i} className="h-4 w-4" />
        ) : isHalf ? (
          <IoMdStarHalf key={i} className="h-4 w-4" />
        ) : (
          <IoMdStarOutline key={i} className="h-4 w-4 text-[var(--placeholder)]" />
        )
      })}
    </span>
  )
}

// Goodreads-style update card: "<Name> <verb> <Title>" + stars in the header,
// the review (when present) above a cover + details block, and a Like · Comment
// footer. Reusable across the feed and any place that shows activity.
export default function ActivityCard({
  a,
  commentCount = 0,
  onDeleted,
  onCountChange,
}: {
  a: Activity
  commentCount?: number
  onDeleted?: (postId: number) => void
  /** Live count updates from the open thread, lifted to the parent so the badge
   *  reflects the batched count immediately (not only after opening comments). */
  onCountChange?: (postId: number, n: number) => void
}) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [liked, setLiked] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const to = mediaPath({ type: a.mediaType, uuid: a.mediaUuid, id: String(a.mediaId) })
  const typeLabel = a.mediaType === 'book' ? t('book') : a.mediaType === 'series' ? t('series') : t('film')
  const showStars = typeof a.rating === 'number' && a.rating > 0
  // For progress events: "page 30 · 45%" (whichever parts are present).
  const progressText =
    a.type === 'progress'
      ? [a.page ? t('pageN', { page: a.page }) : '', a.progressPct ? `${a.progressPct}%` : ''].filter(Boolean).join(' · ')
      : ''
  // The post owner (or an admin) may remove it from the feed; the server enforces.
  const canDelete = !!user && (user.id === a.userId || user.role === 'admin')

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deletePost(a.postId)
      setConfirmingDelete(false)
      onDeleted?.(a.postId)
    } catch {
      setDeleting(false) // keep the dialog open so the user can retry
    }
  }

  return (
    <article className="-mx-4 rounded-none border-x-0 border-y border-[var(--border-subtle)] bg-[var(--container)] px-4 py-4 sm:mx-0 sm:rounded-2xl sm:border sm:p-5">
      {/* header: "<Name> <verb> <Title>" + stars, above the media card */}
      <div className="mb-3 flex items-center gap-2.5">
        <Link
          to={userPath(a.user.handle || a.user.uuid || '')}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{ backgroundColor: a.user.color }}
          title={a.user.name}
        >
          {initials(a.user.name)}
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-sm leading-6 text-[var(--text)]">
          <Link to={userPath(a.user.handle || a.user.uuid || '')} className="font-semibold hover:underline">
            {a.user.name}
          </Link>
          <span className="text-[var(--text-muted)]">{t(VERB_KEY[a.type])}</span>
          <Link to={to} className="font-semibold hover:text-nonsprimary">
            {a.mediaTitle}
          </Link>
          {showStars && (
            <span className="ml-0.5 inline-flex">
              <Stars rating={a.rating!} />
            </span>
          )}
          {progressText && (
            <span className="ml-0.5 inline-flex items-center rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-medium text-[var(--text)]">
              {progressText}
            </span>
          )}
        </div>
        <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">{a.timeAgo}</span>
        {canDelete && (
          <DropdownMenu
            className="flex-shrink-0"
            items={[
              {
                label: t('removeFromFeed'),
                icon: <IoTrashOutline className="h-4 w-4" />,
                danger: true,
                onClick: () => setConfirmingDelete(true),
              },
            ]}
          />
        )}
      </div>

      {/* review text, above the media card when present */}
      {a.text && (
        <p className="mb-3 text-sm leading-6 text-[var(--text)]">{a.text}</p>
      )}

      {/* body: cover + details */}
      <div className="flex gap-4">
        <Link to={to} className="relative block aspect-[2/3] w-[88px] flex-shrink-0">
          {a.coverUrl ? (
            <img
              src={a.coverUrl}
              alt={a.mediaTitle}
              loading="lazy"
              className="h-full w-full rounded-md border border-[var(--border-subtle)] object-cover"
            />
          ) : (
            <div className="h-full w-full rounded-md border border-[var(--border-subtle)] bg-[var(--container-2)]" />
          )}
          <TypeBadge type={a.mediaType} position="top-1.5 right-1.5" size="h-6 w-6" iconSize="h-3 w-3" />
        </Link>

        <div className="min-w-0 flex-1">
          <Link to={to} className="block text-lg font-bold leading-snug text-[var(--text)] hover:text-nonsprimary">
            {a.mediaTitle}
          </Link>
          {a.mediaAuthor && (
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {t('by')} <span className="text-[var(--text)]">{a.mediaAuthor}</span>
            </p>
          )}
          <p className="mt-0.5 text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {typeLabel}
            {a.mediaYear ? ` · ${a.mediaYear}` : ''}
          </p>

          {a.mediaDescription && (
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              <span className="line-clamp-3">{a.mediaDescription}</span>
              <Link to={to} className="text-nonsprimary hover:underline">
                {t('continueReading')}
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* footer: like · comment */}
      <div className="mt-4 flex items-center gap-4 border-t border-[var(--divider)] pt-3 text-sm">
        <button
          onClick={() => setLiked((v) => !v)}
          className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
            liked ? 'text-nonsprimary' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          {liked ? <IoHeart className="h-4 w-4" /> : <IoHeartOutline className="h-4 w-4" />}
          {t('like')}
        </button>
        <button
          onClick={() => setShowComments((v) => !v)}
          className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
            showComments ? 'text-nonsprimary' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <IoChatbubbleOutline className="h-4 w-4" />
          {commentCount > 0 ? commentCount : t('comment')}
        </button>
      </div>

      {showComments && <CommentThread postId={a.postId} onCountChange={(n) => onCountChange?.(a.postId, n)} />}

      {confirmingDelete && (
        <ConfirmModal
          title={t('removeFromFeed')}
          message={t('removeFromFeedConfirm')}
          confirmText={deleting ? t('deleting') : t('delete')}
          cancelText={t('cancel')}
          variant="danger"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </article>
  )
}
