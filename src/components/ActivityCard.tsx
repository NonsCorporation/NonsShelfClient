import { useState } from 'react'
import { Link } from '@/lib/router'
import type { Activity, ActivityType } from '../services/activityService'
import type { MediaItem, ShelfStatus } from '../types'
import { deletePost } from '../services/commentService'
import { libraryService } from '../services/libraryService'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { mediaPath, userPath } from '../lib/paths'
import BoringAvatar from './BoringAvatar'
import ShelfStatusBar from './ShelfStatusBar'
import { IoHeart, IoHeartOutline, IoChatbubbleOutline, IoTrashOutline, IoShareOutline } from 'react-icons/io5'
import { IoMdStar, IoMdStarHalf, IoMdStarOutline } from 'react-icons/io'
import TypeBadge from './TypeBadge'
import CommentThread from './CommentThread'
import DropdownMenu from './DropdownMenu'
import ConfirmModal from './ConfirmModal'
import ShareModal from './ShareModal'
import LibrarianBadge from './LibrarianBadge'
import { isLibrarian } from '../services/librarianService'

// The shelf status a post's own event type unambiguously implies — used for
// the share card's status pill. 'added'/'rated'/'reviewed' don't reliably
// imply one (a rating can be left mid-read), so those show no status pill.
const SHARE_STATUS: Partial<Record<ActivityType, ShelfStatus>> = {
  started: 'active',
  progress: 'active',
  finished: 'done',
  dnf: 'dnf',
}

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
  myItem,
  onDeleted,
  onCountChange,
  onShelfChange,
  openComments: initialOpenComments,
}: {
  a: Activity
  commentCount?: number
  /** The viewer's own library entry for this media, if any — drives the
   *  "You" quick-action row so they can shelve/compare from the feed. */
  myItem?: MediaItem
  onDeleted?: (postId: number) => void
  /** Live count updates from the open thread, lifted to the parent so the badge
   *  reflects the batched count immediately (not only after opening comments). */
  onCountChange?: (postId: number, n: number) => void
  /** Persisted shelf change for this media — lifted so the parent feed updates
   *  its own library state (and the in-progress row). */
  onShelfChange?: (item: MediaItem) => void
  /** When true, the comment thread is expanded on mount (deep-link from notifications). */
  openComments?: boolean
}) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [liked, setLiked] = useState(false)
  const [showComments, setShowComments] = useState(initialOpenComments ?? false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  // The catalog's page count, fetched only when Share opens (Activity itself
  // doesn't carry it) — needed for the share card's progress bar.
  const [sharePages, setSharePages] = useState<number | undefined>(undefined)

  // The viewer's own shelf state for this media. When they haven't added it,
  // synthesize a minimal item from the activity so they can shelve it in place.
  const myStatus = myItem?.status ?? null
  const shelfItem: MediaItem = myItem ?? {
    id: String(a.mediaId),
    uuid: a.mediaUuid,
    type: a.mediaType,
    title: a.mediaTitle,
    author: a.mediaAuthor ?? '',
    coverUrl: a.coverUrl,
    year: a.mediaYear,
  }

  // What THIS POST shows — deliberately built from the activity's own snapshot
  // (rating/review/progress at post time), never from myItem/shelfItem, which
  // is the *viewer's* own separate shelf entry and would misrepresent someone
  // else's post.
  const shareItem: MediaItem = {
    id: String(a.mediaId),
    uuid: a.mediaUuid,
    type: a.mediaType,
    title: a.mediaTitle,
    author: a.mediaAuthor ?? '',
    coverUrl: a.coverUrl,
    year: a.mediaYear,
    pages: sharePages,
  }
  const shareStatus = SHARE_STATUS[a.type] ?? null
  const shareCurrentPage = a.type === 'progress' ? (a.page ?? 0) : 0

  const openShare = async () => {
    setShareOpen(true)
    try {
      const full = await libraryService.getItem(String(a.mediaId))
      // Only the catalog's page count is used — full also carries the
      // *viewer's* own rating/review/status, which must not leak into this
      // post's share card.
      setSharePages(full?.pages)
    } catch {
      setSharePages(undefined)
    }
  }

  // Set the viewer's own shelf status from the feed. Optimistic, then persisted;
  // the resolved item (full catalog fields) replaces the optimistic one.
  const handleSetStatus = async (status: ShelfStatus) => {
    onShelfChange?.({ ...shelfItem, status })
    try {
      const updated = await libraryService.updateItem(shelfItem.id, { status })
      onShelfChange?.(updated)
    } catch {
      /* leave the optimistic value; a reload will reconcile */
    }
  }
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
          className="flex-shrink-0 overflow-hidden rounded-full"
          style={{ width: 36, height: 36 }}
          title={a.user.name}
        >
          {a.user.avatarUrl ? (
            <img src={a.user.avatarUrl} alt={a.user.name} loading="lazy" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <BoringAvatar size={36} name={`user-${a.userId}`} />
          )}
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-sm leading-6 text-[var(--text)]">
          <Link to={userPath(a.user.handle || a.user.uuid || '')} className="font-semibold hover:underline">
            {a.user.name}
          </Link>
          {isLibrarian(a.user.role) && <LibrarianBadge className="h-4 w-4" />}
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
        <DropdownMenu
          className="flex-shrink-0"
          items={[
            {
              label: t('share'),
              icon: <IoShareOutline className="h-4 w-4" />,
              onClick: openShare,
            },
            ...(canDelete
              ? [
                  {
                    label: t('removeFromFeed'),
                    icon: <IoTrashOutline className="h-4 w-4" />,
                    danger: true,
                    onClick: () => setConfirmingDelete(true),
                  },
                ]
              : []),
          ]}
        />
      </div>

      {/* review text, above the media card when present */}
      {a.text && (
        <p className="mb-3 text-sm leading-6 text-[var(--text)]">{a.text}</p>
      )}

      {/* body: cover + details */}
      <div className="flex gap-4">
        <Link to={to} className="relative block aspect-[2/3] w-[88px] flex-shrink-0 self-start">
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

          {/* Your shelf — Goodreads-style quick action under the metadata. */}
          <div className="mt-2">
            <ShelfStatusBar item={shelfItem} currentStatus={myStatus} onStatusChange={handleSetStatus} variant="button" />
          </div>

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

      <ShareModal
        isOpen={shareOpen}
        item={shareItem}
        coverUrl={a.coverUrl}
        title={a.mediaTitle}
        author={a.mediaAuthor}
        totalPages={sharePages}
        rating={a.rating ?? null}
        review={a.text ?? ''}
        status={shareStatus}
        currentPage={shareCurrentPage}
        onClose={() => setShareOpen(false)}
      />
    </article>
  )
}
