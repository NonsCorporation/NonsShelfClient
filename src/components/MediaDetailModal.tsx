'use client'

import { createPortal } from 'react-dom'
import { Link } from '@/lib/router'
import { IoClose } from 'react-icons/io5'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { mediaPath } from '../lib/paths'
import StarsSelector from '../StarsSelector'
import MediaHistory from './MediaHistory'

// Combined detail modal opened from a library card: the rating + review up top,
// the full interaction history (timeline) below. Wider than the other modals so
// the review text and timeline have room. Portaled to <body> so the fixed
// overlay isn't trapped by a transformed ancestor.
export default function MediaDetailModal({ item, onClose }: { item: MediaItem | null; onClose: () => void }) {
  const { t } = useLanguage()
  if (!item || typeof document === 'undefined') return null
  const rated = typeof item.rating === 'number' && item.rating > 0
  const hasReview = !!item.review?.trim()

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm">
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up flex max-h-[85vh] w-full max-w-5xl flex-col gap-4 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        {/* Header: cover, title, author, rating */}
        <div className="flex items-start gap-3">
          <Link to={mediaPath(item)} className="block w-16 flex-shrink-0">
            {item.coverUrl ? (
              <img src={item.coverUrl} alt={item.title} className="aspect-[2/3] w-full rounded-lg object-cover" />
            ) : (
              <div className="aspect-[2/3] w-full rounded-lg bg-[var(--container-2)]" />
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link to={mediaPath(item)} className="block text-lg font-bold leading-snug text-[var(--text)] hover:text-nonsprimary">
              {item.title}
            </Link>
            {(item.author || item.director) && (
              <p className="text-sm text-[var(--text-muted)]">
                {t('by')} <span className="text-[var(--text)]">{item.author || item.director}</span>
              </p>
            )}
            {rated && (
              <span className="mt-1.5 flex items-center gap-1.5 text-sm">
                <StarsSelector initialValue={item.rating} isEditable={false} size="sm" />
                <span className="font-semibold text-[var(--text)]">{(item.rating! / 2).toFixed(1)}</span>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        {/* Review */}
        {hasReview && (
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{t('yourReview')}</div>
            <p className="whitespace-pre-line text-sm leading-6 text-[var(--text)]">{item.review}</p>
          </div>
        )}

        {/* History timeline */}
        <MediaHistory item={item} />
      </div>
    </div>,
    document.body,
  )
}
