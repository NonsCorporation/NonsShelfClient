'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from '@/lib/router'
import Layout from '../components/layout/Layout'
import ActivityCard from '@/components/feed/ActivityCard'
import ChallengeActivityCard from '@/components/challenges/ChallengeActivityCard'
import ProgressModal from '@/components/reading/ProgressModal'
import FinishModal from '@/components/reading/FinishModal'
import { libraryService } from '../services/libraryService'
import { activityService } from '../services/activityService'
import { challengeService } from '../services/challengeService'
import { isYearlyReadingGoal, challengeYear } from '../lib/challenge'
import type { Activity, ActivityPage, ActivityType } from '../services/activityService'
import BoringAvatar from '@/components/ui/BoringAvatar'
import Pagination from '@/components/ui/Pagination'
import { getCommentCounts } from '../services/commentService'
import { catalogService } from '../services/catalogService'
import type { CatalogItem } from '../services/catalogService'
import type { MediaItem, Challenge } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { STATUS_COLOR } from '../lib/shelf'
import type { ShelfStatus } from '../types'
import { mediaPath } from '../lib/paths'
import {
  IoSearch, IoPeopleOutline, IoArrowForward, IoLinkOutline,
  IoCheckmark, IoRibbonOutline, IoTimeOutline,
} from 'react-icons/io5'
import ShelfLogo from '@/components/branding/ShelfLogo'
import ShelfStatusBar from '@/components/media/ShelfStatusBar'
import TypeBadge from '@/components/badges/TypeBadge'
import { ActivityCardSkeleton } from '@/components/ui/Skeletons'
import InfinityLoader from '@/components/ui/InfinityLoader'

// Friends-activity is paginated server-side; this many cards per page.
const ACTIVITY_PER_PAGE = 10

// Coarse day buckets for grouping the activity feed. `at` is Unix seconds.
type DayBucket = 'today' | 'week' | 'earlier'
const BUCKET_LABEL: Record<DayBucket, string> = { today: 'groupToday', week: 'groupThisWeek', earlier: 'groupEarlier' }
function dayBucket(at: number): DayBucket {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const ms = at * 1000
  if (ms >= startOfToday) return 'today'
  if (ms >= startOfToday - 6 * 86400000) return 'week'
  return 'earlier'
}

// Lightweight activity filters. Labels reuse existing verb keys (capitalised in CSS).
const ACTIVITY_FILTERS: { key: 'all' | ActivityType; labelKey: string }[] = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'finished', labelKey: 'verbFinished' },
  { key: 'rated', labelKey: 'verbRated' },
  { key: 'reviewed', labelKey: 'verbReviewed' },
]

