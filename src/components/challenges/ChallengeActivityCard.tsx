import { useState } from 'react'
import { Link } from '@/lib/router'
import type { Activity } from '@/services/activityService'
import { deletePost } from '@/services/commentService'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { userPath } from '@/lib/paths'
import BoringAvatar from '@/components/ui/BoringAvatar'
import { IoHeart, IoHeartOutline, IoChatbubbleOutline, IoTrashOutline, IoRibbonOutline } from 'react-icons/io5'
import CommentThread from '@/components/feed/CommentThread'
import DropdownMenu from '@/components/ui/DropdownMenu'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LibrarianBadge from '@/components/badges/LibrarianBadge'
import { isLibrarian } from '@/services/librarianService'

// A feed card for a "joined a challenge" event: "<Name> joined <Challenge>" over
// a compact challenge tile, with the same like/comment footer as ActivityCard
// (comments attach by post id, so challenge posts thread just like media ones).
export default function ChallengeActivityCard({
  a,
  commentCount = 0,
  onDeleted,
  onCountChange,
  openComments: initialOpenComments,
}: {
  a: Activity
  commentCount?: number
  onDeleted?: (postId: number) => void
  onCountChange?: (postId: number, n: number) => void
  openComments?: boolean
}) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [liked, setLiked] = useState(false)
  const [showComments, setShowComments] = useState(initialOpenComments ?? false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const ch = a.challenge
  if (!ch) return null

  const title = ch.official && ch.period === 'yearly' ? t('readingGoalTitle', { year: ch.year }) : ch.title
  const to = `/challenge/${ch.uuid}`
  // The joiner's numeric goal ("Goal · 10 books"), labelled by what's counted.
  const goalKey =
    ch.mediaType === 'movie' ? 'feedGoalFilms' : ch.mediaType === 'series' ? 'feedGoalSeries' : 'feedGoalBooks'
  const goalText = ch.goal ? t(goalKey, { count: ch.goal }) : ''
  const canDelete = !!user && (user.id === a.userId || user.role === 'admin')

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deletePost(a.postId)
      setConfirmingDelete(false)
      onDeleted?.(a.postId)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <article className="-mx-4 rounded-none border-x-0 border-y border-[var(--border-subtle)] bg-[var(--container)] px-4 py-4 sm:mx-0 sm:rounded-2xl sm:border sm:p-5">
      {/* header: "<Name> joined <Challenge>" */}
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
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm leading-6 text-[var(--text)]">
          <Link to={userPath(a.user.handle || a.user.uuid || '')} className="flex-shrink-0 font-semibold hover:underline">
            {a.user.name}
          </Link>
          {isLibrarian(a.user.role) && <LibrarianBadge className="h-4 w-4 flex-shrink-0" />}
          <span className="flex-shrink-0 text-[var(--text-muted)]">{t('verbJoinedChallenge')}</span>
          <Link to={to} className="min-w-0 font-semibold hover:text-nonsprimary">
            {title}
          </Link>
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

      {/* body: a compact challenge tile */}
      <Link
        to={to}
        className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 transition-colors hover:border-nonsprimary"
      >
        <div className="flex aspect-[2/3] w-12 flex-shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)]">
          <IoRibbonOutline className="h-5 w-5 text-nonsprimary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-[var(--text)]">{title}</p>
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {ch.official ? t('challengeOfficialBadge') : t('challenges')}
          </p>
          {goalText && (
            <span className="mt-1.5 inline-flex items-center rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-semibold text-nonsprimary">
              {goalText}
            </span>
          )}
        </div>
      </Link>

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
