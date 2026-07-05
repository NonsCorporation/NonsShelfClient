'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toPng } from 'html-to-image'
import { IoClose, IoDownloadOutline, IoChevronBack, IoChevronForward, IoBookOutline, IoFilmOutline, IoTvOutline, IoStar, IoStarHalf, IoStarOutline, IoTimeOutline, IoLibraryOutline, IoPersonOutline } from 'react-icons/io5'
import type { MediaType } from '../types'
import type { Recap } from '../lib/recap'
import { fmtInt, fmtDuration } from '../lib/recap'
import ShelfLogo from './ShelfLogo'

type TFn = (key: string, vars?: Record<string, string | number>) => string

// Fixed dark palette so an exported card looks identical in light or dark mode.
const BG = '#0b0b12'
const INK = '#ffffff'
const MUTED = '#9aa0ad'
const FAINT = '#3a3a45'
const CARD_W = 360
const CARD_H = 640
const TYPE_COLOR: Record<MediaType, string> = { book: '#e0a458', movie: '#7c8cff', series: '#4fd1c5' }

// Route cross-origin covers through a CORS-enabled proxy so html-to-image can
// capture them (several cover hosts send no CORS headers). Mirrors ShareModal.
function corsCover(url?: string): string | undefined {
  if (!url) return undefined
  if (!/^https?:\/\//i.test(url)) return url
  return `https://images.weserv.nl/?url=${encodeURIComponent('ssl:' + url.replace(/^https?:\/\//i, ''))}`
}

async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll('img'))
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = () => res(null) }))))
}

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, color: '#f5a623' }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const v = (i + 1) * 2
        if (rating >= v) return <IoStar key={i} size={size} />
        if (rating === v - 1) return <IoStarHalf key={i} size={size} />
        return <IoStarOutline key={i} size={size} style={{ color: FAINT }} />
      })}
    </span>
  )
}

