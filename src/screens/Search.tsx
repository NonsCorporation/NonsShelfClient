import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from '@/lib/router'
import Layout from '../components/layout/Layout'
import CatalogCard from '../components/CatalogCard'
import FinishModal from '../components/FinishModal'
import { catalogService } from '../services/catalogService'
import type { CatalogItem, PersonHit } from '../services/catalogService'
import { libraryService } from '../services/libraryService'
import type { MediaItem, MediaType, ShelfStatus } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { IoSearchOutline, IoPersonOutline, IoAppsOutline, IoBookOutline, IoFilmOutline, IoTvOutline } from 'react-icons/io5'
import type { IconType } from 'react-icons'
import InfinityLoader from '../components/InfinityLoader'
import BoringAvatar from '../components/BoringAvatar'

const keyOf = (it: { type: string; title: string }) => `${it.type}:${it.title.trim().toLowerCase()}`
// Builds the minimal MediaItem shape FinishModal/ShelfStatusBar need from a catalog row.
const shelfItemOf = (it: CatalogItem): MediaItem => ({
  id: it.id, uuid: it.uuid, type: it.type, title: it.title, author: it.author, director: it.director,
  coverUrl: it.coverUrl, year: it.year, genre: it.genre, description: it.description,
})

// How many more of each type to import per "Load more" click. The limit sent to
// the server grows with the page so each press reaches further into the external
// results instead of re-importing the same first batch.
const BATCH = 8

