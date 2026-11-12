import { centerIndex, type BingoCell, type BingoKind } from '@/lib/bingo'
import { hashHue } from '@/lib/hashHue'

// Draws a bingo board straight onto a canvas. Boards can be up to 100×100, far
// too many squares to render (or screenshot) as DOM nodes on a share card or a
// list preview, so big boards are shown as a pixel mosaic instead: one block per
// square, coloured from its title, with ticks and completed lines marked.

type Opts = {
  rows: number
  cols: number
  cells: (BingoCell | null)[]
  kind: BingoKind
  freeCenter: boolean
  /** Squares that are done (ticked, or answered). */
  mask: boolean[]
  /** Prompt boards: the player's answers. */
  answers?: (BingoCell | null)[] | null
  /** Pixels per square. */
  px: number
}

export function boardImage({ rows, cols, cells, kind, freeCenter, mask, answers, px }: Opts): string {
  const canvas = document.createElement('canvas')
  canvas.width = cols * px
  canvas.height = rows * px
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const gap = px >= 8 ? 2 : px >= 4 ? 1 : 0
  const size = px - gap
  const centre = freeCenter ? centerIndex(rows, cols) : null

  ctx.fillStyle = '#0d0d0e'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let i = 0; i < rows * cols; i++) {
    const x = (i % cols) * px
    const y = Math.floor(i / cols) * px
    const prompt = kind === 'prompt'
    const art = prompt ? answers?.[i] ?? null : cells[i]
    const done = !!mask[i]

    if (i === centre) ctx.fillStyle = '#3a3b6a'
    else if (art) {
      const h = hashHue(art.title)
      ctx.fillStyle = `hsl(${h} 52% ${!prompt && done ? 20 : 38}%)`
    } else ctx.fillStyle = prompt && cells[i] ? '#2a2a30' : '#1c1c20'
    ctx.fillRect(x, y, size, size)

    // ticked on a checklist: a primary dot on the darkened square
    if (!prompt && done && i !== centre && px >= 5) {
      ctx.fillStyle = '#6768ab'
      const d = Math.max(2, Math.floor(size / 2))
      ctx.fillRect(x + Math.floor((size - d) / 2), y + Math.floor((size - d) / 2), d, d)
    }
  }
  return canvas.toDataURL('image/png')
}
