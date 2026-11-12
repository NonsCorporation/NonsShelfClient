import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@/lib/router'
import type { Activity, BingoFeedRun } from '@/services/activityService'
import { deletePost } from '@/services/commentService'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePreferences } from '@/contexts/PreferencesContext'
import { userPath } from '@/lib/paths'
import { bingoPath, centerIndex, completedLines, progressMask, type BingoCell } from '@/lib/bingo'
import { bingoApi } from '@/services/bingoService'
import { boardImage } from '@/lib/bingoImage'
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
import BingoGrid from './BingoGrid'
import { IoArrowForward, IoBookOutline, IoChatbubbleOutline, IoCheckmark, IoFilmOutline, IoTrashOutline, IoTrophyOutline, IoTvOutline } from 'react-icons/io5'

// A feed card for a finished bingo run: "<Name> finished <Board>", then the
// board in the style of its share card — a dark card glowing in the colours of
// the books on it, with the covers and the books the player entered. Hovering a
// square shows that book. Same like/comment footer as the other feed cards.
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
  const to = player ? bingoPath(run.boardId, player, run.runId) : bingoPath(run.boardId)
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

      <Link to={to} className="block">
        <FeedBingoCard run={run} player={player} />
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

/** Widest the board is drawn in the feed card (prompt boards are taller, so narrower). */
const BOARD_MAX = 300
const PROMPT_BOARD_MAX = 260
/** Covers shown in the "done" stack before "+N". */
const STACK_MAX = 6
const PEEK_W = 230
/** Largest board whose squares are drawn (and fetched when the post lacks them); bigger ones are a mosaic. */
const SQUARES_MAX = 144

// The app's dark theme values, set on the card so it reads the same in light mode
// (the grid's empty squares and captions use these variables).
const DARK_VARS = {
  '--text': '#f4f4f5',
  '--text-muted': '#a1a1aa',
  '--surface': 'rgba(255, 255, 255, 0.05)',
  '--border': 'rgba(255, 255, 255, 0.14)',
  '--border-strong': 'rgba(255, 255, 255, 0.24)',
  '--container': '#0b0b0e',
  '--primary-soft': 'rgba(103, 104, 171, 0.22)',
  '--primary-ring': 'rgba(103, 104, 171, 0.5)',
} as React.CSSProperties

type Peek = { i: number; left: number; top: number; above: boolean }

type Squares = { cells: (BingoCell | null)[]; answers?: (BingoCell | null)[]; mask: boolean[] }

/**
 * The squares to draw: from the post when the server included them, otherwise
 * loaded from the player's public run (boards up to SQUARES_MAX squares).
 * `loading` is true while that request is in flight.
 */
function useRunSquares(run: BingoFeedRun, player: string | undefined): { squares: Squares | null; loading: boolean } {
  const need = !run.cells && !!player && run.rows * run.cols <= SQUARES_MAX
  const key = `${run.boardId}/${player ?? ''}/${run.runId}`
  const [fetched, setFetched] = useState<{ key: string; squares: Squares | null } | null>(null)

  useEffect(() => {
    if (!need || !player) return
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
  }, [need, key, player, run.boardId, run.runId])

  if (run.cells) return { squares: { cells: run.cells, answers: run.answers, mask: run.mask }, loading: false }
  if (!need) return { squares: null, loading: false }
  return { squares: fetched?.key === key ? fetched.squares : null, loading: fetched?.key !== key }
}

