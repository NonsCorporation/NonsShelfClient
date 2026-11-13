'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toPng } from 'html-to-image'
import {
  IoCheckmark,
  IoClose,
  IoCopyOutline,
  IoDownloadOutline,
  IoLogoFacebook,
  IoLogoTwitter,
  IoLogoWhatsapp,
  IoShareSocialOutline,
} from 'react-icons/io5'
import { FaTelegram } from 'react-icons/fa'
import ShelfLogo from '@/components/branding/ShelfLogo'
import { centerIndex, type Bingo, type BingoCell } from '@/lib/bingo'
import { boardImage } from '@/lib/bingoImage'
import { useCoverInfos } from '@/lib/bingoCovers'
import { hashHue } from '@/lib/hashHue'
import { useLanguage } from '@/contexts/LanguageContext'

// Fixed dark palette so the exported image looks the same whatever theme the
// app is in — same convention as ProfileShareModal / ShareModal.
const BG = '#050507'
const INK = '#ffffff'
const PRIMARY = '#6768ab'

// 9:16 story card, exported at pixelRatio 3 (1080×1920).
const CARD_W = 360
const CARD_H = 640
// The board gets a box this big, whatever its shape.
const CARD_PAD_X = 10
const CARD_PAD_Y = 14
const AREA_W = CARD_W - CARD_PAD_X * 2
const AREA_H = 556
// Cover shape (height / width) and caption height on prompt boards.
const COVER_RATIO = 1.15
const GAP = 6
// Above this many squares the board is drawn as a pixel mosaic instead of DOM nodes.
const MOSAIC_OVER = 400

type Props = {
  board: Bingo
  /** Squares that are done (ticked on a checklist, answered on a prompt board). */
  mask: boolean[]
  /** Prompt boards: the picks shown on the card. */
  answers: (BingoCell | null)[] | null
  /** The link people open to play. */
  link: string
  /** False when the board was too big to put into the link itself. */
  embedded: boolean
  /** Squares in a completed line get a gold frame. */
  winning: Set<number>
  onClose: () => void
}

