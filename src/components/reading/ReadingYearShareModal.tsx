'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toPng } from 'html-to-image'
import { IoClose, IoDownloadOutline, IoShareSocialOutline, IoFlame } from 'react-icons/io5'
import ShelfLogo from '@/components/branding/ShelfLogo'
import { useLanguage } from '@/contexts/LanguageContext'
import { readingService, type ReadingSummary } from '@/services/readingService'
import { corsCover, loadAvatarImage, waitForImages } from '@/lib/shareImage'

// Fixed dark palette so the exported image looks the same in light and dark
// mode — same convention as ProfileShareModal.
const BG = '#000000'
const INK = '#ffffff'
const MUTED = '#9ca3af'
const LINE = '#27272a'
const PRIMARY = '#6768ab'

// 9:16 story card, captured at pixelRatio 3 for a 1080×1920 export.
const CARD_W = 360
const CARD_H = 640

export type ReadingYearShareProps = {
  isOpen: boolean
  onClose: () => void
  year: number
  name: string
  handle: string
  /** The yearly goal, when the reader has set one. */
  goal?: { progress: number; target: number }
  /** The book to feature as "currently reading". */
  current?: { title: string; author?: string; coverUrl?: string }
}

// "My reading year" share card: goal progress, pages/hours/days read, streak and
// the book currently being read, exportable as an image.
export default function ReadingYearShareModal(props: ReadingYearShareProps) {
  if (!props.isOpen || typeof document === 'undefined') return null
  return createPortal(<ShareCard {...props} />, document.body)
}

function ShareCard({ onClose, year, name, handle, goal, current }: ReadingYearShareProps) {
  const { t } = useLanguage()
  const cardRef = useRef<HTMLDivElement>(null)
  const [summary, setSummary] = useState<ReadingSummary | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [coverReady, setCoverReady] = useState(!current?.coverUrl)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [scale, setScale] = useState(() =>
    typeof window === 'undefined' ? 1 : Math.min(1, Math.max(0.45, (window.innerHeight * 0.5) / CARD_H)),
  )

  useEffect(() => {
    const update = () => setScale(Math.min(1, Math.max(0.45, (window.innerHeight * 0.5) / CARD_H)))
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    let cancelled = false
    readingService.getSummary(year).then((s) => {
      if (cancelled) return
      if (s) setSummary(s)
      else setFailed(true)
    })
    return () => { cancelled = true }
  }, [year])

  useEffect(() => {
    const src = corsCover(current?.coverUrl)
    if (!src) return
    let cancelled = false
    loadAvatarImage(src).then((r) => {
      if (cancelled) return
      setCoverUrl(r?.dataUrl ?? null)
      setCoverReady(true)
    })
    return () => { cancelled = true }
  }, [current?.coverUrl])

  useEffect(() => {
    if (!summary || !coverReady || imgUrl || !cardRef.current) return
    const node = cardRef.current
    let cancelled = false
    ;(async () => {
      setBusy(true)
      try {
        await waitForImages(node)
        const url = await toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor: BG })
        if (!cancelled) setImgUrl(url)
      } catch (e) {
        console.error('Reading year share image render failed', e)
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [summary, coverReady, imgUrl])

  const fileName = `${handle || 'reading'}-${year}-shelf.png`

  const save = () => {
    if (!imgUrl) return
    const a = document.createElement('a')
    a.download = fileName
    a.href = imgUrl
    a.click()
  }

  const share = async () => {
    if (!imgUrl) return
    try {
      const blob = await (await fetch(imgUrl)).blob()
      const file = new File([blob], fileName, { type: 'image/png' })
      const data = { title: t('readingYearTitle', { year }), text: t('readingYearShareText', { year }), url: 'https://shelf.nonsapp.com' }
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ ...data, files: [file] })
      else if (navigator.share) await navigator.share(data)
    } catch {
      /* cancelled or unsupported */
    }
  }

  const hours = summary ? Math.round((summary.minutes / 60) * 10) / 10 : 0
  const pct = goal && goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0

  const stat = (value: string | number, label: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 64 }}>
      <span style={{ fontSize: 22, fontWeight: 700 }}>{value}</span>
      <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED }}>{label}</span>
    </div>
  )

  const card = summary && (
    <div
      ref={cardRef}
      style={{
        width: CARD_W,
        height: CARD_H,
        background: `radial-gradient(circle at 50% 12%, rgba(103,104,171,0.4), transparent 62%), ${BG}`,
        color: INK,
        padding: '28px 26px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: INK, display: 'inline-flex' }}>
          <ShelfLogo className="h-5 w-5" />
        </span>
        <span style={{ fontWeight: 300, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>shelf.nonsapp.com</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED }}>{name}</p>
        <p style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 800, lineHeight: 1.15 }}>{t('readingYearTitle', { year })}</p>

        {goal && goal.target > 0 && (
          <div style={{ width: '100%', marginTop: 26 }}>
            <p style={{ margin: 0, fontSize: 52, fontWeight: 800, lineHeight: 1 }}>
              {goal.progress}
              <span style={{ fontSize: 22, fontWeight: 600, color: MUTED }}> / {goal.target}</span>
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED }}>{t('cardBooks')}</p>
            <div style={{ height: 8, borderRadius: 999, background: LINE, marginTop: 14, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: PRIMARY, borderRadius: 999 }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 18, marginTop: 28, paddingTop: 22, borderTop: `1px solid ${LINE}`, width: '100%', justifyContent: 'center' }}>
          {summary.pages > 0 && stat(summary.pages.toLocaleString(), t('cardPages'))}
          {summary.minutes > 0 && stat(hours, t('cardHours'))}
          {stat(summary.active_days, t('cardActiveDays'))}
          {summary.streak.longest > 0 && stat(summary.streak.longest, t('cardStreak'))}
        </div>
      </div>

      <div style={{ minHeight: 84 }}>
        {current && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#111113', border: `1px solid ${LINE}`, borderRadius: 16, padding: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {coverUrl && <img src={coverUrl} alt="" style={{ width: 44, height: 66, objectFit: 'cover', borderRadius: 6, display: 'block' }} />}
            <div style={{ minWidth: 0, textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED }}>{t('cardCurrentlyReading')}</p>
              <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {current.title}
              </p>
              {current.author && <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED }}>{current.author}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold tracking-wide text-[var(--text)]">
            <IoFlame className="h-5 w-5 text-nonsprimary" />
            {t('shareReadingYear')}
          </h3>
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
          ) : card ? (
            <div style={{ width: CARD_W, height: CARD_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{card}</div>
          ) : null}
          {(busy || (!summary && !failed)) && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
            </div>
          )}
          {failed && !imgUrl && (
            <p role="alert" className="px-6 text-center text-sm text-[var(--text-muted)]">{t('shareCardError')}</p>
          )}
        </div>

        <div className="flex gap-2">
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={share}
              disabled={!imgUrl}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary-soft)] py-2.5 text-sm font-medium text-nonsprimary transition-colors hover:bg-[var(--primary-ring)] disabled:opacity-50"
            >
              <IoShareSocialOutline className="h-4 w-4" />
              {t('share')}
            </button>
          )}
          <button
            onClick={save}
            disabled={!imgUrl}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary-soft)] py-2.5 text-sm font-medium text-nonsprimary transition-colors hover:bg-[var(--primary-ring)] disabled:opacity-50"
          >
            <IoDownloadOutline className="h-4 w-4" />
            {t('saveAsImage')}
          </button>
        </div>
      </div>
    </div>
  )
}
