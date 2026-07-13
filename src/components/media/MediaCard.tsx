import { useState, type MouseEvent } from 'react'
import Image from 'next/image'
import { Link, useNavigate } from '@/lib/router'
import {
  IoBookOutline,
  IoFilmOutline,
  IoTvOutline,
  IoHeart,
  IoHeartOutline,
  IoStar,
  IoLibraryOutline,
  IoChatbubbleOutline,
  IoTimeOutline,
} from 'react-icons/io5'
import type { MediaItem, ShelfStatus } from '@/types'
import { useLanguage } from '@/contexts/LanguageContext'
import { statusLabel, STATUS_COLOR } from '@/lib/shelf'
import { mediaPath } from '@/lib/paths'
import TypeBadge from '@/components/badges/TypeBadge'
import ShelfStatusBar from '@/components/media/ShelfStatusBar'
import ReviewContent from '@/components/review/ReviewContent'

// gets latest dated event
function latestEvent(item: MediaItem): { key: 'histFinished' | 'histStarted' | 'histAdded'; date: string } | null {
  const candidates: { key: 'histFinished' | 'histStarted' | 'histAdded'; date?: string }[] = [
    { key: 'histFinished', date: item.finishedAt },
    { key: 'histStarted', date: item.startedAt },
    { key: 'histAdded', date: item.dateAdded },
  ]
  const dated = candidates.filter((c) => c.date) as { key: 'histFinished' | 'histStarted' | 'histAdded'; date: string }[]
  if (dated.length === 0) return null
  return dated.sort((a, b) => b.date.localeCompare(a.date))[0]
}

// formats date to short string
function shortDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// shelf comparison for another user's library
export type ShelfCompare = { status?: ShelfStatus; rating?: number } | undefined

// reading or watching progress
export type ItemProgress = { label: string; pct: number }

// media card props
type MediaCardProps = {
  item: MediaItem
  view: 'grid' | 'list'
  onToggleFavorite?: () => void
  showReview?: boolean
  onOpenDetail?: (item: MediaItem) => void
  compareName?: string
  myEntry?: ShelfCompare
  onMyStatusChange?: (item: MediaItem, status: ShelfStatus) => void
  onMyRemove?: (item: MediaItem) => void
  onFilterStatus?: (status: ShelfStatus) => void
  onFilterType?: (type: MediaItem['type']) => void
  progress?: ItemProgress
}

// renders media cover image or placeholder
function Cover({ item, className, fill }: { item: MediaItem; className?: string; fill?: boolean }) {
  const Icon = item.type === 'book' ? IoBookOutline : item.type === 'series' ? IoTvOutline : IoFilmOutline
  if (item.coverUrl) {
    return fill ? (
      <Image src={item.coverUrl} alt={item.title} fill className={`object-cover ${className ?? ''}`} sizes="(max-width: 640px) 50vw, 200px" />
    ) : (
      <Image src={item.coverUrl} alt={item.title} width={56} height={80} className={className} />
    )
  }
  return (
    <div className={`flex items-center justify-center bg-[var(--container-2)] ${className ?? ''}`}>
      <Icon className="h-8 w-8 text-[var(--placeholder)]" />
    </div>
  )
}

