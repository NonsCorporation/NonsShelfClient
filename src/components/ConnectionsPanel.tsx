'use client'

import { useEffect, useRef, useState } from 'react'
import { Link } from '@/lib/router'
import {
  IoLayersOutline,
  IoGitNetworkOutline,
  IoArrowForward,
  IoChevronBack,
  IoChevronForward,
} from 'react-icons/io5'
import { connectionService } from '../services/connectionService'
import { mediaPath } from '../lib/paths'
import { useLanguage } from '../contexts/LanguageContext'
import type { Connections, SeriesMembership, SeriesPageData, WorkRelationView } from '../types'

// Read-only "Connections" panel on a book/film page: the work's series (shown as
// the full ordered collection with the current title highlighted), the universe
// it belongs to (with sibling series), and its typed edges (adaptations…).
// Renders nothing until there's something to show.
export default function ConnectionsPanel({ mediaId }: { mediaId: string }) {
  const { t } = useLanguage()
  const [data, setData] = useState<Connections | null>(null)
  // Full ordered entries per series uuid (the panel payload only carries
  // neighbours, so we fetch each series to show the whole collection).
  const [seriesItems, setSeriesItems] = useState<Record<string, SeriesPageData['items']>>({})

  useEffect(() => {
    let cancelled = false
    connectionService.getConnections(mediaId).then(async (c) => {
      if (cancelled) return
      setData(c)
      // Fetch every series we render: the work's own series (big rails) plus the
      // sibling series listed under each franchise (compact previews).
      const uuids = new Set<string>()
      c.series.forEach((m) => uuids.add(m.series.uuid))
      c.franchises.forEach((f) => f.siblings.forEach((s) => uuids.add(s.uuid)))
      const entries = await Promise.all(
        [...uuids].map(async (u) => [u, (await connectionService.getSeries(u))?.items ?? []] as const),
      )
      if (!cancelled) setSeriesItems(Object.fromEntries(entries))
    })
    return () => { cancelled = true }
  }, [mediaId])

  if (!data) return null
  const { series, franchises, relations } = data
  if (series.length === 0 && franchises.length === 0 && relations.length === 0) return null

  const relationGroups = groupRelations(relations, t)
  // The series the viewer is already looking at — highlighted in the universe's
  // "all series" list so they know where the current title sits.
  const ownSeriesUuids = new Set(series.map((m) => m.series.uuid))

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <IoGitNetworkOutline className="h-4 w-4 text-[var(--text-muted)]" />
        <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          {t('connectionsTitle') || 'Connections'}
        </h3>
      </div>

      {/* ── Series, shown as the full collection ── */}
      {series.map((m) => (
        <SeriesCard key={`s-${m.series.id}`} m={m} entries={seriesItems[m.series.uuid]} mediaId={mediaId} />
      ))}

      {/* ── Franchise / universe ── */}
      {franchises.map((f) => (
        <div key={`f-${f.franchise.id}`} className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
          <Link
            to={`/franchise/${f.franchise.uuid}`}
            className="group flex items-center justify-between gap-3 bg-gradient-to-r from-[var(--primary-soft)] to-[var(--surface)] px-4 py-3"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-widest text-[var(--text-muted)]">Universe</span>
              <span className="text-[var(--border-strong)]">·</span>
              <span className="truncate text-sm font-semibold text-[var(--text)] group-hover:text-nonsprimary">{f.franchise.name}</span>
            </span>
            {f.saga && <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">{f.saga}</span>}
          </Link>
          {f.siblings.length > 0 && (
            <div className="flex flex-col gap-1.5 bg-[var(--surface)] p-3">
              {f.siblings.map((s) => {
                const its = seriesItems[s.uuid]
                const covers = (its ?? []).map((it) => it.media.cover_url).filter(Boolean).slice(0, 5) as string[]
                const isOwn = ownSeriesUuids.has(s.uuid)
                return (
                  <Link
                    key={s.id}
                    to={`/series/${s.uuid}`}
                    className={`group flex items-center gap-3 rounded-xl border p-2 transition-colors hover:border-nonsprimary/50 ${
                      isOwn ? 'border-nonsprimary/40 bg-[var(--primary-soft)]' : 'border-[var(--border-subtle)] bg-[var(--container)]'
                    }`}
                  >
                    {/* Stacked mini-covers — a brief peek at the series' titles. */}
                    <div className="flex flex-shrink-0 -space-x-3">
                      {covers.length > 0 ? (
                        covers.map((c, i) => (
                          <div
                            key={i}
                            className="h-12 w-8 overflow-hidden rounded border border-[var(--border-subtle)] bg-[var(--container-2)] ring-1 ring-[var(--container)]"
                            style={{ zIndex: covers.length - i }}
                          >
                            <img src={c} alt="" loading="lazy" className="h-full w-full object-cover" />
                          </div>
                        ))
                      ) : (
                        <div className="flex h-12 w-8 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--container-2)]">
                          <IoLayersOutline className="h-4 w-4 text-[var(--text-muted)]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-[var(--text)] group-hover:text-nonsprimary">
                        {s.name}
                        {s.role && s.role !== 'main' && (
                          <span className="flex-shrink-0 rounded-full bg-[var(--primary-soft)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                            {t(`role_${s.role}`) || s.role}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {its ? t('nTitles', { n: its.length }) : ''}
                        {isOwn ? ` · ${t('thisTitle') || 'This'}` : ''}
                      </p>
                    </div>
                    <IoArrowForward className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {/* ── Typed edges (adaptations, remakes…) ── */}
      {relationGroups.map((g) => (
        <div key={g.label}>
          <h4 className="mb-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{g.label}</h4>
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {g.items.map((r) => (
              <RelatedCard key={r.id} r={r} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

// One series shown as its full ordered collection: a header that links to the
// series page, plus a horizontal poster rail (with desktop scroll arrows) where
// the current title is highlighted.
function SeriesCard({ m, entries, mediaId }: { m: SeriesMembership; entries?: SeriesPageData['items']; mediaId: string }) {
  const { t } = useLanguage()
  const railRef = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => railRef.current?.scrollBy({ left: dir * 360, behavior: 'smooth' })
  const isCurrent = (id: number, uuid?: string) => String(id) === mediaId || (!!uuid && uuid === mediaId)
  // Only worth the arrows when the rail is likely to overflow on desktop.
  const showArrows = (entries?.length ?? 0) > 5

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]">
      <Link
        to={`/series/${m.series.uuid}`}
        className="group flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--container)] px-4 py-3"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-widest text-[var(--text-muted)]">Series</span>
          <span className="text-[var(--border-strong)]">·</span>
          <span className="truncate text-sm font-semibold text-[var(--text)] group-hover:text-nonsprimary">{m.series.name}</span>
          {m.series.role && m.series.role !== 'main' && (
            <span className="flex-shrink-0 rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              {t(`role_${m.series.role}`) || m.series.role}
            </span>
          )}
        </span>
        <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
          {positionLabel(m.label, m.position, m.total, t)}
          <IoArrowForward className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
      </Link>

      {/* Poster rail of the whole series, current title highlighted. */}
      <div className="relative">
        {showArrows && (
          <>
            <button
              type="button"
              aria-label="Scroll left"
              onClick={() => scroll(-1)}
              className="absolute left-1.5 top-[44%] z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--container)] text-[var(--text)] shadow-md transition-colors hover:bg-[var(--surface-hover)] sm:flex"
            >
              <IoChevronBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Scroll right"
              onClick={() => scroll(1)}
              className="absolute right-1.5 top-[44%] z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--container)] text-[var(--text)] shadow-md transition-colors hover:bg-[var(--surface-hover)] sm:flex"
            >
              <IoChevronForward className="h-4 w-4" />
            </button>
          </>
        )}
        <div ref={railRef} className="no-scrollbar flex gap-3 overflow-x-auto p-4">
          {(entries ?? []).map((it) => {
            const current = isCurrent(it.media.id, it.media.uuid)
            return (
              <Link
                key={it.media.id}
                to={mediaPath({ type: it.media.type, uuid: it.media.uuid, id: String(it.media.id) })}
                className="group w-[84px] flex-shrink-0 sm:w-[92px]"
                title={it.media.title}
              >
                <div
                  className={`relative aspect-[2/3] w-full overflow-hidden rounded-lg border bg-[var(--container-2)] transition-transform group-hover:-translate-y-0.5 ${
                    current ? 'border-nonsprimary ring-2 ring-nonsprimary/40' : 'border-[var(--border-subtle)]'
                  }`}
                >
                  {it.media.cover_url && (
                    <img src={it.media.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/65 px-1 text-[10px] font-bold text-white backdrop-blur-sm">
                    {it.label ? '★' : it.position}
                  </span>
                  {current && (
                    <span className="absolute inset-x-0 bottom-0 bg-nonsprimary py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-white">
                      {t('thisTitle') || 'This'}
                    </span>
                  )}
                </div>
                <p className={`mt-1 truncate text-center text-[11px] ${current ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
                  {it.media.title}
                </p>
              </Link>
            )
          })}
          {entries === undefined &&
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[126px] w-[84px] flex-shrink-0 animate-pulse rounded-lg bg-[var(--container-2)] sm:w-[92px]" />
            ))}
        </div>
      </div>
    </div>
  )
}

// A poster card for a related work (adaptation/remake/…).
function RelatedCard({ r }: { r: WorkRelationView }) {
  const m = r.media
  return (
    <Link to={mediaPath({ type: m.type, uuid: m.uuid, id: String(m.id) })} className="group w-28 flex-shrink-0" title={m.title}>
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--container-2)] transition-transform group-hover:-translate-y-0.5">
        {m.cover_url && <img src={m.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
        {typeof r.part === 'number' && r.part > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            {`Pt ${r.part}`}
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-xs font-medium text-[var(--text)]">{m.title}</p>
      <p className="truncate text-[11px] text-[var(--text-muted)]">
        {[m.year || undefined, r.note || undefined].filter(Boolean).join(' · ') || ' '}
      </p>
    </Link>
  )
}

// "#5 of 7", or the entry's label ("Prequel") when it has one.
function positionLabel(label: string | undefined, position: number, total: number, t: (k: string) => string): string {
  if (label) return t(`role_${label}`) || label
  return `#${position} ${t('ofTotal') || 'of'} ${total}`
}

type Grouped = { label: string; items: WorkRelationView[] }

// Bucket edges by a friendly label that respects direction (a book sees
// "Adaptations"; the film sees "Based on").
function groupRelations(relations: WorkRelationView[], t: (k: string) => string): Grouped[] {
  const order: string[] = []
  const map = new Map<string, WorkRelationView[]>()
  for (const r of relations) {
    const label = relationLabel(r, t)
    if (!map.has(label)) {
      map.set(label, [])
      order.push(label)
    }
    map.get(label)!.push(r)
  }
  return order.map((label) => ({ label, items: map.get(label)! }))
}

function relationLabel(r: WorkRelationView, t: (k: string) => string): string {
  const outgoing = r.direction === 'outgoing'
  switch (r.kind) {
    case 'adaptation':
      return outgoing ? (t('relAdaptations') || 'Adaptations') : (t('relBasedOn') || 'Based on')
    case 'novelization':
      return outgoing ? (t('relNovelizations') || 'Novelizations') : (t('relAdaptedFrom') || 'Adapted from')
    case 'remake':
      return t('relRemakes') || 'Remakes & versions'
    case 'companion':
      return t('relCompanions') || 'Companions'
    case 'crossover':
      return t('relCrossovers') || 'Crossovers'
    default:
      return t('relRelated') || 'Related'
  }
}
