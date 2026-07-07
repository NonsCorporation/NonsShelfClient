import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/lib/router'
import Layout from '../components/layout/Layout'
import CatalogCard from '../components/CatalogCard'
import BoringAvatar from '../components/BoringAvatar'
import ShelfStatusBar from '../components/ShelfStatusBar'
import { catalogService } from '../services/catalogService'
import type { CatalogItem } from '../services/catalogService'
import { libraryService } from '../services/libraryService'
import { listService } from '../services/listService'
import { connectionService } from '../services/connectionService'
import type { MediaItem, MediaType, ShelfStatus, CuratedListDiscoverEntry, Franchise } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { redirectToNonsLogin } from '../lib/api'
import { initials, colorFor } from '../lib/user'
import {
  IoStar, IoPeopleOutline, IoLogInOutline, IoSparklesOutline, IoArrowForward,
  IoChevronBack, IoChevronForward, IoLayersOutline, IoPlanetOutline,
} from 'react-icons/io5'
import { mediaPath } from '../lib/paths'
import TypeBadge from '../components/TypeBadge'

type Translate = (k: string, v?: Record<string, string | number>) => string

const keyOf = (it: { type: string; title: string }) => `${it.type}:${it.title.trim().toLowerCase()}`
const dedupe = (items: CatalogItem[]) => {
  const seen = new Set<string>()
  return items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
}
const creditOf = (it: CatalogItem) => (it.type === 'book' ? it.author : it.director || it.author)
// Builds the minimal MediaItem shape ShelfStatusBar needs from a catalog row.
const shelfItemOf = (it: CatalogItem): MediaItem => ({
  id: it.id, uuid: it.uuid, type: it.type, title: it.title, author: it.author, director: it.director,
  coverUrl: it.coverUrl, year: it.year, genre: it.genre, description: it.description,
})
const typeWord = (t: Translate, type: MediaType) => (type === 'book' ? t('book') : type === 'series' ? t('series') : t('film'))
// A creator's role → localized label (falls back to the raw role).
const roleLabel = (t: Translate, role: string) => {
  const key = 'role' + role.charAt(0).toUpperCase() + role.slice(1)
  const label = t(key)
  return label === key ? role : label
}

// A person surfaced from the catalog pool: the author of their books or the
// director of their films, plus every loaded title they're behind.
type Creator = {
  key: string
  name: string
  role: 'author' | 'director'
  /** Public person uuid (from the media's maker) → links to /p/<uuid>. */
  uuid?: string
  works: CatalogItem[]
}

type TypeFilter = 'all' | MediaType

