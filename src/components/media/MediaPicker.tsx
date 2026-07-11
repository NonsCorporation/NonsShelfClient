import { useEffect, useState } from 'react'
import { IoSearch } from 'react-icons/io5'
import { catalogService } from '@/services/catalogService'
import type { CatalogItem } from '@/services/catalogService'
import type { MediaType } from '@/types'
import { useLanguage } from '@/contexts/LanguageContext'

type Props = {
  /** Restrict results to one media type; omit to search books and movies alike. */
  type?: MediaType
  /** Exclude this item's own id from results (e.g. don't offer self-linking). */
  excludeId?: string
  onPick: (item: CatalogItem) => void
}

// Debounced title search + pick list for finding one existing catalog item.
// Originally inlined in MediaModal's merge-into flow (MergeIntoSection);
// extracted so the award cross-link picker can reuse the same search+render
// logic without the merge-specific confirmation/action wired in.
export default function MediaPicker({ type, excludeId, onPick }: Props) {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = q.trim()
    const timer = setTimeout(() => {
      if (!term) {
        setResults([])
        return
      }
      setLoading(true)
      catalogService
        .getCatalog(term)
        .then((data) => setResults(data.filter((m) => (!type || m.type === type) && m.id !== excludeId)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [q, type, excludeId])

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
      {loading && <p className="mt-2 text-xs text-[var(--text-muted)]">…</p>}
      {results.length > 0 && (
        <div className="mt-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m)}
              className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-left transition-colors hover:border-nonsprimary"
            >
              <div className="h-10 w-7 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
                {m.coverUrl ? <img src={m.coverUrl} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--text)]">{m.title}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {(m.type === 'book' ? m.author : m.director || m.author) || ''}
                  {m.year ? ` · ${m.year}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
