import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from '@/lib/router'
import Layout from '../components/layout/Layout'
import { ProfileSkeleton } from '@/components/ui/Skeletons'
import ImportModal from '@/components/import-export/ImportModal'
import SettingsModal from '@/components/settings/SettingsModal'
import { libraryService } from '../services/libraryService'
import { collectionService } from '../services/collectionService'
import { challengeService } from '../services/challengeService'
import Pagination from '@/components/ui/Pagination'
import { fetchPublicProfile } from '../services/userService'
import { nonsProfileUrl, nonsFetch, authedFetch } from '../lib/api'
import type { MediaItem, ShelfStatus, Collection, Challenge } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useCollections } from '../contexts/CollectionContext'
import { currentUser } from '../lib/user'
import { isLibrarian } from '../services/librarianService'
import LibrarianBadge from '@/components/badges/LibrarianBadge'
import BoringAvatar from '@/components/ui/BoringAvatar'
import { mediaPath } from '../lib/paths'
import { isYearlyReadingGoal, isGoalChallenge, challengeTitle } from '../lib/challenge'
import { STATUS_COLOR, statusLabel } from '../lib/shelf'
import TypeBadge from '@/components/badges/TypeBadge'
import ActivityCard from '@/components/feed/ActivityCard'
import { getUserActivity, colorFor, type Activity } from '../services/activityService'
import { getCommentCounts } from '../services/commentService'
import {
  IoOpenOutline,
  IoSettingsOutline,
  IoLibraryOutline,
  IoBookOutline,
  IoFilmOutline,
  IoTvOutline,
  IoStar,
  IoFolderOutline,
  IoPeopleOutline,
  IoInformationCircleOutline,
  IoTrophyOutline,
  IoRibbonOutline,
} from 'react-icons/io5'
import type { IconType } from 'react-icons'
import type { MediaType } from '../types'

type ProfileView = {
  id: number
  name: string
  handle: string
  avatar: string
  role?: string
}

type Tab = 'all' | ShelfStatus

type Friend = { uuid: string; username: string; name: string; avatarUrl?: string }

type Translate = (k: string, v?: Record<string, string | number>) => string