function Cover({ url, w = 44, h = 66 }: { url?: string; w?: number; h?: number }) {
  const src = corsCover(url)
  return (
    <span style={{ width: w, height: h, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#1a1a24', display: 'inline-block' }}>
      {src && <img src={src} crossOrigin="anonymous" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </span>
  )
}

// Circular author/person photo — falls back to a muted disc with a person
// glyph (matching the card's own dark palette) when no photo is known.
function PersonPhoto({ url, size = 84 }: { url?: string; size?: number }) {
  const src = corsCover(url)
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: FAINT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {src ? (
        <img src={src} crossOrigin="anonymous" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <IoPersonOutline size={Math.round(size * 0.45)} color={MUTED} />
      )}
    </span>
  )
}

// One 9:16 slide shell with a consistent header/footer chrome.
function Slide({ children, accent, footer }: { children: React.ReactNode; accent: string; footer: string }) {
  return (
    <div style={{ width: '100%', height: '100%', background: `radial-gradient(120% 80% at 50% -10%, ${accent}22 0%, ${BG} 55%)`, color: INK, padding: 26, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: MUTED, letterSpacing: 0.3 }}>
        {/* Shelf wordmark + link, bottom-left — mirrors ShareModal's header, smaller. */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: INK }}>
          <ShelfLogo className="h-3.5 w-3.5" />
          <span style={{ fontWeight: 300, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>shelf.nonsapp.com</span>
        </span>
        <span>{footer}</span>
      </div>
    </div>
  )
}

function statRow(icon: React.ReactNode, value: string | number, label: string, color: string) {
  return (
    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 38, height: 38, borderRadius: 10, background: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 13, color: MUTED }}>{label}</span>
    </div>
  )
}

type Slide = { key: string; accent: string; render: () => React.ReactNode }

function buildSlides(r: Recap, label: string, locale: string, t: TFn, authorPhotoUrl?: string): Slide[] {
  const footer = label
  const slides: Slide[] = []

  // 1) Intro / headline
  slides.push({
    key: 'intro',
    accent: '#7c8cff',
    render: () => (
      <Slide accent="#7c8cff" footer={footer}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, color: MUTED, margin: 0 }}>{t('recapTitle')}</p>
          <p style={{ fontSize: 30, fontWeight: 800, margin: '6px 0 22px' }}>{label}</p>
          <p style={{ fontSize: 84, fontWeight: 900, lineHeight: 0.95, margin: 0 }}>{r.counts.total}</p>
          <p style={{ fontSize: 18, color: MUTED, margin: '4px 0 0' }}>{t('recapFinishedTotal')}</p>
        </div>
      </Slide>
    ),
  })

  // 2) Breakdown by type + volume
  slides.push({
    key: 'breakdown',
    accent: '#e0a458',
    render: () => (
      <Slide accent="#e0a458" footer={footer}>
        <p style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 20px' }}>{t('recapBreakdown')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {r.counts.books > 0 && statRow(<IoBookOutline size={20} />, r.counts.books, t('books'), TYPE_COLOR.book)}
          {r.counts.movies > 0 && statRow(<IoFilmOutline size={20} />, r.counts.movies, t('movies'), TYPE_COLOR.movie)}
          {r.counts.series > 0 && statRow(<IoTvOutline size={20} />, r.counts.series, t('seriesPlural'), TYPE_COLOR.series)}
          {r.pages > 0 && statRow(<IoLibraryOutline size={20} />, fmtInt(r.pages, locale), t('statsPages'), '#c2557a')}
          {r.minutes > 0 && statRow(<IoTimeOutline size={20} />, fmtDuration(r.minutes), t('recapTimeSpent'), '#4fd1c5')}
        </div>
      </Slide>
    ),
  })

  // 3) Most-read author
  if (r.authors.length) {
    const top = r.authors[0]
    slides.push({
      key: 'author',
      accent: '#e0a458',
      render: () => (
        <Slide accent="#e0a458" footer={footer}>
          <p style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 18px' }}>{t('recapMostReadAuthor')}</p>
          <div style={{ marginBottom: 18 }}>
            <PersonPhoto url={authorPhotoUrl} size={96} />
          </div>
          <p style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>{top.name}</p>
          <p style={{ fontSize: 15, color: MUTED, margin: '6px 0 0' }}>{t('recapAuthorCount', { n: top.count })}</p>
          {r.authors.length > 1 && (
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.authors.slice(1, 5).map((a) => (
                <div key={a.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: MUTED }}>
                  <span style={{ color: INK }}>{a.name}</span>
                  <span>{a.count}</span>
                </div>
              ))}
            </div>
          )}
        </Slide>
      ),
    })
  }

  // 4) Top rated
  if (r.topRated.length) {
    slides.push({
      key: 'toprated',
      accent: '#f5a623',
      render: () => (
        <Slide accent="#f5a623" footer={footer}>
          <p style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 18px' }}>{t('recapTopRated')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {r.topRated.map((i) => (
              <div key={i.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Cover url={i.coverUrl} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</p>
                  <p style={{ fontSize: 12, color: MUTED, margin: '2px 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.author}</p>
                  <Stars rating={i.rating || 0} size={14} />
                </div>
              </div>
            ))}
          </div>
        </Slide>
      ),
    })
  }

  // 5) The full list (cover wall)
  if (r.items.length) {
    const shown = r.items.slice(0, 12)
    const more = r.items.length - shown.length
    slides.push({
      key: 'list',
      accent: '#4fd1c5',
      render: () => (
        <Slide accent="#4fd1c5" footer={footer}>
          <p style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 16px' }}>{t('recapEverything')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {shown.map((i) => <Cover key={i.id} url={i.coverUrl} w={72} h={108} />)}
          </div>
          {more > 0 && <p style={{ fontSize: 14, color: MUTED, margin: '16px 0 0', textAlign: 'center' }}>{t('recapAndMore', { n: more })}</p>}
        </Slide>
      ),
    })
  }

  // 6) Ratings distribution
  if (r.ratedCount) {
    const max = Math.max(1, ...r.ratingCounts)
    slides.push({
      key: 'ratings',
      accent: '#c2557a',
      render: () => (
        <Slide accent="#c2557a" footer={footer}>
          <p style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 6px' }}>{t('statsRatings')}</p>
          <p style={{ fontSize: 40, fontWeight: 900, margin: '0 0 18px' }}>{r.avgRating.toFixed(2)}<span style={{ fontSize: 16, color: MUTED, fontWeight: 600 }}> {t('recapAvg')}</span></p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 180 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                <div style={{ width: '100%', borderRadius: 4, height: `${(r.ratingCounts[n] / max) * 100}%`, minHeight: r.ratingCounts[n] ? 4 : 0, background: `hsl(${Math.round(((n - 1) / 9) * 120)}, 62%, 52%)` }} />
                <span style={{ fontSize: 9, color: MUTED }}>{(n / 2).toFixed(1)}</span>
              </div>
            ))}
          </div>
        </Slide>
      ),
    })
  }

  return slides
}

