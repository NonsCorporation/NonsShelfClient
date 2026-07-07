// A decorative bookshelf illustration: a plank with 12 books arranged in three
// groups — a leaning tower of lying books on the left, four standing books in
// the centre, and a stacked-plus-leaning arrangement on the right.
//
// Drawn as SVG on a 212x63 viewBox so every position is relative and scales with
// the container; `non-scaling-stroke` keeps the outline an even weight at any
// size. Each book's spine shows a slightly-blurred slice of its cover — a thin
// standing book naturally reveals a vertical strip, a lying book a horizontal
// band — with the title laid over it.

import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from '@/lib/router'
import { IoStar } from 'react-icons/io5'

const STROKE = 'white'

// Shared rectangle props: rounded outline with a constant stroke weight.
const book = {
  strokeWidth: 2,
  vectorEffect: 'non-scaling-stroke' as const,
  rx: 1.5,
}

// Where the books rest — the top surface of the plank. Kept close to the bottom
// of the (short) viewBox so the arrangement fills the height instead of leaving
// a tall empty band above it.
const FLOOR = 56

export type ShelfBook = {
  title: string
  author?: string
  year?: number
  coverUrl?: string
  rating?: number
  href?: string
}

// viewBox dimensions — used to map book positions to overlay percentages.
const VB_W = 212
const VB_H = 63

type Slot = {
  x: number
  y: number
  width: number
  height: number
  // 'v' = spine text runs bottom-to-top (standing/leaning books);
  // 'h' = text runs left-to-right (lying books).
  orient: 'v' | 'h'
  // Optional lean: degrees plus the pivot point it rotates about (a leaning
  // book pivots on the corner touching the plank). Shared by the SVG rect and
  // the HTML hover hotspot so both tilt identically.
  tilt?: { deg: number; px: number; py: number }
}

// The 12 book positions, keyed by group + index. The three groups are packed
// close together so the whole shelf reads at a glance without scrolling.
const SLOTS: Record<string, Slot> = {
  // Left — tower of lying books, each higher one shifted right (L0 is on the plank).
  L0: { x: 8, y: FLOOR - 8, width: 44, height: 8, orient: 'h' },
  L1: { x: 14, y: FLOOR - 16, width: 44, height: 8, orient: 'h' },
  L2: { x: 20, y: FLOOR - 24, width: 44, height: 8, orient: 'h' },
  L3: { x: 26, y: FLOOR - 32, width: 44, height: 8, orient: 'h' },
  // Center — standing books of differing heights.
  C0: { x: 80, y: FLOOR - 46, width: 9, height: 46, orient: 'v' },
  C1: { x: 91, y: FLOOR - 34, width: 9, height: 34, orient: 'v' },
  C2: { x: 102, y: FLOOR - 42, width: 9, height: 42, orient: 'v' },
  C3: { x: 113, y: FLOOR - 30, width: 9, height: 30, orient: 'v' },
  // Right — two lying books stacked (the "bottom" pair).
  Rb0: { x: 137, y: FLOOR - 10, width: 42, height: 10, orient: 'h' },
  Rb1: { x: 134, y: FLOOR - 22, width: 42, height: 12, orient: 'h' },
  // Right — two books leaning left, rotating about where they touch the plank.
  Rl0: { x: 180, y: FLOOR - 50, width: 9, height: 50, orient: 'v', tilt: { deg: -10, px: 179, py: FLOOR } },
  Rl1: { x: 195, y: FLOOR - 44, width: 9, height: 46, orient: 'v', tilt: { deg: -17, px: 187, py: FLOOR } },
}

// The order titles from `books` fill the slots:
// centre 3, left 2, right bottom pair, centre again, left 1, right leaning pair, left 1 more.
const FILL_ORDER = ['C0', 'C1', 'C2', 'L0', 'L1', 'Rb0', 'Rb1', 'C3', 'L2', 'Rl0', 'Rl1', 'L3'] as const

const hex2 = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')

