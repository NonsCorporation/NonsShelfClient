import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  IoOptionsOutline,
  IoGridOutline,
  IoListOutline,
  IoChevronDown,
  IoLibraryOutline,
} from 'react-icons/io5'
import Layout from '../components/layout/Layout.tsx'
import MediaCard from '../components/MediaCard.tsx'
import MediaModal from '../components/MediaModal.tsx'
import { libraryService } from '../services/libraryService.ts'
import type { MediaItem } from '../types.ts'
import { useLanguage } from '../contexts/LanguageContext.tsx'

type ShelfKey = 'all' | 'wishlist' | 'active' | 'done' | 'favorites'
type SortKey = 'added' | 'rating' | 'title' | 'year'

export default function Home() {
  const { t } = useLanguage()
  const [params, setParams] = useSearchParams()
  const shelf = (params.get('shelf') as ShelfKey) || 'all'
  const query = params.get('q') ?? ''

  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)

  const [typeFilter, setTypeFilter] = useState<'all' | 'book' | 'movie'>('all')
  const [sort, setSort] = useState<SortKey>('added')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [genreFilter, setGenreFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [directorFilter, setDirectorFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')

  const [showForm, setShowForm] = useState<null | 'book' | 'movie'>(null)
  const [formInitialData, setFormInitialData] = useState<MediaItem | null>(null)

  useEffect(() => {
    libraryService.getItems().then((data) => {
      setItems(data)
      setLoading(false)
    })
  }, [])

  // Open the add modal when arrived here via the global "Add" action (?add=book|movie).
  useEffect(() => {
    const add = params.get('add')
    if (add === 'book' || add === 'movie') {
      setFormInitialData(null)
      setShowForm(add)
      const next = new URLSearchParams(params)
      next.delete('add')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const stats = useMemo(() => {
    const rated = items.filter((it) => typeof it.rating === 'number' && it.rating > 0)
    const avg = rated.length ? rated.reduce((s, it) => s + (it.rating || 0), 0) / rated.length / 2 : 0
    return {
      total: items.length,
      books: items.filter((it) => it.type === 'book').length,
      movies: items.filter((it) => it.type === 'movie').length,
      avg: avg ? avg.toFixed(1) : '—',
      done: items.filter((it) => it.status === 'done').length,
    }
  }, [items])

  const filtered = useMemo(() => {
    const list = items.filter((it) => {
      if (shelf === 'favorites' && !it.favorite) return false
      if (shelf !== 'all' && shelf !== 'favorites' && (it.status ?? 'wishlist') !== shelf) return false
      if (typeFilter !== 'all' && it.type !== typeFilter) return false

      const q = query.trim().toLowerCase()
      if (q && !(it.title.toLowerCase().includes(q) || it.author.toLowerCase().includes(q))) return false

      const yF = yearFilter.trim()
      if (yF && (!it.year || it.year.toString() !== yF)) return false

      const gF = genreFilter.trim().toLowerCase()
      if (gF) {
        if (!it.genre) return false
        const g = Array.isArray(it.genre) ? it.genre.join(',').toLowerCase() : it.genre.toLowerCase()
        if (!g.includes(gF)) return false
      }

      if (typeFilter === 'movie') {
        const dF = directorFilter.trim().toLowerCase()
        if (dF && (!it.director || !it.director.toLowerCase().includes(dF))) return false
        const aF = actorFilter.trim().toLowerCase()
        if (aF && (!it.actors || !it.actors.some((a) => a.toLowerCase().includes(aF)))) return false
      }
      return true
    })

    const sorted = [...list]
    switch (sort) {
      case 'rating':
        sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        break
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'year':
        sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
        break
      default:
        sorted.sort((a, b) => (b.dateAdded ?? '').localeCompare(a.dateAdded ?? ''))
    }
    return sorted
  }, [items, shelf, typeFilter, query, yearFilter, genreFilter, directorFilter, actorFilter, sort])

  const hasAdvanced = !!(genreFilter || yearFilter || directorFilter || actorFilter)

  async function handleSave(data: Partial<MediaItem>) {
    if (formInitialData?.id) {
      const updated = await libraryService.updateItem(formInitialData.id, data)
      setItems((prev) => prev.map((it) => (it.id === formInitialData.id ? updated : it)))
      setShowForm(null)
      return
    }
    const newItem = await libraryService.addItem(data as Omit<MediaItem, 'id'>)
    setItems((s) => [newItem, ...s])
    setShowForm(null)
  }

  async function handleDelete(id: string) {
    await libraryService.deleteItem(id)
    setItems((prev) => prev.filter((it) => it.id !== id))
    setShowForm(null)
  }

  async function toggleFavorite(item: MediaItem) {
    const updated = await libraryService.updateItem(item.id, { favorite: !item.favorite })
    setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)))
  }

  const shelfTitle =
    shelf === 'all'
      ? t('library')
      : shelf === 'favorites'
        ? t('favorites')
        : shelf === 'wishlist'
          ? t('shelfWishlist')
          : shelf === 'active'
            ? t('shelfActive')
            : t('shelfDone')

  const sortLabels: Record<SortKey, string> = {
    added: t('sortAdded'),
    rating: t('sortRating'),
    title: t('sortTitle'),
    year: t('sortYear'),
  }

  const statCards = [
    { label: t('statTotal'), value: stats.total },
    { label: t('statBooks'), value: stats.books },
    { label: t('statMovies'), value: stats.movies },
    { label: t('statAvg'), value: stats.avg },
    { label: t('statFinished'), value: stats.done },
  ]

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">{shelfTitle}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t('librarySubtitle')}</p>
      </div>

      {/* Stats strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] px-4 py-3"
          >
            <p className="text-xl font-bold text-[var(--text)]">{s.value}</p>
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {/* Type chips */}
        <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
          {(['all', 'book', 'movie'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === f
                  ? 'bg-[var(--surface-active)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {f === 'all' ? t('all') : f === 'book' ? t('books') : t('movies')}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => {
              setShowSortMenu((v) => !v)
              setShowFilterMenu(false)
            }}
            className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
          >
            <span className="hidden sm:inline">{sortLabels[sort]}</span>
            <span className="sm:hidden">{t('sortBy')}</span>
            <IoChevronDown className="h-3.5 w-3.5" />
          </button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--container-2)] p-1">
                {(Object.keys(sortLabels) as SortKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setSort(k)
                      setShowSortMenu(false)
                    }}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      sort === k
                        ? 'bg-[var(--surface-active)] text-[var(--text)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
                    }`}
                  >
                    {sortLabels[k]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Advanced filters */}
        <div className="relative">
          <button
            onClick={() => {
              setShowFilterMenu((v) => !v)
              setShowSortMenu(false)
            }}
            title={t('filters')}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] transition-colors ${
              showFilterMenu || hasAdvanced
                ? 'bg-[var(--surface-active)] text-[var(--text)]'
                : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
            }`}
          >
            <IoOptionsOutline className="h-5 w-5" />
          </button>
          {showFilterMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowFilterMenu(false)} />
              <div className="absolute right-0 top-full z-40 mt-2 flex w-64 flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--container-2)] p-3">
                {hasAdvanced && (
                  <button
                    onClick={() => {
                      setGenreFilter('')
                      setYearFilter('')
                      setDirectorFilter('')
                      setActorFilter('')
                    }}
                    className="self-end text-xs text-nonsprimaryfocus hover:underline"
                  >
                    {t('clearFilters')}
                  </button>
                )}
                <input
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                  placeholder={t('genre')}
                  className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                />
                <input
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  placeholder={t('year')}
                  className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                />
                {typeFilter === 'movie' && (
                  <>
                    <input
                      value={directorFilter}
                      onChange={(e) => setDirectorFilter(e.target.value)}
                      placeholder={t('director')}
                      className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                    />
                    <input
                      value={actorFilter}
                      onChange={(e) => setActorFilter(e.target.value)}
                      placeholder={t('actor')}
                      className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
          <button
            onClick={() => setView('grid')}
            title={t('gridView')}
            className={`rounded-lg p-1.5 transition-colors ${
              view === 'grid' ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <IoGridOutline className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('list')}
            title={t('listView')}
            className={`rounded-lg p-1.5 transition-colors ${
              view === 'list' ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <IoListOutline className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto hidden text-sm text-[var(--text-muted)] md:block">
          {t('showing', { n: filtered.length, total: items.length })}
        </div>
      </div>

      <MediaModal
        isOpen={showForm !== null}
        initialType={showForm || 'book'}
        initialData={formInitialData ?? undefined}
        onClose={() => setShowForm(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-2xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface)]">
            <IoLibraryOutline className="h-7 w-7 text-[var(--text-muted)]" />
          </div>
          <p className="text-base font-medium text-[var(--text)]">{t('noResults')}</p>
          <p className="text-sm text-[var(--text-muted)]">{t('noResultsHint')}</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid animate-fade-up grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((it) => (
            <MediaCard
              key={it.id}
              item={it}
              view="grid"
              onEdit={() => {
                setFormInitialData(it)
                setShowForm(it.type)
              }}
              onToggleFavorite={() => toggleFavorite(it)}
            />
          ))}
        </div>
      ) : (
        <div className="flex animate-fade-up flex-col gap-2">
          {filtered.map((it) => (
            <MediaCard
              key={it.id}
              item={it}
              view="list"
              onEdit={() => {
                setFormInitialData(it)
                setShowForm(it.type)
              }}
              onToggleFavorite={() => toggleFavorite(it)}
            />
          ))}
        </div>
      )}
    </Layout>
  )
}
