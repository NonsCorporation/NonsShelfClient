import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@/lib/router'
import {
  IoStar, IoAdd, IoCheckmark, IoArrowForward, IoFlameOutline, IoSparklesOutline,
  IoLayersOutline, IoHeartOutline,
} from 'react-icons/io5'
import ListCard from '@/components/discover/ListCard'
import TypeBadge from '@/components/badges/TypeBadge'
import BoringAvatar from '@/components/ui/BoringAvatar'
import type { Activity } from '@/services/activityService'
import type { CatalogItem } from '@/services/catalogService'
import type { Spotlights } from '@/services/discoverService'
import type { CuratedListDiscoverEntry, MediaType } from '@/types'
import { mediaPath } from '@/lib/paths'

type Translate = (key: string, vars?: Record<string, string | number>) => string

// The discovery rails woven between the feed's activity cards, so the page
// isn't one uninterrupted stream of friends' posts. Everything here comes from
// data the feed or Discover already loads — see Feed.tsx for the fetching.

const RAIL_SIZE = 10

function RailPanel({
  icon, title, hint, seeAllTo, t, aside, children,
}: {
  icon: ReactNode
  title: string
  hint?: string
  seeAllTo?: string
  t: Translate
  /** Controls that sit beside the title (e.g. type tabs). */
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
            {icon}
            {title}
          </h2>
          {hint && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p>}
        </div>
        <div className="flex items-center gap-3">
          {aside}
          {seeAllTo && (
            <Link to={seeAllTo} className="group flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-nonsprimary">
              {t('seeAll')}
              <IoArrowForward className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

// Horizontal scroller, bled to the panel edge so posters can run off-screen.
function Rail({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">{children}</div>
}

// A poster tile with an optional rank numeral and a one-tap "want to" button.
// The add button is hidden once the title is on the viewer's shelf (a check
// takes its place), so it can never overwrite a status they've already set.
function PosterTile({
  item, rank, sub, onShelf, onAdd, t,
}: {
  item: CatalogItem
  rank?: number
  sub: ReactNode
  onShelf: boolean
  onAdd: (it: CatalogItem) => Promise<void>
  t: Translate
}) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="w-32 flex-shrink-0 snap-start sm:w-36">
      <div className="group relative aspect-[2/3] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--container-2)] transition-colors hover:border-[var(--border)]">
        <Link to={mediaPath(item)} title={item.title} className="block h-full w-full">
          {item.coverUrl && (
            <img src={item.coverUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
        </Link>
        {rank != null && (
          <span className="pointer-events-none absolute bottom-0.5 left-2 text-5xl font-black leading-none text-white/95 [text-shadow:0_2px_8px_rgba(0,0,0,0.6)]">
            {rank}
          </span>
        )}
        <TypeBadge type={item.type} position="top-2 right-2" size="h-6 w-6" iconSize="h-3 w-3" className="pointer-events-none" />
        <button
          type="button"
          disabled={onShelf || busy}
          aria-label={onShelf ? t('inLibrary') : t('addToShelf')}
          title={onShelf ? t('inLibrary') : t('addToShelf')}
          onClick={async () => {
            setBusy(true)
            try { await onAdd(item) } finally { setBusy(false) }
          }}
          className={`absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-white backdrop-blur-sm transition-colors ${
            onShelf ? 'bg-nonsprimary' : 'bg-black/55 hover:bg-nonsprimary disabled:opacity-60'
          }`}
        >
          {onShelf ? <IoCheckmark className="h-4 w-4" /> : <IoAdd className="h-4 w-4" />}
        </button>
      </div>
      <Link to={mediaPath(item)} className="mt-2 block">
        <p className="truncate text-xs font-semibold text-[var(--text)] hover:text-nonsprimary">{item.title}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-[var(--text-muted)]">{sub}</p>
      </Link>
    </div>
  )
}

const creditOf = (it: CatalogItem) => (it.type === 'book' ? it.author : it.director || it.author)

type TileProps = {
  onShelf: (it: CatalogItem) => boolean
  onAdd: (it: CatalogItem) => Promise<void>
  t: Translate
}

// ── Popular now ────────────────────────────────────────────────────────────

type PopularTab = 'all' | MediaType

export function PopularNowRail({ spotlights, onShelf, onAdd, t }: TileProps & { spotlights: Spotlights }) {
  const [tab, setTab] = useState<PopularTab>('all')

  const items = useMemo(() => {
    if (tab !== 'all') return spotlights[tab].slice(0, RAIL_SIZE)
    // Most-shelved across every type — popularity is the same member-count signal for all three.
    return [...spotlights.book, ...spotlights.movie, ...spotlights.series]
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, RAIL_SIZE)
  }, [spotlights, tab])

  const tabs: { key: PopularTab; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'book', label: t('books') },
    { key: 'movie', label: t('movies') },
    { key: 'series', label: t('seriesPlural') },
  ]

  return (
    <RailPanel
      icon={<IoFlameOutline className="h-4 w-4 text-nonsprimaryfocus" />}
      title={t('popularNow')}
      hint={t('popularNowHint')}
      seeAllTo="/discover"
      t={t}
      aside={
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                tab === tb.key
                  ? 'border-[var(--border)] bg-[var(--container-2)] font-medium text-[var(--text)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
      }
    >
      <Rail>
        {items.map((it, i) => (
          <PosterTile
            key={it.id}
            item={it}
            rank={i + 1}
            onShelf={onShelf(it)}
            onAdd={onAdd}
            t={t}
            sub={
              <>
                {it.communityRating > 0 && (
                  <span className="flex flex-shrink-0 items-center gap-0.5 font-medium">
                    <IoStar className="h-3 w-3 text-nonsprimaryfocus" />
                    {it.communityRating.toFixed(1)}
                  </span>
                )}
                {it.activeNow > 0 ? (
                  <span className="truncate">
                    {it.communityRating > 0 && '· '}
                    {t(it.type === 'book' ? 'membersReading' : 'membersWatching', { n: it.activeNow })}
                  </span>
                ) : (
                  <span className="truncate">{it.communityRating > 0 && creditOf(it) ? '· ' : ''}{creditOf(it)}</span>
                )}
              </>
            }
          />
        ))}
      </Rail>
    </RailPanel>
  )
}

// ── New releases ───────────────────────────────────────────────────────────

export function NewReleasesRail({ items, onShelf, onAdd, t }: TileProps & { items: CatalogItem[] }) {
  return (
    <RailPanel
      icon={<IoSparklesOutline className="h-4 w-4 text-nonsprimaryfocus" />}
      title={t('newReleases')}
      seeAllTo="/discover"
      t={t}
    >
      <Rail>
        {items.map((it) => (
          <PosterTile
            key={it.id}
            item={it}
            onShelf={onShelf(it)}
            onAdd={onAdd}
            t={t}
            sub={<span className="truncate">{[it.year, creditOf(it)].filter(Boolean).join(' · ')}</span>}
          />
        ))}
      </Rail>
    </RailPanel>
  )
}

// ── Curated lists ──────────────────────────────────────────────────────────

export function ListsRail({ lists, t }: { lists: CuratedListDiscoverEntry[]; t: Translate }) {
  return (
    <RailPanel
      icon={<IoLayersOutline className="h-4 w-4 text-nonsprimaryfocus" />}
      title={t('curatedLists')}
      seeAllTo="/discover"
      t={t}
    >
      <Rail>
        {lists.map((l) => (
          <div key={l.id} className="w-40 flex-shrink-0 snap-start sm:w-44">
            <ListCard list={l} />
          </div>
        ))}
      </Rail>
    </RailPanel>
  )
}

// ── Loved by friends ───────────────────────────────────────────────────────

// Rating (out of 10) at or above which a friend's rating counts as "loved".
const LOVED_MIN_RATING = 8

export type FriendPick = {
  mediaId: number
  mediaUuid?: string
  mediaType: MediaType
  title: string
  coverUrl?: string
  credit?: string
  year?: number
  /** Distinct friends who rated it highly, newest first. */
  friends: { handle: string; name: string; avatarUrl?: string }[]
  /** Highest rating among those friends, out of 10. */
  best: number
}

// Titles friends rated highly in the loaded activity page, grouped per title so
// "three friends loved this" outranks a single 10/10. Skips the viewer's own
// activity (they don't need telling what they liked).
export function friendPicksFrom(activity: Activity[], selfHandle?: string): FriendPick[] {
  const picks = new Map<number, FriendPick>()
  for (const a of activity) {
    if (a.type === 'challenge_joined' || !a.mediaId) continue
    if (typeof a.rating !== 'number' || a.rating < LOVED_MIN_RATING) continue
    if (selfHandle && a.user.handle === selfHandle) continue
    let p = picks.get(a.mediaId)
    if (!p) {
      p = {
        mediaId: a.mediaId, mediaUuid: a.mediaUuid, mediaType: a.mediaType, title: a.mediaTitle,
        coverUrl: a.coverUrl, credit: a.mediaAuthor, year: a.mediaYear, friends: [], best: 0,
      }
      picks.set(a.mediaId, p)
    }
    if (!p.friends.some((f) => f.handle === a.user.handle)) {
      p.friends.push({ handle: a.user.handle, name: a.user.name, avatarUrl: a.user.avatarUrl })
    }
    p.best = Math.max(p.best, a.rating)
  }
  return [...picks.values()]
    .sort((a, b) => b.friends.length - a.friends.length || b.best - a.best)
    .slice(0, 8)
}

export function FriendPicksRail({ picks, t }: { picks: FriendPick[]; t: Translate }) {
  return (
    <RailPanel icon={<IoHeartOutline className="h-4 w-4 text-nonsprimaryfocus" />} title={t('lovedByFriends')} t={t}>
      <Rail>
        {picks.map((p) => {
          const names = p.friends.slice(0, 2).map((f) => f.name).join(', ') + (p.friends.length > 2 ? ` +${p.friends.length - 2}` : '')
          return (
            <Link
              key={p.mediaId}
              to={mediaPath({ type: p.mediaType, uuid: p.mediaUuid, id: String(p.mediaId) })}
              className="flex w-64 flex-shrink-0 snap-start items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--container)] p-2.5 transition-colors hover:border-[var(--border)]"
            >
              <div className="relative aspect-[2/3] w-14 flex-shrink-0 overflow-hidden rounded-md bg-[var(--container-2)]">
                {p.coverUrl && <img src={p.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text)]">{p.title}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <IoStar className="h-3 w-3 flex-shrink-0 text-nonsprimaryfocus" />
                  <span className="font-medium text-[var(--text)]">{(p.best / 2).toFixed(1)}</span>
                  {p.year ? <span className="truncate">· {p.year}</span> : null}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-shrink-0 -space-x-1.5">
                    {p.friends.slice(0, 3).map((f) => (
                      <span key={f.handle} className="h-5 w-5 overflow-hidden rounded-full ring-2 ring-[var(--container)]">
                        {f.avatarUrl
                          ? <img src={f.avatarUrl} alt={f.name} className="h-full w-full object-cover" />
                          : <BoringAvatar size={20} name={f.handle} />}
                      </span>
                    ))}
                  </div>
                  <span className="truncate text-[11px] text-[var(--text-muted)]">{t('lovedBy', { names })}</span>
                </div>
              </div>
            </Link>
          )
        })}
      </Rail>
    </RailPanel>
  )
}

// Placeholder while the rails' data loads, sized like a poster rail so the
// feed below doesn't jump when it arrives.
export function RailSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <div className="mb-4 h-4 w-32 rounded bg-[var(--container-2)]" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-32 flex-shrink-0 sm:w-36">
            <div className="aspect-[2/3] rounded-xl bg-[var(--container-2)]" />
            <div className="mt-2 h-3 w-24 rounded bg-[var(--container-2)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
