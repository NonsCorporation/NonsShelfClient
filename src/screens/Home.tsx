import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from '@/lib/router'
import {
  IoOptionsOutline,
  IoGridOutline,
  IoListOutline,
  IoChevronDown,
  IoLibraryOutline,
  IoSearch,
  IoCloudUploadOutline,
  IoLayersOutline,
  IoBookmarkOutline,
  IoTimeOutline,
  IoCheckmarkDoneOutline,
  IoCloseCircleOutline,
  IoHeartOutline,
  IoStar,
  IoChatbubbleOutline,
  IoFolderOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoAdd,
  IoClose,
  IoCheckmark,
  IoDownloadOutline,
} from 'react-icons/io5'
import Layout from '../components/layout/Layout.tsx'
import MediaCard, { type ItemProgress } from '../components/MediaCard.tsx'
import MediaModal from '../components/MediaModal.tsx'
import ImportModal from '../components/ImportModal.tsx'
import ExportModal from '../components/ExportModal.tsx'
import MediaDetailModal from '../components/MediaDetailModal.tsx'
import { libraryService } from '../services/libraryService.ts'
import { fetchPublicProfile } from '../services/userService.ts'
import type { MediaItem } from '../types.ts'
import { useLanguage } from '../contexts/LanguageContext.tsx'
import { useAuth } from '../contexts/AuthContext.tsx'
import { useCollections } from '../contexts/CollectionContext.tsx'

type ShelfKey = 'all' | 'wishlist' | 'active' | 'done' | 'dnf' | 'favorites'
type SortKey = 'added' | 'rating' | 'title' | 'year' | 'reviewed'

