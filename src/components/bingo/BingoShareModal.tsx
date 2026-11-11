'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { hashHue } from '@/lib/hashHue'
import { useLanguage } from '@/contexts/LanguageContext'

// Fixed dark palette so the exported image looks the same whatever theme the
// app is in — same convention as ProfileShareModal / ShareModal.
const BG = '#000000'
const INK = '#ffffff'
const MUTED = '#9ca3af'
const PRIMARY = '#6768ab'
const GOLD = '#f5a623'

// 9:16 story card, exported at pixelRatio 3 (1080×1920).
const CARD_W = 360
const CARD_H = 640
// The board gets a box this big, whatever its shape.
const CARD_PAD_X = 10
const CARD_PAD_Y = 14
const AREA_W = CARD_W - CARD_PAD_X * 2
const AREA_H = 556
// Cover shape (height / width) and caption height on prompt boards.
const COVER_RATIO = 1.25
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

// Several image hosts send no CORS headers, which makes a canvas capture fail,
// so covers go through a CORS-enabled proxy and are inlined as data URLs.
function corsCover(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url
  return `https://images.weserv.nl/?url=${encodeURIComponent('ssl:' + url.replace(/^https?:\/\//i, ''))}`
}

function loadCover(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const max = 200
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.naturalWidth * k))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = corsCover(url)
  })
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

