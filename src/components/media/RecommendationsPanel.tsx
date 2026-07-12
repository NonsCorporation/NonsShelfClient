'use client'

import { useEffect, useRef, useState } from 'react'
import { IoSparklesOutline, IoChevronBack, IoChevronForward } from 'react-icons/io5'
import { Link } from '@/lib/router'
import { mediaPath } from '@/lib/paths'
import { recommendationService } from '@/services/recommendationService'
import { useLanguage } from '@/contexts/LanguageContext'
import TypeBadge from '@/components/badges/TypeBadge'
import type { RecommendationItem, Recommendations } from '@/types'

// Read-only "You might also like" rail on a book/film page. Generation is
// lazy server-side (first request for a work can take a moment while the AI
// runs), so this shows a brief skeleton rather than nothing while loading.
// Renders nothing at all once loaded if there's simply nothing to recommend.
export default function RecommendationsPanel({ mediaId }: { mediaId: string }) {
  const { t } = useLanguage()
  const [data, setData] = useState<Recommendations | null>(null)

  useEffect(() => {
    let cancelled = false
    recommendationService.getRecommendations(mediaId).then((r) => {
      if (!cancelled) setData(r)
    })
    return () => { cancelled = true }
  }, [mediaId])

  if (data && data.ai.length === 0 && data.system.length === 0) return null

  const groups: { label: string; items: RecommendationItem[] }[] = data
    ? [
        data.ai.length > 0 && { label: t('recommendationsAI') || 'You might also like', items: data.ai },
        data.system.length > 0 && { label: t('recommendationsSystem') || 'More like this', items: data.system },
      ].filter((g): g is { label: string; items: RecommendationItem[] } => !!g)
    : []

  return (
    <section className="flex flex-col gap-6">
      {data === null ? (
        <RecommendationsSkeleton />
      ) : (
        groups.map((g) => <RecommendationRail key={g.label} label={g.label} items={g.items} />)
      )}
    </section>
  )
}

// A titled, horizontally-scrolling rail with desktop chevron controls — same
// slider pattern as the book page's editions carousel.
function RecommendationRail({ label, items }: { label: string; items: RecommendationItem[] }) {
  const railRef = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => railRef.current?.scrollBy({ left: dir * 340, behavior: 'smooth' })
  const showArrows = items.length > 4

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <IoSparklesOutline className="h-4 w-4 text-[var(--text-muted)]" />
        <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{label}</h3>
      </div>
      <div className="relative">
        {showArrows && (
          <>
            <button
              type="button"
              aria-label="Scroll left"
              onClick={() => scroll(-1)}
              className="absolute -left-3 top-[38%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--container)] text-[var(--text)] shadow-md transition-colors hover:bg-[var(--surface-hover)] sm:flex"
            >
              <IoChevronBack className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Scroll right"
              onClick={() => scroll(1)}
              className="absolute -right-3 top-[38%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--container)] text-[var(--text)] shadow-md transition-colors hover:bg-[var(--surface-hover)] sm:flex"
            >
              <IoChevronForward className="h-5 w-5" />
            </button>
          </>
        )}
        <div ref={railRef} className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {items.map((item) => (
            <RecommendationCard key={item.media.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}

function RecommendationCard({ item }: { item: RecommendationItem }) {
  const m = item.media
  return (
    <Link
      to={mediaPath({ type: m.type, uuid: m.uuid, id: String(m.id) })}
      className="group w-28 flex-shrink-0"
      title={item.reason || m.title}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--container-2)] transition-transform group-hover:-translate-y-0.5">
        {m.cover_url && <img src={m.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
        <TypeBadge type={m.type} position="top-1.5 right-1.5" size="h-6 w-6" iconSize="h-3 w-3" />
      </div>
      <p className="mt-1 truncate text-xs font-medium text-[var(--text)]">{m.title}</p>
      <p className="truncate text-[11px] text-[var(--text-muted)]">
        {[m.author || m.director, m.year || undefined].filter(Boolean).join(' · ') || ' '}
      </p>
    </Link>
  )
}

function RecommendationsSkeleton() {
  return (
    <div>
      <div className="mb-2 h-3 w-40 animate-pulse rounded bg-[var(--container-2)]" />
      <div className="flex gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="w-28 flex-shrink-0">
            <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-[var(--container-2)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
