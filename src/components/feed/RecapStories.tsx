'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toPng } from 'html-to-image'
import { IoClose, IoDownloadOutline, IoChevronBack, IoChevronForward, IoBookOutline, IoFilmOutline, IoTvOutline, IoStar, IoStarHalf, IoStarOutline, IoTimeOutline, IoLibraryOutline, IoPersonOutline } from 'react-icons/io5'
import type { MediaType } from '@/types'
import type { Recap } from '@/lib/recap'
import { fmtInt, fmtDuration } from '@/lib/recap'
import { mediaPath } from '@/lib/paths'
import ShelfLogo from '@/components/branding/ShelfLogo'
import TypeBadge from '@/components/badges/TypeBadge'

type TFn = (key: string, vars?: Record<string, string | number>) => string

// Fixed dark palette so an exported card looks identical in light or dark mode.
const BG = '#0b0b12'
const INK = '#ffffff'
const MUTED = '#9aa0ad'
const FAINT = '#3a3a45'
const PRIMARY = '#6768ab' // nons primary — theme-invariant, matches --color-nonsprimary
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
    <span style={{ display: 'inline-flex', gap: 1, color: PRIMARY }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const v = (i + 1) * 2
        if (rating >= v) return <IoStar key={i} size={size} />
        if (rating === v - 1) return <IoStarHalf key={i} size={size} />
        return <IoStarOutline key={i} size={size} style={{ color: FAINT }} />
      })}
    </span>
  )
}

// Deterministic hue from a string (title+author), so the same book always
// gets the same generated cover color across renders/exports.
function hashHue(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % 360
}

// Only two sizes are ever passed to Cover (the small list cover and the
// larger cover-wall cover), so the badge's Tailwind size classes are picked
// from that instead of interpolated (arbitrary values must be static for JIT).
function typeBadgeProps(w: number) {
  const small = w <= 44
  return { size: small ? 'h-4 w-4' : 'h-6 w-6', iconSize: small ? 'h-2 w-2' : 'h-3 w-3', textPad: small ? 16 : 24 }
}

