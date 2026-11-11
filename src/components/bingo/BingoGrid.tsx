'use client'

import { IoAdd, IoBookOutline, IoCheckmark, IoFilmOutline, IoStar, IoTvOutline } from 'react-icons/io5'
import { BINGO_CELLS, BINGO_CENTER, BINGO_SIZE, isTicked, type BingoCell } from '@/lib/bingo'
import { hashHue } from '@/lib/hashHue'
import { useLanguage } from '@/contexts/LanguageContext'

type Props = {
  cells: (BingoCell | null)[]
  freeCenter: boolean
  /** Ticked squares; omit for a plain (non-playable) view. */
  marks?: boolean[]
  /** Squares that belong to a completed line. */
  winning?: Set<number>
  /** `mini` is the card preview: no text, tighter gaps. */
  variant?: 'mini' | 'full'
  /** Editor: the square currently being edited. */
  selected?: number | null
  /** Makes the squares clickable (play to tick, or edit to pick). */
  onCell?: (i: number) => void
  /** Editor: shows a "+" in empty squares. */
  editing?: boolean
}

const TYPE_ICON = { book: IoBookOutline, movie: IoFilmOutline, series: IoTvOutline } as const

function tileBackground(title: string) {
  const h = hashHue(title)
  return `linear-gradient(135deg, hsl(${h} 52% 40%), hsl(${(h + 32) % 360} 55% 27%))`
}

export default function BingoGrid({ cells, freeCenter, marks, winning, variant = 'full', selected, onCell, editing }: Props) {
  const { t } = useLanguage()
  const mini = variant === 'mini'

  return (
    <div
      className={`grid w-full ${mini ? 'gap-[3px]' : 'gap-1.5 sm:gap-2'}`}
      style={{ gridTemplateColumns: `repeat(${BINGO_SIZE}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: BINGO_CELLS }, (_, i) => {
        const cell = cells[i]
        const free = freeCenter && i === BINGO_CENTER
        const ticked = marks ? isTicked(marks, i, freeCenter) : false
        const won = winning?.has(i)
        const Icon = cell?.type ? TYPE_ICON[cell.type] : null

        const base = `relative aspect-square overflow-hidden text-left ${mini ? 'rounded-[3px]' : 'rounded-lg sm:rounded-xl'}`
        const ring = selected === i ? 'ring-2 ring-nonsprimary ring-offset-2 ring-offset-[var(--container)]' : won ? 'ring-2 ring-nonspremium' : ''
        const label = free ? t('bingoFree') : cell?.title || t('bingoEmptySquare')

        const content = free ? (
          <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-[var(--primary-soft)] text-nonsprimary ring-1 ring-inset ring-[var(--primary-ring)]">
            <IoStar className={mini ? 'h-2.5 w-2.5' : 'h-5 w-5'} />
            {!mini && <span className="text-[9px] font-bold uppercase tracking-wider sm:text-[10px]">{t('bingoFree')}</span>}
          </span>
        ) : cell ? (
          <>
            {cell.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cell.coverUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0" style={{ background: tileBackground(cell.title) }} />
            )}
            {!mini && (
              <>
                {cell.coverUrl && <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />}
                {Icon && !cell.coverUrl && <Icon className="absolute left-1 top-1 h-3 w-3 text-white/60 sm:left-1.5 sm:top-1.5 sm:h-3.5 sm:w-3.5" />}
                <span
                  className={`absolute inset-x-0 bottom-0 p-1 text-[9px] font-semibold leading-tight text-white sm:p-1.5 sm:text-[11px] ${
                    cell.coverUrl ? 'line-clamp-2' : 'top-0 flex items-center justify-center text-center line-clamp-5'
                  }`}
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,.6)' }}
                >
                  {cell.title}
                </span>
              </>
            )}
          </>
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center border border-dashed border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] ${
              mini ? 'rounded-[3px]' : 'rounded-lg sm:rounded-xl'
            }`}
          >
            {editing && !mini && <IoAdd className="h-5 w-5" />}
          </span>
        )

        const tick = ticked && !free && (
          <span className={`absolute inset-0 flex items-center justify-center bg-black/55 ${won ? 'bg-nonspremium/40' : ''}`}>
            <span className={`flex items-center justify-center rounded-full bg-nonsprimary text-white shadow-lg ${mini ? 'h-2 w-2' : 'h-6 w-6 sm:h-8 sm:w-8'}`}>
              <IoCheckmark className={mini ? 'h-1.5 w-1.5' : 'h-4 w-4 sm:h-5 sm:w-5'} />
            </span>
          </span>
        )

        if (!onCell || mini) {
          return (
            <div key={i} className={`${base} ${ring}`} title={mini ? undefined : label}>
              {content}
              {tick}
            </div>
          )
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => onCell(i)}
            aria-label={label}
            aria-pressed={marks ? ticked : undefined}
            className={`${base} ${ring} transition-transform hover:scale-[1.03] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-nonsprimary`}
          >
            {content}
            {tick}
          </button>
        )
      })}
    </div>
  )
}
