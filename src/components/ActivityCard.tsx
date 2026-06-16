import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Activity, ActivityType } from '../services/activityService'
import { useLanguage } from '../contexts/LanguageContext'
import { initials } from '../lib/user'
import { mediaPath, userPath } from '../lib/paths'
import { IoHeart, IoHeartOutline, IoChatbubbleOutline } from 'react-icons/io5'
import { IoMdStar, IoMdStarHalf, IoMdStarOutline } from 'react-icons/io'

const VERB_KEY: Record<ActivityType, string> = {
  rated: 'verbRated',
  finished: 'verbFinished',
  started: 'verbStarted',
  added: 'verbAdded',
  reviewed: 'verbReviewed',
}

// Five-star display from a 0–10 rating, with half-star steps (matches StarsSelector).
function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex text-nonsprimary">
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = (i + 1) * 2
        const isFull = rating >= starValue
        const isHalf = rating === starValue - 1
        return isFull ? (
          <IoMdStar key={i} className="h-4 w-4" />
        ) : isHalf ? (
          <IoMdStarHalf key={i} className="h-4 w-4" />
        ) : (
          <IoMdStarOutline key={i} className="h-4 w-4 text-[var(--placeholder)]" />
        )
      })}
    </span>
  )
}

// Goodreads-style update card: "<Name> <verb> <Title>" + stars in the header,
// the review (when present) above a cover + details block, and a Like · Comment
// footer. Reusable across the feed and any place that shows activity.
export default function ActivityCard({ a }: { a: Activity }) {
  const { t } = useLanguage()
  const [liked, setLiked] = useState(false)
  const to = mediaPath({ type: a.mediaType, uuid: a.mediaUuid, id: String(a.mediaId) })
  const typeLabel = a.mediaType === 'book' ? t('book') : a.mediaType === 'series' ? t('series') : t('film')
  const showStars = typeof a.rating === 'number' && a.rating > 0

  return (
    <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 sm:p-5">
      {/* header: "<Name> <verb> <Title>" + stars, above the media card */}
      <div className="mb-3 flex items-center gap-2.5">
        <Link
          to={userPath(a.user.handle || a.user.uuid || '')}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{ backgroundColor: a.user.color }}
          title={a.user.name}
        >
          {initials(a.user.name)}
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-sm leading-6 text-[var(--text)]">
          <Link to={userPath(a.user.handle || a.user.uuid || '')} className="font-semibold hover:underline">
            {a.user.name}
          </Link>
          <span className="text-[var(--text-muted)]">{t(VERB_KEY[a.type])}</span>
          <Link to={to} className="font-semibold hover:text-nonsprimary">
            {a.mediaTitle}
          </Link>
          {showStars && (
            <span className="ml-0.5 inline-flex">
              <Stars rating={a.rating!} />
            </span>
          )}
        </div>
        <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">{a.timeAgo}</span>
      </div>

      {/* review text, above the media card when present */}
      {a.text && (
        <p className="mb-3 text-sm leading-6 text-[var(--text)]">{a.text}</p>
      )}

      {/* body: cover + details */}
      <div className="flex gap-4">
        <Link to={to} className="flex-shrink-0">
          {a.coverUrl ? (
            <img
              src={a.coverUrl}
              alt={a.mediaTitle}
              loading="lazy"
              className="h-32 w-[88px] rounded-md border border-[var(--border-subtle)] object-cover"
            />
          ) : (
            <div className="h-32 w-[88px] rounded-md border border-[var(--border-subtle)] bg-[var(--container-2)]" />
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <Link to={to} className="block text-lg font-bold leading-snug text-[var(--text)] hover:text-nonsprimary">
            {a.mediaTitle}
          </Link>
          {a.mediaAuthor && (
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {t('by')} <span className="text-[var(--text)]">{a.mediaAuthor}</span>
            </p>
          )}
          <p className="mt-0.5 text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {typeLabel}
            {a.mediaYear ? ` · ${a.mediaYear}` : ''}
          </p>

          {a.mediaDescription && (
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              <span className="line-clamp-3">{a.mediaDescription}</span>
              <Link to={to} className="text-nonsprimary hover:underline">
                {t('continueReading')}
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* footer: like · comment */}
      <div className="mt-4 flex items-center gap-4 border-t border-[var(--divider)] pt-3 text-sm">
        <button
          onClick={() => setLiked((v) => !v)}
          className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
            liked ? 'text-nonsprimary' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          {liked ? <IoHeart className="h-4 w-4" /> : <IoHeartOutline className="h-4 w-4" />}
          {t('like')}
        </button>
        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-muted)]">
          <IoChatbubbleOutline className="h-4 w-4" />
          {t('comment')}
        </span>
      </div>
      <input
        placeholder={t('writeComment')}
        className="mt-2 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
      />
    </article>
  )
}
