'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoStar } from 'react-icons/io5'
import { Link } from '@/lib/router'
import { mediaPath, userPath } from '@/lib/paths'
import { fetchPublicProfile, type PublicProfile } from '@/services/userService'
import { libraryService } from '@/services/libraryService'
import { BANNER_SIZE } from '@/lib/bannerSize'
import { TYPE_META } from '@/lib/typeMeta'
import type { MediaItem, MediaType } from '@/types'
import { useLanguage } from '@/contexts/LanguageContext'
import { useFloatingPosition } from '@/hooks/useFloatingPosition'
import BoringAvatar from '@/components/ui/BoringAvatar'
import BookCover from '@/components/media/BookCover'
import BannerArt from '@/components/profile/BannerArt'

/** What the card shows: the profile and the small shelf stats. */
type CardData = {
  profile: PublicProfile
  counts: Record<MediaType, number>
  /** Average rating out of 5; 0 when they haven't rated anything. */
  avg: number
  /** The first few things they are in the middle of, and how many there are in all. */
  progress: { items: MediaItem[]; total: number }
}

/** How many in-progress covers the card shows before collapsing the rest into "+n". */
const PROGRESS_SHOWN = 3

// Cache per username for the session — the same author shows up on many posts and
// in many replies, and shouldn't re-fetch (profile, counts and shelf) each time.
const cardCache = new Map<string, Promise<CardData | null>>()
function loadCard(username: string): Promise<CardData | null> {
  let p = cardCache.get(username)
  if (!p) {
    p = fetchCard(username)
    cardCache.set(username, p)
  }
  return p
}

async function fetchCard(username: string): Promise<CardData | null> {
  const profile = await fetchPublicProfile(username)
  if (!profile) return null
  // Everything past the profile is best-effort: a failed lookup just leaves that part out.
  const [book, movie, series, avg, progress] = await Promise.all([    libraryService.countLibrary({ type: 'book' }, profile.id).catch(() => 0),
    libraryService.countLibrary({ type: 'movie' }, profile.id).catch(() => 0),
    libraryService.countLibrary({ type: 'series' }, profile.id).catch(() => 0),
    libraryService.getRatingAverage(profile.id).catch(() => ({ average: 0, count: 0 })),
    libraryService
      .searchLibrary({ status: 'active', sort: 'added', dir: 'desc', page: 0, perPage: PROGRESS_SHOWN }, profile.id)
      .catch(() => ({ items: [] as MediaItem[], total: 0 })),
  ])
  return { profile, counts: { book, movie, series }, avg: avg.count > 0 ? avg.average / 2 : 0, progress }
}

// Wraps a user's name or avatar so hovering it after a short delay shows a small
// profile preview card — banner, avatar, name, @username and
// shelf stats. Mirrors InfoTooltip's portal-to-body + useFloatingPosition
// pattern, so the card can't get clipped by a scrollable/overflow-hidden
// ancestor (e.g. a comment thread).
export default function UserHoverCard({ username, children }: { username: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [card, setCard] = useState<CardData | null | undefined>(undefined)
  const ref = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Opens below the name by default; flips above it when the card (whose height
  // depends on what it has to show) wouldn't fit below and there is more room above.
  const [openUp, setOpenUp] = useState(false)
  const coords = useFloatingPosition(ref, open, openUp)

  useLayoutEffect(() => {
    if (!open || !coords || !panelRef.current || !ref.current) return
    const height = panelRef.current.offsetHeight
    const r = ref.current.getBoundingClientRect()
    const margin = 14 // the 6px gap plus a little breathing room from the screen edge
    const below = window.innerHeight - r.bottom - margin
    const above = r.top - margin
    setOpenUp(height > below && above > below)
  }, [open, card, coords])

  const scheduleOpen = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(true), 350)
  }
  const scheduleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(false), 150)
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    loadCard(username).then((c) => {
      if (!cancelled) setCard(c)
    })
    return () => {
      cancelled = true
    }
  }, [open, username])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return (
    <span
      ref={ref}
      className="relative inline-block"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      {children}
      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current) }}
          onMouseLeave={scheduleClose}
          style={{ position: 'fixed', left: Math.min(coords.left, window.innerWidth - 272), top: coords.top, bottom: coords.bottom }}
          className="animate-fade-up z-[110] w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--container)_96%,transparent)] shadow-2xl backdrop-blur-xl"
        >
          {card === undefined ? (
            <div className="flex items-center gap-2.5 p-3">
              <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-[var(--surface-hover)]" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-hover)]" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-[var(--surface-hover)]" />
              </div>
            </div>
          ) : card === null ? (
            <p className="p-3 text-xs text-[var(--text-muted)]">@{username}</p>
          ) : (
            <UserPreview card={card} />
          )}
        </div>,
        document.body,
      )}
    </span>
  )
}

// The card body: banner (Horizon members), avatar over its edge, name, @username
// and the small shelf stats.
function UserPreview({ card }: { card: CardData }) {
  const { t } = useLanguage()
  const { profile, counts, avg, progress } = card
  const more = progress.total - progress.items.length
  const types = (['book', 'movie', 'series'] as const).filter((tp) => counts[tp] > 0)
  return (
    <div>
      <Link to={userPath(profile.username)} className="block">
        <BannerArt color={profile.bannerColor} avatarUrl={profile.avatarUrl} avatarSeed={`user-${profile.id}`} className={BANNER_SIZE.hover} />
        <div className="px-3">
        <span className={`relative block h-11 w-11 overflow-hidden rounded-full z-10 -mt-5 ring-4 ring-[var(--container)]`}>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
          ) : (
            <BoringAvatar size={44} name={`user-${profile.id}`} />
          )}
        </span>
        <span className="mt-1.5 block truncate text-sm font-semibold text-[var(--text)]">{profile.name}</span>
        <span className="block truncate text-xs text-[var(--text-muted)]">@{profile.username}</span>
        {(types.length > 0 || avg > 0) && (
          <span className="mt-2.5 flex items-center gap-3 border-t border-[var(--border-subtle)] pt-2.5">
            {types.map((tp) => {
              const meta = TYPE_META[tp]
              const Icon = meta.icon
              return (
                <span key={tp} className="flex items-center gap-1 text-xs font-semibold text-[var(--text)]">
                  <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                  {counts[tp]}
                </span>
              )
            })}
            {avg > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-[var(--text)]">
                <IoStar className="h-3.5 w-3.5 text-nonsprimaryfocus" />
                {avg.toFixed(1)}
              </span>
            )}
          </span>
        )}
        </div>
      </Link>

      {progress.items.length > 0 && (
        <div className="px-3 pb-3 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t('shelfActive')}</p>
          <div className="flex items-start gap-2">
            {progress.items.map((it) => (
              <Link key={it.id} to={mediaPath(it)} title={it.title} className="w-[3.4rem] flex-shrink-0">
                <span className="relative block aspect-[2/3] overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--container-2)]">
                  <BookCover url={it.coverUrl} title={it.title} author={it.author} alt={it.title} />
                </span>
                <span className="mt-1 line-clamp-2 block text-[10px] leading-tight text-[var(--text)]">{it.title}</span>
              </Link>
            ))}
            {more > 0 && (
              <span className="flex aspect-[2/3] w-[3.4rem] flex-shrink-0 items-center justify-center rounded-md border border-dashed border-[var(--border)] text-xs font-semibold text-[var(--text-muted)]">
                +{more}
              </span>
            )}
          </div>
        </div>
      )}
      {progress.items.length === 0 && <div className="pb-3" />}
    </div>
  )
}
