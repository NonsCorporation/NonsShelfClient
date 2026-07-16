'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toPng } from 'html-to-image'
import QRCode from 'qrcode'
import {
  IoClose,
  IoCopyOutline,
  IoCheckmark,
  IoDownloadOutline,
  IoShareSocialOutline,
  IoLogoWhatsapp,
  IoLogoTwitter,
  IoLogoFacebook,
  IoBookOutline,
  IoChatbubbleEllipsesOutline,
  IoStar,
  IoOpenOutline,
} from 'react-icons/io5'
import { FaTelegram } from 'react-icons/fa'
import ShelfLogo from '@/components/branding/ShelfLogo'
import { useLanguage } from '@/contexts/LanguageContext'

type TFn = (key: string, vars?: Record<string, string | number>) => string

// Fixed dark palette so the exported image looks identical regardless of the
// app's light/dark theme — matches ShareModal.tsx's share-card convention.
const BG = '#000000'
const INK = '#ffffff'
const MUTED = '#9ca3af'
const LINE = '#27272a'
const PRIMARY = '#6768ab' // nons primary

// Instagram Story aspect ratio (9:16) — same card size convention as
// RecapStories.tsx, rendered at pixelRatio 3 for a full 1080×1920 export.
const CARD_W = 360
const CARD_H = 640

// Several avatar hosts (nons-server, Google, etc.) don't send CORS headers, so
// an <img crossOrigin="anonymous"> request fails outright and html-to-image
// can't capture it. Route through a CORS-enabled proxy, same as ShareModal.
function corsCover(url?: string): string | undefined {
  if (!url) return undefined
  if (!/^https?:\/\//i.test(url)) return url
  const upstream = 'ssl:' + url.replace(/^https?:\/\//i, '')
  return `https://images.weserv.nl/?url=${encodeURIComponent(upstream)}`
}

async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) =>
      img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = () => res(null) }),
    ),
  )
}

type AvatarLoad = { dataUrl: string; color: { r: number; g: number; b: number } | null }

// Loads the avatar cross-origin exactly once and derives both a same-origin
// data: URL (so html-to-image can capture it without tainting the canvas) and
// its dominant accent color (for the card's background glow) — mirrors
// ShareModal.tsx's loadCoverImage.
function loadAvatarImage(src: string): Promise<AvatarLoad | null> {
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

        // Sample a small region for the dominant accent color.
        const size = 60
        const sampleCanvas = document.createElement('canvas')
        sampleCanvas.width = size
        sampleCanvas.height = size
        const sampleCtx = sampleCanvas.getContext('2d')
        let color: { r: number; g: number; b: number } | null = null
        if (sampleCtx) {
          sampleCtx.drawImage(img, 0, 0, size, size)
          const { data } = sampleCtx.getImageData(0, 0, size, size)
          let bestScore = -1
          let bestR = 0, bestG = 0, bestB = 0
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
            if (a < 128) continue
            const max = Math.max(r, g, b), min = Math.min(r, g, b)
            const sat = max === 0 ? 0 : (max - min) / max
            const score = sat * (max / 255)
            if (score > bestScore) { bestScore = score; bestR = r; bestG = g; bestB = b }
          }
          color = bestScore > 0.08 ? { r: bestR, g: bestG, b: bestB } : null
        }
        resolve({ dataUrl, color })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export type ProfileShareStats = {
  name: string
  handle: string
  avatar: string
  typeCounts: { book: number; movie: number; series: number }
  ratedAvg: number
  reviewCount: number
}

type Props = {
  isOpen: boolean
  stats: ProfileShareStats
  shelfUrl: string
  nonsUrl: string
  onClose: () => void
}

