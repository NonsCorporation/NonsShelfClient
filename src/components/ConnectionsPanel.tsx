'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/lib/router'
import {
  IoLayersOutline,
  IoGitNetworkOutline,
  IoChevronBack,
  IoChevronForward,
  IoSparklesOutline,
} from 'react-icons/io5'
import { connectionService } from '../services/connectionService'
import { mediaPath } from '../lib/paths'
import { useLanguage } from '../contexts/LanguageContext'
import type { Connections, MediaSummary, WorkRelationView } from '../types'

// Read-only "Connections" panel on a book/film page: the work's series
// membership (with neighbours), the universe it belongs to (with sibling
// series), and its typed edges (adaptations, remakes…). Renders nothing until
// there's something to show, so it's safe to drop onto every media page.
export default function ConnectionsPanel({ mediaId }: { mediaId: string }) {
  const { t } = useLanguage()
  const [data, setData] = useState<Connections | null>(null)

  useEffect(() => {
    let cancelled = false
    connectionService.getConnections(mediaId).then((c) => {
      if (!cancelled) setData(c)
    })
    return () => {
      cancelled = true
    }
  }, [mediaId])

  if (!data) return null
  const { series, franchises, relations } = data
  if (series.length === 0 && franchises.length === 0 && relations.length === 0) return null

  // Group typed edges under a human label derived from kind + direction.
  const relationGroups = groupRelations(relations, t)

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <IoGitNetworkOutline className="h-4 w-4 text-[var(--text-muted)]" />
        <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          {t('connectionsTitle') || 'Connections'}
        </h3>
      </div>

      {/* ── Series memberships ── */}
      {series.map((m) => (
        <div key={`s-${m.series.id}`} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Link to={`/series/${m.series.uuid}`} className="group flex min-w-0 items-center gap-2">
              <IoLayersOutline className="h-4 w-4 flex-shrink-0 text-nonsprimary" />
              <span className="truncate text-sm font-semibold text-[var(--text)] group-hover:text-nonsprimary">
                {m.series.name}
              </span>
              {m.series.role && m.series.role !== 'main' && (
                <span className="flex-shrink-0 rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  {t(`role_${m.series.role}`) || m.series.role}
                </span>
              )}
            </Link>
            <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">
              {positionLabel(m.label, m.position, m.total, t)}
            </span>
          </div>
          <div className="flex items-stretch gap-2">
            {m.prev && <NeighborCard media={m.prev} dir="prev" label={t('previous') || 'Previous'} />}
            {m.next && <NeighborCard media={m.next} dir="next" label={t('next') || 'Next'} />}
          </div>
        </div>
      ))}

      {/* ── Franchise / universe memberships ── */}
      {franchises.map((f) => (
        <div key={`f-${f.franchise.id}`} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Link to={`/franchise/${f.franchise.uuid}`} className="group flex min-w-0 items-center gap-2">
              <IoSparklesOutline className="h-4 w-4 flex-shrink-0 text-nonsprimary" />
              <span className="truncate text-sm font-semibold text-[var(--text)] group-hover:text-nonsprimary">
                {f.franchise.name}
              </span>
            </Link>
            {f.saga && <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">{f.saga}</span>}
          </div>
          {f.siblings.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {f.siblings.map((s) => (
                <Link
                  key={s.id}
                  to={`/series/${s.uuid}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]"
                >
                  <IoLayersOutline className="h-3 w-3" />
                  {s.name}
                  {s.role && s.role !== 'main' && (
                    <span className="opacity-60">· {t(`role_${s.role}`) || s.role}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* ── Typed edges (adaptations, remakes, …) ── */}
      {relationGroups.map((g) => (
        <div key={g.label}>
          <h4 className="mb-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{g.label}</h4>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {g.items.map((r) => (
              <RelatedCard key={r.id} r={r} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

// A compact prev/next card inside a series block.
function NeighborCard({ media, dir, label }: { media: MediaSummary; dir: 'prev' | 'next'; label: string }) {
  return (
    <Link
      to={mediaPath({ type: media.type, uuid: media.uuid, id: String(media.id) })}
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--container)] p-2 transition-colors hover:border-nonsprimary/50 ${dir === 'next' ? 'flex-row-reverse text-right' : ''}`}
    >
      <div className="h-12 w-8 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
        {media.cover_url && <img src={media.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
          {dir === 'prev' ? <IoChevronBack className="h-3 w-3" /> : null}
          {label}
          {dir === 'next' ? <IoChevronForward className="h-3 w-3" /> : null}
        </p>
        <p className="truncate text-xs font-medium text-[var(--text)]">{media.title}</p>
      </div>
    </Link>
  )
}

// A poster card for a related work (adaptation/remake/…).
function RelatedCard({ r }: { r: WorkRelationView }) {
  const m = r.media
  return (
    <Link
      to={mediaPath({ type: m.type, uuid: m.uuid, id: String(m.id) })}
      className="w-28 flex-shrink-0"
      title={m.title}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--container-2)]">
        {m.cover_url && <img src={m.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
        {typeof r.part === 'number' && r.part > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            {`Pt ${r.part}`}
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-xs font-medium text-[var(--text)]">{m.title}</p>
      <p className="truncate text-[11px] text-[var(--text-muted)]">
        {[m.year || undefined, r.note || undefined].filter(Boolean).join(' · ') || ' '}
      </p>
    </Link>
  )
}

// "#5 of 7", or the entry's label ("Prequel") when it has one.
function positionLabel(label: string | undefined, position: number, total: number, t: (k: string) => string): string {
  if (label) return t(`role_${label}`) || label
  const n = Number.isInteger(position) ? String(position) : String(position)
  return `#${n} ${t('ofTotal') || 'of'} ${total}`
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
