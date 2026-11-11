'use client'

import { memo, useMemo } from 'react'
import { IoAdd, IoBookOutline, IoCheckmark, IoFilmOutline, IoStar, IoTvOutline } from 'react-icons/io5'
import { centerIndex, type BingoCell, type BingoKind } from '@/lib/bingo'
import { boardImage } from '@/lib/bingoImage'
import { hashHue } from '@/lib/hashHue'
import { useLanguage } from '@/contexts/LanguageContext'

type Props = {
  rows: number
  cols: number
  /** The board's squares: items to tick (`list`) or prompts to answer (`prompt`). */
  cells: (BingoCell | null)[]
  freeCenter: boolean
  /** How the squares behave. The editor omits this and just shows `cells` as-is. */
  kind?: BingoKind
  /** Squares that are done (ticked, or answered); the free centre is included. */
  mask?: boolean[]
  /** `prompt` boards: the player's picks, one per square. */
  answers?: (BingoCell | null)[] | null
  /** Squares that belong to a completed line. */
  winning?: Set<number>
  /** `mini` is the card preview: no text, tighter gaps. */
  variant?: 'mini' | 'full'
  /** Editor: the square currently being edited. */
  selected?: number | null
  /** Makes the squares clickable (tick, answer, or edit). */
  onCell?: (i: number) => void
  /** Editor: shows a "+" in empty squares. */
  editing?: boolean
}

const TYPE_ICON = { book: IoBookOutline, movie: IoFilmOutline, series: IoTvOutline } as const

function tileBackground(title: string) {
  const h = hashHue(title)
  return `linear-gradient(135deg, hsl(${h} 52% 40%), hsl(${(h + 32) % 360} 55% 27%))`
}

type CellProps = {
  i: number
  cell: BingoCell | null
  art: BingoCell | null
  free: boolean
  done: boolean
  won: boolean
  selected: boolean
  prompt: boolean
  mini: boolean
  /** Too small for text or icons (big boards). */
  dense: boolean
  editing: boolean
  interactive: boolean
  freeLabel: string
  emptyLabel: string
}

const Cell = memo(function Cell({ i, cell, art, free, done, won, selected, prompt, mini, dense, editing, interactive, freeLabel, emptyLabel }: CellProps) {
  const small = mini || dense
  const radius = dense ? 'rounded-[2px]' : mini ? 'rounded-[3px]' : 'rounded-lg sm:rounded-xl'
  const Icon = art?.type ? TYPE_ICON[art.type] : null
  const label = free ? freeLabel : prompt ? `${cell?.title ?? ''}${art ? ` — ${art.title}` : ''}` : cell?.title || emptyLabel
  const ring = selected ? 'ring-2 ring-nonsprimary ring-offset-1 ring-offset-[var(--container)]' : won ? 'ring-2 ring-nonspremium' : ''

  let content: React.ReactNode
  if (free) {
    content = (
      <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-[var(--primary-soft)] text-nonsprimary ring-1 ring-inset ring-[var(--primary-ring)]">
        {!dense && <IoStar className={small ? 'h-2.5 w-2.5' : 'h-5 w-5'} />}
        {!small && <span className="text-[9px] font-bold uppercase tracking-wider sm:text-[10px]">{freeLabel}</span>}
      </span>
    )
  } else if (art) {
    content = (
      <>
        {art.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art.coverUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0" style={{ background: tileBackground(art.title) }} />
        )}
        {!small && (
          <>
            {art.coverUrl && <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />}
            {Icon && !art.coverUrl && !prompt && <Icon className="absolute left-1 top-1 h-3 w-3 text-white/60 sm:left-1.5 sm:top-1.5 sm:h-3.5 sm:w-3.5" />}
            {prompt && cell && (
              <span className="absolute inset-x-0 top-0 line-clamp-2 bg-black/45 px-1 py-0.5 text-[8px] font-medium leading-tight text-white/85 sm:px-1.5 sm:text-[9px]">
                {cell.title}
              </span>
            )}
            <span
              className={`absolute inset-x-0 bottom-0 p-1 text-[9px] font-semibold leading-tight text-white sm:p-1.5 sm:text-[11px] ${
                art.coverUrl || prompt ? 'line-clamp-2' : 'top-0 flex items-center justify-center text-center line-clamp-5'
              }`}
              style={{ textShadow: '0 1px 2px rgba(0,0,0,.6)' }}
            >
              {art.title}
            </span>
          </>
        )}
      </>
    )
  } else if (prompt && cell) {
    // A prompt waiting for the player's answer.
    content = (
      <span className={`flex h-full w-full flex-col items-center justify-center gap-1 border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-1 text-center ${radius}`}>
        {!small && (
          <>
            <span className="line-clamp-4 text-[9px] font-medium leading-tight text-[var(--text)] sm:text-[11px]">{cell.title}</span>
            <IoAdd className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-muted)]" />
          </>
        )}
      </span>
    )
  } else {
    content = (
      <span className={`flex h-full w-full items-center justify-center border border-dashed border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] ${radius}`}>
        {editing && !small && <IoAdd className="h-5 w-5" />}
      </span>
    )
  }

  // Checklists darken a ticked square; prompt boards just badge an answered one.
  const tick =
    done && !free && !prompt ? (
      <span className={`absolute inset-0 flex items-center justify-center bg-black/55 ${won ? 'bg-nonspremium/40' : ''}`}>
        {!dense && (
          <span className={`flex items-center justify-center rounded-full bg-nonsprimary text-white shadow-lg ${mini ? 'h-2 w-2' : 'h-6 w-6 sm:h-8 sm:w-8'}`}>
            <IoCheckmark className={mini ? 'h-1.5 w-1.5' : 'h-4 w-4 sm:h-5 sm:w-5'} />
          </span>
        )}
      </span>
    ) : done && !free && prompt && !small ? (
      <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-nonsprimary text-white shadow sm:h-5 sm:w-5">
        <IoCheckmark className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      </span>
    ) : null

  return (
    <div
      data-i={i}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive && !dense ? 0 : undefined}
      aria-label={interactive ? label : undefined}
      aria-pressed={interactive && !prompt ? done : undefined}
      title={small ? undefined : label}
      className={`relative aspect-square overflow-hidden text-left ${radius} ${ring} ${
        interactive ? 'cursor-pointer transition-transform hover:scale-[1.03] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-nonsprimary' : ''
      }`}
    >
      {content}
      {tick}
    </div>
  )
})

