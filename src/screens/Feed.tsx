import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@/lib/router'
import Layout from '../components/layout/Layout'
import Hint from '../components/Hint'
import ActivityCard from '../components/ActivityCard'
import ProgressModal from '../components/ProgressModal'
import FinishModal from '../components/FinishModal'
import { libraryService } from '../services/libraryService'
import { activityService } from '../services/activityService'
import type { Activity } from '../services/activityService'
import { getCommentCounts } from '../services/commentService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { usePreferences } from '../contexts/PreferencesContext'
import { useAuth } from '../contexts/AuthContext'
import { statusLabel, STATUS_COLOR } from '../lib/shelf'
import type { ShelfStatus } from '../types'
import { mediaPath } from '../lib/paths'
import { IoStar, IoEyeOffOutline, IoPeopleOutline, IoChevronBack, IoChevronForward } from 'react-icons/io5'
import ShelfStatusBar from '../components/ShelfStatusBar'
import TypeBadge from '../components/TypeBadge'
import { ActivityCardSkeleton } from '../components/Skeletons'

export default function FeedPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const { showInProgress, setShowInProgress } = usePreferences()
  const [items, setItems] = useState<MediaItem[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [finishItem, setFinishItem] = useState<MediaItem | null>(null)

  const load = useCallback(() => {
    if (!user) return
    const me = { id: user.id, name: user.name || user.username, handle: user.username, uuid: user.uuid }
    Promise.all([libraryService.getItems(), activityService.getFriendsActivity(me)]).then(([lib, act]) => {
      setItems(lib)
      setActivity(act)
      setLoading(false)
      // One batched call for all cards' comment counts (keyed by post id).
      getCommentCounts(act.map((a) => a.postId))
        .then(setCommentCounts)
        .catch(() => {})
    })
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const [progressItem, setProgressItem] = useState<MediaItem | null>(null)
  const openFinish = (it: MediaItem) => setFinishItem(it)
  const openProgress = (it: MediaItem) => setProgressItem(it)

  const inProgress = useMemo(() => items.filter((it) => it.status === 'active'), [items])

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">{t('home')}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t('feedSubtitle')}</p>
      </div>

      {/* Currently watching / reading */}
      {!loading && inProgress.length > 0 && showInProgress && (
        <InProgressSection
          items={inProgress}
          onHide={() => setShowInProgress(false)}
          onFinish={openFinish}
          onEditProgress={openProgress}
          onStatusChanged={(id, status) =>
            setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)))
          }
          t={t}
        />
      )}

      {!loading && inProgress.length > 0 && !showInProgress && (
        <Hint icon={IoEyeOffOutline} className="mb-10">
          {t('inProgressHiddenHint')}
        </Hint>
      )}

      {/* Friends activity */}
      <section>
        <h2 className="mb-2 text-base font-semibold text-[var(--text)]">{t('friendsActivity')}</h2>
        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ActivityCardSkeleton key={i} />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface)]">
              <IoPeopleOutline className="h-7 w-7 text-[var(--text-muted)]" />
            </div>
            <p className="max-w-sm px-6 text-sm leading-6 text-[var(--text-muted)]">{t('inviteFriends')}</p>
          </div>
        ) : (
          <div className="animate-fade-up flex flex-col gap-4">
            {activity.map((a) => (
              <ActivityCard
                key={a.id}
                a={a}
                commentCount={commentCounts[String(a.postId)] ?? 0}
                onDeleted={(postId) => setActivity((prev) => prev.filter((x) => x.postId !== postId))}
                onCountChange={(postId, n) => setCommentCounts((m) => ({ ...m, [String(postId)]: n }))}
              />
            ))}
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
  onHide,
  onFinish,
  onEditProgress,
  onStatusChanged,
  t,
}: {
  items: MediaItem[]
  onHide: () => void
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
        <button
          onClick={onHide}
          title={t('hide')}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        >
          <IoEyeOffOutline className="h-4 w-4" />
          {t('hide')}
        </button>
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
