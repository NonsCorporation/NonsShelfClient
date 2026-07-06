import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/lib/router'
import Layout from '../components/layout/Layout'
import CatalogCard from '../components/CatalogCard'
import { catalogService, compactCount } from '../services/catalogService'
import type { CatalogItem } from '../services/catalogService'
import { libraryService } from '../services/libraryService'
import type { MediaItem, MediaType } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { redirectToNonsLogin } from '../lib/api'
import { initials, colorFor } from '../lib/user'
import { IoStar, IoFlame, IoPeopleOutline, IoLogInOutline, IoSparklesOutline, IoArrowForward } from 'react-icons/io5'
import { mediaPath } from '../lib/paths'
import TypeBadge from '../components/TypeBadge'

type Translate = (k: string, v?: Record<string, string | number>) => string

const keyOf = (it: { type: string; title: string }) => `${it.type}:${it.title.trim().toLowerCase()}`
const dedupe = (items: CatalogItem[]) => {
  const seen = new Set<string>()
  return items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
}
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
  const [libKeys, setLibKeys] = useState<Set<string>>(new Set())
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
    libraryService.getItems().then((lib) => setLibKeys(new Set(lib.map(keyOf)))).catch(() => {})
  }, [authLoading, isAuthenticated])

  const inLibrary = (it: CatalogItem) => libKeys.has(keyOf(it)) || added.has(keyOf(it))

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

  const featured = popular[0]

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
      const name = (it.type === 'book' ? it.author : it.director || it.author)?.trim()
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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">{t('discover')}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{t('discoverSubtitle')}</p>
        </div>
        {/* Type toggle — scopes every row below. */}
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : (
        <div className="animate-fade-up">
          {/* Newest additions — the headline feature. */}
          <Row
            title={t('newestAdditions')}
            icon={<IoSparklesOutline className="h-4 w-4 text-nonsprimaryfocus" />}
            items={newestAll}
            inLibrary={inLibrary}
            addProp={addProp}
          />

          {/* When browsing everything, split newest by type so each stands out. */}
          {typeFilter === 'all' && (
            <>
              <Row title={t('newestBooks')} items={newestBooks} inLibrary={inLibrary} addProp={addProp} />
              <Row title={t('newestMovies')} items={newestMovies} inLibrary={inLibrary} addProp={addProp} />
            </>
          )}

          {featured && <Hero item={featured} canAdd={isAuthenticated} inLibrary={inLibrary(featured)} onAdd={() => handleAdd(featured)} t={t} />}

          <Row title={t('popularNow')} items={popular.slice(1)} inLibrary={inLibrary} addProp={addProp} />

          {/* Popular people, each with a strip of their works. */}
          <PeopleSpotlights creators={creators} t={t} />

          {/* Explore by genre — a genre selector over a filterable grid. */}
          <GenreExplorer genres={genres} inLibrary={inLibrary} addProp={addProp} t={t} />

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
    <section className="mb-10">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-[var(--text)]">
        {icon}
        {title}
      </h2>
      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
        {items.map((it) => (
          <div key={it.id} className="w-36 flex-shrink-0 sm:w-40">
            <CatalogCard item={it} inLibrary={inLibrary(it)} onAdd={addProp(it)} showReason={showReason} />
          </div>
        ))}
      </div>
    </section>
  )
}