export default function Home() {
  const { t } = useLanguage()
  const { user: authUser, loading: authLoading } = useAuth()
  const { collections, createCollection, renameCollection, deleteCollection } = useCollections()
  const [params, setParams] = useSearchParams()
  const shelf = (params.get('shelf') as ShelfKey) || 'all'
  const collectionFilter = params.get('collection') ? Number(params.get('collection')) : null

  // Sidebar collection management state.
  const [editingColId, setEditingColId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [creatingCol, setCreatingCol] = useState(false)
  const [newColName, setNewColName] = useState('')
  const newColInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // ?user=<username> opens another user's library read-only (the "open full
  // library" button on a profile links here). Viewing your own username — or no
  // param — is your normal, editable library.
  const userParam = params.get('user')?.trim() || ''
  const readOnly = !!userParam && !!authUser && userParam !== authUser.username && userParam !== authUser.uuid
  const [ownerName, setOwnerName] = useState('')
  const [notFound, setNotFound] = useState(false)

  // Local search — filters the user's own library client-side. The global
  // top-bar search goes to Discover and searches the whole catalog instead.
  const [query, setQuery] = useState('')

  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [progressMap, setProgressMap] = useState<Map<string, ItemProgress>>(new Map())

  const [typeFilter, setTypeFilter] = useState<'all' | 'book' | 'movie' | 'series'>('all')
  const [sort, setSort] = useState<SortKey>('added')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const [showExport, setShowExport] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [genreFilter, setGenreFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [authorFilter, setAuthorFilter] = useState('')
  const [directorFilter, setDirectorFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [hasRating, setHasRating] = useState(false)
  const [hasReview, setHasReview] = useState(false)
  const [addedFrom, setAddedFrom] = useState('')
  const [addedTo, setAddedTo] = useState('')
  // Comparison vs the viewer's own shelf, only when browsing another user's library.
  const [compareFilter, setCompareFilter] = useState<'all' | 'shared' | 'onlyTheirs'>('all')
  const [myByMediaId, setMyByMediaId] = useState<Map<string, { status?: MediaItem['status']; rating?: number }>>(new Map())

  const [showForm, setShowForm] = useState<null | 'book' | 'movie'>(null)
  const [showImport, setShowImport] = useState(false)
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null)

  useEffect(() => {
    if (authLoading) return // wait so self-vs-other is decided correctly
    let cancelled = false
    setLoading(true)
    setNotFound(false)

    async function load() {
      if (readOnly) {
        const p = await fetchPublicProfile(userParam)
        if (cancelled) return
        if (!p) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setOwnerName(p.name || p.username)
        // Their library + my own library (for the per-item shelf comparison).
        const [theirs, mine] = await Promise.all([libraryService.getUserItems(p.id), libraryService.getItems()])
        if (cancelled) return
        setMyByMediaId(new Map(mine.map((m) => [m.id, { status: m.status, rating: m.rating }])))
        setItems(theirs)
      } else {
        setOwnerName('')
        setMyByMediaId(new Map())
        const its = await libraryService.getItems()
        if (cancelled) return
        setItems(its)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, readOnly, userParam])

  // Fetch progress for all active items and build a label map for MediaCard badges.
  useEffect(() => {
    const active = items.filter((it) => it.status === 'active' && (it.type === 'book' || it.type === 'series'))
    if (active.length === 0) { setProgressMap(new Map()); return }
    let cancelled = false
    Promise.all(
      active.map(async (it): Promise<[string, ItemProgress | null]> => {
        try {
          if (it.type === 'book') {
            const rows = await libraryService.getProgress(it.id)
            const page = rows[0]?.page ?? 0
            if (!page) return [it.id, null]
            const total = it.pages ?? 0
            const pct = total > 0 ? Math.min(100, Math.round((page / total) * 100)) : rows[0]?.progress_pct ?? 0
            return [it.id, { label: total > 0 ? `page ${page}/${total}` : `page ${page}`, pct }]
          } else {
            const { watched, total } = await libraryService.getEpisodeStats(it.id)
            if (!watched) return [it.id, null]
            const pct = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0
            return [it.id, { label: total > 0 ? `ep ${watched}/${total}` : `ep ${watched}`, pct }]
          }
        } catch {
          return [it.id, null]
        }
      }),
    ).then((results) => {
      if (cancelled) return
      const map = new Map<string, ItemProgress>()
      for (const [id, prog] of results) if (prog) map.set(id, prog)
      setProgressMap(map)
    })
    return () => { cancelled = true }
  }, [items])

  // Open the add modal when arrived here via the global "Add" action (?add=book|movie).
  useEffect(() => {
    if (readOnly) return
    const add = params.get('add')
    if (add === 'book' || add === 'movie') {
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
      if (collectionFilter !== null && !it.collectionIds?.includes(collectionFilter)) return false
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

      // Per-type unique filters: author for books, director/actor for screen media.
      if (it.type === 'book') {
        const auF = authorFilter.trim().toLowerCase()
        if (auF && !it.author.toLowerCase().includes(auF)) return false
      } else {
        const dF = directorFilter.trim().toLowerCase()
        if (dF && (!it.director || !it.director.toLowerCase().includes(dF))) return false
        const aF = actorFilter.trim().toLowerCase()
        if (aF && (!it.actors || !it.actors.some((a) => a.toLowerCase().includes(aF)))) return false
      }

      // Rating / review presence.
      if (hasRating && !(typeof it.rating === 'number' && it.rating > 0)) return false
      if (hasReview && !it.review?.trim()) return false

      // Date added range (it.dateAdded is an ISO string; compare by date prefix).
      if (addedFrom && (it.dateAdded ?? '').slice(0, 10) < addedFrom) return false
      if (addedTo && (it.dateAdded ?? '').slice(0, 10) > addedTo) return false

      // Comparison vs the viewer's own shelf (read-only other-user libraries).
      if (readOnly && compareFilter !== 'all') {
        const mine = myByMediaId.has(it.id)
        if (compareFilter === 'shared' && !mine) return false
        if (compareFilter === 'onlyTheirs' && mine) return false
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
      case 'reviewed': {
        // Reviewed items first, then by most recently added.
        const has = (it: MediaItem) => (it.review?.trim() ? 1 : 0)
        sorted.sort((a, b) => has(b) - has(a) || (b.dateAdded ?? '').localeCompare(a.dateAdded ?? ''))
        break
      }
      default:
        sorted.sort((a, b) => (b.dateAdded ?? '').localeCompare(a.dateAdded ?? ''))
    }
    return sorted
  }, [
    items, shelf, collectionFilter, typeFilter, query, yearFilter, genreFilter, authorFilter, directorFilter,
    actorFilter, sort, hasRating, hasReview, addedFrom, addedTo, readOnly, compareFilter, myByMediaId,
  ])

  const hasAdvanced = !!(
    genreFilter || yearFilter || authorFilter || directorFilter || actorFilter ||
    hasRating || hasReview || addedFrom || addedTo
  )

  const filterInput =
    'h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

  async function handleSave(data: Partial<MediaItem>) {
    const newItem = await libraryService.addItem(data as Omit<MediaItem, 'id'>)
    setItems((s) => [newItem, ...s])
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
    reviewed: t('sortReviewed'),
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

  // Sidebar collection helpers
  const startEdit = (id: number, name: string) => {
    setEditingColId(id)
    setEditingName(name)
    setTimeout(() => editInputRef.current?.focus(), 30)
  }
  const commitEdit = async () => {
    if (editingColId == null) return
    const name = editingName.trim()
    if (name) await renameCollection(editingColId, name)
    setEditingColId(null)
  }
  const commitCreate = async () => {
    const name = newColName.trim()
    if (name) await createCollection(name)
    setNewColName('')
    setCreatingCol(false)
  }
  const setShelfParam = (key: ShelfKey) => {
    const next = new URLSearchParams(params)
    if (key === 'all') next.delete('shelf')
    else next.set('shelf', key)
    setParams(next, { replace: true })
  }
  const setCollectionParam = (id: number | null) => {
    const next = new URLSearchParams(params)
    if (id == null) next.delete('collection')
    else next.set('collection', String(id))
    setParams(next, { replace: true })
  }

  if (notFound) {
    return (
      <Layout>
        <div className="py-24 text-center text-[var(--text-muted)]">{t('userNotFound')}</div>
      </Layout>
    )
  }

  const shelfNav = [
    { key: 'all' as ShelfKey,      label: t('allItems'),      dot: null,      icon: IoLayersOutline },
    { key: 'wishlist' as ShelfKey, label: t('shelfWishlist'), dot: '#6768ab', icon: IoBookmarkOutline },
    { key: 'active' as ShelfKey,   label: t('shelfActive'),   dot: '#f5a623', icon: IoTimeOutline },
    { key: 'done' as ShelfKey,     label: t('shelfDone'),     dot: '#3ec98a', icon: IoCheckmarkDoneOutline },
    { key: 'dnf' as ShelfKey,      label: t('shelfDNF'),      dot: '#647da3', icon: IoCloseCircleOutline },
    ...(!readOnly ? [{ key: 'favorites' as ShelfKey, label: t('favorites'), dot: '#ff7a85', icon: IoHeartOutline }] : []),
  ]

  return (
    <Layout>
      <div className="flex gap-6">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-52 flex-shrink-0 flex-col gap-0.5 self-start sticky top-24">
        {/* Shelf status nav */}
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          {t('library')}
        </p>
        {shelfNav.map((s) => {
          const active = shelf === s.key
          const Icon = s.icon
          return (
            <button
              key={s.key}
              onClick={() => { setCollectionParam(null); setShelfParam(s.key) }}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                active
                  ? 'bg-[var(--surface-active)] font-medium text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
              }`}
            >
              {s.dot ? (
                <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: s.dot }} />
              ) : (
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              {s.label}
            </button>
          )
        })}

        {/* Collections */}
        {!readOnly && (
          <div className="mt-4">
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {t('collections') || 'Collections'}
            </p>

            {collections.map((col) => {
              const active = collectionFilter === col.id
              return (
                <div key={col.id} className="group relative flex items-center">
                  {editingColId === col.id ? (
                    <div className="flex flex-1 items-center gap-1 pr-1">
                      <input
                        ref={editInputRef}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit()
                          if (e.key === 'Escape') setEditingColId(null)
                        }}
                        onBlur={commitEdit}
                        className="h-7 min-w-0 flex-1 rounded-md border border-[var(--primary-ring)] bg-[var(--input)] px-2 text-xs text-[var(--text)] focus:outline-none"
                      />
                      <button onClick={commitEdit} className="flex-shrink-0 text-nonsprimary hover:opacity-70">
                        <IoCheckmark className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setCollectionParam(active ? null : col.id)}
                        className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                          active
                            ? 'bg-[var(--surface-active)] font-medium text-[var(--text)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
                        }`}
                      >
                        <IoFolderOutline className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="min-w-0 truncate">{col.name}</span>
                        <span className="ml-auto flex-shrink-0 text-[11px] text-[var(--text-muted)]">{col.count}</span>
                      </button>
                      <div className="absolute right-0 hidden items-center gap-0.5 bg-[var(--bg)] pl-1 group-hover:flex">
                        <button
                          onClick={() => startEdit(col.id, col.name)}
                          title="Rename"
                          className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                        >
                          <IoPencilOutline className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => deleteCollection(col.id)}
                          title="Delete"
                          className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400"
                        >
                          <IoTrashOutline className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            {creatingCol ? (
              <div className="mt-1 flex items-center gap-1">
                <input
                  ref={newColInputRef}
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitCreate()
                    if (e.key === 'Escape') { setCreatingCol(false); setNewColName('') }
                  }}
                  onBlur={() => { if (!newColName.trim()) setCreatingCol(false) }}
                  placeholder={t('collectionName') || 'Name…'}
                  className="h-7 min-w-0 flex-1 rounded-md border border-[var(--primary-ring)] bg-[var(--input)] px-2 text-xs text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none"
                />
                <button onClick={commitCreate} className="flex-shrink-0 text-nonsprimary hover:opacity-70">
                  <IoCheckmark className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { setCreatingCol(false); setNewColName('') }} className="flex-shrink-0 text-[var(--text-muted)] hover:opacity-70">
                  <IoClose className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setCreatingCol(true); setTimeout(() => newColInputRef.current?.focus(), 30) }}
                className="mt-1 flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <IoAdd className="h-3.5 w-3.5" />
                {t('newCollection') || 'New collection'}
              </button>
            )}
          </div>
        )}

      </aside>

      {/* ── Main content ── */}
      <div className="min-w-0 flex-1">

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
          {readOnly && ownerName ? t('libraryOf', { name: ownerName }) : shelfTitle}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t('librarySubtitle')}</p>
      </div>

      {/* Shelf tabs — mobile only */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 lg:hidden">
        {shelfNav.map((s) => {
          const active = shelf === s.key
          const Icon = s.icon
          return (
            <button
              key={s.key}
              onClick={() => { setCollectionParam(null); setShelfParam(s.key) }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                active
                  ? 'border-[var(--border)] bg-[var(--container-2)] font-medium text-[var(--text)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              {s.dot ? (
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
              ) : (
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Collection chips — mobile only */}
      {!readOnly && (collections.length > 0 || creatingCol) && (
        <div className="mb-4 lg:hidden">
          <div className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1">
            {collections.map((col) => {
              const active = collectionFilter === col.id
              return (
                <button
                  key={col.id}
                  onClick={() => setCollectionParam(active ? null : col.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                    active
                      ? 'border-[var(--border)] bg-[var(--container-2)] font-medium text-[var(--text)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  <IoFolderOutline className="h-3 w-3 flex-shrink-0" />
                  {col.name}
                  <span className="opacity-50">{col.count}</span>
                </button>
              )
            })}
            {creatingCol ? (
              <div className="flex shrink-0 items-center gap-1">
                <input
                  ref={newColInputRef}
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitCreate()
                    if (e.key === 'Escape') { setCreatingCol(false); setNewColName('') }
                  }}
                  onBlur={() => { if (!newColName.trim()) setCreatingCol(false) }}
                  placeholder={t('collectionName') || 'Name…'}
                  className="h-7 w-32 rounded-full border border-[var(--primary-ring)] bg-[var(--input)] px-3 text-xs text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none"
                />
                <button onClick={commitCreate} className="flex-shrink-0 text-nonsprimary">
                  <IoCheckmark className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { setCreatingCol(false); setNewColName('') }} className="flex-shrink-0 text-[var(--text-muted)]">
                  <IoClose className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setCreatingCol(true); setTimeout(() => newColInputRef.current?.focus(), 30) }}
                className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[var(--border-subtle)] px-3 py-1 text-xs text-[var(--text-muted)]"
              >
                <IoAdd className="h-3 w-3" />
                {t('newCollection') || 'New'}
              </button>
            )}
          </div>
        </div>
      )}

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
        {/* Local library search */}
        <div className="relative w-full sm:w-56">
          <IoSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchLibrary')}
            className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
          />
        </div>

        {/* Type chips */}
        <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
          {(['all', 'book', 'movie', 'series'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === f
                  ? 'bg-[var(--surface-active)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {f === 'all' ? t('all') : f === 'book' ? t('books') : f === 'movie' ? t('movies') : t('seriesPlural')}
            </button>
          ))}
        </div>

        {/* Quick filters: only rated / only reviewed (combine for "reviews with a rating") */}
        <button
          onClick={() => setHasRating((v) => !v)}
          title={t('hasRating')}
          className={`flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
            hasRating
              ? 'border-transparent bg-[var(--primary-soft)] text-[var(--text)]'
              : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <IoStar className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('hasRating')}</span>
        </button>
        <button
          onClick={() => setHasReview((v) => !v)}
          title={t('hasReview')}
          className={`flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
            hasReview
              ? 'border-transparent bg-[var(--primary-soft)] text-[var(--text)]'
              : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <IoChatbubbleOutline className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('hasReview')}</span>
        </button>

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
              <div className="absolute right-0 top-full z-40 mt-2 flex max-h-[70vh] w-72 flex-col gap-3 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--container-2)] p-3">
                {hasAdvanced && (
                  <button
                    onClick={() => {
                      setGenreFilter('')
                      setYearFilter('')
                      setAuthorFilter('')
                      setDirectorFilter('')
                      setActorFilter('')
                      setHasRating(false)
                      setHasReview(false)
                      setAddedFrom('')
                      setAddedTo('')
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
                  className={filterInput}
                />
                <input
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  placeholder={t('year')}
                  className={filterInput}
                />
                {/* Per-type: author for books, director/actor for screen media. */}
                {(typeFilter === 'book' || typeFilter === 'all') && (
                  <input
                    value={authorFilter}
                    onChange={(e) => setAuthorFilter(e.target.value)}
                    placeholder={t('author')}
                    className={filterInput}
                  />
                )}
                {(typeFilter === 'movie' || typeFilter === 'series' || typeFilter === 'all') && (
                  <>
                    <input
                      value={directorFilter}
                      onChange={(e) => setDirectorFilter(e.target.value)}
                      placeholder={t('director')}
                      className={filterInput}
                    />
                    <input
                      value={actorFilter}
                      onChange={(e) => setActorFilter(e.target.value)}
                      placeholder={t('actor')}
                      className={filterInput}
                    />
                  </>
                )}

                {/* Date added range */}
                <label className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                  {t('addedAfter')}
                  <input type="date" value={addedFrom} onChange={(e) => setAddedFrom(e.target.value)} className={`${filterInput} w-36`} />
                </label>
                <label className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                  {t('addedBefore')}
                  <input type="date" value={addedTo} onChange={(e) => setAddedTo(e.target.value)} className={`${filterInput} w-36`} />
                </label>

                {/* Comparison vs your shelf — only when browsing another user's library */}
                {readOnly && (
                  <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
                    {([
                      { key: 'all', label: t('compareAll') },
                      { key: 'shared', label: t('compareShared') },
                      { key: 'onlyTheirs', label: t('compareOnlyTheirs') },
                    ] as const).map((c) => (
                      <button
                        key={c.key}
                        onClick={() => setCompareFilter(c.key)}
                        className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                          compareFilter === c.key
                            ? 'bg-[var(--surface-active)] text-[var(--text)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
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

        {/* Import (Goodreads CSV, etc.) — own library only */}
        {!readOnly && (
          <>
            <button
              onClick={() => setShowImport(true)}
              title={t('importLibrary') || 'Import'}
              className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            >
              <IoCloudUploadOutline className="h-4 w-4" />
              <span className="hidden sm:inline">{t('import') || 'Import'}</span>
            </button>
            <button
              onClick={() => setShowExport(true)}
              title={t('exportLibrary')}
              className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            >
              <IoDownloadOutline className="h-4 w-4" />
              <span className="hidden sm:inline">{t('exportLabel')}</span>
            </button>
          </>
        )}

        <div className="ml-auto hidden text-sm text-[var(--text-muted)] md:block">
          {t('showing', { n: filtered.length, total: items.length })}
        </div>
      </div>

      <MediaModal
        isOpen={showForm !== null}
        initialType={showForm || 'book'}
        onClose={() => setShowForm(null)}
        onSave={handleSave}
      />
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => libraryService.getItems().then(setItems)}
      />
      <MediaDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
      {showExport && (
        <ExportModal collections={collections} onClose={() => setShowExport(false)} />
      )}

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
              onToggleFavorite={readOnly ? undefined : () => toggleFavorite(it)}
              onOpenDetail={setDetailItem}
              onFilterStatus={(s) => {
                const next = new URLSearchParams(params)
                next.set('shelf', s)
                setParams(next, { replace: true })
              }}
              onFilterType={setTypeFilter}
              progress={progressMap.get(it.id)}
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
              onToggleFavorite={readOnly ? undefined : () => toggleFavorite(it)}
              showReview
              onOpenDetail={setDetailItem}
              compareName={readOnly ? ownerName : undefined}
              myEntry={readOnly ? myByMediaId.get(it.id) : undefined}
              progress={progressMap.get(it.id)}
            />
          ))}
        </div>
      )}
      </div>{/* end main content */}
      </div>{/* end 2-col flex */}
    </Layout>
  )
}
