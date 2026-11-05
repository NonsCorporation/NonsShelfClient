'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoBookOutline, IoFilmOutline, IoLayersOutline, IoPersonOutline } from 'react-icons/io5'
import { Link } from '@/lib/router'
import { useFloatingPosition } from '@/hooks/useFloatingPosition'
import { useLanguage } from '@/contexts/LanguageContext'
import { loadLinkPreview, type LinkPreview, type LinkRef } from '@/lib/linkPreview'

// undefined = loading, null = couldn't be loaded (deleted, private, offline).
export function useLinkPreview(ref: LinkRef | null, enabled = true): LinkPreview | null | undefined {
  const [state, setState] = useState<{ key: string; value: LinkPreview | null } | null>(null)
  const key = ref ? `${ref.kind}:${ref.id}` : ''
  useEffect(() => {
    if (!ref || !enabled) return
    let cancelled = false
    loadLinkPreview(ref).then((value) => { if (!cancelled) setState({ key, value }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])
  if (!ref) return null
  return state?.key === key ? state.value : undefined
}

function badge(p: LinkPreview, t: (k: string) => string): { label: string; icon: typeof IoBookOutline } {
  if (p.kind === 'list') return { label: t('lists'), icon: IoLayersOutline }
  if (p.kind === 'user') return { label: t('profile') || 'Profile', icon: IoPersonOutline }
  if (p.mediaType === 'book') return { label: t('book'), icon: IoBookOutline }
  return { label: p.mediaType === 'series' ? t('series') : t('film'), icon: IoFilmOutline }
}

function Thumb({ p, size }: { p: LinkPreview; size: 'sm' | 'md' }) {
  const box = p.round
    ? size === 'sm' ? 'h-10 w-10 rounded-full' : 'h-16 w-16 rounded-full'
    : size === 'sm' ? 'h-14 w-10 rounded-md' : 'h-24 w-16 rounded-lg'
  const Icon = badge(p, () => '').icon
  return (
    <span className={`flex flex-shrink-0 items-center justify-center overflow-hidden bg-[var(--container-2)] ${box}`}>
      {p.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Icon className="h-5 w-5 text-[var(--placeholder)]" />
      )}
    </span>
  )
}

function Body({ p, compact }: { p: LinkPreview; compact?: boolean }) {
  const { t } = useLanguage()
  const b = badge(p, t)
  return (
    <span className="min-w-0 flex-1 text-left">
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-nonsprimary">
        <b.icon className="h-3 w-3" />
        SomeShelf · {b.label}
      </span>
      <span className={`mt-0.5 block font-semibold text-[var(--text)] ${compact ? 'line-clamp-2 text-sm' : 'line-clamp-2 text-sm'}`}>{p.title}</span>
      {p.subtitle && <span className="block truncate text-xs text-[var(--text-muted)]">{p.subtitle}</span>}
      {p.description && !compact && (
        <span className="mt-1 line-clamp-2 block text-xs leading-4 text-[var(--text-muted)]">{p.description}</span>
      )}
    </span>
  )
}

/** The card shown under a message that contains a SomeShelf link. */
export function LinkPreviewCard({ link }: { link: LinkRef }) {
  const p = useLinkPreview(link)
  if (p === null) return null
  if (p === undefined) {
    return <div className="mt-2 h-20 w-full max-w-xs animate-pulse rounded-xl bg-[var(--surface-hover)]" />
  }
  return (
    <Link
      to={p.href}
      className="mt-2 flex w-full max-w-xs items-start gap-3 rounded-xl border-l-[3px] border-nonsprimary bg-[var(--container)] p-2.5 text-[var(--text)] no-underline transition-colors hover:bg-[color-mix(in_srgb,var(--container),white_7%)]"
    >
      <Thumb p={p} size="md" />
      <Body p={p} />
    </Link>
  )
}

/** Wraps a SomeShelf link inside message text: hovering it shows a small card. */
export function LinkHoverCard({ link, children }: { link: LinkRef; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const coords = useFloatingPosition(ref, open, false)
  const p = useLinkPreview(link, open)

  const scheduleOpen = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), 350)
  }
  const scheduleClose = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), 150)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <span ref={ref} className="inline" onMouseEnter={scheduleOpen} onMouseLeave={scheduleClose}>
      {children}
      {open && p !== null && coords && typeof document !== 'undefined' && createPortal(
        <div
          onMouseEnter={() => { if (timer.current) clearTimeout(timer.current) }}
          onMouseLeave={scheduleClose}
          style={{ position: 'fixed', left: Math.max(8, Math.min(coords.left, window.innerWidth - 296)), top: coords.top, bottom: coords.bottom }}
          className="animate-fade-up z-[110] w-72 max-w-[calc(100vw-1rem)] rounded-2xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--container)_96%,transparent)] p-3 text-[var(--text)] shadow-2xl backdrop-blur-xl"
        >
          {p === undefined ? (
            <div className="flex items-center gap-3">
              <div className="h-14 w-10 animate-pulse rounded-md bg-[var(--surface-hover)]" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3 w-32 animate-pulse rounded bg-[var(--surface-hover)]" />
                <div className="h-2.5 w-20 animate-pulse rounded bg-[var(--surface-hover)]" />
              </div>
            </div>
          ) : (
            <Link to={p.href} className="flex items-start gap-3 no-underline">
              <Thumb p={p} size="sm" />
              <Body p={p} compact />
            </Link>
          )}
        </div>,
        document.body,
      )}
    </span>
  )
}