export default function BingoShareModal({ board, mask, answers, link, embedded, winning, onClose }: Props) {
  const { t } = useLanguage()
  const cardRef = useRef<HTMLDivElement>(null)
  const prompt = board.kind === 'prompt'
  const { rows, cols } = board
  const total = rows * cols
  const centre = board.freeCenter ? centerIndex(rows, cols) : null

  // Board geometry: square cells sized to fit the box, with tighter gaps on bigger boards.
  const mosaic = total > MOSAIC_OVER
  // One constant gap, the same across and down.
  const gap = Math.max(rows, cols) <= 10 ? 8 : Math.max(rows, cols) <= 25 ? 2 : Math.max(rows, cols) <= 50 ? 1 : 0
  const gapY = gap
  // Prompt boards show each answer as a cover with its prompt as a caption below, as long as that
  // still leaves covers wide enough to read; bigger boards fall back to plain squares.
  const areaH = AREA_H
  const widthFit = (AREA_W - (cols - 1) * gap) / cols
  // Under each cover sits the book's title (up to three lines) and its author. Rather than reserving the
  // worst case for every row, each row only gets the height its own titles need, which leaves more for covers.
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
    return need > 0 ? Math.ceil(need) + 4 : 0 // + the gap between cover and caption
  }
  const portraitFit = (() => {
    if (!prompt || mosaic) return null
    for (let c = Math.floor(widthFit); c >= 24; c--) {
      const caps = Array.from({ length: rows }, (_, r) => captionFor(c, r))
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

  const mosaicSrc = useMemo(
    () =>
      mosaic
        ? boardImage({ rows, cols, cells: board.cells, kind: board.kind, freeCenter: board.freeCenter, mask, answers, winning, px: Math.max(3, Math.floor(1000 / Math.max(rows, cols))) })
        : '',
    [mosaic, rows, cols, board.cells, board.kind, board.freeCenter, mask, answers, winning],
  )
  const mosaicScale = Math.min(AREA_W / cols, areaH / rows)

  // Every cover that can appear on the card (only when squares are big enough to show them).
  const coverUrls = roomy
    ? Array.from(
        new Set(Array.from({ length: total }, (_, i) => (prompt ? answers?.[i] : board.cells[i])?.coverUrl).filter((u): u is string => !!u)),
      )
    : []
  const coverKey = coverUrls.join('|')

  const [covers, setCovers] = useState<Record<string, string | null>>({})
  const [coversReady, setCoversReady] = useState(coverUrls.length === 0)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const update = () => setScale(Math.min(1, Math.max(0.45, (window.innerHeight * 0.5) / CARD_H)))
    update()
    window.addEventListener('resize', update)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      window.removeEventListener('resize', update)
    }
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    const urls = coverKey ? coverKey.split('|') : []
    if (urls.length === 0) return
    Promise.all(urls.map(async (u) => [u, await loadCover(u)] as const)).then((pairs) => {
      if (cancelled) return
      setCovers(Object.fromEntries(pairs))
      setCoversReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [coverKey])

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

  const done = mask.reduce((n, x) => n + (x ? 1 : 0), 0)
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

  // ── the card (inline styles only, so the capture is theme-proof) ──
  const radius = cell >= 30 ? 7 : cell >= 16 ? 3 : 1
  const cellBox = (i: number, height = cell): React.CSSProperties => ({
    position: 'relative',
    width: cell,
    height,
    borderRadius: radius,
    overflow: 'hidden',
    boxSizing: 'border-box',
    boxShadow: winning.has(i) ? `inset 0 0 0 ${cell >= 30 ? 2 : 1}px ${GOLD}` : undefined,
  })
  const clamp = (lines: number): React.CSSProperties => ({
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical' as const,
  })
  const artBackground = (art: BingoCell) => {
    const data = art.coverUrl ? covers[art.coverUrl] : null
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
    const data = art?.coverUrl ? covers[art.coverUrl] : null
    const centred: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, textAlign: 'center' }
    return (
      <div key={i} style={{ width: cell, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
        <div style={{ height: Math.max(0, (rowCap[Math.floor(i / cols)] ?? 4) - 4), overflow: 'hidden' }}>
          {art && !free && (
            <>
              <div style={{ fontSize: nameFont, lineHeight: 1.15, fontWeight: 600, color: '#f4f4f5', ...clamp(3) }}>{art.title}</div>
              {art.credit && <div style={{ marginTop: 1, fontSize: nameFont * 0.9, lineHeight: 1.15, color: MUTED, ...clamp(1) }}>{art.credit}</div>}
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
        <div key={i} style={{ ...cellBox(i), background: 'rgba(103,104,171,0.28)', border: `1px solid rgba(103,104,171,0.7)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {centreLabel(cell, cell)}
          {roomy && !titleInCentre && <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c9caf0' }}>{t('bingoFree')}</span>}
        </div>
      )
    }
    const art = prompt ? answers?.[i] ?? null : cellData
    if (!art) {
      return (
        <div key={i} style={{ ...cellBox(i), background: prompt && cellData ? '#202024' : '#18181b', border: roomy ? `1px dashed #3f3f46` : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3, textAlign: 'center' }}>
          {roomy && prompt && cellData && <span style={{ fontSize: font, lineHeight: 1.2, color: '#d4d4d8', fontWeight: 500, ...clamp(5) }}>{cellData.title}</span>}
        </div>
      )
    }
    const ticked = !prompt && mask[i]
    const hasCover = !!(art.coverUrl && covers[art.coverUrl])
    return (
      <div key={i} style={cellBox(i)}>
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

  const meta = [
    board.author ? t('bingoBy', { name: board.author }) : '',
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
        height: CARD_H,
        background: `radial-gradient(circle at 50% 0%, rgba(103,104,171,0.34), transparent 55%), ${BG}`,
        color: INK,
        padding: `${CARD_PAD_Y}px ${CARD_PAD_X}px`,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* attribution */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ color: INK, display: 'inline-flex' }}>
          <ShelfLogo className="h-4 w-4" />
        </span>
        <span style={{ fontWeight: 300, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>someshelf.com</span>
      </div>

      {/* boards without a centre square show their title up here instead */}
      {!titleInCentre && (
        <p style={{ margin: '8px 0 0', fontSize: 16, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board.title}</p>
      )}
      <p style={{ margin: '4px 0 0', fontSize: 10, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</p>

      {/* board: takes all the room that is left */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}>
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

      <p style={{ margin: 0, textAlign: 'center', fontSize: 9.5, color: MUTED, letterSpacing: '0.04em' }}>
        {t('bingoCardMade')} · <span style={{ color: '#c9caf0', fontWeight: 600 }}>someshelf.com</span>
      </p>
    </div>
  )

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
            <div style={{ width: CARD_W, height: CARD_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{card}</div>
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
