import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@/lib/router'
import { searchParamsFor } from '@/lib/searchParams'
import type { Activity, BingoFeedRun } from '@/services/activityService'
import { deletePost } from '@/services/commentService'
import { useAuth } from '@/contexts/AuthContext'
import { useLoginModal } from '@/contexts/LoginModalContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePreferences } from '@/contexts/PreferencesContext'
import { userPath } from '@/lib/paths'
import {
  bingoPath,
  bingoShareUrl,
  centerIndex,
  completedLines,
  emptyCells,
  progressMask,
  type Bingo,
  type BingoCell,
} from '@/lib/bingo'
import { bingoApi } from '@/services/bingoService'
import { boardImage } from '@/lib/bingoImage'
import { useCoverInfos } from '@/lib/bingoCovers'
import { hashHue } from '@/lib/hashHue'
import BoringAvatar from '@/components/ui/BoringAvatar'
import DropdownMenu from '@/components/ui/DropdownMenu'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LibrarianBadge from '@/components/badges/LibrarianBadge'
import { isLibrarian } from '@/services/librarianService'
import CommentThread from '@/components/feed/CommentThread'
import CommentPreview from '@/components/feed/CommentPreview'
import LikeButton from '@/components/feed/LikeButton'
import ReactionBanner from '@/components/feed/ReactionBanner'
import BingoShareModal, { BingoShareCard } from './BingoShareModal'
import {
  IoBookOutline,
  IoChatbubbleOutline,
  IoCheckmark,
  IoChevronUp,
  IoFilmOutline,
  IoShareOutline,
  IoTrashOutline,
  IoTvOutline,
} from 'react-icons/io5'

function tileBackground(title: string) {
  const h = hashHue(title)
  return `linear-gradient(135deg, hsl(${h} 52% 38%), hsl(${(h + 32) % 360} 55% 24%))`
}