export default function MediaCard({
  item,
  view,
  onToggleFavorite,
  showReview = false,
  onOpenDetail,
  compareName,
  myEntry,
  onMyStatusChange,
  onMyRemove,
  onFilterStatus,
  onFilterType,
  progress,
}: MediaCardProps) {
  // prevents default event propagation
  const stop = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  // triggers detail modal
  const openDetail = (e: MouseEvent) => {
    stop(e)
    onOpenDetail?.(item)
  }

  const { t } = useLanguage()
  const navigate = useNavigate()
  const [reviewOpen, setReviewOpen] = useState(false)
  const isBook = item.type === 'book'
  const TypeIcon = isBook ? IoBookOutline : item.type === 'series' ? IoTvOutline : IoFilmOutline
  const genres = Array.isArray(item.genre) ? item.genre : item.genre ? [item.genre] : []
  const status = item.status ?? 'wishlist'

  // creator byline text or profile link
  const byline = item.makerUuid ? (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        navigate(`/p/${item.makerUuid}`)
      }}
      className="block max-w-full truncate text-left text-sm text-[var(--text-muted)] transition-colors hover:text-nonsprimary hover:underline"
    >
      {item.author}
    </button>
  ) : (
    <p className="truncate text-sm text-[var(--text-muted)]">{item.author}</p>
  )

  const favBtn = onToggleFavorite ? (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggleFavorite()
      }}
      title={item.favorite ? t('unmarkFavorite') : t('markFavorite')}
      className={`flex items-center justify-center transition-colors ${
        item.favorite ? 'text-nonslightred' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
      }`}
    >
      {item.favorite ? <IoHeart className="h-[18px] w-[18px]" /> : <IoHeartOutline className="h-[18px] w-[18px]" />}
    </button>
  ) : null

  // list view layout
  if (view === 'list') {
    const hasReview = showReview && !!item.review?.trim()
    const rated = typeof item.rating === 'number' && item.rating > 0
    const bothRated = !!compareName && !!myEntry && (myEntry.rating ?? 0) > 0 && rated
    const latest = latestEvent(item)
    return (
      <Link
        to={mediaPath(item)}
        className="group flex flex-col gap-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-hover)]"
      >
        <div className="flex items-start gap-4">
          <div className="relative h-28 w-[74px] flex-shrink-0 overflow-hidden rounded-lg">
            <Cover item={item} fill className="rounded-lg" />
            {/* item type badge */}
            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white/90">
              <TypeIcon className="h-3 w-3" />
            </span>
            {item.year ? (
              <span className="absolute bottom-1 right-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-white/90">
                {item.year}
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            {/* shelf status chip */}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${STATUS_COLOR[status]}22`, color: STATUS_COLOR[status] }}
            >
              {statusLabel(item.type, status, t)}
            </span>
            <h3 className="mt-1 truncate text-[15px] font-semibold text-[var(--text)]">{item.title}</h3>
            {byline}
            {item.description && (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{item.description}</p>
            )}
            {/* latest event line */}
            {latest && (
              <button
                onClick={openDetail}
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-nonsprimary"
              >
                <IoTimeOutline className="h-3.5 w-3.5" />
                {t(latest.key)}
                <span>· {shortDate(latest.date)}</span>
              </button>
            )}
            {progress && (
              <div className="mt-1.5">
                <div className="mb-1 flex items-center gap-2 text-[11px]">
                  <span className="text-[var(--text-muted)]">{progress.label}</span>
                  {progress.pct > 0 && <span className="font-semibold text-nonsprimary">{progress.pct}%</span>}
                </div>
                {progress.pct > 0 && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--container-2)]">
                    <div className="h-full rounded-full bg-nonsprimary transition-all" style={{ width: `${progress.pct}%` }} />
                  </div>
                )}
              </div>
            )}

            {/* comparison view elements */}
            {compareName && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                {onMyStatusChange ? (
                  <div onClick={stop} className="inline-flex">
                    <ShelfStatusBar
                      item={item}
                      currentStatus={myEntry?.status ?? null}
                      onStatusChange={(s) => onMyStatusChange(item, s)}
                      onRemove={myEntry ? () => onMyRemove?.(item) : undefined}
                      variant="button"
                    />
                  </div>
                ) : myEntry ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-soft)] px-2 py-0.5 font-medium text-[var(--text)]">
                    <IoLibraryOutline className="h-3 w-3" />
                    {t('onYourShelf')}
                    {myEntry.status && ` · ${statusLabel(item.type, myEntry.status, t)}`}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[var(--text-muted)]">
                    {t('notInYourLibrary')}
                  </span>
                )}
                {bothRated && (
                  <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[var(--text-muted)]">
                    {t('yourRatingVs', {
                      you: (myEntry!.rating! / 2).toFixed(1),
                      name: compareName,
                      them: (item.rating! / 2).toFixed(1),
                    })}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* indicators and actions column */}
          <div className="flex flex-col items-end self-stretch flex-shrink-0 pr-1 py-1">
            {/* top right corner favorite toggle */}
            {favBtn}

            {/* rating and review below top corner */}
            <div className="flex flex-col items-end gap-1 mt-2 mb-auto">
              {rated && (
                <span className="flex items-center gap-1 text-sm font-semibold text-[var(--text)]">
                  <IoStar className="h-3.5 w-3.5 text-nonsprimary" />
                  {(item.rating! / 2).toFixed(1)}
                </span>
              )}
              {item.review?.trim() && (
                <span title={t('hasReview')} className="text-[var(--text-muted)]">
                  <IoChatbubbleOutline className="h-4 w-4" />
                </span>
              )}
            </div>

            {/* history detail button at bottom */}
            {onOpenDetail && (
              <button
                onClick={openDetail}
                title={t('historyTitle')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] mt-2"
              >
                <IoTimeOutline className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
        </div>

        {/* inline review snippet */}
        {hasReview && (
          <div
            onClick={(e) => e.preventDefault()}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2"
          >
            <ReviewContent
              content={item.review!}
              className={`text-xs leading-6 text-[var(--text)] ${reviewOpen ? '' : 'line-clamp-2'}`}
            />
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setReviewOpen((v) => !v)
              }}
              className="mt-1 text-[11px] font-medium text-nonsprimary hover:underline"
            >
              {reviewOpen ? t('showLess') : t('showMore')}
            </button>
          </div>
        )}
      </Link>
    )
  }

  // grid view layout
  return (
    <Link
      to={mediaPath(item)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] transition-colors duration-200 hover:border-[var(--border)]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[var(--container-2)]">
        <Cover item={item} fill className="transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* top-left status zone */}
        {(() => {
          const badgeCls = 'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white'
          const style = { backgroundColor: `${STATUS_COLOR[status]}d0` }
          const label = statusLabel(item.type, status, t)
          const badges = (
            <div className="flex flex-col items-start gap-1">
              <span className={badgeCls} style={style}>{label}</span>
              {progress && (
                <span className="rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
                  {progress.label}
                </span>
              )}
            </div>
          )
          return onFilterStatus ? (
            <button
              onClick={(e) => { stop(e); onFilterStatus(status) }}
              title={label}
              className="absolute left-0 top-0 z-10 flex w-1/2 items-start justify-start p-2.5"
            >
              {badges}
            </button>
          ) : (
            <span className="absolute left-2.5 top-2.5">{badges}</span>
          )
        })()}

        {/* top-right type zone */}
        {onFilterType ? (
          <button
            onClick={(e) => { stop(e); onFilterType(item.type) }}
            title={t(item.type === 'book' ? 'book' : item.type === 'series' ? 'series' : 'film')}
            className="absolute right-0 top-0 z-10 flex h-1/4 w-1/2 items-start justify-end p-2.5"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white/80 transition-colors group-hover:text-white">
              <TypeIcon className="h-3.5 w-3.5" />
            </span>
          </button>
        ) : (
          <TypeBadge type={item.type} position="top-2.5 right-2.5" />
        )}

        {/* bottom-left detail zone */}
        {onOpenDetail && (() => {
          const rated = typeof item.rating === 'number' && item.rating > 0
          const reviewed = !!item.review?.trim()
          const latest = latestEvent(item)
          if (!rated && !reviewed && !latest) return null
          return (
            <button
              onClick={openDetail}
              title={t('historyTitle')}
              className="absolute bottom-0 left-0 z-10 flex h-1/4 w-1/2 flex-col items-start justify-end gap-1 p-2.5"
            >
              {(rated || reviewed) && (
                <span className="flex items-center gap-1">
                  {rated && (
                    <span className="flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                      <IoStar className="h-3 w-3 text-nonsprimaryfocus" />
                      {(item.rating! / 2).toFixed(1)}
                    </span>
                  )}
                  {reviewed && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white">
                      <IoChatbubbleOutline className="h-3 w-3" />
                    </span>
                  )}
                </span>
              )}
              {latest && (
                <span className="flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white/90 w-max">
                  <IoTimeOutline className="h-3 w-3" />
                  {shortDate(latest.date)}
                </span>
              )}
            </button>
          )
        })()}
        <p className="absolute bottom-2.5 right-2.5 z-10 flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] bg-black/55">
          {item.year ?? '—'}
        </p>
      </div>

      <div className="relative flex flex-1 flex-col gap-1 p-3">
        <h3 className="truncate text-[15px] font-semibold leading-snug text-[var(--text)]" title={item.title}>
          {item.title}
        </h3>
        {byline}
      </div>
    </Link>
  )
}