// A decorative bookshelf illustration: a plank with 12 books arranged in three
// groups — a leaning tower of lying books on the left, four standing books in
// the centre, and a stacked-plus-leaning arrangement on the right.
//
// Drawn as SVG on a 320x100 viewBox (16:5) so every position is relative and
// scales with the container; `non-scaling-stroke` keeps the outline an even
// weight at any size. Each book carries a title and is tinted with the dominant
// colour extracted from its cover image.

import { useEffect, useState } from 'react'

const STROKE = 'white'

// Shared rectangle props: rounded outline with a constant stroke weight.
const book = {
  strokeWidth: 1.6,
  vectorEffect: 'non-scaling-stroke' as const,
  rx: 1.5,
}

// Where the books rest — the top surface of the plank. Kept close to the bottom
// of the (short) viewBox so the arrangement fills the height instead of leaving
// a tall empty band above it.
const FLOOR = 56

export type ShelfBook = { title: string; coverUrl?: string }

type Slot = {
  x: number
  y: number
  width: number
  height: number
  // 'v' = spine text runs bottom-to-top (standing/leaning books);
  // 'h' = text runs left-to-right (lying books).
  orient: 'v' | 'h'
  // Optional SVG transform (used to tilt the leaning books).
  rotate?: string
}

// The 12 book positions, keyed by group + index.
const SLOTS: Record<string, Slot> = {
  // Left — tower of lying books, each higher one shifted right (L0 is on the plank).
  L0: { x: 14, y: FLOOR - 8, width: 44, height: 8, orient: 'h' },
  L1: { x: 20, y: FLOOR - 16, width: 44, height: 8, orient: 'h' },
  L2: { x: 26, y: FLOOR - 24, width: 44, height: 8, orient: 'h' },
  L3: { x: 32, y: FLOOR - 32, width: 44, height: 8, orient: 'h' },
  // Center — standing books of differing heights.
  C0: { x: 138, y: FLOOR - 46, width: 9, height: 46, orient: 'v' },
  C1: { x: 149, y: FLOOR - 34, width: 9, height: 34, orient: 'v' },
  C2: { x: 160, y: FLOOR - 42, width: 9, height: 42, orient: 'v' },
  C3: { x: 171, y: FLOOR - 30, width: 9, height: 30, orient: 'v' },
  // Right — two lying books stacked (the "bottom" pair).
  Rb0: { x: 217, y: FLOOR - 10, width: 42, height: 10, orient: 'h' },
  Rb1: { x: 214, y: FLOOR - 22, width: 42, height: 12, orient: 'h' },
  // Right — two books leaning left, rotating about where they touch the plank.
  Rl0: { x: 260, y: FLOOR - 50, width: 9, height: 50, orient: 'v', rotate: `rotate(-10 259 ${FLOOR})` },
  Rl1: { x: 275, y: FLOOR - 44, width: 9, height: 46, orient: 'v', rotate: `rotate(-17 267 ${FLOOR})` },
}

// The order titles from `books` fill the slots:
// centre 3, left 2, right bottom pair, centre again, left 1, right leaning pair, left 1 more.
const FILL_ORDER = ['C0', 'C1', 'C2', 'L0', 'L1', 'Rb0', 'Rb1', 'C3', 'L2', 'Rl0', 'Rl1', 'L3'] as const

// Pull a representative colour out of a loaded cover, favouring saturated pixels
// so the tint reads as the book's "main" colour rather than a muddy average.
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
    // Cross-origin cover without CORS headers taints the canvas — give up quietly.
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
    // Weight strongly toward saturated pixels, with a small floor so flat
    // covers still contribute.
    const w = sat * sat + 0.04
    r += R * w
    g += G * w
    b += B * w
    total += w
  }
  if (!total) return undefined
  const to = (v: number) => Math.round(v / total).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

// Load each cover once and resolve its dominant colour. Re-runs when the set of
// cover URLs changes.
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

function Book({ id, slot, name, color }: { id: string; slot: Slot; name?: string; color?: string }) {
  const { x, y, width, height, orient, rotate } = slot
  const cx = x + width / 2
  const cy = y + height / 2
  const clipId = `shelf12-clip-${id}`
  const stroke = color ?? STROKE
  return (
    <g transform={rotate}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        {...book}
        stroke={stroke}
        fill={color ?? 'none'}
        fillOpacity={color ? 0.35 : undefined}
      />
      {name && (
        <>
          {/* Clip the title to the spine so long names don't spill out. */}
          <clipPath id={clipId}>
            <rect x={x} y={y} width={width} height={height} rx={1.5} />
          </clipPath>
          <text
            x={cx}
            y={cy}
            clipPath={`url(#${clipId})`}
            fill={STROKE}
            fontSize={4}
            textAnchor="middle"
            dominantBaseline="central"
            transform={orient === 'v' ? `rotate(-90 ${cx} ${cy})` : undefined}
            style={{ fontFamily: 'inherit', fontWeight: 500, letterSpacing: '0.02em' }}
          >
            {name}
          </text>
        </>
      )}
    </g>
  )
}

export default function Shelf12({ books = [] }: { books?: ShelfBook[] }) {
  const colors = useCoverColors(FILL_ORDER.map((_, i) => books[i]?.coverUrl))
  return (
    <svg viewBox="0 0 320 63" className="h-full w-full" preserveAspectRatio="xMidYMax meet">
      {/* Base plank — long thin rectangle spanning the bottom */}
      <rect x={6} y={FLOOR} width={308} height={6} {...book} stroke={STROKE} fill="none" />

      {FILL_ORDER.map((key, i) => (
        <Book key={key} id={key} slot={SLOTS[key]} name={books[i]?.title} color={colors[i]} />
      ))}
    </svg>
  )
}
