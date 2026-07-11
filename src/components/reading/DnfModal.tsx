'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoClose } from 'react-icons/io5'
import { libraryService } from '@/services/libraryService'
import type { MediaItem } from '@/types'
import { useLanguage } from '@/contexts/LanguageContext'
import DatePicker from '@/components/ui/DatePicker'

type Props = {
  isOpen: boolean
  item: MediaItem | null
  onClose: () => void
  onDone: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

// The "did not finish" modal — the abandon-side mirror of FinishModal, but
// leaner: no rating (you're not rating an abandoned read), just the date you
// stopped and an optional "why". Records a distinct dnf attempt in the reads
// list. Books read/movies watched; the copy adapts.
export default function DnfModal({ isOpen, item, onClose, onDone }: Props) {
  const { t } = useLanguage()
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [share, setShare] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setDate(today())
    setNote('')
    setShare(true)
  }, [isOpen])

  if (!isOpen || !item) return null

  const isBook = item.type === 'book'

  const submit = async () => {
    setBusy(true)
    try {
      await libraryService.markDNF(item.id, {
        endedAt: date ? Math.floor(new Date(date).getTime() / 1000) : undefined,
        note: note.trim(),
        share,
      })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {item.coverUrl ? (
              <img src={item.coverUrl} alt="" className="h-16 w-11 flex-shrink-0 rounded object-cover" />
            ) : (
              <div className="h-16 w-11 flex-shrink-0 rounded bg-[var(--container-2)]" />
            )}
            <div>
              <h3 className="text-lg font-semibold leading-tight tracking-wide text-[var(--text)]">{t('didNotFinish')}</h3>
              <p className="text-sm text-[var(--text-muted)]">{item.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            {isBook ? t('dnfDateStopped') : t('dnfDateStoppedWatching')}
          </p>
          <DatePicker value={date} onChange={setDate} max={today()} placeholder="—" openUp={true} />
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
          {t('dnfReason')}
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('dnfReasonPlaceholder')}
            className="resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            checked={share}
            onChange={(e) => setShare(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border-subtle)]"
          />
          {t('shareToFeed')}
        </label>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {t('cancel')}
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="h-10 rounded-lg bg-nonsprimary px-6 text-sm font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
          >
            {busy ? t('saving') : t('dnfConfirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
