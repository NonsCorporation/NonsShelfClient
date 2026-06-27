'use client'

import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toPng } from 'html-to-image'
import { IoClose, IoCopyOutline, IoCheckmark, IoDownloadOutline } from 'react-icons/io5'
import { IoMdStar, IoMdStarHalf, IoMdStarOutline } from 'react-icons/io'
import type { MediaItem, MediaType, ShelfStatus } from '../types'
import { libraryService } from '../services/libraryService'
import ShelfLogo from './ShelfLogo'
import { mediaPath } from '../lib/paths'
import { useLanguage } from '../contexts/LanguageContext'

type TFn = (key: string, vars?: Record<string, string | number>) => string

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
  /** Resolved byline (edition-language–aware), e.g. the author localized to the
   *  selected edition. Falls back to the work's author when absent. */
  author?: string
  /** Resolved total pages (edition-aware). */
  totalPages?: number
  rating: number | null
  review: string
  status: ShelfStatus | null
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

function Stars({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 2, color: PRIMARY }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const v = (i + 1) * 2
        if (rating >= v) return <IoMdStar key={i} size={18} />
        if (rating === v - 1) return <IoMdStarHalf key={i} size={18} />
        return <IoMdStarOutline key={i} size={18} style={{ color: FAINT }} />
      })}
    </div>
  )
}

export default function ShareModal({ isOpen, item, coverUrl, author, totalPages = 0, rating, review, status, onClose }: Props) {
  const { t } = useLanguage()
  const cardRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  // On open: reset and (for a book being read) fetch the latest page.
  useEffect(() => {
    if (!isOpen) return
    setImgUrl(null)
    setCurrentPage(0)
    setCopied(false)
    if (item.type === 'book' && status === 'active') {
      libraryService.getProgress(String(item.id)).then((rows) => setCurrentPage(rows[0]?.page ?? 0)).catch(() => {})
    }
  }, [isOpen, item.id, item.type, status])

  // Regenerate the image when the underlying data settles (e.g. page loaded in).
  useEffect(() => {
    if (isOpen) setImgUrl(null)
  }, [currentPage, isOpen])

  // Render the hidden card to a PNG so the preview *is* the downloadable image.
  useEffect(() => {
    if (!isOpen || imgUrl || !cardRef.current) return
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
  }, [isOpen, imgUrl])

  if (!isOpen || typeof document === 'undefined') return null

  const url = `${window.location.origin}${mediaPath({ type: item.type, uuid: item.uuid, id: String(item.id) })}`
  const pct = currentPage > 0 && totalPages > 0 ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : 0
  const typeLabel = item.type === 'book' ? t('book') : item.type === 'series' ? t('series') : t('film')
  const cover = corsCover(coverUrl || item.coverUrl)
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
    a.download = `${item.title.replace(/[^\w\s-]/g, '').trim() || 'share'}.png`
    a.href = imgUrl
    a.click()
  }

  // The dark share card — horizontal: a 2:3 cover on the left, details on the
  // right, logo across the top. Rendered (visibly) while the PNG is being built,
  // then swapped for the captured <img> so what you see is exactly what saves.
  const card = (
    <div
      ref={cardRef}
      style={{
        background: BG,
        color: INK,
        padding: 22,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* logo, top */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <span style={{ color: INK, display: 'inline-flex' }}>
          <ShelfLogo className="h-5 w-5" />
        </span>
        <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Nons Library
        </span>
      </div>

      {/* body: cover (2:3) left, details right */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ width: 116, aspectRatio: '2 / 3', flexShrink: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${LINE}` }}>
          {cover ? (
            <img crossOrigin="anonymous" src={cover} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: LINE }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>{item.title}</p>
          {byline && <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>{byline}</p>}
          <p style={{ margin: '6px 0 0', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED }}>
            {typeLabel}{item.year ? ` · ${item.year}` : ''}
          </p>

          {typeof rating === 'number' && rating > 0 && (
            <div style={{ marginTop: 12 }}>
              <Stars rating={rating} />
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
                <span style={{ fontWeight: 700, color: PRIMARY }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: LINE, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: PRIMARY, borderRadius: 999 }} />
              </div>
            </div>
          )}

          {review && (
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
              “{review}”
            </p>
          )}
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
