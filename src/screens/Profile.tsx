import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from '@/lib/router'
import Layout from '../components/layout/Layout'
import ImportModal from '../components/ImportModal'
import SettingsModal from '../components/SettingsModal'
import { libraryService } from '../services/libraryService'
import { fetchPublicProfile } from '../services/userService'
import { nonsProfileUrl } from '../lib/api'
import type { MediaItem, ShelfStatus } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { currentUser, initials, colorFor } from '../lib/user'
import { mediaPath } from '../lib/paths'
import { STATUS_COLOR, statusLabel } from '../lib/shelf'
import TypeBadge from '../components/TypeBadge'
import StarsSelector from '../StarsSelector'
import {
  IoOpenOutline,
  IoSettingsOutline,
  IoLibraryOutline,
  IoBookOutline,
  IoFilmOutline,
  IoTvOutline,
  IoChatbubbleOutline,
  IoStarOutline,
  IoStar,
} from 'react-icons/io5'
import type { IconType } from 'react-icons'
import type { MediaType } from '../types'

type ProfileView = {
  name: string
  handle: string
  color: string
  avatar: string
}

type Tab = 'all' | ShelfStatus

// Per-type identity used across the cards: an icon, a label key and an accent
// colour. Gives books, films and series a distinct, recognisable look instead of
// leaning on one generic poster treatment.
const TYPE_META: Record<MediaType, { icon: IconType; labelKey: string; color: string }> = {
  book: { icon: IoBookOutline, labelKey: 'book', color: '#e0a458' },
  movie: { icon: IoFilmOutline, labelKey: 'film', color: '#7c8cff' },
  series: { icon: IoTvOutline, labelKey: 'series', color: '#4fd1c5' },
}

// Tolerate legacy/unknown type values from older records — fall back to film.
const typeMeta = (type: MediaType) => TYPE_META[type] ?? TYPE_META.movie

