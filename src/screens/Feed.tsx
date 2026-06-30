import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from '@/lib/router'
import Layout from '../components/layout/Layout'
import ActivityCard from '../components/ActivityCard'
import ProgressModal from '../components/ProgressModal'
import FinishModal from '../components/FinishModal'
import { libraryService } from '../services/libraryService'
import { activityService } from '../services/activityService'
import type { Activity, ActivityPage } from '../services/activityService'
import Pagination from '../components/Pagination'
import { getCommentCounts } from '../services/commentService'
import { catalogService } from '../services/catalogService'
import type { CatalogItem } from '../services/catalogService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { STATUS_COLOR } from '../lib/shelf'
import type { ShelfStatus } from '../types'
import { mediaPath } from '../lib/paths'
import { IoSearch, IoStar, IoPeopleOutline, IoChevronBack, IoChevronForward } from 'react-icons/io5'
import ShelfLogo from '../components/ShelfLogo'
import ShelfStatusBar from '../components/ShelfStatusBar'
import TypeBadge from '../components/TypeBadge'
import { ActivityCardSkeleton } from '../components/Skeletons'
import InfinityLoader from '../components/InfinityLoader'

// Friends-activity is paginated server-side; this many cards per page.
const ACTIVITY_PER_PAGE = 10

