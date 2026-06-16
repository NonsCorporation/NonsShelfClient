import { Link, useNavigate } from '@/lib/router'
import {
  IoBookOutline,
  IoFilmOutline,
  IoTvOutline,
  IoHeart,
  IoHeartOutline,
  IoStar,
} from 'react-icons/io5'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { statusLabel, STATUS_COLOR } from '../lib/shelf'
import { mediaPath } from '../lib/paths'

type MediaCardProps = {
  item: MediaItem
  view: 'grid' | 'list'
  onToggleFavorite: () => void
}

function Cover({ item, className }: { item: MediaItem; className?: string }) {
  if (item.coverUrl) {
    return <img src={item.coverUrl} alt={item.title} className={className} loading="lazy" />
  }
  const Icon = item.type === 'book' ? IoBookOutline : item.type === 'series' ? IoTvOutline : IoFilmOutline
  return (
    <div className={`flex items-center justify-center bg-[var(--container-2)] ${className ?? ''}`}>
      <Icon className="h-8 w-8 text-[var(--placeholder)]" />
    </div>
  )
}

export default function MediaCard({ item, view, onToggleFavorite }: MediaCardProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const isBook = item.type === 'book'
  const TypeIcon = isBook ? IoBookOutline : item.type === 'series' ? IoTvOutline : IoFilmOutline
  const genres = Array.isArray(item.genre) ? item.genre : item.genre ? [item.genre] : []
  const status = item.status ?? 'wishlist'

  // Byline: the author/director name. When we know the person's uuid it links to
  // their /p/<uuid> page — via navigate (not a nested <a>, the card is a Link).
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

  const favBtn = (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggleFavorite()
      }}
      title={item.favorite ? t('unmarkFavorite') : t('markFavorite')}
      className={`flex items-center justify-center transition-colors ${
        item.favorite ? 'text-nonslightred' : 'text-white/70 hover:text-white'
      }`}
    >
      {item.favorite ? <IoHeart className="h-[18px] w-[18px]" /> : <IoHeartOutline className="h-[18px] w-[18px]" />}
    </button>
  )

  // ── List view ─────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <Link
        to={mediaPath(item)}
        className="group flex items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-hover)]"
      >
        <Cover item={item} className="h-20 w-14 flex-shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <TypeIcon className="h-3.5 w-3.5" />
            <span>{item.year ?? '—'}</span>
            <span
              className="ml-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${STATUS_COLOR[status]}22`, color: STATUS_COLOR[status] }}
            >
              {statusLabel(item.type, status, t)}
            </span>
          </div>
          <h3 className="mt-1 truncate text-[15px] font-semibold text-[var(--text)]">{item.title}</h3>
          {byline}
        </div>
        <div className="flex flex-shrink-0 items-center gap-3 pr-1">
          {typeof item.rating === 'number' && item.rating > 0 && (
            <span className="flex items-center gap-1 text-sm font-semibold text-[var(--text)]">
              <IoStar className="h-3.5 w-3.5 text-nonsprimary" />
              {(item.rating / 2).toFixed(1)}
            </span>
          )}
          <span className="text-[var(--text-muted)]">{favBtn}</span>
        </div>
      </Link>
    )
  }

  // ── Grid view ─────────────────────────────────────────────────────────────
  return (
    <Link
      to={mediaPath(item)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] transition-colors duration-200 hover:border-[var(--border)]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[var(--container-2)]">
        <Cover item={item} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Top row: status + favorite */}
        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: `${STATUS_COLOR[status]}d0` }}
          >
            {statusLabel(item.type, status, t)}
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40">
            {favBtn}
          </span>
        </div>

        {/* Type icon */}
        <div className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white/80">
          <TypeIcon className="h-3.5 w-3.5" />
        </div>

        {/* Rating pill */}
        {typeof item.rating === 'number' && item.rating > 0 && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-semibold text-white">
            <IoStar className="h-3 w-3 text-nonsprimaryfocus" />
            {(item.rating / 2).toFixed(1)}
          </div>
        )}
      </div>

      <div className="relative flex flex-1 flex-col gap-1 p-3">
        <h3 className="truncate text-[15px] font-semibold leading-snug text-[var(--text)]" title={item.title}>
          {item.title}
        </h3>
        {byline}
        {genres.length > 0 && (
          <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]/70">{genres.slice(0, 3).join(' · ')}</p>
        )}
      </div>
    </Link>
  )
}