// Drive a colour to full saturation (keeping hue and lightness) so the extracted
// average becomes a vivid, clearly-visible outline.
function vivid(r: number, g: number, b: number): string {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  // Moderate saturation, with lightness held in a mid-range so pale or near-black
  // covers still yield a colour you can see — muted rather than neon.
  const s = 0.5
  const ll = Math.max(0.45, Math.min(0.62, l))
  const c = (1 - Math.abs(2 * ll - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ll - c / 2
  let rr = 0
  let gg = 0
  let bb = 0
  if (h < 60) [rr, gg, bb] = [c, x, 0]
  else if (h < 120) [rr, gg, bb] = [x, c, 0]
  else if (h < 180) [rr, gg, bb] = [0, c, x]
  else if (h < 240) [rr, gg, bb] = [0, x, c]
  else if (h < 300) [rr, gg, bb] = [x, 0, c]
  else [rr, gg, bb] = [c, 0, x]
  return `#${hex2((rr + m) * 255)}${hex2((gg + m) * 255)}${hex2((bb + m) * 255)}`
}

// Saturation-weighted average of a loaded cover, boosted to a vivid accent.
function dominantColor(img: HTMLImageElement): string | undefined {
  const size = 24
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  ctx.drawImage(img, 0, 0, size, size)
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, size, size).data
  } catch {
    return undefined
  }
  let r = 0
  let g = 0
  let b = 0
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    const R = data[i]
    const G = data[i + 1]
    const B = data[i + 2]
    if (data[i + 3] < 125) continue
    const max = Math.max(R, G, B)
    const min = Math.min(R, G, B)
    const sat = max === 0 ? 0 : (max - min) / max
    const w = sat * sat + 0.04
    r += R * w
    g += G * w
    b += B * w
    total += w
  }
  if (!total) return undefined
  return vivid(r / total, g / total, b / total)
}