export default function ProfilePage() {
  const { t } = useLanguage()
  const { id: routeId } = useParams<{ id: string }>()
  const { user: authUser, loading: authLoading } = useAuth()

  const [items, setItems] = useState<MediaItem[]>([])
  const [profile, setProfile] = useState<ProfileView | null>(null)
  const [isSelf, setIsSelf] = useState(true)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [importOpen, setImportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)

    const mine = !routeId || routeId === authUser?.username || routeId === authUser?.uuid

    async function load() {
      if (mine) {
        const its = await libraryService.getItems()
        if (cancelled) return
        setIsSelf(true)
        setProfile({
          name: authUser?.name || authUser?.username || currentUser.name,
          handle: authUser?.username ?? currentUser.handle,
          color: currentUser.color,
          avatar: authUser?.avatar_url || '',
        })
        setItems(its)
      } else {
        const p = await fetchPublicProfile(routeId!)
        if (cancelled) return
        if (!p) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setIsSelf(false)
        setProfile({ name: p.name, handle: p.username, color: colorFor(p.username), avatar: p.avatarUrl || '' })
        const its = await libraryService.getUserItems(p.id)
        if (cancelled) return
        setItems(its)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [routeId, authUser, authLoading])

  const byNewest = (a: MediaItem, b: MediaItem) => (b.dateAdded ?? '').localeCompare(a.dateAdded ?? '')
  // Rated OR reviewed items — Goodreads shows a rating-only entry here too.
  const reviews = useMemo(
    () =>
      items
        .filter((it) => (it.review && it.review.trim()) || (typeof it.rating === 'number' && it.rating > 0))
        .sort(byNewest),
    [items],
  )
  const counts = useMemo(
    () => ({
      all: items.length,
      wishlist: items.filter((it) => it.status === 'wishlist').length,
      active: items.filter((it) => it.status === 'active').length,
      done: items.filter((it) => it.status === 'done').length,
      dnf: items.filter((it) => it.status === 'dnf').length,
    }),
    [items],
  )
  const shown = useMemo(() => {
    if (tab === 'all') return [...items].sort(byNewest)
    return items.filter((it) => it.status === tab).sort(byNewest)
  }, [items, tab])

  const ratedAvg = useMemo(() => {
    const rated = items.filter((it) => typeof it.rating === 'number' && it.rating > 0)
    return rated.length ? rated.reduce((s, it) => s + (it.rating || 0), 0) / rated.length / 2 : 0
  }, [items])

  if (loading) {
    return (
      <Layout>
        <div className="py-24 text-center text-[var(--text-muted)]">{t('loading')}</div>
      </Layout>
    )
  }
  if (notFound || !profile) {
    return (
      <Layout>
        <div className="py-24 text-center text-[var(--text-muted)]">{t('userNotFound')}</div>
      </Layout>
    )
  }

  const stats: { label: string; value: string | number }[] = [
    { label: t('statTotal'), value: items.length },
    { label: t('statFinished'), value: counts.done },
    { label: t('statAvg'), value: ratedAvg ? ratedAvg.toFixed(1) : '—' },
  ]
  if (isSelf) stats.push({ label: t('favorites'), value: items.filter((it) => it.favorite).length })

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: t('filterAll'), count: counts.all },
    { key: 'wishlist', label: t('shelfWishlist'), count: counts.wishlist },
    { key: 'active', label: t('shelfActive'), count: counts.active },
    { key: 'done', label: t('shelfDone'), count: counts.done },
    { key: 'dnf', label: t('shelfDNF'), count: counts.dnf },
  ]

  return (
    <Layout>
      {/* Profile card — identity, nons link, settings, stats */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-5 sm:p-6">
        <div className="flex items-start gap-5">
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.name} className="h-20 w-20 flex-shrink-0 rounded-2xl object-cover" />
          ) : (
            <span
              className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold text-white"
              style={{ backgroundColor: profile.color }}
            >
              {initials(profile.name)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight text-[var(--text)]">{profile.name}</h1>
            <p className="text-sm text-[var(--text-muted)]">@{profile.handle}</p>
            {profile.handle && (
              <a
                href={nonsProfileUrl(profile.handle)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-nonsprimary hover:underline"
              >
                <IoOpenOutline className="h-4 w-4" />
                {t('viewNonsProfile')}
              </a>
            )}
          </div>

          {/* Settings — own profile only; opens the full settings modal */}
          {isSelf && (
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label={t('settingsTitle')}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
            >
              <IoSettingsOutline className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Stats — stacked value-over-label cells, divided like an IMDb header */}
        <div className="mt-5 flex flex-wrap items-stretch gap-x-6 gap-y-3 border-t border-[var(--border-subtle)] pt-4 sm:gap-x-8">
          {stats.map((s, i) => (
            <div key={s.label} className={`flex flex-col ${i > 0 ? 'border-l border-[var(--border-subtle)] pl-6 sm:pl-8' : ''}`}>
              <span className="text-xl font-bold leading-none text-[var(--text)]">{s.value}</span>
              <span className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shelf tabs */}
      <div className="no-scrollbar mt-6 flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)]">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === tb.key
                ? 'border-nonsprimary text-[var(--text)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {tb.label}
            <span className="text-xs text-[var(--text-muted)]">{tb.count}</span>
          </button>
        ))}
      </div>

      {/* Shelf — a single horizontal row so reviews stay reachable below it. */}
      <div className="mt-5">
        {shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--text-muted)]">{t('noResults')}</p>
        ) : (
          <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
            {shown.map((it) => {
              const status = it.status ?? 'wishlist'
              const rated = typeof it.rating === 'number' && it.rating > 0
              return (
                <Link key={it.id} to={mediaPath(it)} className="group w-24 flex-shrink-0 sm:w-28" title={it.title}>
                  <Cover item={it}>
                    {rated && (
                      <span className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        <IoStar className="h-2.5 w-2.5 text-nonsprimaryfocus" />
                        {(it.rating! / 2).toFixed(1)}
                      </span>
                    )}
                  </Cover>
                  <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
                    <span className="truncate">{statusLabel(it.type, status, t)}</span>
                  </p>
                  <p className="line-clamp-2 text-xs font-medium leading-snug text-[var(--text)]">{it.title}</p>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Open the full Goodreads-style library (shelves, filters, sort) for this user. */}
      <div className="mt-4">
        <Link
          to={`/library?user=${encodeURIComponent(profile.handle)}`}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:border-nonsprimary hover:text-nonsprimary"
        >
          <IoLibraryOutline className="h-4 w-4" />
          {t('openFullLibrary')}
        </Link>
      </div>

      {/* Ratings & reviews — below the shelves, Goodreads-style */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-baseline gap-2 text-base font-semibold text-[var(--text)]">
          {t('ratingsReviewsTitle')}
          {reviews.length > 0 && <span className="text-sm font-normal text-[var(--text-muted)]">{reviews.length}</span>}
        </h2>
        {reviews.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-sm text-[var(--text-muted)]">
            {t('noRatingsReviews')}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map((it) => {
              const meta = typeMeta(it.type)
              const TypeIcon = meta.icon
              const rated = typeof it.rating === 'number' && it.rating > 0
              const hasReview = !!(it.review && it.review.trim())
              return (
                <article
                  key={it.id}
                  className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 transition-colors hover:border-[var(--border)] sm:p-5"
                >
                  {/* cover + details, single aligned column on the right */}
                  <div className="flex gap-4">
                    <Link to={mediaPath(it)} className="block w-[68px] flex-shrink-0 sm:w-[84px]" title={it.title}>
                      <Cover item={it} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      {/* type chip + year — colour-coded per media kind */}
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                          style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
                        >
                          <TypeIcon className="h-3 w-3" />
                          {t(meta.labelKey)}
                        </span>
                        {it.year && <span className="text-[var(--text-muted)]">{it.year}</span>}
                      </div>

                      <Link
                        to={mediaPath(it)}
                        className="mt-1.5 block text-base font-bold leading-snug text-[var(--text)] hover:text-nonsprimary"
                      >
                        {it.title}
                      </Link>
                      {(it.author || it.director) && (
                        <p className="text-sm text-[var(--text-muted)]">
                          {t('by')} <span className="text-[var(--text)]">{it.author || it.director}</span>
                        </p>
                      )}

                      {/* action line: stars, then what the user did + when —
                          packed together (no stretched gap before the date). */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--text-muted)]">
                        {rated && (
                          <span className="flex items-center gap-1.5">
                            <StarsSelector initialValue={it.rating} isEditable={false} size="sm" />
                            <span className="font-semibold text-[var(--text)]">{(it.rating! / 2).toFixed(1)}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          {hasReview ? <IoChatbubbleOutline className="h-3.5 w-3.5" /> : <IoStarOutline className="h-3.5 w-3.5" />}
                          {hasReview ? t('verbReviewed') : t('verbRated')}
                          {it.dateAdded && ` · ${formatDate(it.dateAdded)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* review text sits below, divided from the meta */}
                  {hasReview && (
                    <p className="mt-3 whitespace-pre-line border-t border-[var(--border-subtle)] pt-3 text-sm leading-6 text-[var(--text)]">
                      {it.review}
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenImport={() => setImportOpen(true)} />
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onImported={() => libraryService.getItems().then(setItems)} />
    </Layout>
  )
}

// A 2:3 poster with the type badge. `children` overlay on top of the cover
// (used for the rating chip on shelf items).
function Cover({ item, children }: { item: MediaItem; children?: ReactNode }) {
  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--container-2)] transition-colors group-hover:border-[var(--border)]">
      {item.coverUrl ? (
        <img src={item.coverUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[var(--placeholder)]">
          {(() => {
            const Icon = typeMeta(item.type).icon
            return <Icon className="h-7 w-7" />
          })()}
        </span>
      )}
      <TypeBadge type={item.type} />
      {children}
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
