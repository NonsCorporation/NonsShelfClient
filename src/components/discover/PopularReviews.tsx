'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/lib/router'
import { IoChatbubbleOutline, IoChevronUp, IoChatbubblesOutline } from 'react-icons/io5'
import { RailPanel, Rail } from '@/components/feed/FeedDiscoverBlocks'
import BoringAvatar from '@/components/ui/BoringAvatar'
import TypeBadge from '@/components/badges/TypeBadge'
import StarsSelector from '@/StarsSelector'
import { reviewToPlainText } from '@/components/review/reviewText'
import { discoverService, type PopularReview } from '@/services/discoverService'
import { useLanguage } from '@/contexts/LanguageContext'
import { mediaPath } from '@/lib/paths'

const COUNT = 8

// The most-liked / most-discussed reviews across the catalog, as a horizontal
// rail of cards. Self-contained: it fetches its own data (the endpoint is
// public) so it can be dropped onto any page — the signed-in feed and the
// signed-out Discover home both embed it. Renders nothing until at least one
// review has drawn a reaction, rather than an empty panel.
export default function PopularReviews() {
  const { t } = useLanguage()
  const [reviews, setReviews] = useState<PopularReview[] | null>(null)

  useEffect(() => {
    let cancelled = false
    discoverService.popularReviews(COUNT).then((r) => { if (!cancelled) setReviews(r) })
    return () => { cancelled = true }
  }, [])

  if (!reviews || reviews.length === 0) return null

  return (
    <RailPanel
      icon={<IoChatbubblesOutline className="h-4 w-4 text-nonsprimaryfocus" />}
      title={t('popularReviews')}
      hint={t('popularReviewsHint')}
      t={t}
    >
      <Rail>
        {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
      </Rail>
    </RailPanel>
  )
}

function ReviewCard({ review: r }: { review: PopularReview }) {
  const { t } = useLanguage()
  const name = r.name || r.username || 'User'
  const text = reviewToPlainText(r.review)
  return (
    <Link
      to={r.uuid ? `${mediaPath(r.media)}?review=${r.uuid}` : mediaPath(r.media)}
      className="flex w-72 flex-shrink-0 snap-start flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 transition-colors hover:border-[var(--border)] sm:w-80"
    >
      <div className="flex items-center gap-3">
        <div className="relative aspect-[2/3] w-11 flex-shrink-0 overflow-hidden rounded-md bg-[var(--container-2)]">
          {r.media.coverUrl && <img src={r.media.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
          <TypeBadge type={r.media.type} position="top-1 right-1" size="h-4 w-4" iconSize="h-2.5 w-2.5" className="pointer-events-none" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text)]">{r.media.title}</p>
          {r.media.year ? <p className="text-xs text-[var(--text-muted)]">{r.media.year}</p> : null}
          {r.value > 0 && (
            <div className="mt-1">
              <StarsSelector initialValue={r.value} isEditable={false} size="sm" />
            </div>
          )}
        </div>
      </div>

      <p className="line-clamp-4 flex-1 text-xs leading-5 text-[var(--text-muted)]">{text}</p>

      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        {r.avatarUrl ? (
          <img src={r.avatarUrl} alt="" loading="lazy" className="h-5 w-5 flex-shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex-shrink-0 overflow-hidden rounded-full" style={{ width: 20, height: 20 }}>
            <BoringAvatar size={20} name={`user-${r.userId}`} />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[var(--text)]">{name}</span>
        <span className="inline-flex flex-shrink-0 items-center gap-0.5 font-medium" title={t('popularReviewsLikes', { n: r.likeCount })}>
          <IoChevronUp className="h-4 w-4" />
          {r.likeCount}
        </span>
        <span className="inline-flex flex-shrink-0 items-center gap-1 font-medium" title={t('popularReviewsComments', { n: r.commentCount })}>
          <IoChatbubbleOutline className="h-3.5 w-3.5" />
          {r.commentCount}
        </span>
      </div>
    </Link>
  )
}