// Download one card node as a PNG.
async function downloadCard(node: HTMLElement, name: string) {
  await waitForImages(node)
  const url = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: BG })
  const a = document.createElement('a')
  a.download = `${name}.png`
  a.href = url
  a.click()
}

export default function RecapStories({ open, onClose, recap, label, locale, t, authorPhotoUrl }: {
  open: boolean
  onClose: () => void
  recap: Recap
  label: string
  locale: string
  t: TFn
  /** Photo of the most-read author (recap.authors[0]), shown on the author slide in place of a book cover. */
  authorPhotoUrl?: string
}) {
  const slides = useMemo(() => buildSlides(recap, label, locale, t, authorPhotoUrl), [recap, label, locale, t, authorPhotoUrl])
  const nodes = useRef<(HTMLDivElement | null)[]>([])
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)

  // Step the carousel; scrolls the target card into view (mobile) after commit.
  const go = useCallback((d: number) => {
    setActive((a) => {
      const next = Math.min(slides.length - 1, Math.max(0, a + d))
      requestAnimationFrame(() => {
        const el = scroller.current?.children[next] as HTMLElement | undefined
        el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      })
      return next
    })
  }, [slides.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, go])

  if (!open || typeof document === 'undefined') return null

  const slug = label.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'recap'

  const onScroll = () => {
    const s = scroller.current
    if (!s) return
    const center = s.scrollLeft + s.clientWidth / 2
    let best = 0, bestDist = Infinity
    Array.from(s.children).forEach((c, i) => {
      const el = c as HTMLElement
      const mid = el.offsetLeft + el.offsetWidth / 2
      const dist = Math.abs(mid - center)
      if (dist < bestDist) { bestDist = dist; best = i }
    })
    setActive(best)
  }

  const saveOne = async (i: number) => {
    const node = nodes.current[i]
    if (!node) return
    setBusy(true)
    try { await downloadCard(node, `${slug}-${slides[i].key}`) } finally { setBusy(false) }
  }

  const saveAll = async () => {
    setBusy(true)
    try {
      for (let i = 0; i < slides.length; i++) {
        const node = nodes.current[i]
        if (node) await downloadCard(node, `${slug}-${String(i + 1).padStart(2, '0')}-${slides[i].key}`)
      }
    } finally { setBusy(false) }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/85 backdrop-blur-sm" onClick={onClose}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-white">{t('recapTitle')} · <span className="text-white/60">{label}</span></p>
        <div className="flex items-center gap-2">
          <button onClick={saveAll} disabled={busy} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50">
            <IoDownloadOutline className="h-4 w-4" /> {busy ? t('recapSaving') : t('recapSaveAll')}
          </button>
          <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><IoClose className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Progress bars (story style) — mobile only */}
      <div className="flex gap-1 px-4 pb-2 sm:px-6 lg:hidden" onClick={(e) => e.stopPropagation()}>
        {slides.map((s, i) => (
          <span key={s.key} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/20">
            <span className="block h-full rounded-full bg-white transition-all" style={{ width: i < active ? '100%' : i === active ? '100%' : '0%' }} />
          </span>
        ))}
      </div>

      {/* Cards: swipeable carousel on mobile, wrapped grid on desktop */}
      <div
        ref={scroller}
        onScroll={onScroll}
        onClick={(e) => e.stopPropagation()}
        className="flex flex-1 snap-x snap-mandatory items-center gap-4 overflow-x-auto overflow-y-hidden px-[calc(50vw-180px)] scrollbar-none lg:snap-none lg:flex-wrap lg:content-start lg:justify-center lg:overflow-y-auto lg:overflow-x-hidden lg:px-6 lg:py-4"
      >
        {slides.map((s, i) => (
          <div key={s.key} className="group relative shrink-0 snap-center">
            <div
              ref={(el) => { nodes.current[i] = el }}
              style={{ width: CARD_W, height: CARD_H, borderRadius: 22, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
            >
              {s.render()}
            </div>
            <button
              onClick={() => saveOne(i)}
              disabled={busy}
              title={t('recapSaveCard')}
              className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100 disabled:opacity-50"
            >
              <IoDownloadOutline className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Mobile nav arrows */}
      <div className="flex items-center justify-center gap-6 py-4 lg:hidden" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => go(-1)} disabled={active === 0} className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-30"><IoChevronBack className="h-5 w-5" /></button>
        <span className="text-xs text-white/60">{active + 1} / {slides.length}</span>
        <button onClick={() => go(1)} disabled={active === slides.length - 1} className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-30"><IoChevronForward className="h-5 w-5" /></button>
      </div>
    </div>,
    document.body,
  )
}
