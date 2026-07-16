'use client'

import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toPng } from 'html-to-image'
import { IoClose, IoCopyOutline, IoCheckmark, IoDownloadOutline, IoTimeOutline } from 'react-icons/io5'
import { IoMdStar, IoMdStarHalf, IoMdStarOutline } from 'react-icons/io'
import type { MediaItem, MediaType, ShelfStatus } from '@/types'
import { libraryService } from '@/services/libraryService'
import ShelfLogo from '@/components/branding/ShelfLogo'
import TypeBadge from '@/components/badges/TypeBadge'
import { mediaPath } from '@/lib/paths'
import { useLanguage } from '@/contexts/LanguageContext'
import { reviewToPlainText } from '@/components/review/reviewText'

type TFn = (key: string, vars?: Record<string, string | number>) => string

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Friendly, first-person status line for the share card ("I'm finished!"),
// rather than the neutral shelf label used elsewhere.
function shareStatusLabel(type: MediaType, status: ShelfStatus, t: TFn): string {
  const isBook = type === 'book'
  switch (status) {
    case 'wishlist':
      return isBook ? t('shareWantToRead') : t('shareWantToWatch')
    case 'active':
      return isBook ? t('shareReading') : t('shareWatching')
    case 'done':
      return isBook ? t('shareFinishedBook') : t('shareFinishedFilm')
    case 'dnf':
      return t('shareDnf')
  }
}

type Props = {
  isOpen: boolean
  item: MediaItem
  /** Resolved cover URL (edition-aware). */
  coverUrl?: string
  /** Resolved title (edition-aware), e.g. a translated printing's title. */
  title?: string
  /** Resolved byline (edition-language–aware), e.g. the author localized to the
   *  selected edition. Falls back to the work's author when absent. */
  author?: string
  /** Resolved total pages (edition-aware). */
  totalPages?: number
  rating: number | null
  review: string
  status: ShelfStatus | null
  /** Known current page, bypassing the internal per-viewer progress fetch.
   *  Needed when sharing *someone else's* activity (e.g. from the feed) —
   *  libraryService.getProgress is scoped to the signed-in viewer, so calling
   *  it there would show the viewer's own reading position instead of the
   *  post author's. Omit to keep the normal own-item behavior (MediaOne). */
  currentPage?: number
  onClose: () => void
}

// Fixed dark palette so the exported image looks identical regardless of the
// app's light/dark theme.
const BG = '#000000'
const INK = '#ffffff'
const MUTED = '#9ca3af'
const FAINT = '#3f3f46'
const LINE = '#27272a'
const PRIMARY = '#6768ab' // nons primary

// Several cover hosts (Google Books, ISBNdb, Fantlab) don't send CORS headers,
// so an <img crossOrigin="anonymous"> request to them fails outright — the share
// card's cover shows blank and html-to-image can't capture it. Route covers
// through a CORS-enabled image proxy so they both display and export reliably.
// Relative/same-origin covers have no CORS problem and are used as-is.
function corsCover(url?: string): string | undefined {
  if (!url) return undefined
  if (!/^https?:\/\//i.test(url)) return url
  const upstream = 'ssl:' + url.replace(/^https?:\/\//i, '')
  return `https://images.weserv.nl/?url=${encodeURIComponent(upstream)}`
}

// Wait for every <img> inside the node to finish loading, so html-to-image
// captures the cover instead of a blank box.
async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) =>
      img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = () => res(null) }),
    ),
  )
}

function Stars({ rating, color = PRIMARY }: { rating: number; color?: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, color }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const v = (i + 1) * 2
        if (rating >= v) return <IoMdStar key={i} size={28} />
        if (rating === v - 1) return <IoMdStarHalf key={i} size={28} />
        return <IoMdStarOutline key={i} size={28} style={{ color: FAINT }} />
      })}
    </div>
  )
}

type CoverLoad = { color: { r: number; g: number; b: number } | null; dataUrl: string }