export default function ProfileShareModal({ isOpen, stats, shelfUrl, nonsUrl, onClose }: Props) {
  const { t } = useLanguage() as { t: TFn }
  const cardRef = useRef<HTMLDivElement>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null)
  const [avatarReady, setAvatarReady] = useState(false)
  const [accent, setAccent] = useState<{ r: number; g: number; b: number } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  // Shrinks the 360×640 card to fit the viewport (mirrors RecapStories.tsx) —
  // applied only to the on-screen wrapper, never to the captured node itself,
  // so the exported PNG stays a full-resolution 1080×1920 regardless of how
  // small the preview renders on a short screen.
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (!isOpen) return
    const update = () => setScale(Math.min(1, Math.max(0.45, (window.innerHeight * 0.5) / CARD_H)))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setImgUrl(null)
    setCopied(false)
    setAvatarDataUrl(null)
    setAvatarReady(false)
    setAccent(null)
    const src = corsCover(stats.avatar)
    if (!src) { setAvatarReady(true); return }
    loadAvatarImage(src).then((result) => {
      setAvatarDataUrl(result?.dataUrl ?? null)
      setAccent(result?.color ?? null)
      setAvatarReady(true)
    })
  }, [isOpen, stats.avatar])

  useEffect(() => {
    if (!isOpen) return
    setQrDataUrl(null)
    QRCode.toDataURL(shelfUrl, { margin: 1, width: 480, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [isOpen, shelfUrl])

  useEffect(() => {
    if (!isOpen || !avatarReady || !qrDataUrl || imgUrl || !cardRef.current) return
    const node = cardRef.current
    let cancelled = false
    ;(async () => {
      setBusy(true)
      try {
        await waitForImages(node)
        const url = await toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor: BG })
        if (!cancelled) setImgUrl(url)
      } catch (e) {
        console.error('Profile share image render failed', e)
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, avatarReady, qrDataUrl, imgUrl])

  if (!isOpen || typeof document === 'undefined') return null

  const totalAdded = stats.typeCounts.book + stats.typeCounts.movie + stats.typeCounts.series

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shelfUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const saveImage = () => {
    if (!imgUrl) return
    const a = document.createElement('a')
    a.download = `${stats.handle || 'profile'}-shelf.png`
    a.href = imgUrl
    a.click()
  }

  const nativeShare = async () => {
    if (!imgUrl) return
    try {
      const res = await fetch(imgUrl)
      const blob = await res.blob()
      const file = new File([blob], `${stats.handle || 'profile'}-shelf.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: stats.name, url: shelfUrl })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: stats.name, url: shelfUrl })
        return
      }
    } catch {
      /* user cancelled or unsupported — ignore */
    }
  }

  // Neither Telegram's t.me/share/url intent nor WhatsApp/X/Facebook's web
  // intents accept an attached file — they're link-only by design, no matter
  // the app. The only way to actually hand the platform an image from a web
  // page is the OS share sheet (Web Share API with files), which is
  // mobile-only. So: try that first (lets the user pick Telegram etc. from
  // the sheet with the image attached); fall back to the text-only web
  // intent — e.g. on desktop, where the user attaches the downloaded image
  // themselves — only when file sharing isn't available at all.
  const shareToApp = async (webHref: string) => {
    if (imgUrl && typeof navigator !== 'undefined' && navigator.canShare) {
      try {
        const res = await fetch(imgUrl)
        const blob = await res.blob()
        const file = new File([blob], `${stats.handle || 'profile'}-shelf.png`, { type: 'image/png' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: stats.name, url: shelfUrl })
          return
        }
      } catch {
        return // share sheet opened but was cancelled/failed — don't also pop a new tab
      }
    }
    window.open(webHref, '_blank', 'noopener,noreferrer')
  }

  const shareLinks = [
    {
      key: 'whatsapp',
      icon: IoLogoWhatsapp,
      href: `https://wa.me/?text=${encodeURIComponent(`${stats.name} on Nons Shelf — ${shelfUrl}`)}`,
    },
    {
      key: 'telegram',
      icon: FaTelegram,
      href: `https://t.me/share/url?url=${encodeURIComponent(shelfUrl)}&text=${encodeURIComponent(`${stats.name} on Nons Shelf`)}`,
    },
    {
      key: 'x',
      icon: IoLogoTwitter,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(stats.name + ' on Nons Shelf')}&url=${encodeURIComponent(shelfUrl)}`,
    },
    {
      key: 'facebook',
      icon: IoLogoFacebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shelfUrl)}`,
    },
  ]

  const stat = (Icon: typeof IoBookOutline, value: number, label: string, decimals = 0) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 64 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 20, fontWeight: 700 }}>
        <Icon style={{ width: 16, height: 16, color: PRIMARY }} />
        {value.toFixed(decimals)}
      </span>
      <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED }}>{label}</span>
    </div>
  )

  // Background glow tinted with the avatar's dominant accent color (falls
  // back to the nons primary when the avatar hasn't loaded a usable color).
  const glowColor = accent ? `${accent.r},${accent.g},${accent.b}` : '103,104,171'

  // Vertical Instagram Story card — logo up top, identity + stats centered in
  // the middle, QR code anchored near the bottom third, all spaced across the
  // full 9:16 frame instead of a compact top-aligned block.
  const card = (
    <div
      ref={cardRef}
      style={{
        width: CARD_W,
        height: CARD_H,
        background: `radial-gradient(circle at 50% 15%, rgba(${glowColor},0.35), transparent 60%), ${BG}`,
        color: INK,
        padding: '28px 26px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* logo, top */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: INK, display: 'inline-flex' }}>
          <ShelfLogo className="h-5 w-5" />
        </span>
        <span style={{ fontWeight: 300, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          shelf.nonsapp.com
        </span>
      </div>

      {/* identity + stats, centered */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${LINE}` }}>
          {avatarDataUrl ? (
            <img src={avatarDataUrl} alt={stats.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: LINE }} />
          )}
        </div>
        <p style={{ margin: '16px 0 0', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{stats.name}</p>
        <p style={{ margin: '3px 0 0', fontSize: 14, color: MUTED }}>@{stats.handle}</p>

        <div style={{ display: 'flex', gap: 22, marginTop: 24, paddingTop: 20, borderTop: `1px solid ${LINE}` }}>
          {totalAdded > 0 && stat(IoBookOutline, totalAdded, 'Added')}
          {stats.ratedAvg > 0 && stat(IoStar, stats.ratedAvg, 'Avg', 1)}
          {stats.reviewCount > 0 && stat(IoChatbubbleEllipsesOutline, stats.reviewCount, 'Reviews')}
        </div>
      </div>

      {/* QR, anchored near the bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {qrDataUrl && (
          <div style={{ background: '#ffffff', padding: 12, borderRadius: 16 }}>
            <img src={qrDataUrl} alt="QR code" style={{ width: 168, height: 168, display: 'block' }} />
          </div>
        )}
        <p style={{ margin: '12px 0 0', fontSize: 11, color: MUTED }}>Scan to follow on Shelf</p>
      </div>
    </div>
  )

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">{t('shareProfile')}</h3>
          <button
            onClick={onClose}
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
            <img src={imgUrl} alt="" style={{ width: CARD_W * scale, height: CARD_H * scale, display: 'block' }} />
          ) : (
            <div style={{ width: CARD_W, height: CARD_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              {card}
            </div>
          )}
          {busy && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
            </div>
          )}
        </div>

        {/* profile links */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] py-1.5 pl-3 pr-1.5">
            <span className="min-w-0 flex-1 select-all overflow-hidden whitespace-nowrap text-sm text-[var(--text-muted)]">{shelfUrl}</span>
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
          <a
            href={nonsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-nonsprimary hover:underline"
          >
            <IoOpenOutline className="h-4 w-4" />
            {t('viewNonsProfile')}
          </a>
        </div>

        {/* social share */}
        <div className="flex items-center gap-2">
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={nativeShare}
              disabled={!imgUrl}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary-soft)] py-2.5 text-sm font-medium text-nonsprimary transition-colors hover:bg-[var(--primary-ring)] disabled:opacity-50"
            >
              <IoShareSocialOutline className="h-4 w-4" />
              {t('share')}
            </button>
          )}
          {shareLinks.map(({ key, icon: Icon, href }) => (
            <button
              key={key}
              onClick={() => shareToApp(href)}
              disabled={!imgUrl}
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