export default function FeedPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const focusPostId = searchParams.get('post') ? Number(searchParams.get('post')) : null
  const [items, setItems] = useState<MediaItem[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [activityTotal, setActivityTotal] = useState(0)
  const [activityPage, setActivityPage] = useState(0) // zero-based
  const [activityLoading, setActivityLoading] = useState(false)
  const [finishItem, setFinishItem] = useState<MediaItem | null>(null)
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

  // Initial load (and manual refresh, e.g. after finishing a book): library
  // items + the first activity page. Returning to page 0 surfaces the new event.
  const load = useCallback(() => {
    if (!me) return
    setLoading(true)
    setActivityPage(0)
    Promise.all([libraryService.getItems(), activityService.getFriendsActivity(me, 0, ACTIVITY_PER_PAGE)]).then(([lib, act]) => {
      setItems(lib)
      applyActivity(act)
      setLoading(false)
    })
  }, [me, applyActivity])

  useEffect(() => {
    load()
  }, [load])

  // When arriving via a ?post= deep-link, scroll to and highlight that card.
  useEffect(() => {
    if (!focusPostId || loading) return
    const t = setTimeout(() => focusCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
    return () => clearTimeout(t)
  }, [focusPostId, loading])

  // Jump to the top of the feed, then load the chosen activity page.
  const goToActivityPage = (page: number) => {
    if (!me) return
    activityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActivityPage(page)
    setActivityLoading(true)
    activityService
      .getFriendsActivity(me, page, ACTIVITY_PER_PAGE)
      .then(applyActivity)
      .finally(() => setActivityLoading(false))
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
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">{t('home')}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t('feedSubtitle')}</p>
      </div>

      {/* Currently watching / reading */}
      {!loading && inProgress.length > 0 && (
        <InProgressSection
          items={inProgress}
          onFinish={openFinish}
          onEditProgress={openProgress}
          onStatusChanged={(id, status) =>
            setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)))
          }
          t={t}
        />
      )}

      {/* Friends activity */}
      <section ref={activityRef} className="scroll-mt-4">
        <h2 className="mb-2 text-base font-semibold text-[var(--text)]">{t('friendsActivity')}</h2>
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
          </div>
        ) : (
          <div className={`animate-fade-up flex flex-col gap-4 transition-opacity ${activityLoading ? 'opacity-60' : ''}`}>
            {activity.map((a) => {
              const isFocused = focusPostId != null && a.postId === focusPostId
              return (
                <div
                  key={a.id}
                  ref={isFocused ? focusCardRef : undefined}
                  className={isFocused ? 'ring-2 ring-nonsprimary/60 rounded-2xl' : undefined}
                >
                  <ActivityCard
                    a={a}
                    commentCount={commentCounts[String(a.postId)] ?? 0}
                    myItem={myByMedia.get(a.mediaId)}
                    openComments={isFocused}
                    onShelfChange={applyShelfChange}
                    onDeleted={(postId) => {
                      setActivity((prev) => prev.filter((x) => x.postId !== postId))
                      setActivityTotal((n) => Math.max(0, n - 1))
                    }}
                    onCountChange={(postId, n) => setCommentCounts((m) => ({ ...m, [String(postId)]: n }))}
                  />
                </div>
              )
            })}
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


function InProgressSection({
  items,
  onFinish,
  onEditProgress,
  onStatusChanged,
  t,
}: {
  items: MediaItem[]
  onFinish: (it: MediaItem) => void
  onEditProgress: (it: MediaItem) => void
  onStatusChanged: (id: string, status: ShelfStatus) => void
  t: (key: string) => string
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const updateArrows = () => {
    const el = rowRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    updateArrows()
    const el = rowRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows, { passive: true })
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      ro.disconnect()
    }
  }, [items])

  const scroll = (dir: 'left' | 'right') => {
    rowRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' })
  }

  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id))

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text)]">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR.active }} />
          {t('shelfActive')}
        </h2>
        <p className="hidden text-sm text-[var(--text-muted)] sm:block">{t('continueHint')}</p>
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--container)] text-[var(--text)] shadow-lg hover:bg-[var(--surface-hover)]"
          >
            <IoChevronBack className="h-4 w-4" />
          </button>
        )}

        {canScrollRight && (
          <>
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-[var(--bg)] to-transparent" />
            <button
              onClick={() => scroll('right')}
              className="absolute -right-3 top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--container)] text-[var(--text)] shadow-lg hover:bg-[var(--surface-hover)]"
            >
              <IoChevronForward className="h-4 w-4" />
            </button>
          </>
        )}

        <div ref={rowRef} className="no-scrollbar flex items-start gap-3 overflow-x-auto pb-1">
          {items.map((it) => (
            <InProgressCard
              key={it.id}
              item={it}
              expanded={expandedId === it.id}
              onFinish={() => onFinish(it)}
              onEditProgress={() => onEditProgress(it)}
              onStatusChanged={onStatusChanged}
              t={t}
            />
          ))}
        </div>
      </div>
    </section>
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
  expanded: boolean
  onFinish: () => void
  onEditProgress: () => void
  onStatusChanged: (id: string, status: ShelfStatus) => void
  t: (key: string) => string
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
    <div className="w-72 flex-shrink-0">
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--container)]">
        <Link to={mediaPath(item)} className="flex items-center gap-3 p-3">
          <div className="relative aspect-[2/3] w-14 flex-shrink-0">
            {item.coverUrl ? (
              <img src={item.coverUrl} alt={item.title} loading="lazy" className="h-full w-full rounded-md object-cover" />
            ) : (
              <div className="h-full w-full rounded-md bg-[var(--container-2)]" />
            )}
            <TypeBadge type={item.type} position="top-1 right-1" size="h-6 w-6" iconSize="h-3 w-3" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</h3>
            <p className="truncate text-xs text-[var(--text-muted)]">{item.author}</p>
            {item.type === 'book' && latestPage > 0 && (
              <div className="mt-1.5">
                <p className="mb-1 text-[11px] text-[var(--text-muted)]">
                  {totalPages > 0 ? `Page ${latestPage} / ${totalPages}` : `Page ${latestPage}`}
                  {pct > 0 && <span className="ml-1 font-semibold text-nonsprimary">{pct}%</span>}
                </p>
                {pct > 0 && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--container-2)]">
                    <div className="h-full rounded-full bg-nonsprimary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            )}
            {item.type === 'series' && episodeStats && episodeStats.watched > 0 && (
              <div className="mt-1.5">
                <p className="mb-1 text-[11px] text-[var(--text-muted)]">
                  {episodeStats.total > 0 ? `Ep ${episodeStats.watched} / ${episodeStats.total}` : `${episodeStats.watched} ep`}
                  {pct > 0 && <span className="ml-1 font-semibold text-nonsprimary">{pct}%</span>}
                </p>
                {pct > 0 && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--container-2)]">
                    <div className="h-full rounded-full bg-nonsprimary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            )}
            {typeof item.rating === 'number' && item.rating > 0 && (
              <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--text)]">
                <IoStar className="h-3 w-3 text-nonsprimary" />
                {(item.rating / 2).toFixed(1)}
              </span>
            )}
          </div>
        </Link>

        <div className="mx-3 h-px bg-[var(--border-subtle)]" />

        <div className="p-1.5">
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