// A feed card for a finished bingo run: "<Name> finished bingo <Board>", then
// the same picture as the board's share image. Hovering a square previews that
// item; same share/like/comment footer as the other feed cards.
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
  const { openLogin } = useLoginModal()
  const { showActivityReactions } = usePreferences()
  const showReactionBanner = a.userReactionPayload && (a.userReactionPayload.actorId !== user?.id || showActivityReactions)
  const [showComments, setShowComments] = useState(initialOpenComments ?? false)
  const [commentsMounted, setCommentsMounted] = useState(initialOpenComments ?? false)
  const toggleComments = () => {
    setShowComments((v) => !v)
    setCommentsMounted(true)
  }
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const run = a.bingo
  const player = a.user.uuid || a.user.handle
  const { squares, loading } = useRunSquares(run, player)

  if (!run) return null

  const to = player ? bingoPath(run.boardId, player, run.runId) : bingoPath(run.boardId)
  const canDelete = !!user && (user.id === a.userId || user.role === 'admin')
  const mask = squares?.mask ?? run.mask
  const winning = new Set(completedLines(mask, run.rows, run.cols).flat())

  const shareBoard: Bingo = {
    id: run.boardId,
    kind: run.kind,
    title: run.title,
    description: '',
    author: a.user.name,
    freeCenter: run.freeCenter,
    rows: run.rows,
    cols: run.cols,
    cells: squares?.cells ?? emptyCells(run.rows, run.cols),
    revision: 1,
    createdAt: a.at * 1000,
  }
  const shareLink = () =>
    bingoShareUrl(shareBoard, {
      userId: player,
      runId: run.runId,
      run: { marks: run.kind === 'list' ? mask : undefined, answers: squares?.answers ?? undefined },
      by: a.user.name,
    })

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
    <article className="-mx-4 rounded-none border-x-0 border-y border-[var(--border-subtle)] bg-[var(--container)] px-4 py-4 sm:mx-0 sm:rounded-2xl sm:border-0 sm:p-4">
      {showReactionBanner && <ReactionBanner payload={a.userReactionPayload!} />}

      <div className="mb-3 flex items-center gap-2.5">
        <Link
          to={userPath(a.user.handle || a.user.uuid || '')}
          className="flex-shrink-0 overflow-hidden rounded-full"
          style={{ width: 36, height: 36 }}
          title={a.user.name}
        >
          {a.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
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
            {run.title}
          </Link>
        </div>
        <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">{a.timeAgo}</span>
        <DropdownMenu
          className="flex-shrink-0"
          items={[
            {
              label: t('share'),
              icon: <IoShareOutline className="h-4 w-4" />,
              onClick: () => setShareOpen(true),
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

      <Link to={to} className="block">
        <FeedBingoCard run={run} squares={squares} loading={loading} />
      </Link>

      <div className="mt-4 flex items-center gap-4 border-t border-[var(--divider)] pt-3 text-sm">
        {user ? (
          <LikeButton postId={a.postId} />
        ) : (
          <button
            onClick={() => openLogin()}
            className="inline-flex items-center gap-1.5 font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            <IoChevronUp className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={user ? toggleComments : () => openLogin()}
          className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
            showComments ? 'text-nonsprimary' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <IoChatbubbleOutline className="h-4 w-4" />
          {commentCount > 0 && commentCount}
        </button>
      </div>

      {!showComments && commentCount > 0 && (
        <CommentPreview postId={a.postId} commentCount={commentCount} onViewAll={toggleComments} />
      )}

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${showComments ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className={`overflow-hidden transition-opacity duration-200 ${showComments ? 'opacity-100 delay-100' : 'opacity-0'}`}>
          {commentsMounted && <CommentThread postId={a.postId} onCountChange={(n) => onCountChange?.(a.postId, n)} />}
        </div>
      </div>

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

      {shareOpen && (
        <BingoShareModal
          board={shareBoard}
          mask={mask}
          answers={squares?.answers ?? null}
          winning={winning}
          link={shareLink().url}
          embedded={shareLink().embedded}
          onClose={() => setShareOpen(false)}
        />
      )}
    </article>
  )
}

/** The share picture's natural width (BingoShareModal's card). */
const CARD_W = 360
const PEEK_W = 240
/** Covers whose colours tint a feed post's backdrop. */
const COLOR_SAMPLES = 8
/** Largest board whose squares are drawn (and fetched when the post lacks them); bigger ones are a mosaic. */
const SQUARES_MAX = 144

type Peek = { i: number; left: number; top: number; above: boolean }

type Squares = { cells: (BingoCell | null)[]; answers?: (BingoCell | null)[]; mask: boolean[] }

/**
 * The squares to draw: from the post when the server included them, otherwise
 * loaded from the player's public run (boards up to SQUARES_MAX squares).
 * `loading` is true while that request is in flight.
 */
function useRunSquares(run: BingoFeedRun | undefined, player: string | undefined): { squares: Squares | null; loading: boolean } {
  const need = !!run && !run.cells && !!player && run.rows * run.cols <= SQUARES_MAX
  const key = run ? `${run.boardId}/${player ?? ''}/${run.runId}` : ''
  const [fetched, setFetched] = useState<{ key: string; squares: Squares | null } | null>(null)

  useEffect(() => {
    if (!run || !need || !player) return
    let alive = true
    bingoApi
      .playerRun(run.boardId, player, run.runId)
      .then((r) => {
        if (!alive) return
        if (!r) return setFetched({ key, squares: null })
        const b = r.board
        setFetched({
          key,
          squares: {
            cells: b.cells,
            answers: b.kind === 'prompt' ? r.run.answers : undefined,
            mask: progressMask(b, r.run.marks, r.run.answers),
          },
        })
      })
      .catch(() => alive && setFetched({ key, squares: null }))
    return () => {
      alive = false
    }
  }, [need, key, player, run])

  if (!run) return { squares: null, loading: false }
  if (run.cells) return { squares: { cells: run.cells, answers: run.answers, mask: run.mask }, loading: false }
  if (!need) return { squares: null, loading: false }
  return { squares: fetched?.key === key ? fetched.squares : null, loading: fetched?.key !== key }
}

function FeedBingoCard({ run, squares, loading }: { run: BingoFeedRun; squares: Squares | null; loading: boolean }) {
  const { rows, cols, kind, freeCenter } = run
  const cells = squares?.cells
  const answers = squares?.answers
  const mask = squares?.mask ?? run.mask
  const prompt = kind === 'prompt'
  const winning = useMemo(() => new Set(completedLines(mask, rows, cols).flat()), [mask, rows, cols])
  const navigate = useNavigate()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [peek, setPeek] = useState<Peek | null>(null)

  // The picture is drawn at its natural width and shrunk to fit narrow screens.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / CARD_W)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const board: Bingo = useMemo(
    () => ({
      id: run.boardId,
      kind,
      title: run.title,
      description: '',
      author: '',
      freeCenter,
      rows,
      cols,
      cells: cells ?? emptyCells(rows, cols),
      revision: 1,
      createdAt: 0,
    }),
    [run.boardId, run.title, kind, freeCenter, rows, cols, cells],
  )

  // What each square shows: the item to tick, or the book the player entered.
  const artAt = (i: number): BingoCell | null => (prompt ? answers?.[i] : cells?.[i]) ?? null

  // The card's backdrop and glow take the colours of its covers, like the share
  // image does. Sample only a handful, so a feed of bingo posts stays light.
  const colorUrls = useMemo(() => {
    const urls = new Set<string>()
    for (let i = 0; i < rows * cols && urls.size < COLOR_SAMPLES; i++) {
      const u = (prompt ? answers?.[i] : cells?.[i])?.coverUrl
      if (u) urls.add(u)
    }
    return [...urls]
  }, [rows, cols, prompt, answers, cells])
  const { colors: coverColors } = useCoverInfos(colorUrls)
  const centre = freeCenter ? centerIndex(rows, cols) : null

  // Without the squares (very big boards) there is nothing to draw but the done pattern.
  const mosaic = useMemo(
    () =>
      cells || loading
        ? ''
        : boardImage({ rows, cols, cells: [], kind: 'list', freeCenter, mask, px: Math.max(2, Math.floor((CARD_W * 2) / Math.max(rows, cols))) }),
    [cells, loading, rows, cols, freeCenter, mask],
  )

  // Hover a square → show its book. Only re-render when the hovered square changes.
  // The popover is clickable, so closing waits a beat: the pointer can travel
  // from the square onto it without it vanishing.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keepOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  const closeSoon = () => {
    keepOpen()
    closeTimer.current = setTimeout(() => setPeek(null), 160)
  }
  useEffect(() => () => keepOpen(), [])

  const onMove = (e: React.MouseEvent) => {
    const wrap = wrapRef.current
    const target = e.target as HTMLElement
    if (target.closest('[data-peek]')) return keepOpen() // over the popover itself
    const el = target.closest<HTMLElement>('[data-i]')
    const i = el ? Number(el.dataset.i) : -1
    if (!wrap || !el || i === centre || !artAt(i)) return closeSoon()
    keepOpen()
    if (peek?.i === i) return
    const r = el.getBoundingClientRect()
    const c = wrap.getBoundingClientRect()
    const above = r.top - c.top > 130
    setPeek({
      i,
      left: Math.min(Math.max(0, r.left - c.left + r.width / 2 - PEEK_W / 2), Math.max(0, c.width - PEEK_W)),
      // flush with the square (the popover carries its own gap as padding)
      top: above ? r.top - c.top : r.bottom - c.top,
      above,
    })
  }

  // Opens the picked book in the catalog search (cells don't carry a catalog id yet).
  const openBook = (art: BingoCell) => {
    const params = searchParamsFor(art.title)
    if (art.type) params.set('tab', art.type)
    navigate({ pathname: '/search', search: `?${params.toString()}` })
  }

  const peekArt = peek ? artAt(peek.i) : null

  return (
    <div ref={wrapRef} className="relative w-full" onMouseMove={cells ? onMove : undefined} onMouseLeave={closeSoon}>
      {cells ? (
        <div style={{ zoom: scale, width: CARD_W }}>
          <BingoShareCard board={board} mask={mask} answers={answers ?? null} winning={winning} coverColors={coverColors} compact />
        </div>
      ) : loading ? (
        <div className="animate-pulse rounded-2xl bg-[var(--surface-active)]" style={{ width: '100%', maxWidth: CARD_W, aspectRatio: `${cols} / ${rows}` }} />
      ) : (
        mosaic && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mosaic} alt="" className="block w-full rounded-2xl" style={{ maxWidth: CARD_W, imageRendering: 'pixelated', aspectRatio: `${cols} / ${rows}` }} />
        )
      )}

      {peek && peekArt && (
        <BookPeek
          art={peekArt}
          prompt={prompt ? cells?.[peek.i]?.title : undefined}
          ticked={!prompt && !!mask[peek.i]}
          above={peek.above}
          onOpen={() => openBook(peekArt)}
          style={{ left: peek.left, top: peek.top, transform: peek.above ? 'translateY(-100%)' : undefined }}
        />
      )}
    </div>
  )
}

const TYPE_ICON = { book: IoBookOutline, movie: IoFilmOutline, series: IoTvOutline } as const

/**
 * The hovered square's book: cover, title, author, year and type (plus the prompt
 * it answers). Clickable: it opens the book. Its outer box carries a transparent
 * 8px band on the side facing the square, so the pointer never crosses a gap.
 */
function BookPeek({
  art, prompt, ticked, above, onOpen, style,
}: {
  art: BingoCell
  prompt?: string
  ticked: boolean
  above: boolean
  onOpen: () => void
  style: React.CSSProperties
}) {
  const { t } = useLanguage()
  const Icon = art.type ? TYPE_ICON[art.type] : null
  const typeLabel = art.type === 'book' ? t('book') : art.type === 'series' ? t('series') : art.type === 'movie' ? t('film') : ''
  // The feed card sits inside a link to the result, so this must not be an <a>.
  const open = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onOpen()
  }
  return (
    <div data-peek className={`absolute z-20 ${above ? 'pb-2' : 'pt-2'}`} style={{ width: PEEK_W, ...style }}>
      <div
        role="link"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open(e)}
        aria-label={art.title}
        className="flex cursor-pointer gap-3 rounded-xl border border-white/15 bg-[#141417]/95 p-2.5 text-left shadow-2xl backdrop-blur-md transition-colors hover:border-nonsprimary/60 hover:bg-[#1b1b20]"
      >
        <div className="relative h-[72px] w-12 flex-shrink-0 overflow-hidden rounded-md ring-1 ring-white/10" style={{ background: tileBackground(art.title) }}>
          {art.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            Icon && <Icon className="absolute inset-0 m-auto h-5 w-5 text-white/60" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {prompt && <p className="mb-0.5 line-clamp-2 text-[10px] font-medium uppercase tracking-wide text-white/55">{prompt}</p>}
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{art.title}</p>
          {art.credit && <p className="mt-0.5 truncate text-xs text-white/70">{art.credit}</p>}
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/50">
            {[typeLabel, art.year].filter(Boolean).join(' · ')}
            {ticked && (
              <span className="inline-flex items-center gap-0.5 text-nonsprimary">
                <IoCheckmark className="h-3 w-3" />
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
