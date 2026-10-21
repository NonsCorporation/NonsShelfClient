'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IoClose } from 'react-icons/io5'
import { readingService } from '@/services/readingService'
import { libraryService } from '@/services/libraryService'
import type { MediaItem } from '@/types'
import { useLanguage } from '@/contexts/LanguageContext'
import DatePicker from '@/components/ui/DatePicker'

type Props = {
  isOpen: boolean
  item: MediaItem | null
  /** Where the reader is now; prefills "from page". */
  currentPage?: number
  onClose: () => void
  /** Called after a session (and optional progress update) was saved. */
  onLogged: () => void
}

const today = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// "YYYY-MM-DD" (local) → unix seconds at noon local time, so the day stays the
// same in the server's timezone bucketing whichever side of midnight it lands.
const dayToUnix = (day: string): number | undefined => {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return undefined
  const sec = Math.floor(new Date(y, m - 1, d, 12).getTime() / 1000)
  // Logging "today" must not be dated in the future.
  return Math.min(sec, Math.floor(Date.now() / 1000))
}

const num = (s: string): number => {
  const n = Math.floor(Number(s))
  return Number.isFinite(n) && n > 0 ? n : 0
}

// "Log reading session": a timed sitting with a book — pages and/or minutes,
// optionally backdated. Feeds the reading streak and yearly totals; can also
// move the book's progress forward to the end page.
export default function LogSessionModal(props: Props) {
  // The form mounts fresh each time the modal opens, so its fields start from
  // the initial values below without a reset effect.
  if (!props.isOpen || !props.item) return null
  return <SessionForm {...props} item={props.item} />
}

function SessionForm({ item, currentPage = 0, onClose, onLogged }: Omit<Props, 'isOpen' | 'item'> & { item: MediaItem }) {
  const { t } = useLanguage()
  const [startPage, setStartPage] = useState(currentPage > 0 ? String(currentPage) : '')
  const [endPage, setEndPage] = useState('')
  const [minutes, setMinutes] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [updateProgress, setUpdateProgress] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const start = num(startPage)
  const end = num(endPage)
  const hasRange = start > 0 && end > 0
  const pages = hasRange ? end - start : 0
  const mins = num(minutes)

  const submit = async () => {
    if (hasRange && end < start) { setError(t('sessionEndBeforeStart')); return }
    // A start page alone is meaningless; a session needs pages or minutes.
    if ((!hasRange || pages === 0) && mins === 0) { setError(t('sessionNeedsValue')); return }
    setBusy(true)
    setError('')
    try {
      await readingService.logSession({
        mediaId: item.id,
        startPage: hasRange ? start : undefined,
        endPage: hasRange ? end : undefined,
        minutes: mins || undefined,
        note: note.trim() || undefined,
        sessionDate: dayToUnix(date),
      })
      if (updateProgress && end > currentPage) {
        // Quiet update: a session shouldn't spam the friends feed.
        await libraryService.logProgress(item.id, { page: end, share: false, eventDate: dayToUnix(date) })
      }
      onLogged()
      onClose()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('sessionSaveError'))
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'
  const labelCls = 'flex flex-col gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]'

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold leading-tight tracking-wide text-[var(--text)]">{t('logSession')}</h3>
            <p className="text-sm text-[var(--text-muted)]">{item.title}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('cancel')}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            {t('sessionStartPage')}
            <input type="number" inputMode="numeric" min={0} value={startPage} onChange={(e) => setStartPage(e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            {t('sessionEndPage')}
            <input type="number" inputMode="numeric" min={0} value={endPage} onChange={(e) => setEndPage(e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            {t('sessionMinutes')}
            <input type="number" inputMode="numeric" min={0} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={inputCls} />
          </label>
          <div className={labelCls}>
            {t('sessionDate')}
            <DatePicker value={date} onChange={setDate} max={today()} placeholder="—" openUp={true} />
          </div>
        </div>

        {pages > 0 && (
          <p className="-mt-1 text-xs font-medium text-nonsprimary">{t('sessionPagesOnly', { pages })}</p>
        )}

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
          {t('sessionNote')}
          <textarea
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('sessionNotePlaceholder')}
            className="resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
          />
        </label>

        {end > currentPage && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={updateProgress}
              onChange={(e) => setUpdateProgress(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-subtle)]"
            />
            {t('sessionUpdateProgress')}
          </label>
        )}

        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

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
            {busy ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