// Loads the cover exactly once and derives both the accent color and a
// same-origin data: URL from that single fetch, instead of the accent-extract
// and the visible <img> each hitting the (third-party, occasionally flaky)
// CORS proxy separately. That duplicate-fetch race was why the gradient
// (extracted successfully) could be right while the visible cover still came
// up blank — one of the two independent requests to images.weserv.nl failed
// while the other succeeded. Retries once on a transient failure.
async function loadCoverImage(src: string, attempt = 0): Promise<CoverLoad | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

        // Sample a small region and bucket pixels into a coarse color
        // histogram, so the accent is the color that actually *dominates*
        // the cover rather than whichever single pixel happens to be most
        // saturated (a rare bright fleck could otherwise win).
        const size = 60
        const sampleCanvas = document.createElement('canvas')
        sampleCanvas.width = size
        sampleCanvas.height = size
        const sampleCtx = sampleCanvas.getContext('2d')
        let color: { r: number; g: number; b: number } | null = null
        if (sampleCtx) {
          sampleCtx.drawImage(img, 0, 0, size, size)
          const { data } = sampleCtx.getImageData(0, 0, size, size)
          const STEP = 24
          const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
            if (a < 128) continue
            const max = Math.max(r, g, b), min = Math.min(r, g, b)
            const sat = max === 0 ? 0 : (max - min) / max
            // Skip near-white/near-black/near-gray pixels — they're rarely
            // what anyone means by a cover's "color" and would otherwise
            // dominate the histogram on covers with lots of white margin.
            if (sat < 0.15 || max < 30 || max > 250) continue
            const key = `${Math.round(r / STEP)},${Math.round(g / STEP)},${Math.round(b / STEP)}`
            const bucket = buckets.get(key)
            if (bucket) {
              bucket.count++
              bucket.r += r; bucket.g += g; bucket.b += b
            } else {
              buckets.set(key, { count: 1, r, g, b })
            }
          }
          let best: { count: number; r: number; g: number; b: number } | null = null
          for (const bucket of buckets.values()) {
            if (!best || bucket.count > best.count) best = bucket
          }
          color = best ? { r: Math.round(best.r / best.count), g: Math.round(best.g / best.count), b: Math.round(best.b / best.count) } : null
        }
        resolve({ color, dataUrl })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => {
      if (attempt < 1) {
        const retrySrc = src + (src.includes('?') ? '&' : '?') + 'retry=1'
        loadCoverImage(retrySrc, attempt + 1).then(resolve)
      } else {
        resolve(null)
      }
    }
    img.src = src
  })
}