// The profile page only ever shows a small preview of the shelf (with a link
// to the full Goodreads-style /library for everything) — no reason to pull
// the whole shelf's media rows down just to render this many covers.
const SHELF_PREVIEW_SIZE = 10


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

  const [profile, setProfile] = useState<ProfileView | null>(null)
  const [isSelf, setIsSelf] = useState(true)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [collectionFilter, setCollectionFilter] = useState<number | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  // A small preview of the shelf (server-filtered/sorted, capped at
  // SHELF_PREVIEW_SIZE) — "Open full library" below is where the whole thing
  // lives, so this page never fetches more than it shows.
  const [shown, setShown] = useState<MediaItem[]>([])
  const [shelfLoading, setShelfLoading] = useState(true)
  const [counts, setCounts] = useState<Record<Tab, number>>({ all: 0, wishlist: 0, active: 0, done: 0, dnf: 0 })
  const [typeCounts, setTypeCounts] = useState<Record<MediaType, number>>({ book: 0, movie: 0, series: 0 })
  const [ratedAvg, setRatedAvg] = useState(0)
  // The signed-in viewer's own shelf status per media id shown in the
  // activity feed below (a cheap targeted read — see getStatuses) — only
  // meaningful, and only fetched, when viewing your own profile.
  const [myStatuses, setMyStatuses] = useState<Map<string, ShelfStatus>>(new Map())
  // Bumped to force a refetch of the shelf preview + stats after an import.
  const [refreshTick, setRefreshTick] = useState(0)
  // Activity posts — feed-style cards with comments, replaces the custom reviews section.
  const [posts, setPosts] = useState<Activity[]>([])
  const [postsTotal, setPostsTotal] = useState(0)
  const [postsPage, setPostsPage] = useState(0) // zero-based
  const [postsLoading, setPostsLoading] = useState(false)
  const [postCommentCounts, setPostCommentCounts] = useState<Record<string, number>>({})
  const postsRef = useRef<HTMLElement>(null)
  const { collections } = useCollections()
  // Another user's collections (view/filter only, public — same visibility as
  // their shelf). Empty when viewing your own profile (collections comes from
  // the context above instead) or when their shelf is private.
  const [otherCollections, setOtherCollections] = useState<Collection[]>([])
  const shownCollections = isSelf ? collections : otherCollections
  // Challenges this profile's owner has joined, each with their own progress —
  // shown below the library regardless of who's viewing.
  const [challenges, setChallenges] = useState<Challenge[]>([])
  // On your own profile, the current year's reading challenge even if you
  // haven't set a goal yet — so its shield (a "join" prompt) still shows.
  const [readingChallenge, setReadingChallenge] = useState<Challenge | null>(null)


  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setPostsPage(0)
    // A collection filter is a specific collection's numeric id — meaningless
    // (and silently wrong, not just stale) once we're looking at a different
    // user's collections, so it must not carry over across a profile switch.
    setCollectionFilter(null)

    const mine = !routeId || routeId === authUser?.username || routeId === authUser?.uuid

    async function load() {
      if (mine) {
        setIsSelf(true)
        setProfile({
          id: authUser?.id ?? 0,
          name: authUser?.name || authUser?.username || currentUser.name,
          handle: authUser?.username ?? currentUser.handle,
          avatar: authUser?.avatar_url || '',
          role: authUser?.role,
        })
        setOtherCollections([])
        // Import friends from nons (best-effort — silently ignored if unreachable).
        try {
          const res = await nonsFetch('/api/friendships/friends?limit=100')
          if (!cancelled && res.ok) {
            const data = await res.json()
            const fs: Friend[] = (data.friendships ?? [])
              .filter((f: { uuid?: string }) => f.uuid)
              .map((f: { uuid: string; username: string; name: string; avatar_url?: string; avatarUrl?: string }) => ({
                uuid: f.uuid,
                username: f.username,
                name: f.name || f.username,
                avatarUrl: f.avatar_url || f.avatarUrl,
              }))
            setFriends(fs)
          }
        } catch { /* nons unreachable */ }
      } else {
        const p = await fetchPublicProfile(routeId!)
        if (cancelled) return
        if (!p) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setIsSelf(false)
        let userRole: string | undefined
        try {
          const res = await authedFetch(`/api/users/${p.id}`)
          if (res.ok) {
            const data = await res.json()
            userRole = data.role
          }
        } catch { /* library server unreachable — no badge */ }
        setProfile({ id: p.id, name: p.name, handle: p.username, avatar: p.avatarUrl || '', role: userRole })
        const theirCollections = await collectionService.getUserCollections(p.id)
        if (cancelled) return
        setOtherCollections(theirCollections)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [routeId, authUser, authLoading])

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    challengeService.listUserChallenges(profile.id).then((cs) => { if (!cancelled) setChallenges(cs) })
    return () => { cancelled = true }
  }, [profile])

  // Own profile: pull the current year's reading challenge (viewer-aware) even
  // when unjoined, so its shield appears as a "join" prompt. Other profiles use
  // only the owner's joined list, so an unset goal simply doesn't show.
  useEffect(() => {
    if (!isSelf) { setReadingChallenge(null); return }
    let cancelled = false
    challengeService.listChallenges().then((all) => {
      if (cancelled) return
      setReadingChallenge(all.find((c) => isYearlyReadingGoal(c, new Date().getFullYear())) ?? null)
    })
    return () => { cancelled = true }
  }, [isSelf, profile])

  // The shelf preview row — server-filtered/sorted/capped, so switching tabs
  // or a collection chip re-fetches just SHELF_PREVIEW_SIZE items instead of
  // ever holding the whole shelf client-side.
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    // Wrapped in an IIFE, not called directly: react-hooks/set-state-in-effect
    // flags a setState-triggering call made straight from the effect body.
    ;(async () => {
      setShelfLoading(true)
      const res = await libraryService.searchLibrary(
        {
          status: tab === 'all' ? undefined : tab,
          collectionId: collectionFilter ?? undefined,
          sort: 'added',
          dir: 'desc',
          page: 0,
          perPage: SHELF_PREVIEW_SIZE,
        },
        isSelf ? undefined : profile.id,
      )
      if (cancelled) return
      setShown(res.items)
      setShelfLoading(false)
    })()
    return () => { cancelled = true }
  }, [profile, isSelf, tab, collectionFilter, refreshTick])

  // Header stats — status/type tallies and the average rating, each a cheap
  // count-only (or SQL-aggregated) request instead of derived from a full
  // shelf fetch. Independent of tab/collectionFilter (these always reflect
  // the whole shelf, not the current filter).
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    const userId = isSelf ? undefined : profile.id
    Promise.all([
      libraryService.countLibrary({}, userId),
      libraryService.countLibrary({ status: 'wishlist' }, userId),
      libraryService.countLibrary({ status: 'active' }, userId),
      libraryService.countLibrary({ status: 'done' }, userId),
      libraryService.countLibrary({ status: 'dnf' }, userId),
      libraryService.countLibrary({ type: 'book' }, userId),
      libraryService.countLibrary({ type: 'movie' }, userId),
      libraryService.countLibrary({ type: 'series' }, userId),
      libraryService.getRatingAverage(userId),
    ]).then(([all, wishlist, active, done, dnf, book, movie, series, avg]) => {
      if (cancelled) return
      setCounts({ all, wishlist, active, done, dnf })
      setTypeCounts({ book, movie, series })
      setRatedAvg(avg.count > 0 ? avg.average / 2 : 0)
    })
    return () => { cancelled = true }
  }, [profile, isSelf, refreshTick])

  const POSTS_PER_PAGE = 10
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    setPostsLoading(true)
    const userInfo: Activity['user'] = {
      name: profile.name,
      handle: profile.handle,
      color: colorFor(profile.handle),
      avatarUrl: profile.avatar || undefined,
      role: profile.role,
    }
    getUserActivity(profile.id, userInfo, postsPage, POSTS_PER_PAGE)
      .then((res) => {
        if (cancelled) return
        setPosts(res.items)
        setPostsTotal(res.total)
        getCommentCounts(res.items.map((a) => a.postId))
          .then((counts) => { if (!cancelled) setPostCommentCounts(counts) })
          .catch(() => {})
      })
      .finally(() => { if (!cancelled) setPostsLoading(false) })
    return () => { cancelled = true }
  }, [profile, postsPage])

  const postsPageCount = Math.ceil(postsTotal / POSTS_PER_PAGE)

  // The viewer's own shelf status for each media id in the current activity
  // page — a cheap targeted read (see getStatuses), not a full shelf fetch,
  // and only needed at all when the viewer is looking at their own profile
  // (it drives the feed's "You" quick-action row).
  useEffect(() => {
    let cancelled = false
    // Wrapped in an IIFE, not called directly: react-hooks/set-state-in-effect
    // flags a setState-triggering call made straight from the effect body.
    ;(async () => {
      if (!isSelf || posts.length === 0) {
        if (!cancelled) setMyStatuses(new Map())
        return
      }
      const ids = Array.from(new Set(posts.map((p) => String(p.mediaId))))
      const m = await libraryService.getStatuses(ids)
      if (!cancelled) setMyStatuses(m)
    })()
    return () => { cancelled = true }
  }, [isSelf, posts])

  if (loading) {
    return (
      <Layout>
        <ProfileSkeleton />
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
            <img src={profile.avatar} alt={profile.name} className="h-20 w-20 flex-shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex-shrink-0 overflow-hidden rounded-full" style={{ width: 80, height: 80 }}>
              <BoringAvatar size={80} name={`user-${profile.id}`} />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight text-[var(--text)]">{profile.name}</h1>
              {isLibrarian(profile.role) && <LibrarianBadge />}
            </div>
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

        {/* Stats — type composition + avg rating; tab bar below carries status counts */}
        <div className="mt-5 flex flex-wrap items-stretch gap-x-6 gap-y-3 border-t border-[var(--border-subtle)] pt-4 sm:gap-x-8">
          {(['book', 'movie', 'series'] as const)
            .filter((tp) => typeCounts[tp] > 0)
            .map((tp, i) => {
              const meta = TYPE_META[tp]
              const Icon = meta.icon
              return (
                <div key={tp} className={`flex flex-col ${i > 0 ? 'border-l border-[var(--border-subtle)] pl-6 sm:pl-8' : ''}`}>
                  <span className="flex items-center gap-1.5 text-xl font-bold leading-none text-[var(--text)]">
                    <Icon className="h-[17px] w-[17px]" style={{ color: meta.color }} />
                    {typeCounts[tp]}
                  </span>
                  <span className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{t(meta.labelKey)}</span>
                </div>
              )
            })}
          {ratedAvg > 0 && (
            <div className={`flex flex-col ${(['book', 'movie', 'series'] as const).some((tp) => typeCounts[tp] > 0) ? 'border-l border-[var(--border-subtle)] pl-6 sm:pl-8' : ''}`}>
              <span className="flex items-center gap-1.5 text-xl font-bold leading-none text-[var(--text)]">
                <IoStar className="h-[17px] w-[17px] text-nonsprimaryfocus" />
                {ratedAvg.toFixed(1)}
              </span>
              <span className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{t('statAvg')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Friends — own profile only, separate card */}
      {isSelf && (
        <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <IoPeopleOutline className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-sm font-semibold text-[var(--text)]">
              {t('friends') || 'Friends'}
            </span>
            {friends.length > 0 && (
              <span className="text-xs text-[var(--text-muted)]">{friends.length}</span>
            )}
            <div className="group relative ml-auto">
              <IoInformationCircleOutline className="h-4 w-4 cursor-help text-[var(--text-muted)]" />
              <div className="pointer-events-none absolute right-0 top-6 z-50 w-64 rounded-xl border border-[var(--border)] bg-[var(--container)] p-3 text-xs leading-relaxed text-[var(--text-muted)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                Friends are imported from nons. Add them there to see their reading progress here.
              </div>
            </div>
          </div>
          {friends.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              {t('noFriendsYet') || 'No friends yet — add them on nons to see their progress.'}
            </p>
          ) : (
            <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1">
              {friends.map((f) => (
                <Link
                  key={f.uuid}
                  to={`/u/${f.username}`}
                  className="group/friend flex flex-shrink-0 flex-col items-center gap-1.5"
                  title={f.name}
                >
                  <span className="overflow-hidden rounded-full ring-2 ring-transparent transition-colors group-hover/friend:ring-nonsprimary" style={{ width: 40, height: 40 }}>
                    {f.avatarUrl
                      ? <img src={f.avatarUrl} alt={f.name} className="h-full w-full object-cover" />
                      : <BoringAvatar size={40} name={f.username} />
                    }
                  </span>
                  <span className="max-w-[52px] truncate text-[10px] text-[var(--text-muted)] group-hover/friend:text-[var(--text)]">
                    {f.name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Collection chips — own (editable elsewhere) or another user's (view/filter only) */}
      {shownCollections.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-3 flex items-center gap-1.5 overflow-x-auto px-4">
          {shownCollections.map((col) => {
            const active = collectionFilter === col.id
            return (
              <button
                key={col.id}
                onClick={() => setCollectionFilter(active ? null : col.id)}
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
        </div>
      )}

      {/* Shelf — a single horizontal row so reviews stay reachable below it.
          A capped preview (SHELF_PREVIEW_SIZE), server-filtered by tab/
          collection — "Open full library" below is where the rest lives. */}
      <div className="mt-5">
        {!shelfLoading && shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--text-muted)]">{t('noResults')}</p>
        ) : (
          <div className={`no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1 transition-opacity ${shelfLoading ? 'opacity-60' : ''}`}>
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
          to={`/u/${encodeURIComponent(profile.handle)}/library`}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:border-nonsprimary hover:text-nonsprimary"
        >
          <IoLibraryOutline className="h-4 w-4" />
          {t('openFullLibrary')}
        </Link>
      </div>

      {/* Challenges — a shield per challenge (title + "n/target" progress),
          solid-outlined once completed, dashed while in progress. Official
          challenges (the reading challenge) get a purple gradient and lead the
          row; community ones follow in silver. */}
      {(() => {
        const year = new Date().getFullYear()
        // The reading challenge: for your own profile use the viewer-aware copy
        // (shows even when unjoined, as a "join" shield); for others, only their
        // joined copy. Community challenges are the rest of the joined list.
        const reading = isSelf ? readingChallenge : (challenges.find((c) => isYearlyReadingGoal(c, year)) ?? null)
        const rest = challenges.filter((c) => !isYearlyReadingGoal(c, year))
        const list = [...(reading ? [reading] : []), ...rest]
        // Official first (purple), then community (silver).
        const ordered = [...list.filter((c) => c.official), ...list.filter((c) => !c.official)]
        if (ordered.length === 0) return null
        return (
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <IoTrophyOutline className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="text-sm font-semibold text-[var(--text)]">{t('challenges')}</span>
            </div>
            <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
              {ordered.map((c) => (
                <ChallengeShield key={c.id} challenge={c} t={t} />
              ))}
            </div>
          </div>
        )
      })()}

      {/* Ratings & reviews — feed-style ActivityCards with comment threads */}
      <section ref={postsRef} className="mt-8 scroll-mt-4">
        <h2 className="mb-2 text-base font-semibold text-[var(--text)]">
          {t('ratingsReviewsTitle')}
          {postsTotal > 0 && <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">{postsTotal}</span>}
        </h2>
        {postsTotal === 0 ? (
          !postsLoading && (
            <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-sm text-[var(--text-muted)]">
              {t('noRatingsReviews')}
            </p>
          )
        ) : (
          <div className={`flex flex-col gap-4 transition-opacity ${postsLoading ? 'opacity-60' : ''}`}>
            {posts.map((a) => (
              <ActivityCard
                key={a.id}
                a={a}
                commentCount={postCommentCounts[String(a.postId)] ?? 0}
                myItem={myStatusItem(a, myStatuses)}
                onDeleted={(postId) => {
                  setPosts((prev) => prev.filter((x) => x.postId !== postId))
                  setPostsTotal((n) => Math.max(0, n - 1))
                }}
                onCountChange={(postId, n) => setPostCommentCounts((m) => ({ ...m, [String(postId)]: n }))}
              />
            ))}
            <Pagination
              currentPage={postsPage + 1}
              totalPages={postsPageCount}
              onPageChange={(p) => {
                postsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                setPostsPage(p - 1)
              }}
              t={t}
            />
          </div>
        )}
      </section>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenImport={() => setImportOpen(true)} />
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onImported={() => setRefreshTick((n) => n + 1)} />
    </Layout>
  )
}

// A minimal MediaItem stub carrying just the viewer's own shelf status for an
// activity's media — built from the activity's own snapshot fields (already
// on hand) plus a targeted status lookup (see getStatuses), instead of a
// looking up a full item out of the whole shelf. undefined when the viewer
// hasn't shelved this media at all.
function myStatusItem(a: Activity, myStatuses: Map<string, ShelfStatus>): MediaItem | undefined {
  const status = myStatuses.get(String(a.mediaId))
  if (!status) return undefined
  return {
    id: String(a.mediaId),
    uuid: a.mediaUuid,
    type: a.mediaType,
    title: a.mediaTitle,
    author: a.mediaAuthor ?? '',
    coverUrl: a.coverUrl,
    year: a.mediaYear,
    status,
  }
}

// Shield gradients carry the challenge kind at a glance: a rich purple for
// official challenges (the reading challenge), a brushed-silver/graphite for
// community-authored ones. Both keep white shield text readable. Plain hex via
// inline style rather than Tailwind palette classes, which run too bright here.
const OFFICIAL_GRADIENT = 'linear-gradient(135deg, #7c4dff, #2b1a66)'
const COMMUNITY_GRADIENT = 'linear-gradient(135deg, #9aa0ad, #3a3d44)'

// One challenge, as a shield: a gradient badge (purple for official, silver for
// community) with the title and "progress/target" inside. Solid border once the
// target's been hit, dashed while still in progress. A goal challenge with no
// number set yet (your own unjoined reading challenge) shows a "set goal"
// prompt instead of progress, so the shield doubles as a join affordance.
function ChallengeShield({ challenge, t }: { challenge: Challenge; t: Translate }) {
  const target = challenge.target ?? 0
  const progress = challenge.progress ?? 0
  const completed = (challenge.completed_at ?? 0) > 0
  const gradient = challenge.official ? OFFICIAL_GRADIENT : COMMUNITY_GRADIENT
  const title = challengeTitle(t, challenge)
  const goalPending = isGoalChallenge(challenge) && target === 0

  return (
    <Link
      to={`/challenge/${challenge.uuid}`}
      title={title}
      className="group flex w-24 flex-shrink-0 flex-col items-center"
    >
      <div
        style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 68%, 50% 100%, 0% 68%)', background: gradient }}
        className={`flex h-28 w-24 flex-col items-center justify-center gap-1 p-3 text-center transition-transform group-hover:-translate-y-0.5 ${
          completed ? 'border-2 border-white/80' : 'border-2 border-dashed border-white/45'
        }`}
      >
        {challenge.official && <IoRibbonOutline className="h-3.5 w-3.5 text-white/90" />}
        <span className="line-clamp-3 text-[11px] font-bold leading-tight text-white drop-shadow-sm">
          {title}
        </span>
        {target > 0 ? (
          <span className="text-[10px] font-semibold text-white/85">{progress}/{target}</span>
        ) : goalPending ? (
          <span className="text-[10px] font-semibold text-white/85">{t('setGoal')}</span>
        ) : null}
      </div>
    </Link>
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