// Fallback "cover" for items with no cover image: a generated color field
// with the author at top and the title centered, in place of an empty box.
function MediaCoverDerived({ title, author, type, w, h }: { title?: string; author?: string; type?: MediaType; w: number; h: number }) {
  const hue = hashHue(`${title || ''}${author || ''}`)
  const bg = `hsl(${hue}, 22%, 15%)`
  const { textPad } = typeBadgeProps(w)
  return (
    <span
      style={{
        width: w, height: h, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
        background: bg, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: Math.max(3, Math.round(w * 0.08)), boxSizing: 'border-box',
      }}
    >
      {author && (
        <span style={{ fontSize: Math.max(6, w * 0.11), color: INK, opacity: 0.75, lineHeight: 1.1, paddingRight: type ? textPad : 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
          {author}
        </span>
      )}
      <span style={{ fontSize: Math.max(7, w * 0.14), fontWeight: 800, color: INK, lineHeight: 1.15, textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
        {title}
      </span>
      <span />
    </span>
  )
}

// OpenLibrary (and some other hosts) return a 200 OK with a 1x1 placeholder
// gif for ISBNs with no real cover, instead of a 404 — so "has a URL" isn't
// enough; treat any tiny decoded image as no cover too.
const MIN_COVER_DIM = 4

// The type badge is layered on top of every cover in this component — real
// image or derived fallback alike — so covers in the recap always show what
// kind of media they are.
function Cover({ url, title, author, type, w = 44, h = 66 }: { url?: string; title?: string; author?: string; type?: MediaType; w?: number; h?: number }) {
  const src = corsCover(url)
  const [broken, setBroken] = useState(!src)
  useEffect(() => setBroken(!src), [src])
  const { size, iconSize } = typeBadgeProps(w)
  return (
    <span style={{ position: 'relative', width: w, height: h, flexShrink: 0 }}>
      {broken ? (
        <MediaCoverDerived title={title} author={author} type={type} w={w} h={h} />
      ) : (
        <span style={{ display: 'block', width: w, height: h, borderRadius: 6, overflow: 'hidden', background: '#1a1a24' }}>
          <img
            src={src}
            crossOrigin="anonymous"
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setBroken(true)}
            onLoad={(e) => {
              const img = e.currentTarget
              if (img.naturalWidth < MIN_COVER_DIM || img.naturalHeight < MIN_COVER_DIM) setBroken(true)
            }}
          />
        </span>
      )}
      {type && <TypeBadge type={type} position="top-1 right-1" size={size} iconSize={iconSize} />}
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

// Builds a smooth cubic-bezier path through a series of points — a lightweight
// "wave" curve (control points sit at each segment's horizontal midpoint, at
// each endpoint's own height) with no charting dependency.
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const midX = (p0.x + p1.x) / 2
    d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`
  }
  return d
}

// Rating distribution as a continuous wave (smooth filled area) across the
// 10 half-star buckets, with each bucket's count labelled above its point.
function RatingWave({ counts }: { counts: number[] }) {
  const W = 300
  const H = 130
  const TOP_PAD = 22 // room for the count label above the tallest peak
  const max = Math.max(1, ...counts.slice(1))
  const n = 10
  const points = Array.from({ length: n }, (_, i) => {
    const value = counts[i + 1] || 0
    const x = (i / (n - 1)) * W
    const y = TOP_PAD + (1 - value / max) * (H - TOP_PAD)
    return { x, y, value }
  })
  const linePath = smoothPath(points)
  const areaPath = `${linePath} L ${points[n - 1].x} ${H} L ${points[0].x} ${H} Z`
  const gradId = 'recapWaveFill'

  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.55} />
          <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={PRIMARY} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={PRIMARY} />
          <text x={p.x} y={p.y - 9} fontSize={9} fontWeight={700} fill={INK} textAnchor="middle">{p.value}</text>
          <text x={p.x} y={H + 13} fontSize={9} fill={MUTED} textAnchor="middle">{((i + 1) / 2).toFixed(1)}</text>
        </g>
      ))}
    </svg>
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

function buildSlides(r: Recap, label: string, locale: string, t: TFn, authorPhotoUrl?: string, userName?: string): Slide[] {
  const footer = label
  const slides: Slide[] = []

  // 1) Intro + breakdown, combined — headline total plus the per-type/volume
  // rows on the same card, opened with a personalized "Recap for {name}".
  slides.push({
    key: 'intro',
    accent: '#7c8cff',
    render: () => (
      <Slide accent="#7c8cff" footer={footer}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26 }}>
          <div>
            <p style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, color: MUTED, margin: 0 }}>{label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, margin: '6px 0 16px' }}>
              {userName ? t('recapForName', { name: userName }) : t('recapTitle')}
            </p>
            <p style={{ fontSize: 64, fontWeight: 900, lineHeight: 0.95, margin: 0 }}>{r.counts.total}</p>
            <p style={{ fontSize: 16, color: MUTED, margin: '4px 0 0' }}>{t('recapFinishedTotal')}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {r.counts.books > 0 && statRow(<IoBookOutline size={18} />, r.counts.books, t('books'), TYPE_COLOR.book)}
            {r.counts.movies > 0 && statRow(<IoFilmOutline size={18} />, r.counts.movies, t('movies'), TYPE_COLOR.movie)}
            {r.counts.series > 0 && statRow(<IoTvOutline size={18} />, r.counts.series, t('seriesPlural'), TYPE_COLOR.series)}
            {r.pages > 0 && statRow(<IoLibraryOutline size={18} />, fmtInt(r.pages, locale), t('statsPages'), '#c2557a')}
            {r.minutes > 0 && statRow(<IoTimeOutline size={18} />, fmtDuration(r.minutes), t('recapTimeSpent'), '#4fd1c5')}
          </div>
        </div>
      </Slide>
    ),
  })

  // 2) Most-read author
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

  // 3) Top rated
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
                <Cover url={i.coverUrl} title={i.title} author={i.author} type={i.type} />
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

  // 4) Ratings distribution — a continuous wave across the 10 half-star
  // buckets, each point labelled with its count, plus how many reviews were
  // written this period (only when there are any).
  if (r.ratedCount) {
    slides.push({
      key: 'ratings',
      accent: '#c2557a',
      render: () => (
        <Slide accent="#c2557a" footer={footer}>
          <p style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 6px' }}>{t('statsRatings')}</p>
          <p style={{ fontSize: 40, fontWeight: 900, margin: '0 0 8px' }}>{r.avgRating.toFixed(2)}<span style={{ fontSize: 16, color: MUTED, fontWeight: 600 }}> {t('recapAvg')}</span></p>
          <RatingWave counts={r.ratingCounts} />
          {r.reviewCount > 0 && (
            <p style={{ fontSize: 14, color: MUTED, margin: '18px 0 0' }}>
              {t('recapReviewsWritten')} <span style={{ color: INK, fontWeight: 700 }}>{r.reviewCount}</span>
            </p>
          )}
        </Slide>
      ),
    })
  }

  // 5) The full list (cover wall) — paginated across as many cards as needed
  // (12 covers each) so every finished item is shown, rather than truncating
  // with a "+N more" note. Each cover shows its rating below and, in the live
  // preview, links out to the title's page (inert once exported to PNG).
  if (r.items.length) {
    const PER_PAGE = 12
    const pageCount = Math.ceil(r.items.length / PER_PAGE)
    for (let p = 0; p < pageCount; p++) {
      const chunk = r.items.slice(p * PER_PAGE, (p + 1) * PER_PAGE)
      slides.push({
        key: `list-${p}`,
        accent: '#4fd1c5',
        render: () => (
          <Slide accent="#4fd1c5" footer={footer}>
            <p style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 16px' }}>
              {t('recapEverything')}
              {pageCount > 1 && <span style={{ color: MUTED, fontWeight: 600 }}> {p + 1}/{pageCount}</span>}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {chunk.map((i) => (
                <a
                  key={i.id}
                  href={mediaPath({ type: i.type, uuid: i.uuid, id: i.id })}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                >
                  <Cover url={i.coverUrl} title={i.title} author={i.author} type={i.type} w={72} h={108} />
                  {typeof i.rating === 'number' && i.rating > 0 ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: PRIMARY }}>★ {(i.rating / 2).toFixed(1)}</span>
                  ) : (
                    <span style={{ fontSize: 11, color: MUTED }}>—</span>
                  )}
                </a>
              ))}
            </div>
          </Slide>
        ),
      })
    }
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

export default function RecapStories({ open, onClose, recap, label, locale, t, authorPhotoUrl, userName }: {
  open: boolean
  onClose: () => void
  recap: Recap
  label: string
  locale: string
  t: TFn
  /** Photo of the most-read author (recap.authors[0]), shown on the author slide in place of a book cover. */
  authorPhotoUrl?: string
  /** The signed-in user's display name, for the "Recap for {name}" header. */
  userName?: string
}) {
  const slides = useMemo(
    () => buildSlides(recap, label, locale, t, authorPhotoUrl, userName),
    [recap, label, locale, t, authorPhotoUrl, userName],
  )
  const nodes = useRef<(HTMLDivElement | null)[]>([])
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  // On mobile the card (fixed 360×640, a full story-sized card) can be taller
  // than the space left between the toolbar and the nav arrows, cropping its
  // top/bottom. `scale` shrinks it to fit that space visually — applied to a
  // wrapper *around* the captured node, never to the node itself, so the
  // exported PNG is always captured at full native resolution regardless of
  // how small it's shown on screen. 1 on desktop (the wrapped grid needs no fit).
  const [scale, setScale] = useState(1)
  // Below lg the layout is the single-card mobile carousel (needs the
  // scale-to-fit + centering padding below); at/above lg it's the desktop
  // wrapped grid, which needs neither.
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    if (!open) return
    const el = scroller.current
    if (!el) return
    const update = () => {
      const desktop = window.innerWidth >= 1024
      setIsDesktop(desktop)
      if (desktop) { setScale(1); return }
      const s = Math.min(1, (el.clientHeight - 16) / CARD_H, (el.clientWidth - 32) / CARD_W)
      setScale(Math.max(0.4, s))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [open])

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
        style={!isDesktop ? { paddingLeft: `calc(50vw - ${(CARD_W * scale) / 2}px)`, paddingRight: `calc(50vw - ${(CARD_W * scale) / 2}px)` } : undefined}
        className="flex min-h-0 flex-1 snap-x snap-mandatory items-center gap-4 overflow-x-auto overflow-y-hidden scrollbar-none lg:snap-none lg:flex-wrap lg:content-start lg:justify-center lg:overflow-y-auto lg:overflow-x-hidden lg:px-6 lg:py-4"
      >
        {slides.map((s, i) => (
          <div
            key={s.key}
            className="group relative shrink-0 snap-center"
            style={{ width: CARD_W * scale, height: CARD_H * scale }}
          >
            {/* Visual scaler — shrinks the card on screen only; the captured
                node below it keeps its native 360×640 layout size untouched. */}
            <div
              style={{
                width: CARD_W,
                height: CARD_H,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                borderRadius: 22,
                overflow: 'hidden',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              }}
            >
              <div ref={(el) => { nodes.current[i] = el }} style={{ width: CARD_W, height: CARD_H }}>
                {s.render()}
              </div>
            </div>
            <button
              onClick={() => saveOne(i)}
              disabled={busy}
              title={t('recapSaveCard')}
              className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white opacity-100 transition-opacity hover:bg-black/70 disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100"
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