export default function FeedPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const focusPostId = searchParams.get('post') ? Number(searchParams.get('post')) : null
  // Zero-based, mirrors ?page= (1-based, param omitted on page 1) — same
  // convention as Library.tsx so back/forward and deep-links to a given
  // page work without extra client state.
  const activityPage = Math.max(1, Number(searchParams.get('page') || '1')) - 1
  const [items, setItems] = useState<MediaItem[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [activityTotal, setActivityTotal] = useState(0)
  // Bumped to force a refetch of the current activity page (e.g. after
  // finishing a book) even when activityPage itself hasn't changed.
  const [activityRefreshKey, setActivityRefreshKey] = useState(0)
  const [activityLoading, setActivityLoading] = useState(false)
  const [finishItem, setFinishItem] = useState<MediaItem | null>(null)
  // The viewer's yearly reading challenge, shown as the last card in the
  // in-progress row once they've set a goal for the current year.
  const [readingChallenge, setReadingChallenge] = useState<Challenge | null>(null)
  const activityRef = useRef<HTMLElement>(null)
  const focusCardRef = useRef<HTMLDivElement>(null)

  const me = useMemo(
    () => (user ? { id: user.id, name: user.name || user.username, handle: user.username, uuid: user.uuid, avatar: user.avatar_url, role: user.role } : null),
    [user],
  )

  // Apply a fetched activity page + fetch its cards' comment counts (one batched
  // call, keyed by post id).
  const applyActivity = useCallback((res: ActivityPage) => {
    setActivity(res.items)
    setActivityTotal(res.total)
    getCommentCounts(res.items.map((a) => a.postId))
      .then(setCommentCounts)
      .catch(() => {})
  }, [])

  // Library items — fetched once per sign-in. Doesn't touch the URL, so a
  // deep-link like /feed?page=3 lands on page 3 instead of getting reset.
  useEffect(() => {
    if (!me) return
    setLoading(true)
    libraryService.getItems().then((lib) => {
      setItems(lib)
      setLoading(false)
    })
  }, [me])

  // The current year's reading challenge — kept separate from the library fetch
  // so it can refresh with the feed (finishing a book moves progress). Shown in
  // the in-progress row either as live progress (goal set) or a "join" nudge.
  useEffect(() => {
    if (!me) return
    let cancelled = false
    const year = new Date().getFullYear()
    challengeService.listChallenges().then((all) => {
      if (cancelled) return
      setReadingChallenge(all.find((c) => isYearlyReadingGoal(c, year)) ?? null)
    })
    return () => { cancelled = true }
  }, [me, activityRefreshKey])

  // Manual refresh (e.g. after finishing a book): reload library items and
  // jump back to activity page 1 so the new event is visible. Always bumps
  // activityRefreshKey so the activity effect below refetches even when the
  // URL was already on page 1 (where the page param itself wouldn't change).
  const load = useCallback(() => {
    if (!me) return
    setLoading(true)
    libraryService.getItems().then((lib) => {
      setItems(lib)
      setLoading(false)
    })
    const next = new URLSearchParams(searchParams)
    next.delete('page')
    setSearchParams(next, { replace: true })
    setActivityRefreshKey((k) => k + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me])

  // Friends activity — refetched whenever the URL page param changes (or
  // load() forces a refresh via activityRefreshKey).
  useEffect(() => {
    if (!me) return
    let cancelled = false
    setActivityLoading(true)
    activityService
      .getFriendsActivity(me, activityPage, ACTIVITY_PER_PAGE)
      .then((res) => {
        if (cancelled) return
        applyActivity(res)
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [me, activityPage, activityRefreshKey, applyActivity])

  // When arriving via a ?post= deep-link, scroll to and highlight that card.
  useEffect(() => {
    if (!focusPostId || loading) return
    const t = setTimeout(() => focusCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
    return () => clearTimeout(t)
  }, [focusPostId, loading])

  // Jump to the top of the feed, then push the chosen page into the URL —
  // the activity effect above owns the actual fetch.
  const goToActivityPage = (page: number) => {
    activityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const next = new URLSearchParams(searchParams)
    if (page === 0) next.delete('page')
    else next.set('page', String(page + 1))
    setSearchParams(next, { replace: true })
  }

  const activityPageCount = Math.ceil(activityTotal / ACTIVITY_PER_PAGE)

  // The viewer's own library, keyed by catalog id, so each activity card can
  // show their shelf status/rating for that media and let them shelve it.
  const myByMedia = useMemo(() => {
    const m = new Map<number, MediaItem>()
    for (const it of items) m.set(Number(it.id), it)
    return m
  }, [items])

  // Merge a persisted shelf change back into the library state (insert when the
  // item wasn't on the shelf yet), so the card + in-progress row stay in sync.
  const applyShelfChange = useCallback((updated: MediaItem) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === updated.id)
      if (i === -1) return [...prev, updated]
      const next = [...prev]
      next[i] = updated
      return next
    })
  }, [])

  const [progressItem, setProgressItem] = useState<MediaItem | null>(null)
  const openFinish = (it: MediaItem) => setFinishItem(it)
  const openProgress = (it: MediaItem) => setProgressItem(it)

  const inProgress = useMemo(() => items.filter((it) => it.status === 'active'), [items])
  const [typeFilter, setTypeFilter] = useState<'all' | ActivityType>('all')
  const [invited, setInvited] = useState(false)

  // The newest wishlist item — used to nudge starting something when nothing's active.
  const newestWishlist = useMemo(() => {
    const w = items.filter((it) => it.status === 'wishlist')
    w.sort((a, b) => (b.dateAdded ?? '').localeCompare(a.dateAdded ?? ''))
    return w[0] ?? null
  }, [items])

  // Distinct friends who appear in the current activity page — the "pulse" strip.
  const recentFriends = useMemo(() => {
    const seen = new Map<string, { handle: string; name: string; avatarUrl?: string }>()
    for (const a of activity) {
      if (!seen.has(a.user.handle)) seen.set(a.user.handle, { handle: a.user.handle, name: a.user.name, avatarUrl: a.user.avatarUrl })
    }
    return [...seen.values()].slice(0, 14)
  }, [activity])

  // Time-of-day greeting for the desktop header.
  const greetingKey = (() => {
    const h = new Date().getHours()
    return h < 12 ? 'greetingMorning' : h < 18 ? 'greetingAfternoon' : 'greetingEvening'
  })()

  // Shared counts behind both the header's stat line and the sidebar's stats card.
  const stats = useMemo(() => {
    const now = new Date()
    const finishedThisMonth = items.filter((it) => {
      if (it.status !== 'done' || !it.finishedAt) return false
      const d = new Date(it.finishedAt)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length
    const activeFriends = new Set(activity.map((a) => a.user.handle)).size
    return { inProgress: inProgress.length, finishedThisMonth, activeFriends }
  }, [items, activity, inProgress])

  // A quiet at-a-glance line under the greeting: only the segments that apply.
  const statLine = useMemo(() => {
    const segs = [
      stats.inProgress > 0 && t('statInProgress', { count: stats.inProgress }),
      stats.finishedThisMonth > 0 && t('statFinishedThisMonth', { count: stats.finishedThisMonth }),
      stats.activeFriends > 0 && t('statFriendsActive', { count: stats.activeFriends }),
    ].filter(Boolean) as string[]
    return segs.join(' · ')
  }, [stats, t])

  // Group the (filtered) activity page into day buckets, preserving newest-first order.
  const activityGroups = useMemo(() => {
    const visible = typeFilter === 'all' ? activity : activity.filter((a) => a.type === typeFilter)
    const groups: { key: DayBucket; items: Activity[] }[] = []
    for (const a of visible) {
      const b = dayBucket(a.at)
      const last = groups[groups.length - 1]
      if (last && last.key === b) last.items.push(a)
      else groups.push({ key: b, items: [a] })
    }
    return groups
  }, [activity, typeFilter])

  return (
    <Layout>
      <div className="mb-5 flex items-center gap-3 lg:hidden">
        <div className="flex flex-shrink-0 items-center gap-2">
          <ShelfLogo className="h-6 w-6 text-[var(--text)]" />
          <span className="text-xl font-bold tracking-tight text-[var(--text)]">Nons Shelf</span>
        </div>
        <div className="min-w-0 flex-1">
          <MobileCatalogSearch t={t} />
        </div>
      </div>

      <div className="mb-6 hidden lg:block">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
          {t(greetingKey)}{me?.name ? `, ${me.name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{statLine || t('feedSubtitle')}</p>
      </div>

      {/* Currently watching / reading */}
      {!loading && (inProgress.length > 0 || readingChallenge) && (
        <InProgressSection
          items={inProgress}
          readingChallenge={readingChallenge}
          stats={stats}
          onFinish={openFinish}
          onEditProgress={openProgress}
          onStatusChanged={(id, status) =>
            setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)))
          }
          t={t}
        />
      )}

      {/* Nudge to start something when nothing's in progress but the wishlist isn't empty */}
      {!loading && inProgress.length === 0 && newestWishlist && (
        <Link
          to={mediaPath(newestWishlist)}
          className="group mb-10 flex items-center gap-3 rounded-xl border border-dashed border-[var(--border)] p-3 transition-colors hover:border-nonsprimary"
        >
          <div className="relative aspect-[2/3] w-10 flex-shrink-0">
            {newestWishlist.coverUrl ? (
              <img src={newestWishlist.coverUrl} alt="" loading="lazy" className="h-full w-full rounded-md object-cover" />
            ) : (
              <div className="h-full w-full rounded-md bg-[var(--container-2)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--text)]">{t('startFromWishlist')}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">{newestWishlist.title}</p>
          </div>
          <IoArrowForward className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-nonsprimary" />
        </Link>
      )}

      {/* Friends activity */}
      <section ref={activityRef} className="scroll-mt-4">
        {/* Type filter sits on its own row above the title, so both stay a
            straight, uncrowded line on mobile. */}
        {/* Mobile: filter row above the title (its own line). Desktop (sm+):
            back on the same row as the title, right-aligned. */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h2 className="order-2 flex items-center gap-2 text-base font-semibold text-[var(--text)] sm:order-1">
            <IoPeopleOutline className="h-[18px] w-[18px] text-[var(--text-muted)]" />
            {t('friendsActivity')}
          </h2>
          {!loading && activityTotal > 0 && (
            <div className="no-scrollbar order-1 flex items-center gap-1.5 overflow-x-auto sm:order-2">
              {ACTIVITY_FILTERS.map((f) => {
                const active = typeFilter === f.key
                return (
                  <button
                    key={f.key}
                    onClick={() => setTypeFilter(f.key)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                      active
                        ? 'border-[var(--border)] bg-[var(--container-2)] font-medium text-[var(--text)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {t(f.labelKey)}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Pulse — friends active recently; tap to open their profile. */}
        {!loading && activityTotal > 0 && recentFriends.length > 0 && (
          <div className="no-scrollbar -mx-1 mb-4 flex gap-3 overflow-x-auto px-1 pb-1">
            {recentFriends.map((f) => (
              <Link
                key={f.handle}
                to={`/u/${f.handle}`}
                className="group/friend flex flex-shrink-0 flex-col items-center gap-1"
                title={f.name}
              >
                <span className="overflow-hidden rounded-full ring-2 ring-transparent transition-colors group-hover/friend:ring-nonsprimary" style={{ width: 40, height: 40 }}>
                  {f.avatarUrl
                    ? <img src={f.avatarUrl} alt={f.name} className="h-full w-full object-cover" />
                    : <BoringAvatar size={40} name={f.handle} />}
                </span>
                <span className="max-w-[52px] truncate text-[10px] text-[var(--text-muted)] group-hover/friend:text-[var(--text)]">{f.name}</span>
              </Link>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ActivityCardSkeleton key={i} />
            ))}
          </div>
        ) : activityTotal === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface)]">
              <IoPeopleOutline className="h-7 w-7 text-[var(--text-muted)]" />
            </div>
            <p className="max-w-sm px-6 text-sm leading-6 text-[var(--text-muted)]">{t('inviteFriends')}</p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.origin).then(() => {
                  setInvited(true)
                  setTimeout(() => setInvited(false), 2000)
                }).catch(() => {})
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
            >
              {invited ? <IoCheckmark className="h-4 w-4 text-nonsprimary" /> : <IoLinkOutline className="h-4 w-4" />}
              {t(invited ? 'copied' : 'copyInviteLink')}
            </button>
          </div>
        ) : (
          <div className={`animate-fade-up flex flex-col gap-4 transition-opacity ${activityLoading ? 'opacity-60' : ''}`}>
            {activityGroups.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">{t('noResults')}</p>
            )}
            {activityGroups.map((group) => (
              <div key={group.key} className="flex flex-col gap-4">
                {/* Quiet day divider for scannability. */}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {t(BUCKET_LABEL[group.key])}
                  </span>
                  <span className="h-px flex-1 bg-[var(--border-subtle)]" />
                </div>
                {group.items.map((a) => {
                  const isFocused = focusPostId != null && a.postId === focusPostId
                  const onDeleted = (postId: number) => {
                    setActivity((prev) => prev.filter((x) => x.postId !== postId))
                    setActivityTotal((n) => Math.max(0, n - 1))
                  }
                  const onCountChange = (postId: number, n: number) =>
                    setCommentCounts((m) => ({ ...m, [String(postId)]: n }))
                  return (
                    <div
                      key={a.id}
                      ref={isFocused ? focusCardRef : undefined}
                      className={isFocused ? 'ring-2 ring-nonsprimary/60 rounded-2xl' : undefined}
                    >
                      {a.type === 'challenge_joined' ? (
                        <ChallengeActivityCard
                          a={a}
                          commentCount={commentCounts[String(a.postId)] ?? 0}
                          openComments={isFocused}
                          onDeleted={onDeleted}
                          onCountChange={onCountChange}
                        />
                      ) : (
                        <ActivityCard
                          a={a}
                          commentCount={commentCounts[String(a.postId)] ?? 0}
                          myItem={myByMedia.get(a.mediaId)}
                          openComments={isFocused}
                          onShelfChange={applyShelfChange}
                          onDeleted={onDeleted}
                          onCountChange={onCountChange}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
            <Pagination
              currentPage={activityPage + 1}
              totalPages={activityPageCount}
              onPageChange={(p) => goToActivityPage(p - 1)}
              t={t}
            />
          </div>
        )}
      </section>

      <ProgressModal
        isOpen={!!progressItem}
        item={progressItem}
        onClose={() => setProgressItem(null)}
        onFinish={() => { setFinishItem(progressItem); setProgressItem(null) }}
      />
      <FinishModal
        isOpen={!!finishItem}
        item={finishItem}
        onClose={() => setFinishItem(null)}
        onFinished={() => {
          setFinishItem(null)
          load()
        }}
      />
    </Layout>
  )
}


type Translate = (key: string, vars?: Record<string, string | number>) => string

// The feed's top area, split into three side-by-side containers — mirroring
// the /m/ page's habit of many small bordered blocks rather than one dense
// one: what's in progress, the reading challenge, and a few quick numbers.
function InProgressSection({
  items,
  readingChallenge,
  stats,
  onFinish,
  onEditProgress,
  onStatusChanged,
  t,
}: {
  items: MediaItem[]
  readingChallenge: Challenge | null
  stats: { inProgress: number; finishedThisMonth: number; activeFriends: number }
  onFinish: (it: MediaItem) => void
  onEditProgress: (it: MediaItem) => void
  onStatusChanged: (id: string, status: ShelfStatus) => void
  t: Translate
}) {
  const VISIBLE_COUNT = 3
  const [showAll, setShowAll] = useState(false)
  const visibleItems = showAll ? items : items.slice(0, VISIBLE_COUNT)

  return (
    <section className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 lg:col-span-2">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR.active }} />
          {t('shelfActive')}
        </h2>
        {items.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">{t('continueHint')}</p>
        ) : (
          <>
            <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
              {visibleItems.map((it) => (
                <InProgressCard
                  key={it.id}
                  item={it}
                  onFinish={() => onFinish(it)}
                  onEditProgress={() => onEditProgress(it)}
                  onStatusChanged={onStatusChanged}
                  t={t}
                />
              ))}
            </div>
            {items.length > VISIBLE_COUNT && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-2 text-xs font-medium text-[var(--text-muted)] hover:text-nonsprimary"
              >
                {showAll ? t('showLess') : t('showAll')}
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <ChallengeBlock challenge={readingChallenge} t={t} />
        <div className="hidden lg:block">
          <StatsBlock stats={stats} t={t} />
        </div>
      </div>
    </section>
  )
}

// Reading challenge, as its own fluid-width block (not the fixed-width rail
// card it used to share a row with) — the goal or "join" nudge, plus progress.
function ChallengeBlock({ challenge, t }: { challenge: Challenge | null; t: Translate }) {
  if (!challenge) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <IoRibbonOutline className="h-4 w-4 text-nonsprimary" />
          {t('readingChallenge')}
        </h2>
        <p className="text-xs text-[var(--text-muted)]">{t('noReadingChallenge')}</p>
      </div>
    )
  }

  const target = challenge.target ?? 0
  const progress = challenge.progress ?? 0
  const hasGoal = challenge.joined && target > 0
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0
  const done = (challenge.completed_at ?? 0) > 0
  const title = t('readingGoalTitle', { year: challengeYear(challenge) })

  return (
    <Link
      to={`/challenge/${challenge.uuid}`}
      className={`group flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-nonsprimary ${
        hasGoal ? 'border-[var(--border-subtle)] bg-[var(--surface)]' : 'border-dashed border-[var(--border)]'
      }`}
    >
      <div className="flex aspect-square w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)]">
        <IoRibbonOutline className="h-5 w-5 text-nonsprimary" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-[var(--text)]">{title}</h3>
        {hasGoal ? (
          <>
            <p className="truncate text-xs text-[var(--text-muted)]">
              {t('readingGoalProgress', { progress, target })}
              {pct > 0 && <span className="ml-1 font-semibold text-nonsprimary">{pct}%</span>}
            </p>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--container-2)]">
              <div className="h-full rounded-full bg-nonsprimary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <p className="truncate text-xs text-[var(--text-muted)]">{t('joinReadingChallenge')}</p>
        )}
      </div>
      {hasGoal && done && <IoCheckmark className="h-4 w-4 flex-shrink-0 text-nonsprimary" />}
      {!hasGoal && (
        <IoArrowForward className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-nonsprimary" />
      )}
    </Link>
  )
}

// Quick numbers — reuses the same counts behind the header's stat line, just
// broken out as its own small block instead of buried in muted text.
function StatsBlock({
  stats,
  t,
}: {
  stats: { inProgress: number; finishedThisMonth: number; activeFriends: number }
  t: Translate
}) {
  const rows = [
    { icon: IoTimeOutline, label: t('sidebarInProgress'), value: stats.inProgress },
    { icon: IoCheckmark, label: t('sidebarFinishedMonth'), value: stats.finishedThisMonth },
    { icon: IoPeopleOutline, label: t('sidebarFriendsActive'), value: stats.activeFriends },
  ]
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">{t('sidebarYourStats')}</h2>
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-nonsprimary">
              <r.icon className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1 truncate text-xs text-[var(--text-muted)]">{r.label}</span>
            <span className="text-sm font-semibold text-[var(--text)]">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function InProgressCard({
  item,
  onFinish,
  onEditProgress,
  onStatusChanged,
  t,
}: {
  item: MediaItem
  onFinish: () => void
  onEditProgress: () => void
  onStatusChanged: (id: string, status: ShelfStatus) => void
  t: Translate
}) {
  const [latestPage, setLatestPage] = useState<number>(0)
  const [episodeStats, setEpisodeStats] = useState<{ watched: number; total: number } | null>(null)
  useEffect(() => {
    if (item.type === 'book') {
      libraryService.getProgress(item.id).then((rows) => setLatestPage(rows[0]?.page ?? 0)).catch(() => {})
    } else if (item.type === 'series') {
      libraryService.getEpisodeStats(item.id).then(setEpisodeStats).catch(() => {})
    }
  }, [item.id, item.type])

  const totalPages = item.pages ?? 0
  const pct = item.type === 'book' && totalPages > 0 && latestPage > 0
    ? Math.min(100, Math.round((latestPage / totalPages) * 100))
    : item.type === 'series' && episodeStats && episodeStats.total > 0
      ? Math.min(100, Math.round((episodeStats.watched / episodeStats.total) * 100))
      : 0

  const handleStatusChange = (key: ShelfStatus) => {
    if (key === 'done') { onFinish(); return }
    // Reflect the change immediately (e.g. → "did not finish" drops it out of the
    // in-progress row), then persist.
    onStatusChanged(item.id, key)
    libraryService.updateItem(item.id, { status: key }).catch(() => {})
  }

  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Link to={mediaPath(item)} className="relative aspect-[2/3] w-14 flex-shrink-0">
        {item.coverUrl ? (
          <img src={item.coverUrl} alt={item.title} loading="lazy" className="h-full w-full rounded-md object-cover" />
        ) : (
          <div className="h-full w-full rounded-md bg-[var(--container-2)]" />
        )}
        <TypeBadge type={item.type} position="top-1 right-1" size="h-6 w-6" iconSize="h-3 w-3" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={mediaPath(item)}>
          <h3 className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</h3>
          <p className="truncate text-xs text-[var(--text-muted)]">
            {item.author}
            {pct > 0 && <span className="ml-1 font-semibold text-nonsprimary">{pct}%</span>}
          </p>
        </Link>
        {pct > 0 && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--container-2)]">
            <div className="h-full rounded-full bg-nonsprimary transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}

        <div className="mt-1.5">
          <ShelfStatusBar
            item={item}
            currentStatus="active"
            onStatusChange={handleStatusChange}
            onEditProgress={onEditProgress}
          />
        </div>
      </div>
    </div>
  )
}

function MobileCatalogSearch({ t }: { t: (key: string) => string }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!q.trim()) { setResults([]); setLoading(false); setImporting(false); setOpen(false); return }
    setLoading(true)
    setOpen(true)
    const timer = setTimeout(async () => {
      const data = await catalogService.getCatalog(q).catch(() => [] as CatalogItem[])
      if (data.length > 0) { setResults(data.slice(0, 6)); setLoading(false); return }
      setImporting(true)
      const fill = await catalogService.searchFill(q, { limit: 10, series: true })
      setImporting(false)
      setResults(fill.items.slice(0, 6))
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const submit = () => {
    if (!q.trim()) return
    setOpen(false)
    navigate({ pathname: '/search', search: `?q=${encodeURIComponent(q.trim())}` })
  }

  return (
    <div className="relative">
      <div className="relative">
        <IoSearch className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          onFocus={() => q.trim() && setOpen(true)}
          placeholder={t('globalSearch') || 'Search books, films…'}
          className="h-11 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--input)] pl-11 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
        />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] shadow-2xl">
            {loading && !importing && (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl p-2" style={{ opacity: 1 - i * 0.25 }}>
                    <div className="h-12 w-8 animate-pulse rounded bg-[var(--surface)]" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--surface)]" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-[var(--surface)]" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {importing && (
              <div className="flex justify-center py-4">
                <InfinityLoader size={70} hint={t('searchingExternal')} />
              </div>
            )}
            {!loading && !importing && results.length > 0 && (
              <div className="p-2">
                {results.map((item) => (
                  <Link
                    key={item.id}
                    to={mediaPath(item)}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-[var(--surface)]"
                  >
                    <div className="relative aspect-[2/3] w-8 flex-shrink-0">
                      {item.coverUrl
                        ? <img src={item.coverUrl} alt="" className="h-full w-full rounded object-cover" />
                        : <div className="h-full w-full rounded bg-[var(--surface)]" />}
                      <TypeBadge type={item.type} position="-top-1 -right-1" size="h-5 w-5" iconSize="h-2.5 w-2.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</div>
                      <div className="truncate text-xs text-[var(--text-muted)]">
                        {item.type === 'book' ? item.author : item.director || item.author}
                      </div>
                    </div>
                  </Link>
                ))}
                <button
                  onClick={submit}
                  className="mt-1 w-full rounded-xl bg-[var(--surface)] py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)]"
                >
                  {t('seeAllResults')}
                </button>
              </div>
            )}
            {!loading && !importing && results.length === 0 && (
              <p className="px-4 py-3 text-sm text-[var(--text-muted)]">{t('noResults')}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
