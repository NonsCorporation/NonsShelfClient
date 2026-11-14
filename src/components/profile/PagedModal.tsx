'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IoClose } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'

type Props = {
  title: string
  /** How many are in the list (shown next to the title). */
  total: number
  /** Show the "load more" button — there are more pages on the server. */
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
  onClose: () => void
  children: ReactNode
}

// Modal shell for "view all" lists on the profile. The list is paged by the
// caller, so opening it only ever costs one page of requests; more are fetched
// when the reader asks for them.
export default function PagedModal({ title, total, hasMore, loading, onLoadMore, onClose, children }: Props) {
  const { t } = useLanguage()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--overlay)] sm:items-center sm:p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--container)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h3 className="text-base font-semibold text-[var(--text)]">
            {title}
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">{total}</span>
          </h3>
          <button
            onClick={onClose}
            aria-label={t('cancel')}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {children}
          {hasMore && (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loading}
              className="mt-4 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:border-nonsprimary hover:text-nonsprimary disabled:opacity-50"
            >
              {loading ? '…' : t('loadMore')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