export default function DiscoverPage() {
  const { t } = useLanguage()
  const { isAuthenticated, loading: authLoading } = useAuth()

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [popular, setPopular] = useState<CatalogItem[]>([])
  const [recent, setRecent] = useState<CatalogItem[]>([])
  const [newestBooks, setNewestBooks] = useState<CatalogItem[]>([])
  const [newestMovies, setNewestMovies] = useState<CatalogItem[]>([])
  const [spotlights, setSpotlights] = useState<Record<MediaType, CatalogItem[]> | null>(null)
  const [curatedLists, setCuratedLists] = useState<CuratedListDiscoverEntry[]>([])
  const [universes, setUniverses] = useState<Franchise[]>([])
  const [libItems, setLibItems] = useState<Map<string, MediaItem>>(new Map())
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const scopeType = typeFilter === 'all' ? undefined : typeFilter

  // Catalog rows for the active scope. `recent()` returns the most recently
  // added rows, so it doubles as the "just added" / newest source. Refetch when
  // the toggle changes; the /api/media endpoint answers over the SSO session.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      catalogService.popular(scopeType, 40),
      catalogService.recent(scopeType, 40),
      catalogService.recent('book', 18),
      catalogService.recent('movie', 18),
      typeFilter === 'all'
        ? Promise.all([
            catalogService.popular('book', 12),
            catalogService.popular('movie', 12),
            catalogService.popular('series', 12),
          ])
        : Promise.resolve(null),
    ])
      .then(([pop, rec, newBooks, newMovies, spots]) => {
        if (cancelled) return
        setPopular(pop)
        setRecent(rec)
        setNewestBooks(newBooks)
        setNewestMovies(newMovies)
        setSpotlights(spots ? { book: spots[0], movie: spots[1], series: spots[2] } : null)
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [typeFilter, scopeType])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    libraryService.getItems().then((lib) => setLibItems(new Map(lib.map((it) => [keyOf(it), it])))).catch(() => {})
  }, [authLoading, isAuthenticated])

  // Curated lists don't scope by type/filter — fetched once.
  useEffect(() => {
    listService.discoverLists(8).then(setCuratedLists).catch(() => {})
  }, [])

  // Universes (franchises) — shared catalog data, not scoped by type/filter.
  useEffect(() => {
    connectionService.searchFranchises('').then(setUniverses).catch(() => {})
  }, [])

  const inLibrary = (it: CatalogItem) => libItems.has(keyOf(it)) || added.has(keyOf(it))
  const statusOf = (it: CatalogItem): ShelfStatus | null =>
    libItems.get(keyOf(it))?.status ?? (added.has(keyOf(it)) ? 'wishlist' : null)

  const handleAdd = async (it: CatalogItem) => {
    if (!isAuthenticated) {
      redirectToNonsLogin()
      return
    }
    const payload: Omit<MediaItem, 'id'> & { id?: string } = {
      id: it.id, type: it.type, title: it.title, author: it.author, director: it.director,
      coverUrl: it.coverUrl, year: it.year, genre: it.genre, description: it.description, status: 'wishlist',
    }
    await libraryService.addItem(payload)
    setAdded((prev) => new Set(prev).add(keyOf(it)))
  }
  // Pass an add handler only to signed-in users; anonymous cards hide the button.
  const addProp = (it: CatalogItem) => (isAuthenticated ? () => handleAdd(it) : undefined)

  // Full status picker (want to / reading / finished / dnf), used by the hero
  // carousel instead of a plain add button. Adds the item on first pick, then
  // patches its shelf status on every pick after that.
  const handleStatusChange = async (it: CatalogItem, status: ShelfStatus) => {
    if (!isAuthenticated) {
      redirectToNonsLogin()
      return
    }
    const key = keyOf(it)
    const existing = libItems.get(key)
    const updated = existing
      ? await libraryService.updateItem(existing.id, { status })
      : await libraryService.addItem({
          id: it.id, type: it.type, title: it.title, author: it.author, director: it.director,
          coverUrl: it.coverUrl, year: it.year, genre: it.genre, description: it.description, status,
        })
    setLibItems((prev) => new Map(prev).set(key, updated))
    setAdded((prev) => new Set(prev).add(key))
  }

  // Top few, cover-bearing, for the cinematic hero carousel.
  const heroItems = useMemo(() => popular.filter((p) => p.coverUrl).slice(0, 5), [popular])
  const trending = useMemo(() => dedupe([...popular, ...recent]).slice(0, 10), [popular, recent])

  // Newest additions across the current scope — most recently added first. When
  // a single type is selected, `recent` already holds that type; when "all",
  // interleave the newest books and movies so both surface near the top.
  const newestAll = useMemo(() => {
    if (typeFilter !== 'all') return recent.slice(0, 18)
    const merged: CatalogItem[] = []
    const max = Math.max(newestBooks.length, newestMovies.length)
    for (let i = 0; i < max; i++) {
      if (newestBooks[i]) merged.push(newestBooks[i])
      if (newestMovies[i]) merged.push(newestMovies[i])
    }
    return dedupe(merged).slice(0, 18)
  }, [typeFilter, recent, newestBooks, newestMovies])

  const newReleases = useMemo(
    () => dedupe([...popular, ...recent]).filter((c) => c.year).sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).slice(0, 18),
    [popular, recent],
  )

  // Popular people, derived straight from the loaded catalog: group titles by
  // their maker (book → author, film → director), so each person comes with the
  // real works behind them. No extra requests, and it can't be starved by an
  // empty people endpoint. The most prolific makers in the pool surface first.
  const creators = useMemo(() => {
    const pool = dedupe([...popular, ...recent])
    const map = new Map<string, Creator>()
    for (const it of pool) {
      const name = creditOf(it)?.trim()
      if (!name) continue
      const role: Creator['role'] = it.type === 'book' ? 'author' : 'director'
      const key = it.makerUuid || `${role}:${name.toLowerCase()}`
      const entry = map.get(key) ?? { key, name, role, uuid: it.makerUuid, works: [] }
      if (!entry.uuid && it.makerUuid) entry.uuid = it.makerUuid
      entry.works.push(it)
      map.set(key, entry)
    }
    return [...map.values()]
      .map((c) => ({ ...c, works: dedupe(c.works) }))
      .sort((a, b) => b.works.length - a.works.length || a.name.localeCompare(b.name))
      .slice(0, 8)
  }, [popular, recent])

  // Genre → items. OpenLibrary subjects are noisy and fragmented, so we keep any
  // genre with 2+ titles in the pool and rank by how many titles fall under it.
  const genres = useMemo(() => {
    const pool = dedupe([...popular, ...recent])
    const byGenre = new Map<string, CatalogItem[]>()
    for (const c of pool) for (const g of c.genre ?? []) {
      const genre = g?.trim()
      if (!genre) continue
      const arr = byGenre.get(genre) ?? []
      arr.push(c)
      byGenre.set(genre, arr)
    }
    return [...byGenre.entries()]
      .map(([genre, items]) => ({ genre, items }))
      .filter((r) => r.items.length >= 2)
      .sort((a, b) => b.items.length - a.items.length)
  }, [popular, recent])

  const toggles: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'book', label: t('books') },
    { key: 'movie', label: t('movies') },
    { key: 'series', label: t('seriesPlural') },
  ]

  return (
    <Layout>
      {/* Top bar — minimal, home-page feel: the scope segmented control leads. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold tracking-tight text-[var(--text)]">{t('discover')}</h1>
        <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
          {toggles.map((tg) => (
            <button
              key={tg.key}
              onClick={() => setTypeFilter(tg.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === tg.key
                  ? 'bg-[var(--surface-active)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {tg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sign-in nudge for anonymous visitors. */}
      {!authLoading && !isAuthenticated && (
        <button
          onClick={redirectToNonsLogin}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-nonsprimary/40 bg-[var(--primary-soft)] px-4 py-2.5 text-sm font-medium text-nonsprimaryfocus transition-colors hover:bg-[var(--primary-soft)]/70"
        >
          <IoLogInOutline className="h-4 w-4" />
          {t('signInToAdd')}
        </button>
      )}

      {loading ? (
        <div className="animate-pulse">
          <div className="mb-10 h-80 rounded-3xl bg-[var(--surface)]" />
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-[var(--surface)]" />
            ))}
          </div>
        </div>
      ) : (
        <div className="animate-fade-up">
          {/* ── Cinematic hero carousel ── */}
          <HeroCarousel items={heroItems} canAdd={isAuthenticated} statusOf={statusOf} onStatusChange={handleStatusChange} t={t} />

          {/* ── Explore by genre — leads the page; genres are the primary way
              in, with matching curated lists surfaced as "sublists" once a
              genre is picked. ── */}
          <GenreExplorer genres={genres} lists={curatedLists} inLibrary={inLibrary} addProp={addProp} t={t} />

          {/* ── Community curated lists ── */}
          <CuratedListsRail lists={curatedLists} />

          {/* ── Universes (franchises) — shared catalog groupings ── */}
          <UniversesRail universes={universes} t={t} />

          {/* ── Trending — a compact list with covers, distinct from the card rails ── */}
          <TrendingList title={t('trendingNow')} items={trending} statusOf={statusOf} onStatusChange={handleStatusChange} />

          {/* ── Popular people + their works ── */}
          <PeopleSpotlights creators={creators} t={t} />

          {/* ── Just added ── */}
          <Row title={t('newestAdditions')} icon={<IoSparklesOutline className="h-4 w-4 text-nonsprimaryfocus" />} items={newestAll} inLibrary={inLibrary} addProp={addProp} />

          {typeFilter === 'all' && (
            <>
              <Row title={t('newestBooks')} items={newestBooks} inLibrary={inLibrary} addProp={addProp} />
              <Row title={t('newestMovies')} items={newestMovies} inLibrary={inLibrary} addProp={addProp} />
            </>
          )}

          <Row title={t('newReleases')} items={newReleases} inLibrary={inLibrary} addProp={addProp} />

          {typeFilter === 'all' && spotlights && (
            <>
              <Row title={t('popularBooks')} items={spotlights.book} inLibrary={inLibrary} addProp={addProp} />
              <Row title={t('popularFilms')} items={spotlights.movie} inLibrary={inLibrary} addProp={addProp} />
              <Row title={t('popularSeries')} items={spotlights.series} inLibrary={inLibrary} addProp={addProp} />
            </>
          )}
        </div>
      )}
    </Layout>
  )
}