// Hero — the top-popular item, with an add (or sign-in) CTA.
function Hero({
  item, canAdd, inLibrary, onAdd, t,
}: {
  item: CatalogItem
  canAdd: boolean
  inLibrary: boolean
  onAdd: () => void
  t: Translate
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center gap-2">
        <IoFlame className="h-4 w-4 text-nonslightred" />
        <h2 className="text-base font-semibold text-[var(--text)]">{t('trendingNow')}</h2>
      </div>
      <div className="flex flex-col gap-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 sm:flex-row sm:p-5">
        <Link
          to={mediaPath(item)}
          className="relative aspect-[2/3] w-32 flex-shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--container-2)] transition-colors hover:border-[var(--border)] sm:w-44"
        >
          {item.coverUrl && <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover" />}
          <TypeBadge type={item.type} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
            <span>{item.type === 'book' ? t('book') : item.type === 'series' ? t('series') : t('film')}</span>
            {item.year && (<><span className="text-[var(--border-strong)]">·</span><span>{item.year}</span></>)}
            {item.genre && item.genre.length > 0 && (
              <><span className="text-[var(--border-strong)]">·</span><span className="normal-case tracking-normal">{item.genre.slice(0, 3).join(', ')}</span></>
            )}
          </div>
          <h3 className="mt-1.5 text-2xl font-bold leading-tight tracking-tight text-[var(--text)]">
            <Link to={mediaPath(item)} className="hover:underline">{item.title}</Link>
          </h3>
          <p className="text-sm text-[var(--text-muted)]">{item.type === 'book' ? item.author : item.director || item.author}</p>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            {item.communityRating > 0 && (
              <span className="flex items-center gap-1.5 font-semibold text-[var(--text)]">
                <IoStar className="h-4 w-4 text-nonsprimaryfocus" />
                {item.communityRating.toFixed(1)}
              </span>
            )}
            {item.popularity > 0 && (
              <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <IoPeopleOutline className="h-4 w-4" />
                {t('inLibrariesLabel', { n: compactCount(item.popularity) })}
              </span>
            )}
          </div>

          {item.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--text-muted)]">{item.description}</p>}

          <div className="mt-auto pt-4">
            {canAdd ? (
              <button
                onClick={onAdd}
                disabled={inLibrary}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors ${
                  inLibrary ? 'cursor-default border border-[var(--border-subtle)] text-[var(--text-muted)]' : 'bg-nonsprimary text-white hover:bg-nonsprimaryfocus'
                }`}
              >
                {inLibrary ? t('inLibrary') : t('addToLibrary')}
              </button>
            ) : (
              <button
                onClick={redirectToNonsLogin}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-nonsprimary px-5 text-sm font-semibold text-white hover:bg-nonsprimaryfocus"
              >
                <IoLogInOutline className="h-4 w-4" />
                {t('signInToAdd')}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// Popular people — one rich card each: avatar, role and a horizontal strip of
// their works (covers link straight to the title). Derived from the catalog
// pool, so it renders whenever the catalog does.
function PeopleSpotlights({ creators, t }: { creators: Creator[]; t: Translate }) {
  if (creators.length === 0) return null
  return (
    <section className="mb-10">
      <div className="mb-1 flex items-center gap-2">
        <IoPeopleOutline className="h-4 w-4 text-nonsprimaryfocus" />
        <h2 className="text-base font-semibold text-[var(--text)]">{t('popularPeople')}</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--text-muted)]">{t('popularPeopleSubtitle')}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {creators.map((p) => {
          return (
            <div
              key={p.key}
              className="flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 transition-colors hover:border-[var(--border)]"
            >
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border border-[var(--border-subtle)]">
                  <span
                    className="flex h-full w-full items-center justify-center text-base font-semibold text-white"
                    style={{ backgroundColor: colorFor(p.uuid || p.name) }}
                  >
                    {initials(p.name)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  {p.uuid ? (
                    <Link to={`/p/${p.uuid}`} className="block truncate text-lg font-semibold text-[var(--text)] hover:text-nonsprimary">
                      {p.name}
                    </Link>
                  ) : (
                    <p className="truncate text-lg font-semibold text-[var(--text)]">{p.name}</p>
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--text-muted)]">
                    <span className="font-medium text-[var(--text)]">{roleLabel(t, p.role)}</span>
                    <span className="text-[var(--border-strong)]">·</span>
                    <span>{t('nWorks', { n: p.works.length })}</span>
                  </div>
                </div>
                {p.uuid && (
                  <Link
                    to={`/p/${p.uuid}`}
                    className="hidden flex-shrink-0 items-center gap-1 self-start rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-nonsprimary hover:text-nonsprimary sm:inline-flex"
                  >
                    {t('viewProfile')}
                    <IoArrowForward className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {/* Works strip — covers scroll horizontally, linking to each title. */}
              <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1">
                {p.works.map((w) => (
                  <Link key={w.id} to={mediaPath(w)} className="group/w w-20 flex-shrink-0" title={w.title}>
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--container-2)] transition-colors group-hover/w:border-[var(--border)]">
                      {w.coverUrl
                        ? <img src={w.coverUrl} alt={w.title} loading="lazy" className="h-full w-full object-cover transition-transform group-hover/w:scale-105" />
                        : <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-[var(--text-muted)]">{w.title}</span>}
                      <TypeBadge type={w.type} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-tight text-[var(--text-muted)] group-hover/w:text-[var(--text)]">{w.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// Explore by genre — a pill selector over a filterable grid. "All" shows a
// collage of genre cards; picking a genre swaps in that genre's full grid.
function GenreExplorer({
  genres, inLibrary, addProp, t,
}: {
  genres: { genre: string; items: CatalogItem[] }[]
  inLibrary: (it: CatalogItem) => boolean
  addProp: (it: CatalogItem) => (() => void) | undefined
  t: Translate
}) {
  const [selected, setSelected] = useState<string | null>(null)
  if (genres.length === 0) return null

  const active = selected ? genres.find((g) => g.genre === selected) : null

  return (
    <section className="mb-10">
      <div className="mb-1 flex items-center gap-2">
        <IoSparklesOutline className="h-4 w-4 text-nonsprimaryfocus" />
        <h2 className="text-base font-semibold text-[var(--text)]">{t('exploreByGenre')}</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--text-muted)]">{t('exploreByGenreSubtitle')}</p>

      {/* Genre pills. */}
      <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        <GenrePill label={t('allGenres')} active={selected === null} onClick={() => setSelected(null)} />
        {genres.map((g) => (
          <GenrePill key={g.genre} label={g.genre} count={g.items.length} active={selected === g.genre} onClick={() => setSelected(g.genre)} />
        ))}
      </div>

      {active ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {active.items.slice(0, 18).map((it) => (
            <CatalogCard key={it.id} item={it} inLibrary={inLibrary(it)} onAdd={addProp(it)} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {genres.slice(0, 8).map((g) => (
            <GenreCard key={g.genre} genre={g.genre} items={g.items} onClick={() => setSelected(g.genre)} t={t} />
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
          ? 'border-nonsprimary bg-nonsprimary text-white'
          : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text)]'
      }`}
    >
      {label}
      {count != null && <span className={active ? 'text-white/70' : 'text-[var(--text-muted)]'}>{count}</span>}
    </button>
  )
}

// A genre "cover" — a 2×2 collage of the genre's titles under a gradient, with
// the genre name and count overlaid. Clicking selects the genre.
function GenreCard({ genre, items, onClick, t }: { genre: string; items: CatalogItem[]; onClick: () => void; t: Translate }) {
  const covers = items.filter((i) => i.coverUrl).slice(0, 4)
  return (
    <button
      onClick={onClick}
      className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--container-2)] text-left transition-colors hover:border-[var(--border)]"
    >
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
        {covers.length > 0
          ? Array.from({ length: 4 }).map((_, i) => {
              const c = covers[i % covers.length]
              return (
                <div key={i} className="overflow-hidden">
                  {c?.coverUrl && <img src={c.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105" />}
                </div>
              )
            })
          : null}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="truncate text-base font-semibold text-white">{genre}</p>
        <p className="text-xs text-white/70">{t('nWorks', { n: items.length })}</p>
      </div>
    </button>
  )
}
