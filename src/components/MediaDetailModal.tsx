'use client'

import { createPortal } from 'react-dom'
import { useState } from 'react'
import { Link } from '@/lib/router'
import { IoClose, IoPencilOutline, IoLockClosedOutline } from 'react-icons/io5'
import { FiClipboard } from 'react-icons/fi'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { mediaPath } from '../lib/paths'
import { libraryService } from '../services/libraryService'
import StarsSelector from '../StarsSelector'
import MediaHistory from './MediaHistory'
import ReviewContent from './review/ReviewContent'

// Combined detail modal opened from a library card: the rating + review up top,
// the full interaction history (timeline) below. Wider than the other modals so
// the review text and timeline have room. Portaled to <body> so the fixed
// overlay isn't trapped by a transformed ancestor.
export default function MediaDetailModal({ item, onClose }: { item: MediaItem | null; onClose: () => void }) {
  const { t } = useLanguage()
  const [editingNote, setEditingNote] = useState(false)
  const [editText, setEditText] = useState('')
  const [optimisticNote, setOptimisticNote] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  if (!item || typeof document === 'undefined') return null
  const rated = typeof item.rating === 'number' && item.rating > 0
  const hasReview = !!item.review?.trim()
  const displayNote = optimisticNote !== undefined ? optimisticNote : (item.note ?? '')

  const startEditNote = () => {
    setEditText(displayNote)
    setEditingNote(true)
  }

  const saveNote = async () => {
    setSaving(true)
    try {
      await libraryService.setNote(item.id, editText)
      setOptimisticNote(editText)
      setEditingNote(false)
    } finally {
      setSaving(false)
    }
  }

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
            <ReviewContent content={item.review!} className="text-sm leading-6 text-[var(--text)]" />
          </div>
        )}

        {/* Private note — only shown when the item is on the user's shelf */}
        {item.status && (
          <div className="group relative">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              <FiClipboard className="h-3.5 w-3.5" />
              {t('privateNote')}
            </div>

            {editingNote ? (
              <div className="flex flex-col gap-2">
                <textarea
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-md border-0 bg-black/[.04] dark:bg-white/[.04] px-2 py-1 text-sm leading-6 text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:bg-black/[.07] dark:focus:bg-white/[.07] transition-colors"
                  placeholder={t('privateNotePlaceholder')}
                />
                <p className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <IoLockClosedOutline className="h-3 w-3 flex-shrink-0" />
                  {t('onlyVisibleToYou')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={saveNote}
                    disabled={saving}
                    className="rounded-lg bg-nonsprimary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-50"
                  >
                    {saving ? '…' : t('save')}
                  </button>
                  <button
                    onClick={() => setEditingNote(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            ) : displayNote ? (
              <>
                <p onClick={startEditNote} className="cursor-text whitespace-pre-line pr-7 text-sm leading-6 text-[var(--text)] hover:opacity-80 transition-opacity">{displayNote}</p>
                <button
                  onClick={startEditNote}
                  className="absolute right-0 top-0 rounded-lg p-1 text-[var(--text-muted)] transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-[var(--text)]"
                >
                  <IoPencilOutline className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <p
                onClick={startEditNote}
                className="cursor-text text-sm italic text-[var(--text-muted)] opacity-50 hover:opacity-80 transition-opacity"
              >
                {t('addPrivateNote')}
              </p>
            )}
          </div>
        )}

        {/* History timeline */}
        <MediaHistory item={item} />
      </div>
    </div>,
    document.body,
  )
}