export default function BingoGrid({
  rows,
  cols,
  cells,
  freeCenter,
  kind = 'list',
  mask,
  answers,
  winning,
  variant = 'full',
  selected,
  onCell,
  editing,
}: Props) {
  const { t } = useLanguage()
  const mini = variant === 'mini'
  const prompt = kind === 'prompt' && !editing
  // Past ~12 squares a side there is no room for text, and past 40 even gaps go.
  const dense = !mini && (cols > 12 || rows > 12)
  const gap = cols > 40 ? 'gap-0' : cols > 12 || mini ? 'gap-px' : 'gap-1.5 sm:gap-2'
  const centre = freeCenter ? centerIndex(rows, cols) : null
  const freeLabel = t('bingoFree')
  const emptyLabel = t('bingoEmptySquare')

  const click = (e: React.SyntheticEvent) => {
    if (!onCell) return
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
    if (el) onCell(Number(el.dataset.i))
  }

  return (
    <div
      className={`grid w-full ${gap}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      onClick={onCell && !mini ? click : undefined}
      onKeyDown={
        onCell && !mini
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                click(e)
              }
            }
          : undefined
      }
    >
      {Array.from({ length: rows * cols }, (_, i) => {
        const cell = cells[i] ?? null
        return (
          <Cell
            key={i}
            i={i}
            cell={cell}
            art={prompt ? answers?.[i] ?? null : cell}
            free={i === centre}
            done={!!mask?.[i]}
            won={!!winning?.has(i)}
            selected={selected === i}
            prompt={prompt}
            mini={mini}
            dense={dense}
            editing={!!editing}
            interactive={!!onCell && !mini}
            freeLabel={freeLabel}
            emptyLabel={emptyLabel}
          />
        )
      })}
    </div>
  )
}

/**
 * A board shown small (list cards): a real mini grid when it is small enough, a
 * pixel mosaic for big boards, always keeping the board's proportions.
 */
export function BoardPreview(props: Omit<Props, 'variant' | 'onCell' | 'editing' | 'selected'>) {
  const { rows, cols, cells, kind = 'list', freeCenter, mask, answers, winning } = props
  const big = rows * cols > 100
  const src = useMemo(
    () =>
      big
        ? boardImage({ rows, cols, cells, kind, freeCenter, mask: mask ?? [], answers, winning, px: Math.max(2, Math.floor(240 / Math.max(rows, cols))) })
        : '',
    [big, rows, cols, cells, kind, freeCenter, mask, answers, winning],
  )
  const wide = cols >= rows
  return (
    <div className="flex aspect-square w-full items-center justify-center">
      <div style={wide ? { width: '100%' } : { height: '100%', aspectRatio: `${cols} / ${rows}` }}>
        {big ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" style={{ imageRendering: 'pixelated', width: '100%', aspectRatio: `${cols} / ${rows}` }} className="block rounded-[3px]" />
        ) : (
          <BingoGrid {...props} variant="mini" />
        )}
      </div>
    </div>
  )
}
