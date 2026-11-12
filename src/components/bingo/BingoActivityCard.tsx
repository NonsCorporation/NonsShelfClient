import { useState } from 'react'
import { Link } from '@/lib/router'
import type { Activity } from '@/services/activityService'
import { deletePost } from '@/services/commentService'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePreferences } from '@/contexts/PreferencesContext'
import { userPath } from '@/lib/paths'
import { bingoPath } from '@/lib/bingo'
import BoringAvatar from '@/components/ui/BoringAvatar'
import DropdownMenu from '@/components/ui/DropdownMenu'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LibrarianBadge from '@/components/badges/LibrarianBadge'
import { isLibrarian } from '@/services/librarianService'
import CommentThread from '@/components/feed/CommentThread'
import CommentPreview from '@/components/feed/CommentPreview'
import LikeButton from '@/components/feed/LikeButton'
import ReactionBanner from '@/components/feed/ReactionBanner'
import { KindTag } from './BingoParts'
import { IoChatbubbleOutline, IoGridOutline, IoTrashOutline, IoTrophyOutline } from 'react-icons/io5'

// A feed card for a finished bingo run: "<Name> finished <Board>" over a tile
// with a mini grid of the done squares (boards up to 10×10) and the score, with
// the same like/comment footer as the other feed cards.
export default function BingoActivityCard({
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
  const { showActivityReactions } = usePreferences()
  const showReactionBanner = a.userReactionPayload && (a.userReactionPayload.actorId !== user?.id || showActivityReactions)
  const [showComments, setShowComments] = useState(initialOpenComments ?? false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const run = a.bingo
  if (!run) return null

  const player = a.user.uuid || a.user.handle
  const to = player ? bingoPath(run.board.id, player, run.run_id) : bingoPath(run.board.id)
  const everything = run.total > 0 && run.done === run.total
  const score = everything
    ? t('bingoAllDone')
    : run.lines > 0
      ? run.lines === 1
        ? t('bingoLineOne')
        : t('bingoLinesMany', { count: run.lines })
      : ''
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
      {showReactionBanner && <ReactionBanner payload={a.userReactionPayload!} />}

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
          <span className="flex-shrink-0 text-[var(--text-muted)]">{t('verbFinishedBingo')}</span>
          <Link to={to} className="min-w-0 font-semibold hover:text-nonsprimary">
            {run.board.title}
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

      <Link
        to={to}
        className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 transition-colors hover:border-nonsprimary"
      >
        <MiniGrid rows={run.board.rows} cols={run.board.cols} mask={run.mask} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-[var(--text)]">{run.board.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <KindTag kind={run.board.kind} />
            <span className="rounded-full bg-[var(--container)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
              {run.board.rows}×{run.board.cols}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            {run.done} / {run.total}
            {score && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-nonspremium/15 px-2 py-0.5 font-semibold text-nonspremium">
                <IoTrophyOutline className="h-3 w-3" />
                {score}
              </span>
            )}
          </p>
        </div>
      </Link>

      <div className="mt-4 flex items-center gap-4 border-t border-[var(--divider)] pt-3 text-sm">
        <LikeButton postId={a.postId} />
        <button
          onClick={() => setShowComments((v) => !v)}
          className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
            showComments ? 'text-nonsprimary' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <IoChatbubbleOutline className="h-4 w-4" />
          {commentCount > 0 && commentCount}
        </button>
      </div>

      {!showComments && commentCount > 0 && (
        <CommentPreview postId={a.postId} commentCount={commentCount} onViewAll={() => setShowComments(true)} />
      )}

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

// The done squares as a tiny grid; a plain icon tile when the board is too big
// to send a mask for.
function MiniGrid({ rows, cols, mask }: { rows: number; cols: number; mask?: string }) {
  if (!mask || mask.length !== rows * cols) {
    return (
      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)]">
        <IoGridOutline className="h-6 w-6 text-nonsprimary" />
      </div>
    )
  }
  return (
    <div
      className="grid h-14 w-14 flex-shrink-0 gap-px overflow-hidden rounded-md bg-[var(--border-subtle)] p-px"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {Array.from(mask, (ch, i) => (
        <span key={i} className={ch === '1' ? 'bg-nonsprimary' : 'bg-[var(--container)]'} />
      ))}
    </div>
  )
}
