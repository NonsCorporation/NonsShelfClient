'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoClose } from 'react-icons/io5'
import MediaPicker from '@/components/media/MediaPicker'
import { BINGO_CELL_MAX, cellFromCatalog, type BingoCell } from '@/lib/bingo'
import { useLanguage } from '@/contexts/LanguageContext'

type Props = {
  /** The prompt being answered, e.g. "The book I cried on". */
  prompt: string
  current: BingoCell | null
  /** Called with the chosen answer, or null to clear it. */
  onAnswer: (cell: BingoCell | null) => void
  onClose: () => void
}

const inputCls =
  'h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

// Fill in one square of a prompt bingo: pick a book/film from the catalog or
// type your own answer.
export default function BingoAnswerModal({ prompt, current, onAnswer, onClose }: Props) {
  const { t } = useLanguage()
  const [mode, setMode] = useState<'catalog' | 'text'>('catalog')
  const [text, setText] = useState(current?.kind === 'text' ? current.title : '')

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
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--container)] p-5 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t('bingoAnswerTitle')}</p>
            <h3 className="mt-0.5 text-lg font-semibold leading-snug text-[var(--text)]">{prompt}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t('cancel')}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        {current && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface)] px-3 py-2">
            <span className="min-w-0 truncate text-sm text-[var(--text)]">{current.title}</span>
            <button type="button" onClick={() => onAnswer(null)} className="flex-shrink-0 text-xs font-medium text-nonslightred hover:underline">
              {t('bingoAnswerClear')}
            </button>
          </div>
        )}

        <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
          {(['catalog', 'text'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === m ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {m === 'catalog' ? t('bingoFromCatalog') : t('bingoCustomText')}
            </button>
          ))}
        </div>

        {mode === 'catalog' ? (
          <MediaPicker onPick={(item) => onAnswer(cellFromCatalog(item))} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const v = text.trim()
              if (v) onAnswer({ kind: 'text', title: v.slice(0, BINGO_CELL_MAX) })
            }}
            className="flex flex-col gap-2"
          >
            <input
              autoFocus
              value={text}
              maxLength={BINGO_CELL_MAX}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('bingoAnswerPlaceholder')}
              className={inputCls}
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="rounded-lg bg-nonsprimary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-40"
            >
              {t('bingoAnswerDone')}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
