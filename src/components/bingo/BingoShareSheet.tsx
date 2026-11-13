'use client'

import { useEffect } from 'react'
import { useScrollLock } from '@/lib/useScrollLock'
import { createPortal } from 'react-dom'
import { IoCheckmark, IoChevronForward, IoClose, IoImageOutline, IoLinkOutline, IoPersonOutline } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'

type Props = {
  /** Whether there is a result (ticks / answers) worth sharing. */
  hasResult: boolean
  /** Which link was just copied, for the little confirmation. */
  copied: 'board' | 'result' | null
  onImage: () => void
  onCopyBoard: () => void
  onCopyResult: () => void
  onClose: () => void
}

// "Share" as a friendly sheet of plain choices (a picture, the board, my result)
// instead of a row of technical buttons.
export default function BingoShareSheet({ hasResult, copied, onImage, onCopyBoard, onCopyResult, onClose }: Props) {
  useScrollLock(true)
  const { t } = useLanguage()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const rows = [
    { key: 'image', icon: IoImageOutline, title: t('bingoShareImage'), hint: t('bingoShareImageHint'), onClick: onImage, done: false, show: true },
    { key: 'board', icon: IoLinkOutline, title: t('bingoShareBoardRow'), hint: t('bingoShareBoardHint'), onClick: onCopyBoard, done: copied === 'board', show: true },
    { key: 'result', icon: IoPersonOutline, title: t('bingoShareResult'), hint: t('bingoShareResultHint'), onClick: onCopyResult, done: copied === 'result', show: hasResult },
  ].filter((r) => r.show)

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--overlay)] sm:items-center sm:p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--container)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h3 className="text-lg font-semibold text-[var(--text)]">{t('bingoShareTitle')}</h3>
          <button
            onClick={onClose}
            aria-label={t('cancel')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-1 p-2 pb-4">
          {rows.map((r) => (
            <button
              key={r.key}
              onClick={r.onClick}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[var(--surface)]"
            >
              <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${r.done ? 'bg-nonsprimary text-white' : 'bg-[var(--primary-soft)] text-nonsprimary'}`}>
                {r.done ? <IoCheckmark className="h-5 w-5" /> : <r.icon className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--text)]">{r.done ? t('bingoCopied') : r.title}</span>
                <span className="block text-xs text-[var(--text-muted)]">{r.hint}</span>
              </span>
              {r.key === 'image' && <IoChevronForward className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