async function waitForImages(node: HTMLElement) {
  await Promise.all(
    Array.from(node.querySelectorAll('img')).map((img) =>
      img.complete ? Promise.resolve() : new Promise((res) => (img.onload = img.onerror = () => res(null))),
    ),
  )
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'bingo'

/** How many lines the words take at `perLine` characters per line (greedy wrap; a long word breaks). */
function countLines(words: string[], perLine: number): number {
  let lines = 1
  let used = 0
  for (const word of words) {
    if (word.length > perLine) {
      if (used > 0) lines++
      lines += Math.ceil(word.length / perLine) - 1
      used = word.length % perLine || perLine
    } else if (used === 0) used = word.length
    else if (used + 1 + word.length <= perLine) used += 1 + word.length
    else {
      lines++
      used = word.length
    }
  }
  return lines
}

/** Font size for the book title / author under a cover of this width. */
const nameFontFor = (cell: number) => Math.max(6.5, Math.min(7.5, cell * 0.14))

/**
 * Largest font size at which `text` wraps into at most `maxLines` lines inside a w×h box
 * (estimated from average glyph width). A title that still doesn't fit at the smallest
 * readable size is cropped to `maxLines` lines, which the caller ends with an ellipsis.
 */
function fitText(text: string, w: number, h: number, max = 20, min = 9, maxLines = 3): { font: number; lines: number } {
  const words = text.split(/\s+/).filter(Boolean)
  for (let f = Math.min(max, h / (maxLines * 1.15)); f >= min; f -= 0.5) {
    const perLine = Math.max(1, Math.floor(w / (f * 0.6)))
    // shrink before splitting a word across lines (only the smallest size may)
    if (f - 0.5 >= min && words.some((word) => word.length > perLine)) continue
    const lines = countLines(words, perLine)
    if (lines <= maxLines) return { font: f, lines }
  }
  return { font: min, lines: maxLines }
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const mx = Math.max(r, g, b) / 255
  const mn = Math.min(r, g, b) / 255
  const l = (mx + mn) / 2
  const d = mx - mn
  let h = 0
  if (d > 0) {
    if (mx === r / 255) h = ((g - b) / 255 / d + (g < b ? 6 : 0)) * 60
    else if (mx === g / 255) h = ((b - r) / 255 / d + 2) * 60
    else h = ((r - g) / 255 / d + 4) * 60
  }
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return [h, sat, l]
}

/** Deterministic pseudo-random numbers (mulberry32) from a string seed. */
function seededRandom(seed: string): () => number {
  let h = 1779033703
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353) << 13 | h >>> 19
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

/** Where everything goes on the card for this board: square size, gaps, captions, and whether there is room for covers and titles. */
function shareGeometry(board: Pick<Bingo, 'kind' | 'rows' | 'cols' | 'freeCenter'>, answers: (BingoCell | null)[] | null, areaH: number) {
  const prompt = board.kind === 'prompt'
  const { rows, cols } = board
  const total = rows * cols
  const centre = board.freeCenter ? centerIndex(rows, cols) : null

  // Board geometry: square cells sized to fit the box, with tighter gaps on bigger boards.
  const mosaic = total > MOSAIC_OVER
  // One constant gap, used everywhere: between columns, between rows, and between a cover and its caption.
  const gap = Math.max(rows, cols) <= 10 ? GAP : Math.max(rows, cols) <= 25 ? 2 : Math.max(rows, cols) <= 50 ? 1 : 0
  const gapY = gap
  // Prompt boards show each answer as a cover with its prompt as a caption below, as long as that
  // still leaves covers wide enough to read; bigger boards fall back to plain squares.
  const widthFit = (AREA_W - (cols - 1) * gap) / cols
  // Under each cover sits the book's title (up to three lines) and its author. The caption area is as tall
  // as the longest title on the board needs, and the same for every row.
  const captionFor = (c: number, r: number) => {
    const f = nameFontFor(c)
    const perLine = Math.max(1, Math.floor(c / (f * 0.6)))
    let need = 0
    for (let col = 0; col < cols; col++) {
      const i = r * cols + col
      const a = answers?.[i]
      if (!a || i === centre) continue
      const titleLines = Math.min(3, countLines(a.title.split(/\s+/).filter(Boolean), perLine))
      need = Math.max(need, titleLines * f * 1.15 + (a.credit ? 1 + f * 0.9 * 1.15 : 0))
    }
    return need > 0 ? Math.ceil(need) + gap : 0 // + the gap between cover and caption
  }
  const portraitFit = (() => {
    if (!prompt || mosaic) return null
    for (let c = Math.floor(widthFit); c >= 24; c--) {
      // Every row gets the same caption height (the tallest any row needs), so the rows are evenly spaced.
      const tallest = Math.max(...Array.from({ length: rows }, (_, r) => captionFor(c, r)))
      const caps = Array<number>(rows).fill(tallest)
      const height = caps.reduce((x, y) => x + y, 0) + rows * Math.round(c * COVER_RATIO) + (rows - 1) * gapY
      if (height <= areaH) return { cell: c, caps }
    }
    return null
  })()
  const portrait = !!portraitFit
  const rowCap = portraitFit?.caps ?? []
  const cell = Math.max(1, portraitFit ? portraitFit.cell : Math.floor(Math.min(widthFit, (areaH - (rows - 1) * gapY) / rows)))
  const coverH = portrait ? Math.round(cell * COVER_RATIO) : cell
  const roomy = !mosaic && cell >= (portrait ? 24 : 30) // enough room for titles and covers
  // The free centre square carries the board's title (sized to fit); boards without one show it in the header.
  const titleInCentre = centre !== null && !mosaic && cell >= 24
  return { prompt, rows, cols, total, centre, mosaic, gap, gapY, rowCap, portrait, cell, coverH, roomy, titleInCentre }
}

type CardProps = {
  board: Bingo
  mask: boolean[]
  answers: (BingoCell | null)[] | null
  winning: Set<number>
  /** Cover URL → an inlined copy of it (the export needs CORS-safe data URLs). Omit to load covers straight from their URLs. */
  covers?: Record<string, string | null>
  /** Cover URL → its vibrant colour, for the backdrop. Squares without one use their title's colour. */
  coverColors?: Record<string, [number, number, number] | null>
  cardRef?: React.Ref<HTMLDivElement>
  /** In-app use (a feed post): as tall as the board needs instead of the 9:16 story, and without the site lines. */
  compact?: boolean
}

/** The share picture itself: the board on a dark card glowing in the colours of its covers. */
export function BingoShareCard({ board, mask, answers, winning, covers, coverColors = {}, cardRef, compact = false }: CardProps) {
  const { t } = useLanguage()
  const areaH = compact ? Math.min(AREA_H, Math.round(AREA_W * (board.rows / board.cols) * (board.kind === 'prompt' ? 1.5 : 1))) : AREA_H
  const { prompt, rows, cols, total, centre, mosaic, gap, gapY, rowCap, portrait, cell, coverH, roomy, titleInCentre } = shareGeometry(board, answers, areaH)
  const coverSrc = (url?: string): string | null => (url ? (covers ? covers[url] ?? null : url) : null)
  const done = mask.reduce((n, x) => n + (x ? 1 : 0), 0)

  // Only boards too big for real squares are drawn as a mosaic.
  const mosaicSrc = mosaic
    ? boardImage({ rows, cols, cells: board.cells, kind: board.kind, freeCenter: board.freeCenter, mask, answers, px: Math.max(3, Math.floor(1000 / Math.max(rows, cols))) })
    : ''
  const mosaicScale = Math.min(AREA_W / cols, areaH / rows)

  // ── the card (inline styles only, so the capture is theme-proof) ──
  const radius = cell >= 30 ? 7 : cell >= 16 ? 3 : 1
  const cellBox = (i: number, height = cell): React.CSSProperties => ({
    position: 'relative',
    width: cell,
    height,
    borderRadius: radius,
    overflow: 'hidden',
    boxSizing: 'border-box',
  })
  const clamp = (lines: number): React.CSSProperties => ({
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical' as const,
  })
  const artBackground = (art: BingoCell) => {
    const data = coverSrc(art.coverUrl)
    if (data) return <img src={data} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    const h = hashHue(art.title)
    return <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, hsl(${h} 52% 40%), hsl(${(h + 32) % 360} 55% 27%))` }} />
  }
  const font = Math.min(11, Math.max(5.5, cell * 0.13))

  // What goes in the free centre square: the board's title, sized to fill it.
  const centreLabel = (w: number, h: number) => {
    if (!titleInCentre) return <span style={{ fontSize: Math.max(8, w * 0.3), lineHeight: 1, color: '#c9caf0' }}>★</span>
    const { font: f, lines } = fitText(board.title, w - 10, h - 10)
    return (
      <span style={{ padding: 5, fontSize: f, lineHeight: 1.15, fontWeight: 700, color: '#fff', textAlign: 'center', wordBreak: 'break-word', ...clamp(lines) }}>
        {board.title}
      </span>
    )
  }

  // Prompt boards: the prompt in the middle of the (darkened) cover, and under it the book's title and author.
  const promptFont = Math.max(6, Math.min(9.5, cell * 0.16))
  const promptLines = Math.max(3, Math.floor((coverH - 8) / (promptFont * 1.15)))
  const nameFont = nameFontFor(cell)
  const renderPortraitCell = (i: number) => {
    const cellData = board.cells[i]
    const art = answers?.[i] ?? null
    const free = i === centre
    const text = free ? t('bingoFree') : cellData?.title ?? ''
    const data = coverSrc(art?.coverUrl)
    const centred: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, textAlign: 'center' }
    return (
      <div key={i} data-i={i} style={{ width: cell, display: 'flex', flexDirection: 'column', gap }}>
        <div
          style={{
            ...cellBox(i, coverH),
            borderRadius: Math.max(2, radius - 2),
            ...(free
              ? { background: 'rgba(103,104,171,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
              : !art
                ? { background: '#18181b', border: '1px dashed #3f3f46' }
                : {}),
          }}
        >
          {free && centreLabel(cell, coverH)}
          {art && (
            <>
              {artBackground(art)}
              {data && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.62)' }} />}
              <div style={centred}>
                <span style={{ fontSize: promptFont, lineHeight: 1.15, fontWeight: 600, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.7)', ...clamp(promptLines) }}>{text}</span>
              </div>
            </>
          )}
          {!art && !free && (
            <div style={centred}>
              <span style={{ fontSize: promptFont, lineHeight: 1.15, color: '#d4d4d8', ...clamp(promptLines) }}>{text}</span>
            </div>
          )}
        </div>
        <div style={{ height: Math.max(0, (rowCap[Math.floor(i / cols)] ?? gap) - gap), overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {art && !free && (
            <>
              <div style={{ fontSize: nameFont, lineHeight: 1.15, fontWeight: 600, color: '#f4f4f5', textShadow: '0 1px 3px rgba(0,0,0,0.85)', ...clamp(3) }}>{art.title}</div>
              {art.credit && <div style={{ marginTop: 1, fontSize: nameFont * 0.9, lineHeight: 1.15, color: '#cfd2d8', textShadow: '0 1px 3px rgba(0,0,0,0.85)', ...clamp(1) }}>{art.credit}</div>}
            </>
          )}
        </div>
      </div>
    )
  }

  const renderCell = (i: number) => {
    if (portrait) return renderPortraitCell(i)
    const cellData = board.cells[i]
    if (i === centre) {
      return (
        <div key={i} data-i={i} style={{ ...cellBox(i), background: 'rgba(103,104,171,0.28)', border: `1px solid rgba(103,104,171,0.7)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {centreLabel(cell, cell)}
          {roomy && !titleInCentre && <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c9caf0' }}>{t('bingoFree')}</span>}
        </div>
      )
    }
    const art = prompt ? answers?.[i] ?? null : cellData
    if (!art) {
      return (
        <div key={i} data-i={i} style={{ ...cellBox(i), background: prompt && cellData ? '#202024' : '#18181b', border: roomy ? `1px dashed #3f3f46` : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3, textAlign: 'center' }}>
          {roomy && prompt && cellData && <span style={{ fontSize: font, lineHeight: 1.2, color: '#d4d4d8', fontWeight: 500, ...clamp(5) }}>{cellData.title}</span>}
        </div>
      )
    }
    const ticked = !prompt && mask[i]
    const hasCover = !!coverSrc(art.coverUrl)
    return (
      <div key={i} data-i={i} style={cellBox(i)}>
        {artBackground(art)}
        {roomy && hasCover && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.58)' }} />}
        {roomy && (
          <div style={{ position: 'absolute', inset: 0, padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <span style={{ fontSize: font, lineHeight: 1.15, fontWeight: 600, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.7)', ...clamp(Math.max(3, Math.floor((cell - 6) / (font * 1.15)))) }}>
              {art.title}
            </span>
          </div>
        )}
        {ticked && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cell >= 14 && (
              <span style={{ width: cell * 0.4, height: cell * 0.4, borderRadius: cell, background: PRIMARY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: cell * 0.25, fontWeight: 700, lineHeight: 1 }}>✓</span>
            )}
          </div>
        )}
      </div>
    )
  }

  // The card's background: one colour per row of the board (its covers' colours, or the tile colours
  // when there is no cover), blended top row to bottom row. Big boards are grouped into a few bands.
  const rgbAt = (i: number): [number, number, number] | null => {
    const art = prompt ? answers?.[i] : board.cells[i]
    if (!art) return null
    return (art.coverUrl && coverColors[art.coverUrl]) || hslToRgb(hashHue(art.title), 0.52, 0.4)
  }
  const bands = Math.min(rows, 8)
  const bandColours = Array.from({ length: bands }, (_, b) => {
    const from = Math.floor((b * rows) / bands)
    const to = Math.floor(((b + 1) * rows) / bands)
    let r = 0
    let g = 0
    let bl = 0
    let n = 0
    for (let row = from; row < to; row++)
      for (let col = 0; col < cols; col++) {
        const c = rgbAt(row * cols + col)
        if (c) {
          r += c[0]
          g += c[1]
          bl += c[2]
          n++
        }
      }
    return n ? [Math.round(r / n), Math.round(g / n), Math.round(bl / n)] : [103, 104, 171]
  })
  const backdrop = `linear-gradient(to bottom, ${bandColours
    .map((c, b) => `rgba(${c[0]},${c[1]},${c[2]},0.12) ${bands === 1 ? 50 : Math.round(8 + (b * 84) / (bands - 1))}%`)
    .join(', ')})`

  // Fire-like glows rising from the top and bottom edges, in one accent colour taken from the covers.
  const flame = (c: [number, number, number], x: number, edge: 0 | 100, w: number, h: number, a: number) =>
    `radial-gradient(ellipse ${w}% ${h}% at ${x}% ${edge}%, rgba(${c[0]},${c[1]},${c[2]},${a}) 0%, rgba(${c[0]},${c[1]},${c[2]},${(a * 0.55).toFixed(3)}) 28%, rgba(${c[0]},${c[1]},${c[2]},${(a * 0.2).toFixed(3)}) 58%, rgba(${c[0]},${c[1]},${c[2]},0) 92%)`
  // The board's accent: the most common vivid hue among its covers (weighted by how saturated they are).
  const accent = ((): [number, number, number] => {
    const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }))
    for (let i = 0; i < total; i++) {
      const c = rgbAt(i)
      if (!c) continue
      const [h, sat, l] = rgbToHsl(c)
      const w = sat * (1 - Math.abs(2 * l - 1)) + 0.02
      const bin = bins[Math.floor(h / 30) % 12]
      bin.w += w
      bin.r += c[0] * w
      bin.g += c[1] * w
      bin.b += c[2] * w
    }
    const best = bins.reduce((a, b) => (b.w > a.w ? b : a))
    if (best.w <= 0.03) return [103, 104, 171]
    const [h, sat] = rgbToHsl([best.r / best.w, best.g / best.w, best.b / best.w])
    return hslToRgb(h, Math.min(1, Math.max(0.8, sat)), 0.55)
  })()
  const shade = (dh: number, dl = 0) => {
    const [h, sat, l] = rgbToHsl(accent)
    return hslToRgb((h + dh + 360) % 360, sat, Math.min(0.85, Math.max(0.3, l + dl)))
  }
  // Flames along an edge, random like a real fire: uneven positions, widths, heights, strengths and a little
  // hue and lightness drift, from a seed made of the board, so the same board always burns the same way.
  const rand = seededRandom(`${board.id}:${board.title}:${rows}x${cols}`)
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo)
  const edgeFlames = (edge: 0 | 100) => {
    const out: string[] = []
    const n = 9 + Math.floor(rand() * 4)
    for (let k = 0; k < n; k++) {
      out.push(flame(shade(between(-24, 24), between(-0.08, 0.1)), between(-4, 104), edge, between(14, 40), between(14, 44), between(0.2, 0.46)))
    }
    // a few tall, thin licks of flame
    for (let k = 0; k < 3; k++) {
      out.push(flame(shade(between(-14, 18), between(0, 0.14)), between(6, 94), edge, between(7, 13), between(38, 56), between(0.18, 0.32)))
    }
    // and a faint, even glow along the edge itself
    out.push(flame(shade(0, 0.1), 50, edge, 96, 9, 0.14))
    return out
  }
  const glow = [...edgeFlames(0), ...edgeFlames(100)].join(', ')

  const meta = [
    board.author && !board.official ? t('bingoBy', { name: board.author }) : '',
    prompt ? t('bingoFilledCount', { count: done, total }) : t('bingoProgress', { count: done, total }),
    winning.size > 0 ? t('bingoWin') : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const card = (
    <div
      ref={cardRef}
      style={{
        width: CARD_W,
        height: compact ? undefined : CARD_H,
        borderRadius: compact ? 14 : undefined,
        background: `${glow}, ${backdrop}, ${BG}`,
        color: INK,
        padding: `${CARD_PAD_Y}px ${CARD_PAD_X}px`,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* attribution */}
      <div style={{ display: compact ? 'none' : 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ color: INK, display: 'inline-flex' }}>
          <ShelfLogo className="h-4 w-4" />
        </span>
        <span style={{ fontWeight: 300, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>someshelf.com</span>
      </div>

      {/* boards without a centre square show their title up here instead */}
      {!titleInCentre && (
        <p style={{ margin: compact ? 0 : '8px 0 0', fontSize: 16, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board.title}</p>
      )}
      <p style={{ margin: '4px 0 0', fontSize: 10, color: '#d4d4d8', textShadow: '0 1px 3px rgba(0,0,0,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</p>

      {/* board: takes all the room that is left */}
      <div style={{ flex: compact ? undefined : 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: compact ? '8px 0 0' : '4px 0' }}>
        {mosaic ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mosaicSrc}
            alt=""
            style={{ width: cols * mosaicScale, height: rows * mosaicScale, imageRendering: 'pixelated', display: 'block', borderRadius: 4 }}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${cell}px)`, columnGap: gap, rowGap: gapY, ...(portrait ? { gridTemplateRows: rowCap.map((cap) => `${coverH + cap}px`).join(' ') } : {}) }}>
            {Array.from({ length: total }, (_, i) => renderCell(i))}
          </div>
        )}
      </div>

      <p style={{ display: compact ? 'none' : undefined, margin: 0, textAlign: 'center', fontSize: 9.5, color: '#e5e7eb', letterSpacing: '0.04em', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
        {t('bingoCardMade')} · <span style={{ color: '#c9caf0', fontWeight: 600 }}>someshelf.com</span>
      </p>
    </div>
  )

  return card
}

export default function BingoShareModal({ board, mask, answers, link, embedded, winning, onClose }: Props) {
  const { t } = useLanguage()
  const cardRef = useRef<HTMLDivElement>(null)
  // Covers are only loaded when the squares are big enough to show them.
  const { prompt, total, roomy } = shareGeometry(board, answers, AREA_H)

  // Every cover that can appear on the card (only when squares are big enough to show them).
  const coverUrls = roomy
    ? Array.from(
        new Set(Array.from({ length: total }, (_, i) => (prompt ? answers?.[i] : board.cells[i])?.coverUrl).filter((u): u is string => !!u)),
      )
    : []
  const { covers, colors: coverColors, ready: coversReady } = useCoverInfos(coverUrls)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    const update = () => setScale(Math.min(1, Math.max(0.45, (window.innerHeight * 0.5) / CARD_H)))
    update()
    window.addEventListener('resize', update)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = prev
      window.removeEventListener('resize', update)
    }
  }, [onClose])

  useEffect(() => {
    if (!coversReady || imgUrl || !cardRef.current) return
    const node = cardRef.current
    let cancelled = false
    ;(async () => {
      setBusy(true)
      try {
        await waitForImages(node)
        const url = await toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor: BG })
        if (!cancelled) setImgUrl(url)
      } catch (e) {
        console.error('Bingo share image render failed', e)
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [coversReady, imgUrl])

  const fileName = `${slug(board.title)}-bingo.png`
  const shareText = `${board.title} — ${t('bingoCardMade')}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt(t('bingoShare'), link)
    }
  }

  const saveImage = () => {
    if (!imgUrl) return
    const a = document.createElement('a')
    a.download = fileName
    a.href = imgUrl
    a.click()
  }

  // Link-only intents can't carry an image, so try the OS share sheet first
  // (mobile), and fall back to the web intent (desktop) — same as the profile card.
  const shareWith = async (webHref?: string) => {
    if (imgUrl && navigator.canShare) {
      try {
        const blob = await (await fetch(imgUrl)).blob()
        const file = new File([blob], fileName, { type: 'image/png' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: board.title, url: link })
          return
        }
      } catch {
        return
      }
    }
    if (webHref) window.open(webHref, '_blank', 'noopener,noreferrer')
    else if (navigator.share) navigator.share({ title: board.title, url: link }).catch(() => {})
  }

  const apps = [
    { key: 'whatsapp', icon: IoLogoWhatsapp, href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${link}`)}` },
    { key: 'telegram', icon: FaTelegram, href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}` },
    { key: 'x', icon: IoLogoTwitter, href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(link)}` },
    { key: 'facebook', icon: IoLogoFacebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
  ]

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">{t('bingoShareTitle')}</h3>
          <button
            onClick={onClose}
            aria-label={t('cancel')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <div
          className="relative mx-auto flex items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-black"
          style={{ width: CARD_W * scale, height: CARD_H * scale }}
        >
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgUrl} alt="" style={{ width: CARD_W * scale, height: CARD_H * scale, display: 'block' }} />
          ) : (
            <div style={{ width: CARD_W, height: CARD_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <BingoShareCard board={board} mask={mask} answers={answers} winning={winning} covers={covers} coverColors={coverColors} cardRef={cardRef} />
            </div>
          )}
          {busy && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] py-1.5 pl-3 pr-1.5">
          <span className="min-w-0 flex-1 select-all overflow-hidden whitespace-nowrap text-sm text-[var(--text-muted)]">{link}</span>
          <button
            onClick={copyLink}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              copied ? 'bg-nonsprimary text-white' : 'bg-[var(--container)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {copied ? <IoCheckmark className="h-3.5 w-3.5" /> : <IoCopyOutline className="h-3.5 w-3.5" />}
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
        {!embedded && <p className="-mt-2 text-[11px] leading-snug text-[var(--text-muted)]">{t('bingoLinkTooBig')}</p>}

        <div className="flex items-center gap-2">
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={() => shareWith()}
              disabled={!imgUrl}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary-soft)] py-2.5 text-sm font-medium text-nonsprimary transition-colors hover:bg-[var(--primary-ring)] disabled:opacity-50"
            >
              <IoShareSocialOutline className="h-4 w-4" />
              {t('share')}
            </button>
          )}
          {apps.map(({ key, icon: Icon, href }) => (
            <button
              key={key}
              onClick={() => shareWith(href)}
              disabled={!imgUrl}
              aria-label={key}
              title={t('shareAppHint')}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)] disabled:opacity-50"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <p className="-mt-1 text-[11px] leading-snug text-[var(--text-muted)]">{t('shareAppHint')}</p>

        <button
          onClick={saveImage}
          disabled={!imgUrl}
          className="flex items-center justify-center gap-2 rounded-xl bg-[var(--primary-soft)] py-2.5 text-sm font-medium text-nonsprimary transition-colors hover:bg-[var(--primary-ring)] disabled:opacity-50"
        >
          <IoDownloadOutline className="h-4 w-4" />
          {t('saveAsImage')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