function FeedBingoCard({ run, player }: { run: BingoFeedRun; player?: string }) {
  const { t } = useLanguage()
  const { rows, cols, kind, freeCenter } = run
  const { squares, loading } = useRunSquares(run, player)
  const cells = squares?.cells
  const answers = squares?.answers
  const mask = squares?.mask ?? run.mask
  const prompt = kind === 'prompt'
  const winning = useMemo(() => new Set(completedLines(mask, rows, cols).flat()), [mask, rows, cols])
  const cardRef = useRef<HTMLDivElement>(null)
  const [peek, setPeek] = useState<Peek | null>(null)

  // What each square shows: the item to tick, or the book the player entered.
  const artAt = (i: number): BingoCell | null => (prompt ? answers?.[i] : cells?.[i]) ?? null
  const centre = freeCenter ? centerIndex(rows, cols) : null

  // Glow colours from the books on the board (their title hues), like the share card's backdrop.
  const glow = useMemo(() => {
    const hues: number[] = []
    for (let i = 0; i < rows * cols && hues.length < 24; i++) {
      const art = (prompt ? answers?.[i] : cells?.[i]) ?? null
      if (art) hues.push(hashHue(art.title))
    }
    const h1 = hues[0] ?? hashHue(run.title)
    const h2 = hues[Math.floor(hues.length / 2)] ?? (h1 + 50) % 360
    return [
      `radial-gradient(ellipse 85% 40% at 12% 0%, hsla(${h1}, 75%, 55%, 0.34), transparent 72%)`,
      `radial-gradient(ellipse 85% 40% at 88% 100%, hsla(${h2}, 75%, 55%, 0.3), transparent 72%)`,
      '#050507',
    ].join(', ')
  }, [rows, cols, prompt, answers, cells, run.title])

  const mosaic = useMemo(
    () =>
      cells
        ? ''
        : boardImage({
            rows,
            cols,
            cells: [],
            // Without squares a prompt board's picks are unknown, so draw done squares as checklist ticks.
            kind: 'list',
            freeCenter,
            mask,
            winning,
            px: Math.max(2, Math.floor((BOARD_MAX * 2) / Math.max(rows, cols))),
          }),
    [cells, rows, cols, freeCenter, mask, winning],
  )

  const everything = run.total > 0 && run.done === run.total
  const score = everything ? t('bingoAllDone') : run.lines > 0 ? (run.lines === 1 ? t('bingoLineOne') : t('bingoLinesMany', { count: run.lines })) : ''
  const pct = run.total > 0 ? Math.round((run.done / run.total) * 100) : 0
  // Board column: capped, and narrower for tall boards so the card stays feed-sized.
  const max = prompt ? PROMPT_BOARD_MAX : BOARD_MAX
  const boardWidth = rows > cols ? Math.max(180, (cols / rows) * max) : max

  // The books behind the done squares, for the little cover stack.
  const doneArts = useMemo(() => {
    const out: BingoCell[] = []
    for (let i = 0; i < rows * cols; i++) {
      if (i === centre || !mask[i]) continue
      const art = (prompt ? answers?.[i] : cells?.[i]) ?? null
      if (art) out.push(art)
    }
    // Real covers first: they make the stack.
    return out.sort((x, y) => Number(!!y.coverUrl) - Number(!!x.coverUrl))
  }, [rows, cols, centre, mask, prompt, answers, cells])

  // Hover a square → show its book. Only re-render when the hovered square changes.
  const onMove = (e: React.MouseEvent) => {
    const card = cardRef.current
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
    const i = el ? Number(el.dataset.i) : -1
    if (!card || !el || i === centre || !artAt(i)) {
      if (peek) setPeek(null)
      return
    }
    if (peek?.i === i) return
    const r = el.getBoundingClientRect()
    const c = card.getBoundingClientRect()
    const above = r.top - c.top > 120
    setPeek({
      i,
      left: Math.min(Math.max(4, r.left - c.left + r.width / 2 - PEEK_W / 2), Math.max(4, c.width - PEEK_W - 4)),
      top: above ? r.top - c.top - 8 : r.bottom - c.top + 8,
      above,
    })
  }

  const peekArt = peek ? artAt(peek.i) : null

  return (
    <div
      ref={cardRef}
      onMouseLeave={() => setPeek(null)}
      className="group relative flex w-full flex-col gap-4 rounded-2xl p-3 text-[var(--text)] shadow-lg ring-1 ring-white/10 transition-shadow hover:ring-white/20 sm:flex-row sm:gap-5 sm:p-4"
      style={{ ...DARK_VARS, background: glow }}
    >
      {/* the board */}
      <div className="w-full flex-shrink-0 self-start sm:w-auto" onMouseMove={cells ? onMove : undefined}>
        <div className="mx-auto w-full sm:mx-0" style={{ maxWidth: boardWidth, width: '100%' }}>
          <div className="sm:w-[var(--bw)]" style={{ '--bw': `${boardWidth}px` } as React.CSSProperties}>
            {cells ? (
              <BingoGrid rows={rows} cols={cols} cells={cells} freeCenter={freeCenter} kind={kind} mask={mask} answers={answers} winning={winning} tooltips={false} />
            ) : loading ? (
              <div className="w-full animate-pulse rounded-md bg-white/5" style={{ aspectRatio: `${cols} / ${rows}` }} />
            ) : (
              mosaic && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mosaic} alt="" className="block w-full rounded-md" style={{ imageRendering: 'pixelated', aspectRatio: `${cols} / ${rows}` }} />
              )
            )}
          </div>
        </div>
      </div>

      {/* what it is and how it went */}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
          {t(prompt ? 'bingoKindPrompt' : 'bingoKindList')} · {rows}×{cols}
        </p>
        <p className="mt-1 line-clamp-2 text-lg font-bold leading-snug">{run.title}</p>

        <div className="mt-3 flex items-end justify-between gap-2">
          <p className="leading-none">
            <span className="text-3xl font-bold tracking-tight">{run.done}</span>
            <span className="ml-1 text-sm text-white/50">/ {run.total}</span>
          </p>
          {score && (
            <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-nonspremium/20 px-2.5 py-1 text-xs font-semibold text-nonspremium">
              <IoTrophyOutline className="h-3.5 w-3.5" />
              {score}
            </span>
          )}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${everything ? 'bg-nonspremium' : 'bg-nonsprimary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-white/50">{t(prompt ? 'bingoFilledLabel' : 'bingoTickedLabel')}</p>

        {doneArts.length > 0 && (
          <div className="mt-4 flex items-center">
            {doneArts.slice(0, STACK_MAX).map((art, k) => {
              const h = hashHue(art.title)
              return (
                <span
                  key={k}
                  title={art.title}
                  className="relative h-12 w-8 flex-shrink-0 overflow-hidden rounded-[5px] ring-2 ring-[#0b0b0e]"
                  style={{ marginLeft: k === 0 ? 0 : -10, zIndex: STACK_MAX - k, background: `linear-gradient(135deg, hsl(${h} 52% 40%), hsl(${(h + 32) % 360} 55% 27%))` }}
                >
                  {art.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={art.coverUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </span>
              )
            })}
            {doneArts.length > STACK_MAX && <span className="ml-2 text-xs font-medium text-white/60">+{doneArts.length - STACK_MAX}</span>}
          </div>
        )}

        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-medium text-white/60 transition-colors group-hover:text-white">
          {t('open')}
          <IoArrowForward className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>

      {peek && peekArt && (
        <BookPeek
          art={peekArt}
          prompt={prompt ? cells?.[peek.i]?.title : undefined}
          ticked={!prompt && !!mask[peek.i]}
          style={{ left: peek.left, top: peek.top, transform: peek.above ? 'translateY(-100%)' : undefined }}
        />
      )}
    </div>
  )
}

const TYPE_ICON = { book: IoBookOutline, movie: IoFilmOutline, series: IoTvOutline } as const

/** The hovered square's book: cover, title, author, year and type (plus the prompt it answers). */
function BookPeek({ art, prompt, ticked, style }: { art: BingoCell; prompt?: string; ticked: boolean; style: React.CSSProperties }) {
  const { t } = useLanguage()
  const Icon = art.type ? TYPE_ICON[art.type] : null
  const typeLabel = art.type === 'book' ? t('book') : art.type === 'series' ? t('series') : art.type === 'movie' ? t('film') : ''
  const h = hashHue(art.title)
  return (
    <div
      className="pointer-events-none absolute z-20 flex gap-3 rounded-xl border border-white/10 bg-[#141417]/95 p-2.5 text-left shadow-2xl backdrop-blur"
      style={{ width: PEEK_W, ...style }}
      role="tooltip"
    >
      <div className="relative h-[72px] w-12 flex-shrink-0 overflow-hidden rounded-md" style={{ background: `linear-gradient(135deg, hsl(${h} 52% 40%), hsl(${(h + 32) % 360} 55% 27%))` }}>
        {art.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          Icon && <Icon className="absolute inset-0 m-auto h-5 w-5 text-white/60" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {prompt && <p className="mb-0.5 line-clamp-2 text-[10px] font-medium uppercase tracking-wide text-white/50">{prompt}</p>}
        <p className="line-clamp-3 text-sm font-semibold leading-snug text-white">{art.title}</p>
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
  )
}