export default function ShareModal({ isOpen, item, coverUrl, title, author, totalPages = 0, rating, review, status, currentPage: currentPageProp, onClose }: Props) {
  const { t } = useLanguage()
  const cardRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [accent, setAccent] = useState<{ r: number; g: number; b: number } | null>(null)
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null)
  const [accentReady, setAccentReady] = useState(false)
  const [progressReady, setProgressReady] = useState(false)
  const [showDates, setShowDates] = useState(true)
  const [showGradient, setShowGradient] = useState(true)
  const [showHeader, setShowHeader] = useState(true)
  const [confirmRemove, setConfirmRemove] = useState(false)

  // On open: reset and (for a book being read) fetch the latest page.
  useEffect(() => {
    if (!isOpen) return
    setImgUrl(null)
    setCurrentPage(0)
    setCopied(false)
    setAccent(null)
    setAccentReady(false)
    setProgressReady(false)
    if (typeof currentPageProp === 'number') {
      // Caller already knows the page — see the currentPage prop doc above.
      setCurrentPage(currentPageProp)
      setProgressReady(true)
    } else if (item.type === 'book' && status === 'active') {
      libraryService.getProgress(String(item.id))
        .then((rows) => setCurrentPage(rows[0]?.page ?? 0))
        .catch(() => {})
        .finally(() => setProgressReady(true))
    } else {
      setProgressReady(true)
    }
  }, [isOpen, item.id, item.type, status, currentPageProp])

  // Regenerate the image when the underlying data settles (e.g. page loaded in).
  useEffect(() => {
    if (isOpen) setImgUrl(null)
  }, [currentPage, isOpen])

  // Load the cover once (see loadCoverImage) and derive both the accent color
  // and the data: URL the card actually displays; signal ready when done
  // (with or without a color/image — a failed load still unblocks rendering).
  useEffect(() => {
    if (!isOpen) return
    const src = corsCover(coverUrl || item.coverUrl)
    setAccent(null)
    setCoverDataUrl(null)
    setAccentReady(false)
    setImgUrl(null)
    if (!src) { setAccentReady(true); return }
    loadCoverImage(src).then((result) => {
      setAccent(result?.color ?? null)
      setCoverDataUrl(result?.dataUrl ?? null)
      setAccentReady(true)
    })
  }, [isOpen, coverUrl, item.coverUrl])

  // Regenerate PNG when the user toggles options that affect the card layout.
  useEffect(() => {
    if (isOpen) setImgUrl(null)
  }, [showDates, showHeader, showGradient, isOpen])

  // Render the hidden card to a PNG so the preview *is* the downloadable image.
  // Wait for accent extraction to finish so the gradient is baked in.
  useEffect(() => {
    if (!isOpen || !accentReady || !progressReady || imgUrl || !cardRef.current) return
    const node = cardRef.current
    let cancelled = false
    ;(async () => {
      setBusy(true)
      try {
        await waitForImages(node)
        const url = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: BG })
        if (!cancelled) setImgUrl(url)
      } catch (e) {
        console.error('Share image render failed', e)
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, accentReady, progressReady, imgUrl])

  if (!isOpen || typeof document === 'undefined') return null

  const url = `${window.location.origin}${mediaPath({ type: item.type, uuid: item.uuid, id: String(item.id) })}`
  const pct = currentPage > 0 && totalPages > 0 ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : 0
  const byline = author || item.author

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const saveImage = () => {
    if (!imgUrl) return
    const a = document.createElement('a')
    a.download = `${(title || item.title).replace(/[^\w\s-]/g, '').trim() || 'share'}.png`
    a.href = imgUrl
    a.click()
  }

  // The dark share card — horizontal: a 2:3 cover on the left, details on the
  // right, logo across the top. Rendered (visibly) while the PNG is being built,
  // then swapped for the captured <img> so what you see is exactly what saves.
  const accentGradient = accent && showGradient
    ? `linear-gradient(to left, rgba(${accent.r},${accent.g},${accent.b},0.38) 0%, transparent 65%)`
    : undefined

  // Choose a progress-bar colour that reads well on the dark card. Use the
  // accent when it's bright enough (luminance > 0.12), otherwise fall back to
  // white so it's always legible.
  const progressColor = (() => {
    if (!accent) return INK
    const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
    const lum = 0.2126 * lin(accent.r) + 0.7152 * lin(accent.g) + 0.0722 * lin(accent.b)
    return lum > 0.12 ? `rgb(${accent.r},${accent.g},${accent.b})` : INK
  })()

  const card = (
    <div
      ref={cardRef}
      style={{
        width: 480,
        background: accentGradient ? `${accentGradient}, ${BG}` : BG,
        color: INK,
        padding: 22,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* logo, top */}
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ color: INK, display: 'inline-flex' }}>
            <ShelfLogo className="h-5 w-5" />
          </span>
          <span style={{ fontWeight: 300, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            shelf.nonsapp.com
          </span>
        </div>
      )}

      {/* body: cover (2:3) left, details right */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ position: 'relative', width: 116, aspectRatio: '2 / 3', flexShrink: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${LINE}` }}>
          {coverDataUrl ? (
            <img src={coverDataUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: LINE }} />
          )}
          <TypeBadge type={item.type} position="bottom-1.5 right-1.5" size="h-6 w-6" iconSize="h-3 w-3" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
            {title || item.title}
            {item.year && <span style={{ fontSize: 14, fontWeight: 400, color: MUTED }}> ({item.year})</span>}
          </p>
          {byline && <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>{byline}</p>}

          {typeof rating === 'number' && rating > 0 && (
            <div style={{ marginTop: 14 }}>
              <Stars rating={rating} color={progressColor} />
            </div>
          )}

          {status && (
            <div style={{ marginTop: 12 }}>
              <span
                style={{
                  display: 'inline-block',
                  border: `1px solid ${INK}`,
                  borderRadius: 999,
                  padding: '3px 12px',
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {shareStatusLabel(item.type, status, t)}
              </span>
            </div>
          )}

          {pct > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED, marginBottom: 6 }}>
                <span>Page {currentPage}{totalPages > 0 ? ` / ${totalPages}` : ''}</span>
                <span style={{ fontWeight: 700, color: progressColor }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: LINE, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: progressColor, borderRadius: 999 }} />
              </div>
            </div>
          )}

          {reviewToPlainText(review) && (
            <p
              style={{
                margin: '14px 0 0',
                fontSize: 12.5,
                fontStyle: 'italic',
                lineHeight: 1.5,
                color: MUTED,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              “{reviewToPlainText(review)}”
            </p>
          )}

          {showDates && status === 'done' && item.finishedAt && (() => {
            const start = fmtDate(item.startedAt)
            const end = fmtDate(item.finishedAt)
            // Movies/series are watched in one sitting-ish — only the
            // finish date is meaningful. Books show the full range when
            // a start date is known.
            const label = item.type !== 'book' || !start ? end : `${start} → ${end}`
            return (
              <div style={{ marginTop: 14 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    border: `1px solid ${LINE}`,
                    borderRadius: 999,
                    padding: '4px 12px',
                    fontSize: 11,
                    color: MUTED,
                  }}
                >
                  <IoTimeOutline style={{ width: 12, height: 12, flexShrink: 0, color: INK, opacity: 0.8 }} />
                  {label}
                </span>
              </div>
            )
          })()}
        </div>
      </div>

    </div>
  )

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        {/* header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">{t('share')}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        {/* preview — the live card until the PNG is ready, then the captured image */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
          {imgUrl ? (
            <img src={imgUrl} alt="" className="block w-full" />
          ) : (
            card
          )}
          {busy && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
            </div>
          )}
        </div>

        {/* card options */}
        <div className="relative flex flex-wrap items-center gap-2">
          {/* branding toggle */}
          <button
            onClick={() => showHeader ? setConfirmRemove(true) : setShowHeader(true)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              showHeader
                ? 'border-nonsprimary bg-[var(--primary-soft)] text-nonsprimary'
                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <ShelfLogo className="h-3.5 w-3.5" />
            Show branding
          </button>

          {/* gradient toggle */}
          <button
            onClick={() => setShowGradient((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              showGradient
                ? 'border-nonsprimary bg-[var(--primary-soft)] text-nonsprimary'
                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Show gradient
          </button>

          {/* dates toggle */}
          {status === 'done' && item.finishedAt && (
            <button
              onClick={() => setShowDates((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                showDates
                  ? 'border-nonsprimary bg-[var(--primary-soft)] text-nonsprimary'
                  : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <IoTimeOutline className="h-3.5 w-3.5" />
              Show dates
            </button>
          )}

          {/* confirm-remove popup */}
          {confirmRemove && (
            <div className="absolute left-0 top-full z-10 mt-2 w-72 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 shadow-xl">
              <p className="mb-1 text-sm font-semibold text-[var(--text)]">Remove branding?</p>
              <p className="mb-4 text-xs leading-snug text-[var(--text-muted)]">
                Keeping it helps <span className="font-medium text-[var(--text)]">Nons&nbsp;&amp;&nbsp;Shelf</span> grow.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="flex-1 rounded-xl bg-[var(--primary-soft)] py-2 text-xs font-semibold text-nonsprimary transition-colors hover:bg-[var(--primary-ring)]"
                >
                  Keep
                </button>
                <button
                  onClick={() => { setShowHeader(false); setConfirmRemove(false) }}
                  className="flex-1 rounded-xl bg-[var(--surface)] py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>

        {/* link + copy */}
        <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] py-1.5 pl-3 pr-1.5">
          <span className="min-w-0 flex-1 select-all overflow-hidden whitespace-nowrap text-sm text-[var(--text-muted)]">{url}</span>
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

        {/* save as image — soft/ghost style, lighter than the primary action */}
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