// A local result with relevance (word_similarity of the query vs the title,
// 0..1) at or above this is a "real" hit; anything below is a weak fuzzy match
// (e.g. only one query word overlaps), which shouldn't stop the external-source
// import from also running.
const STRONG_MATCH = 0.8

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
  // Shelf status per result (by keyOf), seeded from the user's library and
  // updated in place as they change status from the shelf-status bar.
  const [statusByKey, setStatusByKey] = useState<Map<string, ShelfStatus>>(new Map())
  const [finishItem, setFinishItem] = useState<CatalogItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<'relevance' | 'popular'>('relevance')
  const [page, setPage] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  // People tab: a separate results mode (fuzzy name search, its own endpoint),
  // toggled independently of the All/Books/Movies/Series catalog filter.
  const [peopleMode, setPeopleMode] = useState(false)
  const [people, setPeople] = useState<PersonHit[]>([])
  const [peopleLoading, setPeopleLoading] = useState(false)

  // Badge the given results with the user's shelf status, fetching status for
  // only those media ids (one small query) instead of pulling the whole shelf.
  // Merges into the existing map (keyed by keyOf) so it can top up appended
  // "Load more" pages without clobbering statuses already shown.
  const seedStatuses = useCallback(async (list: CatalogItem[]) => {
    const byId = await libraryService.getStatuses(list.map((it) => it.id))
    if (byId.size === 0) return
    setStatusByKey((prev) => {
      const next = new Map(prev)
      for (const it of list) {
        const s = byId.get(it.id)
        if (s) next.set(keyOf(it), s)
      }
      return next
    })
  }, [])

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
      setStatusByKey(new Map()) // clear the previous query's badges
      const cat = await catalogService.getCatalog(q)
      if (cat.length > 0) {
        // Local hits exist — show them immediately. External results are pulled in
        // on demand via "Load more" so a single local match doesn't hide the rest.
        setCatalog(cat)
        setLoading(false)
        void seedStatuses(cat)
        if (cat.some((it) => (it.relevance ?? 0) >= STRONG_MATCH)) return
        // Every local hit is only a weak fuzzy match (shares a word with the
        // query, e.g. "project hail" -> "The Phoenix Project") — the result the
        // user wants is probably external. Import from external sources behind
        // the shown list; search-fill persists the imports and returns the whole
        // local catalog re-ranked, so the real match (e.g. "Project Hail Mary")
        // now leads.
        setImporting(true)
        const fill = await catalogService.searchFill(q, { limit: 5, series: true, force: true })
        setImporting(false)
        if (fill.items.length > 0) {
          setCatalog(fill.items)
          void seedStatuses(fill.items)
        }
        return
      }
      // Nothing in local catalog — auto-import books, movies and series in parallel.
      setLoading(false)
      setImporting(true)
      const fill = await catalogService.searchFill(q, { limit: 5, series: true })
      setImporting(false)
      setCatalog(fill.items)
      void seedStatuses(fill.items)
    }, q ? 300 : 0)
    return () => clearTimeout(timer)
  }, [q, seedStatuses])

  // People tab: debounced fuzzy name search against its own endpoint, only
  // while active — no external-source import step, unlike the catalog search.
  useEffect(() => {
    if (!peopleMode || !q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPeople([])
      setPeopleLoading(false)
      return
    }
    let cancelled = false
    setPeopleLoading(true)
    const timer = setTimeout(async () => {
      const res = await catalogService.searchPeople(q)
      if (!cancelled) {
        setPeople(res)
        setPeopleLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [peopleMode, q])

  // Import the next batch of books, movies and series from external sources and
  // append the ones not already shown. When a press brings nothing new, the
  // external sources are exhausted for this query and the button is hidden.
  const handleLoadMore = async () => {
    if (loadingMore || !q) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const fill = await catalogService.searchFill(q, { limit: nextPage * BATCH, series: true, force: true })
      let added: CatalogItem[] = []
      setCatalog((prev) => {
        const seenIds = new Set(prev.map((it) => it.id))
        const seenKeys = new Set(prev.map(keyOf))
        added = fill.items.filter((it) => !seenIds.has(it.id) && !seenKeys.has(keyOf(it)))
        return [...prev, ...added]
      })
      setPage(nextPage)
      if (added.length === 0) setExhausted(true)
      else void seedStatuses(added)
    } finally {
      setLoadingMore(false)
    }
  }

  const inLibrary = (it: CatalogItem) => statusByKey.has(keyOf(it))

  // First status pick adds the item to the shelf (against the existing catalog
  // row via it.id, never creating a duplicate); later picks just update it.
  const handleStatusChange = async (it: CatalogItem, status: ShelfStatus) => {
    // "Finished" gets the full rate/review/dates flow (same as the "in
    // progress" row on Home) instead of an immediate silent status flip.
    if (status === 'done') {
      setFinishItem(it)
      return
    }
    const key = keyOf(it)
    if (statusByKey.has(key)) {
      await libraryService.updateItem(it.id, { status })
    } else {
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
        status,
      }
      await libraryService.addItem(payload)
    }
    setStatusByKey((prev) => new Map(prev).set(key, status))
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

  const tabs: { key: Filter; label: string; count: number; icon: IconType }[] = [
    { key: 'all', label: t('filterAll'), count: catalog.length, icon: IoAppsOutline },
    { key: 'book', label: t('books'), count: counts.book, icon: IoBookOutline },
    { key: 'movie', label: t('movies'), count: counts.movie, icon: IoFilmOutline },
    { key: 'series', label: t('seriesPlural'), count: counts.series, icon: IoTvOutline },
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
      ) : (
        <>
          {/* Type filter + People toggle + sort — always shown once there's a
              query, so switching into/out of People mode doesn't wait on the
              catalog fetch. */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => { setFilter(tab.key); setPeopleMode(false) }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      !peopleMode && filter === tab.key
                        ? 'bg-[var(--surface-active)] text-[var(--text)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                    <span className="text-xs text-[var(--text-muted)]">{tab.count}</span>
                  </button>
                ))}
              </div>
              {/* People — a separate button, not part of the type-filter group
                  (it searches a different endpoint, people by name), but styled
                  identically to those tabs so it reads as one consistent set. */}
              <button
                onClick={() => setPeopleMode((v) => !v)}
                className={`flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium transition-colors ${
                  peopleMode
                    ? 'bg-[var(--surface-active)] text-[var(--text)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <IoPersonOutline className="h-4 w-4" />
                {t('people')}
              </button>
            </div>
            {!peopleMode && (
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
            )}
          </div>

          {peopleMode ? (
            peopleLoading ? (
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className="aspect-square w-full animate-pulse rounded-full bg-[var(--surface)]" />
                  </div>
                ))}
              </div>
            ) : people.length === 0 ? (
              <p className="py-16 text-center text-sm text-[var(--text-muted)]">{t('noResults')}</p>
            ) : (
              <div className="animate-fade-up grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {people.map((p) => (
                  <Link key={p.uuid} to={`/p/${p.uuid}`} className="group flex flex-col items-center text-center">
                    <div className="aspect-square w-full overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--container-2)] transition-colors group-hover:border-[var(--border)]">
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <BoringAvatar size={64} name={p.uuid || p.name} className="h-full w-full" />
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs font-medium leading-snug text-[var(--text)] group-hover:text-nonsprimary">{p.name}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{t('nTitles', { n: p.creditCount })}</p>
                  </Link>
                ))}
              </div>
            )
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
              {shown.length === 0 ? (
                <p className="py-16 text-center text-sm text-[var(--text-muted)]">{t('noResults')}</p>
              ) : (
                <div className="animate-fade-up grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {shown.map((it) => (
                    <CatalogCard
                      key={it.id}
                      item={it}
                      inLibrary={inLibrary(it)}
                      shelfStatus={{
                        current: statusByKey.get(keyOf(it)) ?? null,
                        onChange: (status) => handleStatusChange(it, status),
                      }}
                    />
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
        </>
      )}

      <FinishModal
        isOpen={!!finishItem}
        item={finishItem ? shelfItemOf(finishItem) : null}
        onClose={() => setFinishItem(null)}
        onFinished={() => {
          const it = finishItem!
          setFinishItem(null)
          setStatusByKey((prev) => new Map(prev).set(keyOf(it), 'done'))
        }}
      />
    </Layout>
  )
}
