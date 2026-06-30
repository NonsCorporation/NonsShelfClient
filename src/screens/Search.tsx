import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from '@/lib/router'
import Layout from '../components/layout/Layout'
import CatalogCard from '../components/CatalogCard'
import { catalogService } from '../services/catalogService'
import type { CatalogItem } from '../services/catalogService'
import { libraryService } from '../services/libraryService'
import type { MediaItem, MediaType } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { IoSearchOutline } from 'react-icons/io5'
import InfinityLoader from '../components/InfinityLoader'

const keyOf = (it: { type: string; title: string }) => `${it.type}:${it.title.trim().toLowerCase()}`

// How many more of each type to import per "Load more" click. The limit sent to
// the server grows with the page so each press reaches further into the external
// results instead of re-importing the same first batch.
const BATCH = 8

type Filter = 'all' | MediaType

// Dedicated search-results page (its own /search route), split out of Discover so
// the two concerns don't share a screen. Reads the query from ?q= and searches the
// whole catalog local-first. External sources (Google Books / OpenLibrary / TMDB)
// are pulled in automatically when nothing local matches, and on demand via the
// repeatable "Load more" button. A type filter narrows the shown results.
export default function SearchPage() {
  const { t } = useLanguage()
  const [params] = useSearchParams()
  const q = params.get('q')?.trim() ?? ''
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [libKeys, setLibKeys] = useState<Set<string>>(new Set())
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<'relevance' | 'popular'>('relevance')
  const [page, setPage] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exhausted, setExhausted] = useState(false)

  useEffect(() => {
    // All setState happens inside the debounce callback (never synchronously in
    // the effect body), so this doesn't trigger cascading renders.
    const timer = setTimeout(async () => {
      if (!q) {
        setCatalog([])
        setImporting(false)
        setLoading(false)
        return
      }
      setLoading(true)
      setImporting(false)
      setPage(0)
      setExhausted(false)
      const [cat, lib] = await Promise.all([catalogService.getCatalog(q), libraryService.getItems()])
      setLibKeys(new Set(lib.map(keyOf)))
      if (cat.length > 0) {
        // Local hits exist — show them immediately. External results are pulled in
        // on demand via "Load more" so a single local match doesn't hide the rest.
        setCatalog(cat)
        setLoading(false)
        return
      }
      // Nothing in local catalog — auto-import books, movies and series in parallel.
      setLoading(false)
      setImporting(true)
      const fill = await catalogService.searchFill(q, { limit: 5, series: true })
      setImporting(false)
      setCatalog(fill.items)
    }, q ? 300 : 0)
    return () => clearTimeout(timer)
  }, [q])

  // Import the next batch of books, movies and series from external sources and
  // append the ones not already shown. When a press brings nothing new, the
  // external sources are exhausted for this query and the button is hidden.
  const handleLoadMore = async () => {
    if (loadingMore || !q) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const fill = await catalogService.searchFill(q, { limit: nextPage * BATCH, series: true, force: true })
      let appended = 0
      setCatalog((prev) => {
        const seenIds = new Set(prev.map((it) => it.id))
        const seenKeys = new Set(prev.map(keyOf))
        const extra = fill.items.filter((it) => !seenIds.has(it.id) && !seenKeys.has(keyOf(it)))
        appended = extra.length
        return [...prev, ...extra]
      })
      setPage(nextPage)
      if (appended === 0) setExhausted(true)
    } finally {
      setLoadingMore(false)
    }
  }

  const inLibrary = (it: CatalogItem) => libKeys.has(keyOf(it)) || added.has(keyOf(it))

  const handleAdd = async (it: CatalogItem) => {
    // it.id is the backend media id — pass it so the item is added to the shelf
    // against the existing catalog row instead of creating a duplicate.
    const payload: Omit<MediaItem, 'id'> & { id?: string } = {
      id: it.id,
      type: it.type,
      title: it.title,
      author: it.author,
      director: it.director,
      coverUrl: it.coverUrl,
      year: it.year,
      genre: it.genre,
      description: it.description,
      status: 'wishlist',
    }
    await libraryService.addItem(payload)
    setAdded((prev) => new Set(prev).add(keyOf(it)))
  }

  // Per-type counts drive the filter tabs; the shown grid is filtered by the
  // active tab.
  const counts = useMemo(() => {
    const c = { book: 0, movie: 0, series: 0 }
    for (const it of catalog) c[it.type] += 1
    return c
  }, [catalog])
  const shown = useMemo(() => {
    const list = filter === 'all' ? catalog : catalog.filter((it) => it.type === filter)
    if (sort !== 'popular') return list
    // Stable sort by shelf-count (popularity) desc; keeps relevance order among ties.
    return [...list].sort((a, b) => b.popularity - a.popularity)
  }, [catalog, filter, sort])

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: t('filterAll'), count: catalog.length },
    { key: 'book', label: t('books'), count: counts.book },
    { key: 'movie', label: t('movies'), count: counts.movie },
    { key: 'series', label: t('seriesPlural'), count: counts.series },
  ]

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
          {q ? t('searchResults', { q }) : t('search')}
        </h1>
        {q && <p className="mt-1 text-sm text-[var(--text-muted)]">{t('searchSubtitle')}</p>}
      </div>

      {!q ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center text-[var(--text-muted)]">
          <IoSearchOutline className="h-8 w-8" />
          <p className="text-sm">{t('searchPrompt')}</p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : importing ? (
        <div className="flex justify-center py-16">
          <InfinityLoader size={100} hint={t('searchingExternal')} />
        </div>
      ) : catalog.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--text-muted)]">{t('noResults')}</p>
      ) : (
        <>
          {/* Type filter + sort */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === tab.key
                      ? 'bg-[var(--surface-active)] text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs text-[var(--text-muted)]">{tab.count}</span>
                </button>
              ))}
            </div>
            <div className="inline-flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
              {(['relevance', 'popular'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    sort === s
                      ? 'bg-[var(--surface-active)] text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {s === 'relevance' ? t('sortRelevance') : t('sortPopular')}
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--text-muted)]">{t('noResults')}</p>
          ) : (
            <div className="animate-fade-up grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {shown.map((it) => (
                <CatalogCard key={it.id} item={it} inLibrary={inLibrary(it)} onAdd={() => handleAdd(it)} />
              ))}
            </div>
          )}

          {!exhausted && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-60"
              >
                {loadingMore && <span className="h-4 w-4 animate-spin rounded-full border-2 border-nonsprimary border-t-transparent" />}
                {loadingMore ? t('searchingExternal') : t('searchLoadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
