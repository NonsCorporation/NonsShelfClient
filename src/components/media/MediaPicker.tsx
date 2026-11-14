import { useEffect, useMemo, useState } from 'react'
import { IoSearch } from 'react-icons/io5'
import { catalogService } from '@/services/catalogService'
import type { CatalogItem } from '@/services/catalogService'
import type { MediaType } from '@/types'
import { useLanguage } from '@/contexts/LanguageContext'
import BookCover from '@/components/media/BookCover'
import TypeBadge from '@/components/badges/TypeBadge'

type Props = {
  /** Restrict results to one media type; omit to search books and movies alike. */
  type?: MediaType
  /** Show filter chips: a media-type picker (only when `type` isn't fixed) and the genres found in the results. */
  filters?: boolean
  /** Exclude this item's own id from results (e.g. don't offer self-linking). */
  excludeId?: string
  onPick: (item: CatalogItem) => void
}

// Debounced title search + pick list for finding one existing catalog item.
// Originally inlined in MediaModal's merge-into flow (MergeIntoSection);
// extracted so the award cross-link picker can reuse the same search+render
// logic without the merge-specific confirmation/action wired in.
export default function MediaPicker({ type, filters = false, excludeId, onPick }: Props) {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState<MediaType | undefined>(undefined)
  const [genre, setGenre] = useState<string | null>(null)
  // A fixed `type` always wins over the chips.
  const activeType = type ?? (filters ? typeFilter : undefined)

  useEffect(() => {
    const term = q.trim()
    const timer = setTimeout(() => {
      if (!term) {
        setResults([])
        return
      }
      setLoading(true)
      catalogService
        .getCatalog(term, activeType)
        .then((data) => setResults(data.filter((m) => (!activeType || m.type === activeType) && m.id !== excludeId)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [q, activeType, excludeId])

  // Genres present in the results, most common first.
  const genres = useMemo(() => {
    const count = new Map<string, number>()
    for (const m of results) for (const g of m.genre ?? []) count.set(g, (count.get(g) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([g]) => g)
  }, [results])
  // A genre that the new results don't have would leave the list empty.
  const activeGenre = genre && genres.includes(genre) ? genre : null
  const shown = activeGenre ? results.filter((m) => m.genre?.includes(activeGenre)) : results

  const chip = (active: boolean) =>
    `flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
      active ? 'bg-nonsprimary text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
    }`
  const typeChips: { key: MediaType | undefined; label: string }[] = [
    { key: undefined, label: t('all') },
    { key: 'book', label: t('books') },
    { key: 'movie', label: t('movies') },
    { key: 'series', label: t('series') },
  ]

  return (
    <div>
      <div className="relative">
        <IoSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchCatalogPlaceholder')}
          className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
        />
      </div>
      {filters && !type && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto" role="group" aria-label={t('type')}>
          {typeChips.map((c) => (
            <button
              key={c.key ?? 'all'}
              type="button"
              aria-pressed={typeFilter === c.key}
              onClick={() => {
                setTypeFilter(c.key)
                setGenre(null)
              }}
              className={chip(typeFilter === c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {filters && genres.length > 1 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto" role="group" aria-label={t('genre')}>
          <button type="button" aria-pressed={activeGenre === null} onClick={() => setGenre(null)} className={chip(activeGenre === null)}>
            {t('allGenres')}
          </button>
          {genres.map((g) => (
            <button key={g} type="button" aria-pressed={activeGenre === g} onClick={() => setGenre(activeGenre === g ? null : g)} className={chip(activeGenre === g)}>
              {g}
            </button>
          ))}
        </div>
      )}
      {loading && <p className="mt-2 text-xs text-[var(--text-muted)]">…</p>}
      {shown.length > 0 && (
        <div className="mt-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {shown.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m)}
              className="relative flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-left transition-colors hover:border-nonsprimary"
            >
              <div className="h-10 w-7 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
                <BookCover url={m.coverUrl} title={m.title} author={m.author} />
              </div>
              <div className="min-w-0 pr-7">
                <p className="truncate text-sm text-[var(--text)]">{m.title}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {(m.type === 'book' ? m.author : m.director || m.author) || ''}
                  {m.year ? ` · ${m.year}` : ''}
                </p>
              </div>
              {!type && <TypeBadge type={m.type} position="right-2 top-2" size="h-6 w-6" iconSize="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
