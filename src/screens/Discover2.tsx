import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/lib/router'
import Layout from '../components/layout/Layout'
import CatalogCard from '../components/CatalogCard'
import { catalogService, compactCount } from '../services/catalogService'
import type { CatalogItem, PersonHit } from '../services/catalogService'
import { libraryService } from '../services/libraryService'
import type { MediaItem, MediaType } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { redirectToNonsLogin } from '../lib/api'
import { initials, colorFor } from '../lib/user'
import { IoStar, IoFlame, IoPeopleOutline, IoLogInOutline, IoSparklesOutline } from 'react-icons/io5'
import { mediaPath } from '../lib/paths'
import TypeBadge from '../components/TypeBadge'

const keyOf = (it: { type: string; title: string }) => `${it.type}:${it.title.trim().toLowerCase()}`
const dedupe = (items: CatalogItem[]) => {
  const seen = new Set<string>()
  return items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
}

type TypeFilter = 'all' | MediaType

export default function Discover2Page() {
  const { t } = useLanguage()
  const { isAuthenticated, loading: authLoading } = useAuth()

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [popular, setPopular] = useState<CatalogItem[]>([])
  const [recent, setRecent] = useState<CatalogItem[]>([])
  const [newestBooks, setNewestBooks] = useState<CatalogItem[]>([])
  const [newestMovies, setNewestMovies] = useState<CatalogItem[]>([])
  const [spotlights, setSpotlights] = useState<Record<MediaType, CatalogItem[]> | null>(null)
  const [people, setPeople] = useState<PersonHit[]>([])
  const [libKeys, setLibKeys] = useState<Set<string>>(new Set())
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const scopeType = typeFilter === 'all' ? undefined : typeFilter

  // Catalog rows for the active scope. `recent()` returns the most recently
  // added rows, so it doubles as the "just added" / newest source. Refetch when
  // the toggle changes; the public /api/media endpoint answers anonymously.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      catalogService.popular(scopeType, 24),
      catalogService.recent(scopeType, 24),
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

  // Notable people (once) + the viewer's library keys (only when signed in, so
  // anonymous visitors make no auth call).
  useEffect(() => {
    catalogService.notablePeople(16).then(setPeople).catch(() => {})
  }, [])
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
  // Top genres across the loaded pool → one row each (no extra fetch).
  const genreRows = useMemo(() => {
    const pool = dedupe([...popular, ...recent])
    const freq = new Map<string, number>()
    for (const c of pool) for (const g of c.genre ?? []) if (g) freq.set(g, (freq.get(g) ?? 0) + 1)
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => ({ genre, items: pool.filter((c) => (c.genre ?? []).includes(genre)).slice(0, 18) }))
      .filter((r) => r.items.length >= 4)
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
          {/* Newest additions — the headline feature of Discover 2. */}
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
          <PeopleRow title={t('notableNames')} people={people} t={t} />
          <Row title={t('newReleases')} items={newReleases} inLibrary={inLibrary} addProp={addProp} />

          {typeFilter === 'all' && spotlights && (
            <>
              <Row title={t('popularBooks')} items={spotlights.book} inLibrary={inLibrary} addProp={addProp} />
              <Row title={t('popularFilms')} items={spotlights.movie} inLibrary={inLibrary} addProp={addProp} />
              <Row title={t('popularSeries')} items={spotlights.series} inLibrary={inLibrary} addProp={addProp} />
            </>
          )}

          {genreRows.map((r) => (
            <Row key={r.genre} title={`${t('browseByGenre')}: ${r.genre}`} items={r.items} inLibrary={inLibrary} addProp={addProp} />
          ))}
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
  t: (k: string, v?: Record<string, string | number>) => string
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

// Notable names — round avatar cards linking to each person's /p/<uuid> page.
function PeopleRow({ title, people, t }: { title: string; people: PersonHit[]; t: (k: string, v?: Record<string, string | number>) => string }) {
  if (people.length === 0) return null
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-base font-semibold text-[var(--text)]">{title}</h2>
      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
        {people.map((p) => (
          <Link key={p.uuid} to={`/p/${p.uuid}`} className="group flex w-24 flex-shrink-0 flex-col items-center text-center sm:w-28">
            <div className="aspect-square w-full overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--container-2)] transition-colors group-hover:border-[var(--border)]">
              {p.photoUrl ? (
                <img src={p.photoUrl} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center text-lg font-semibold text-white"
                  style={{ backgroundColor: colorFor(p.uuid || p.name) }}
                >
                  {initials(p.name)}
                </span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-xs font-medium leading-snug text-[var(--text)] group-hover:text-nonsprimary">{p.name}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{t('nTitles', { n: p.creditCount })}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