// Load each cover once and resolve its accent colour; re-runs when URLs change.
function useCoverColors(urls: (string | undefined)[]): (string | undefined)[] {
  const key = urls.join('|')
  const [colors, setColors] = useState<(string | undefined)[]>([])
  useEffect(() => {
    let cancelled = false
    const result: (string | undefined)[] = urls.map(() => undefined)
    urls.forEach((url, i) => {
      if (!url) return
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (cancelled) return
        result[i] = dominantColor(img)
        setColors([...result])
      }
      img.src = url
    })
    setColors(result)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return colors
}

function Book({ id, slot, name, coverUrl, color }: { id: string; slot: Slot; name?: string; coverUrl?: string; color?: string }) {
  const { x, y, width, height, orient, tilt } = slot
  const cx = x + width / 2
  const cy = y + height / 2
  const clipId = `shelf12-clip-${id}`
  const rotate = tilt ? `rotate(${tilt.deg} ${tilt.px} ${tilt.py})` : undefined
  return (
    <g transform={rotate} filter="url(#shelf12-shadow)">
      {/* Clip everything (cover slice, scrim, title) to the rounded spine. */}
      <clipPath id={clipId}>
        <rect x={x} y={y} width={width} height={height} rx={1.5} />
      </clipPath>

      {coverUrl && (
        <g clipPath={`url(#${clipId})`}>
          {/* `slice` fills the spine and crops the cover, so a thin book shows a
              vertical strip and a lying book a horizontal band — a natural slice. */}
          <image
            href={coverUrl}
            x={x}
            y={y}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMid slice"
            filter="url(#shelf12-blur)"
          />
          {/* Gentle scrim so the title stays legible over any cover. */}
          <rect x={x} y={y} width={width} height={height} fill="#000" opacity={0.28} />
        </g>
      )}

      {/* Outline — the cover's vivid accent colour, white until it resolves. */}
      <rect x={x} y={y} width={width} height={height} {...book} stroke={color ?? STROKE} fill="none" />

      {name && (
        <text
          x={cx}
          y={cy}
          clipPath={`url(#${clipId})`}
          fill={STROKE}
          fontSize={4}
          textAnchor="middle"
          dominantBaseline="central"
          transform={orient === 'v' ? `rotate(-90 ${cx} ${cy})` : undefined}
          style={{
            fontFamily: 'inherit',
            fontWeight: 500,
            letterSpacing: '0.02em',
            paintOrder: 'stroke',
            stroke: 'rgba(0,0,0,0.5)',
            strokeWidth: 0.5,
            strokeLinejoin: 'round',
          }}
        >
          {name}
        </text>
      )}
    </g>
  )
}

// Floating preview shown while a book is hovered — the "full card" of the item.
function PreviewCard({ book, slot }: { book: ShelfBook; slot: Slot }) {
  const centerX = ((slot.x + slot.width / 2) / VB_W) * 100
  const topPct = (slot.y / VB_H) * 100
  // Anchor above the book; clamp horizontally so edge books don't overflow.
  const left = Math.max(18, Math.min(82, centerX))
  return (
    <div
      className="pointer-events-none absolute z-20 w-40 -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--container)] p-2.5 shadow-xl"
      style={{ left: `${left}%`, bottom: `calc(${100 - topPct}% + 8px)` }}
    >
      <div className="flex gap-2.5">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt="" className="h-16 w-11 flex-shrink-0 rounded-md object-cover" />
        ) : (
          <div className="h-16 w-11 flex-shrink-0 rounded-md bg-[var(--container-2)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-[var(--text)]">{book.title}</p>
          {book.author && <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{book.author}</p>}
          <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            {book.year && <span>{book.year}</span>}
            {typeof book.rating === 'number' && book.rating > 0 && (
              <span className="flex items-center gap-0.5">
                <IoStar className="h-2.5 w-2.5 text-nonsprimaryfocus" />
                {(book.rating / 2).toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Shelf12({ books = [] }: { books?: ShelfBook[] }) {
  const colors = useCoverColors(FILL_ORDER.map((_, i) => books[i]?.coverUrl))
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div className="relative w-full">
      {/* The illustration itself, clipped to a rounded, softly-lit niche. */}
      <div className="relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-gradient-to-b from-[var(--container-2)] to-[var(--surface)] shadow-[inset_0_2px_18px_rgba(0,0,0,0.28)]">
        {/* Warm spotlight from above + vignette toward the edges for depth. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_120%,rgba(0,0,0,0.28),transparent_55%)]" />
        <svg viewBox="0 0 212 63" className="relative block h-auto w-full" preserveAspectRatio="xMidYMax meet">
          <defs>
            {/* Slight blur on the cover slices so they read as soft spines. */}
            <filter id="shelf12-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.5" />
            </filter>
            {/* Soft shadow that grounds each book on the shelf. */}
            <filter id="shelf12-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0.7" stdDeviation="0.7" floodColor="#000" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Base plank — long thin rectangle spanning the bottom */}
          <rect x={4} y={FLOOR} width={204} height={6} {...book} stroke={STROKE} fill="none" />

          {FILL_ORDER.map((key, i) => (
            <Book key={key} id={key} slot={SLOTS[key]} name={books[i]?.title} coverUrl={books[i]?.coverUrl} color={colors[i]} />
          ))}
        </svg>
      </div>

      {/* HTML hotspots laid over each book: click opens the full page, hover previews. */}
      {FILL_ORDER.map((key, i) => {
        const b = books[i]
        if (!b) return null
        const s = SLOTS[key]
        const style: CSSProperties = {
          left: `${(s.x / VB_W) * 100}%`,
          top: `${(s.y / VB_H) * 100}%`,
          width: `${(s.width / VB_W) * 100}%`,
          height: `${(s.height / VB_H) * 100}%`,
        }
        if (s.tilt) {
          style.transform = `rotate(${s.tilt.deg}deg)`
          style.transformOrigin = `${((s.tilt.px - s.x) / s.width) * 100}% ${((s.tilt.py - s.y) / s.height) * 100}%`
        }
        const target = (
          <div
            className="h-full w-full cursor-pointer"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
          />
        )
        return (
          <div key={key} className="absolute" style={style}>
            {b.href ? (
              <Link to={b.href} className="block h-full w-full" title={b.title}>
                {target}
              </Link>
            ) : (
              target
            )}
          </div>
        )
      })}

      {hovered != null && books[hovered] && (
        <PreviewCard book={books[hovered]} slot={SLOTS[FILL_ORDER[hovered]]} />
      )}
    </div>
  )
}
