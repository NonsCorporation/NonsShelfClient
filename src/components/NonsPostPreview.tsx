import { IoMdStar } from 'react-icons/io'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import ReviewContent from './review/ReviewContent'

type Props = {
  item: MediaItem
  title: string
  review: string
  rating: number | null
}

// A read-only approximation of how the cross-post will render on the main
// nons feed: title, review body, rating, and the "Mentioned <title>" chip
// linking back to this item. Not the real nons-client <Post> component (a
// different app) — just enough for the user to sanity-check before sending.
export default function NonsPostPreview({ item, title, review, rating }: Props) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
        {t('preview') || 'Preview'}
      </p>
      <h4 className="text-sm font-semibold text-[var(--text)]">{title || item.title}</h4>
      {rating ? (
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <IoMdStar
              key={i}
              className={`h-3.5 w-3.5 ${i < Math.round(rating / 2) ? 'text-nonsprimary' : 'text-[var(--border-subtle)]'}`}
            />
          ))}
        </div>
      ) : null}
      {review ? <ReviewContent content={review} className="text-sm text-[var(--text-muted)]" /> : null}
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--container-2)] p-2">
        {item.coverUrl ? (
          <img src={item.coverUrl} alt="" className="h-10 w-7 flex-shrink-0 rounded object-cover" />
        ) : (
          <div className="h-10 w-7 flex-shrink-0 rounded bg-[var(--container)]" />
        )}
        <p className="text-xs text-[var(--text-muted)]">
          {t('mentioned') || 'Mentioned'} <span className="font-medium text-[var(--text)]">{item.title}</span>
        </p>
      </div>
    </div>
  )
}
