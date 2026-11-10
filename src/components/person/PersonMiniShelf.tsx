'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@/lib/router'
import { IoBookOutline, IoChevronBack, IoChevronForward, IoFilmOutline, IoStar } from 'react-icons/io5'
import { authedFetch } from '@/lib/api'
import { statusLabel, STATUS_COLOR } from '@/lib/shelf'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import type { MediaType, ShelfStatus } from '@/types'

// One of this person's works the viewer has read/seen/started or rated, as
// returned by GET /api/people/:uuid/my-shelf (already de-duplicated server-side,
// so a person who was both actor and producer of a title appears once).
type Work = {
  uuid: string
  type: MediaType
  title: string
  year?: number
  cover_url?: string
  /** Shelf status; empty when the viewer rated it without shelving it. */
  status: ShelfStatus | ''
  /** 1..10, 0 = unrated. */
  rating: number
}

// A small shelf of everything the signed-in viewer has read or seen by a person,
// with their own status and rating on each. Renders nothing for signed-out
// visitors or when there's nothing to show.
export default function PersonMiniShelf({ personUuid }: { personUuid: string }) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [works, setWorks] = useState<Work[]>([])
  const userId = user?.id
  const railRef = useRef<HTMLDivElement>(null)
  // Which directions the row can still scroll — drives the arrow buttons, which
  // exist because the scrollbar is hidden and a mouse wheel only scrolls vertically.
  const [canScroll, setCanScroll] = useState({ back: false, forward: false })

  const measure = useCallback(() => {
    const el = railRef.current
    if (!el) return
    setCanScroll({ back: el.scrollLeft > 4, forward: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])

  // Re-measure when the works load and when the row is resized.
  useEffect(() => {
    measure()
    const el = railRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [works, measure])

  const scrollBy = (dir: 1 | -1) => {
    const el = railRef.current
    if (el) el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.8), behavior: 'smooth' })
  }

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    authedFetch(`/api/people/${personUuid}/my-shelf`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Work[] }) => { if (!cancelled) setWorks(d.items ?? []) })
      .catch(() => { if (!cancelled) setWorks([]) })
    return () => { cancelled = true }
  }, [personUuid, userId])

  if (!userId || works.length === 0) return null

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('personYourShelf')}</h3>
        {(canScroll.back || canScroll.forward) && (
          <div className="flex items-center gap-1">
            {([-1, 1] as const).map((dir) => {
              const enabled = dir === -1 ? canScroll.back : canScroll.forward
              return (
                <button
                  key={dir}
                  type="button"
                  disabled={!enabled}
                  onClick={() => scrollBy(dir)}
                  aria-label={dir === -1 ? 'Scroll left' : 'Scroll right'}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)] disabled:opacity-30 disabled:hover:border-[var(--border-subtle)] disabled:hover:text-[var(--text-muted)]"
                >
                  {dir === -1 ? <IoChevronBack className="h-3.5 w-3.5" /> : <IoChevronForward className="h-3.5 w-3.5" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div ref={railRef} onScroll={measure} className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {works.map((w) => (
          <Link
            key={w.uuid}
            to={`${w.type === 'book' ? '/b' : '/m'}/${w.uuid}`}
            className="group flex w-24 flex-shrink-0 flex-col gap-1.5 sm:w-28"
          >
            <div className="aspect-[2/3] overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--container-2)]">
              {w.cover_url ? (
                <img
                  src={w.cover_url}
                  alt={w.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {w.type === 'book'
                    ? <IoBookOutline className="h-6 w-6 text-[var(--placeholder)]" />
                    : <IoFilmOutline className="h-6 w-6 text-[var(--placeholder)]" />}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-[var(--text)]" title={w.title}>{w.title}</p>
              {w.status && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-[var(--text-muted)]">
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: STATUS_COLOR[w.status] }} />
                  <span className="truncate">{statusLabel(w.type, w.status, t)}</span>
                </p>
              )}
              {w.rating > 0 && (
                <p className="mt-0.5 flex items-center gap-0.5 text-[11px] font-medium text-[var(--text)]">
                  <IoStar className="h-3 w-3 text-nonsprimaryfocus" />
                  {(w.rating / 2).toFixed(1)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