// ── Cinematic hero carousel (TMDB/IMDb style) ──────────────────────────────────
// A full-bleed banner whose backdrop is the featured cover, blurred and faded
// into the page background so it reads as one surface. Auto-advances through the
// top titles; dots + arrows for manual control.
function HeroCarousel({
  items, canAdd, statusOf, onStatusChange, t,
}: {
  items: CatalogItem[]
  canAdd: boolean
  statusOf: (it: CatalogItem) => ShelfStatus | null
  onStatusChange: (it: CatalogItem, status: ShelfStatus) => void
  t: Translate
}) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = items.length

  useEffect(() => {
    if (count <= 1 || paused) return
    const id = setInterval(() => setIdx((i) => (i + 1) % count), 6500)
    return () => clearInterval(id)
  }, [count, paused])

  if (count === 0) return null
  const active = idx % count
  const item = items[active]
  const go = (n: number) => setIdx((n + count) % count)

  return (
    <section
      className="relative mb-12 overflow-hidden rounded-3xl border border-[var(--border-subtle)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Blurred backdrop that melts into the page. */}
      <div className="absolute inset-0">
        {item.coverUrl && (
          <img key={item.id} src={item.coverUrl} alt="" className="h-full w-full scale-125 object-cover opacity-40 blur-2xl transition-opacity duration-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/85 to-[var(--bg)]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg)] via-[var(--bg)]/60 to-transparent" />
      </div>

      <div className="relative flex items-center gap-5 p-5 sm:gap-8 sm:p-8">
        <Link
          to={mediaPath(item)}
          className="group relative aspect-[2/3] w-28 flex-shrink-0 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--container-2)] shadow-2xl transition-transform hover:scale-[1.02] sm:w-52"
        >
          {item.coverUrl && <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover" />}
          <TypeBadge type={item.type} />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-2xl font-black leading-[1.05] tracking-tight text-[var(--text)] sm:text-4xl">
            <Link to={mediaPath(item)} className="hover:underline">{item.title}</Link>
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)] sm:text-sm">
            <span className="font-medium text-[var(--text)]">{typeWord(t, item.type)}</span>
            {item.year && (<><span className="text-[var(--border-strong)]">·</span><span>{item.year}</span></>)}
            {creditOf(item) && (<><span className="text-[var(--border-strong)]">·</span><span className="truncate">{creditOf(item)}</span></>)}
            {item.communityRating > 0 && (
              <span className="flex items-center gap-1 font-semibold text-[var(--text)]">
                <IoStar className="h-3.5 w-3.5 text-nonsprimaryfocus" />{item.communityRating.toFixed(1)}
              </span>
            )}
          </div>

          {item.genre && item.genre.length > 0 && (
            <div className="mt-3 hidden flex-wrap gap-1.5 sm:flex">
              {item.genre.slice(0, 3).map((g) => (
                <span key={g} className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)]/70 px-2.5 py-1 text-[11px] text-[var(--text-muted)] backdrop-blur-sm">{g}</span>
              ))}
            </div>
          )}

          {item.description && (
            <p className="mt-3 hidden max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:line-clamp-3">{item.description}</p>
          )}

          <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            {canAdd ? (
              <div className="flex h-11 max-w-full items-center">
                <ShelfStatusBar
                  item={shelfItemOf(item)}
                  currentStatus={statusOf(item)}
                  onStatusChange={(status) => onStatusChange(item, status)}
                  variant="button"
                />
              </div>
            ) : (
              <button
                onClick={redirectToNonsLogin}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-nonsprimary px-5 text-sm font-semibold text-white hover:bg-nonsprimaryfocus"
              >
                <IoLogInOutline className="h-4 w-4" />{t('signInToAdd')}
              </button>
            )}
            <Link
              to={mediaPath(item)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]/60 px-5 text-sm font-semibold text-[var(--text)] backdrop-blur-sm transition-colors hover:border-[var(--border)]"
            >
              {t('viewDetails')}
              <IoArrowForward className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Prev / next arrows (desktop). */}
        {count > 1 && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 justify-between px-3 sm:flex">
            <button onClick={() => go(active - 1)} className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg)]/70 text-[var(--text)] backdrop-blur-sm transition-colors hover:bg-[var(--bg)]">
              <IoChevronBack className="h-4 w-4" />
            </button>
            <button onClick={() => go(active + 1)} className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg)]/70 text-[var(--text)] backdrop-blur-sm transition-colors hover:bg-[var(--bg)]">
              <IoChevronForward className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Dots. */}
      {count > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
          {items.map((it, i) => (
            <button
              key={it.id}
              onClick={() => setIdx(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === active ? 'w-6 bg-nonsprimary' : 'w-1.5 bg-[var(--border-strong)] hover:bg-[var(--text-muted)]'}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// A horizontal scroll row of catalog cards. `addProp` returns an add handler for
// signed-in users (undefined ⇒ no add button). An optional `icon` sits before
// the title.
function Row({
  title, icon, items, showReason, inLibrary, addProp,
}: {
  title: string
  icon?: React.ReactNode
  items: CatalogItem[]
  showReason?: boolean
  inLibrary: (it: CatalogItem) => boolean
  addProp: (it: CatalogItem) => (() => void) | undefined
}) {
  if (items.length === 0) return null
  return (
    <section className="mb-11">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight text-[var(--text)]">
        {icon}
        {title}
      </h2>
      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
        {items.map((it) => (
          <div key={it.id} className="w-32 flex-shrink-0 sm:w-40">
            <CatalogCard item={it} inLibrary={inLibrary(it)} onAdd={addProp(it)} showReason={showReason} />
          </div>
        ))}
      </div>
    </section>
  )
}

// Trending — a compact vertical list (cover + title/year/type/description per
// row) rather than a card grid, so it reads distinctly from the rails around
// it. Stacks (cover+text, then rating+status) on mobile; one row on sm+.
function TrendingList({
  title, items, statusOf, onStatusChange,
}: {
  title: string
  items: CatalogItem[]
  statusOf: (it: CatalogItem) => ShelfStatus | null
  onStatusChange: (it: CatalogItem, status: ShelfStatus) => void
}) {
  if (items.length === 0) return null
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-lg font-bold tracking-tight text-[var(--text)]">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
        {items.slice(0, 10).map((it) => (
          <div
            key={it.id}
            className="flex flex-col gap-3 border-b border-[var(--border-subtle)] p-3 transition-colors last:border-0 hover:bg-[var(--surface)] sm:flex-row sm:items-center"
          >
            <Link to={mediaPath(it)} className="flex min-w-0 flex-1 items-start gap-3">
              <div className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--container-2)]">
                {it.coverUrl && <img src={it.coverUrl} alt={it.title} loading="lazy" className="h-full w-full object-cover" />}
                <TypeBadge type={it.type} position="top-1 right-1" size="h-5 w-5" iconSize="h-2.5 w-2.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text)]">{it.title}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {creditOf(it)}
                  {it.year ? ` · ${it.year}` : ''}
                </p>
                {it.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">{it.description}</p>
                )}
              </div>
            </Link>

            <div className="flex flex-shrink-0 items-center justify-between gap-3 sm:justify-end">
              {it.communityRating > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
                  <IoStar className="h-3.5 w-3.5 text-nonsprimaryfocus" />
                  {it.communityRating.toFixed(1)}
                </span>
              )}
              <ShelfStatusBar
                item={shelfItemOf(it)}
                currentStatus={statusOf(it)}
                onStatusChange={(status) => onStatusChange(it, status)}
                variant="button"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// Popular people — a horizontal rail of bigger-than-life author/director
// cards: a big avatar with their own covers fanned out behind it, floating.
// The first card leads extra-large so the rail reads as a spotlight, not a
// uniform grid. Derived from the catalog pool, so it renders whenever the
// catalog does.
function PeopleSpotlights({ creators, t }: { creators: Creator[]; t: Translate }) {
  if (creators.length === 0) return null
  return (
    <section className="mb-12">
      <div className="mb-1 flex items-center gap-2">
        <IoPeopleOutline className="h-4 w-4 text-nonsprimaryfocus" />
        <h2 className="text-lg font-bold tracking-tight text-[var(--text)]">{t('popularPeople')}</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--text-muted)]">{t('popularPeopleSubtitle')}</p>
      <div className="no-scrollbar -mx-1 flex items-stretch gap-4 overflow-x-auto px-1 pb-2">
        {creators.map((p, i) => (
          <div key={p.key} className={i === 0 ? 'w-64 flex-shrink-0 sm:w-72' : 'w-48 flex-shrink-0 sm:w-56'}>
            <PersonCard person={p} big={i === 0} t={t} />
          </div>
        ))}
      </div>
    </section>
  )
}

function PersonCard({ person, big, t }: { person: Creator; big?: boolean; t: Translate }) {
  const covers = person.works.filter((w) => w.coverUrl).slice(0, 3)
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] transition-colors hover:border-[var(--border)]">
      {/* Floating covers, fanned out behind the avatar and clipped to the card. */}
      <div className={`relative flex flex-shrink-0 items-center justify-center ${big ? 'h-32' : 'h-24'}`}>
        {covers.map((w, i, arr) => (
          <div
            key={w.id}
            style={{
              transform: `rotate(${(i - (arr.length - 1) / 2) * 14}deg) translateX(${(i - (arr.length - 1) / 2) * (big ? 42 : 28)}px) translateY(${big ? 8 : 5}px)`,
            }}
            className={`absolute overflow-hidden rounded-lg border-2 border-[var(--container)] opacity-70 shadow-lg transition-opacity duration-300 group-hover:opacity-95 ${big ? 'h-24 w-16' : 'h-16 w-11'}`}
          >
            <img src={w.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          </div>
        ))}
        <div className={`relative z-10 flex-shrink-0 overflow-hidden rounded-full border-4 border-[var(--container)] shadow-xl ${big ? 'h-20 w-20' : 'h-14 w-14'}`}>
          <span
            className="flex h-full w-full items-center justify-center font-bold text-white"
            style={{ backgroundColor: colorFor(person.uuid || person.name), fontSize: big ? '1.5rem' : '1rem' }}
          >
            {initials(person.name)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center p-4 pt-2 text-center">
        {person.uuid ? (
          <Link to={`/p/${person.uuid}`} className={`block truncate font-bold text-[var(--text)] hover:text-nonsprimary ${big ? 'text-xl' : 'text-base'}`}>
            {person.name}
          </Link>
        ) : (
          <p className={`truncate font-bold text-[var(--text)] ${big ? 'text-xl' : 'text-base'}`}>{person.name}</p>
        )}
        <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
          <span className="font-medium text-[var(--text)]">{roleLabel(t, person.role)}</span>
          <span>·</span>
          <span>{t('nWorks', { n: person.works.length })}</span>
        </div>
        {person.uuid && (
          <Link
            to={`/p/${person.uuid}`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-nonsprimaryfocus hover:underline"
          >
            {t('viewProfile')}
            <IoArrowForward className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  )
}

// Community curated lists — Goodreads-style Listopia rail. The lead card runs
// bigger and taller than the rest, and every card's covers float as a fanned
// stack rather than tiling edge-to-edge, so it reads as a shelf of things
// someone put together, not another catalog grid.
function CuratedListsRail({ lists }: { lists: CuratedListDiscoverEntry[] }) {
  if (lists.length === 0) return null
  return (
    <section className="mb-11">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight text-[var(--text)]">
        <IoLayersOutline className="h-4 w-4 text-nonsprimaryfocus" />
        Curated lists
      </h2>
      <div className="no-scrollbar -mx-1 flex items-stretch gap-4 overflow-x-auto px-1 pb-1">
        {lists.map((l, i) => (
          <div key={l.id} className={i === 0 ? 'w-64 flex-shrink-0 sm:w-72' : 'w-44 flex-shrink-0 sm:w-52'}>
            <ListCard list={l} big={i === 0} />
          </div>
        ))}
      </div>
    </section>
  )
}

function ListCard({ list, big }: { list: CuratedListDiscoverEntry; big?: boolean }) {
  const covers = (list.cover_urls ?? []).slice(0, big ? 4 : 3)
  return (
    <Link
      to={`/list/${list.uuid}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--primary-soft)] via-[var(--container-2)] to-[var(--container-2)] transition-transform hover:-translate-y-1 ${big ? 'aspect-[3/4]' : 'aspect-[4/5]'}`}
    >
      {/* Floating, fanned covers — same visual language as a list's own page. */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {covers.map((c, i, arr) => (
          <div
            key={i}
            style={{
              transform: `rotate(${(i - (arr.length - 1) / 2) * 9}deg) translateX(${(i - (arr.length - 1) / 2) * (big ? 26 : 18)}px)`,
              zIndex: i,
            }}
            className={`absolute overflow-hidden rounded-lg border-2 border-[var(--container)] shadow-xl transition-transform duration-300 group-hover:scale-105 ${big ? 'h-32 w-20 sm:h-40 sm:w-28' : 'h-20 w-14'}`}
          >
            {c && <img src={c} alt="" loading="lazy" className="h-full w-full object-cover" />}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="relative mt-auto p-3">
        <p className={`truncate font-semibold text-white ${big ? 'text-xl' : 'text-sm'}`}>{list.title}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
          {list.owner_username && (
            <>
              {list.owner_avatar_url ? (
                <img src={list.owner_avatar_url} alt="" className="h-4 w-4 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <span className="h-4 w-4 flex-shrink-0 overflow-hidden rounded-full">
                  <BoringAvatar size={16} name={`user-${list.user_id}`} />
                </span>
              )}
              <span className="truncate">{list.owner_name || list.owner_username}</span>
              <span>·</span>
            </>
          )}
          <span className="flex-shrink-0">{list.count} item{list.count !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </Link>
  )
}

// Universes — shared-catalog franchises (Marvel/Wizarding World-style groupings
// of series and standalone works), shown as a fanned-cover tile (same visual
// language as curated lists), using a preview of member covers from the API.
function UniversesRail({ universes, t }: { universes: Franchise[]; t: Translate }) {
  if (universes.length === 0) return null
  return (
    <section className="mb-12">
      <div className="mb-1 flex items-center gap-2">
        <IoPlanetOutline className="h-4 w-4 text-nonsprimaryfocus" />
        <h2 className="text-lg font-bold tracking-tight text-[var(--text)]">{t('universesTitle')}</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--text-muted)]">{t('universesSubtitle')}</p>
      <div className="no-scrollbar -mx-1 flex items-stretch gap-4 overflow-x-auto px-1 pb-1">
        {universes.map((f) => (
          <UniverseCard key={f.uuid} franchise={f} />
        ))}
      </div>
    </section>
  )
}

function UniverseCard({ franchise }: { franchise: Franchise }) {
  const covers = (franchise.cover_urls ?? []).slice(0, 4)
  return (
    <Link
      to={`/franchise/${franchise.uuid}`}
      className="group relative flex aspect-[4/5] w-44 flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--primary-soft)] via-[var(--container-2)] to-[var(--container-2)] transition-transform hover:-translate-y-1 sm:w-52"
    >
      {/* Floating, fanned covers — same visual language as a curated list's tile. */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {covers.length > 0 ? (
          covers.map((c, i, arr) => (
            <div
              key={i}
              style={{
                transform: `rotate(${(i - (arr.length - 1) / 2) * 9}deg) translateX(${(i - (arr.length - 1) / 2) * 18}px)`,
                zIndex: i,
              }}
              className="absolute h-20 w-14 overflow-hidden rounded-lg border-2 border-[var(--container)] shadow-xl transition-transform duration-300 group-hover:scale-105"
            >
              <img src={c} alt="" loading="lazy" className="h-full w-full object-cover" />
            </div>
          ))
        ) : (
          <IoPlanetOutline className="h-10 w-10 text-[var(--text-muted)]" />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="relative mt-auto p-3">
        <p className="truncate text-sm font-semibold text-white">{franchise.name}</p>
        {typeof franchise.count === 'number' && franchise.count > 0 && (
          <p className="mt-1 text-xs text-white/70">{franchise.count} work{franchise.count !== 1 ? 's' : ''}</p>
        )}
      </div>
    </Link>
  )
}

// Explore by genre — the page's lead-in. "All" shows a bento collage of
// genre tiles (mixed sizes, floating covers) rather than a uniform grid;
// picking a genre swaps in its full item grid plus any curated lists tagged
// with that genre ("sublists" — Listopia-by-genre).
function GenreExplorer({
  genres, lists, inLibrary, addProp, t,
}: {
  genres: { genre: string; items: CatalogItem[] }[]
  lists: CuratedListDiscoverEntry[]
  inLibrary: (it: CatalogItem) => boolean
  addProp: (it: CatalogItem) => (() => void) | undefined
  t: Translate
}) {
  const [selected, setSelected] = useState<string | null>(null)
  if (genres.length === 0) return null

  const active = selected ? genres.find((g) => g.genre === selected) : null
  const sublists = selected ? lists.filter((l) => l.genres?.includes(selected)) : []

  return (
    <section className="mb-12">
      <h2 className="mb-1 text-lg font-bold tracking-tight text-[var(--text)]">{t('exploreByGenre')}</h2>
      <p className="mb-4 text-sm text-[var(--text-muted)]">{t('exploreByGenreSubtitle')}</p>

      {/* Genre pills. */}
      <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        <GenrePill label={t('allGenres')} active={selected === null} onClick={() => setSelected(null)} />
        {genres.map((g) => (
          <GenrePill key={g.genre} label={g.genre} count={g.items.length} active={selected === g.genre} onClick={() => setSelected(g.genre)} />
        ))}
      </div>

      {active ? (
        <div>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-6">
            {active.items.slice(0, 18).map((it) => (
              <CatalogCard key={it.id} item={it} inLibrary={inLibrary(it)} onAdd={addProp(it)} />
            ))}
          </div>

          {/* Sublists — curated lists tagged with this genre. */}
          {sublists.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <IoLayersOutline className="h-3.5 w-3.5 text-nonsprimaryfocus" />
                Lists in {active.genre}
              </h3>
              <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
                {sublists.map((l) => (
                  <div key={l.id} className="w-44 flex-shrink-0 sm:w-52">
                    <ListCard list={l} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // Bento collage — the first tile leads bigger (2×2), the second is
        // tall (1×2), the rest fill in at the regular size.
        <div className="grid auto-rows-[132px] grid-cols-2 gap-4 sm:auto-rows-[150px] sm:grid-cols-4">
          {genres.slice(0, 7).map((g, i) => (
            <GenreCard
              key={g.genre}
              genre={g.genre}
              items={g.items}
              tint={i}
              big={i === 0}
              className={i === 0 ? 'col-span-2 row-span-2' : i === 1 ? 'row-span-2' : ''}
              onClick={() => setSelected(g.genre)}
              t={t}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function GenrePill({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-[var(--border-strong)] bg-[var(--surface-active)] text-[var(--text)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text)]'
      }`}
    >
      {label}
      {count != null && <span className="text-[var(--text-muted)]">{count}</span>}
    </button>
  )
}

// A rotating set of tints so the genre tiles feel curated (Goodreads/TMDB).
const GENRE_TINTS = [
  'from-rose-500/30', 'from-amber-500/30', 'from-emerald-500/30', 'from-sky-500/30',
  'from-violet-500/30', 'from-fuchsia-500/30', 'from-cyan-500/30', 'from-orange-500/30',
]

// A genre "cover" — a fanned, floating stack of the genre's own covers over a
// tinted gradient (not a tiled collage), with the name and count overlaid.
// Clicking selects the genre. `big` (the bento layout's lead tile) gets a
// larger stack and much bigger type.
function GenreCard({
  genre, items, tint, big, className, onClick, t,
}: {
  genre: string
  items: CatalogItem[]
  tint: number
  big?: boolean
  className?: string
  onClick: () => void
  t: Translate
}) {
  const covers = items.filter((i) => i.coverUrl).slice(0, big ? 5 : 3)
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br ${GENRE_TINTS[tint % GENRE_TINTS.length]} to-[var(--container-2)] text-left transition-transform hover:-translate-y-0.5 hover:border-[var(--border)] ${className ?? ''}`}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {covers.map((c, i, arr) => (
          <div
            key={c.id}
            style={{
              transform: `rotate(${(i - (arr.length - 1) / 2) * 10}deg) translateX(${(i - (arr.length - 1) / 2) * (big ? 46 : 24)}px) translateY(${Math.abs(i - (arr.length - 1) / 2) * (big ? 10 : 6)}px)`,
              zIndex: i,
            }}
            className={`absolute overflow-hidden rounded-lg border-2 border-black/10 shadow-xl transition-transform duration-300 group-hover:scale-105 ${big ? 'h-32 w-24 sm:h-40 sm:w-28' : 'h-16 w-11 sm:h-20 sm:w-14'}`}
          >
            {c.coverUrl && <img src={c.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className={`truncate font-bold text-white ${big ? 'text-2xl' : 'text-sm'}`}>{genre}</p>
        <p className="text-xs text-white/70">{t('nWorks', { n: items.length })}</p>
      </div>
    </button>
  )
}
