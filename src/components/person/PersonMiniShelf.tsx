'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/lib/router'
import { IoBookOutline, IoFilmOutline, IoStar } from 'react-icons/io5'
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
      <h3 className="mb-3 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
        {t('personYourShelf')}
      </h3>
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
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
