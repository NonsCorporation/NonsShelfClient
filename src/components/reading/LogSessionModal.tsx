'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IoClose } from 'react-icons/io5'
import { readingService, type ReadingSession } from '@/services/readingService'
import { libraryService } from '@/services/libraryService'
import type { MediaItem } from '@/types'
import { useLanguage } from '@/contexts/LanguageContext'
import DatePicker from '@/components/ui/DatePicker'

type Props = {
  isOpen: boolean
  item: MediaItem | null
  /** Where the reader is now; prefills "from page". */
  currentPage?: number
  /** Edit this session instead of logging a new one. */
  session?: ReadingSession | null
  onClose: () => void
  /** Called after a session (and optional progress update) was saved. */
  onLogged: () => void
}

const pad = (n: number) => String(n).padStart(2, '0')
const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const today = () => toDay(new Date())
const yesterday = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toDay(d)
}

// "YYYY-MM-DD" (local) → unix seconds at noon local time, so the day stays the
// same in the server's timezone bucketing whichever side of midnight it lands.
// Today is capped at "now" so a session is never dated in the future.
const dayToUnix = (day: string): number | undefined => {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return Math.min(Math.floor(new Date(y, m - 1, d, 12).getTime() / 1000), Math.floor(Date.now() / 1000))
}

const num = (s: string): number => {
  const n = Math.floor(Number(s))
  return Number.isFinite(n) && n > 0 ? n : 0
}

const MINUTE_CHIPS = [15, 30, 45, 60]

// "Log reading session": a timed sitting with a book — pages and/or minutes,
// optionally backdated. Feeds the reading streak and yearly totals; can also
// move the book's progress forward to the end page. Doubles as the editor for an
// existing session. A bottom sheet on phones, a centred dialog on larger screens.
export default function LogSessionModal(props: Props) {
  // The form mounts fresh each time the modal opens, so its fields start from
  // the initial values below without a reset effect.
  if (!props.isOpen || !props.item) return null
  return <SessionForm {...props} item={props.item} />
}

function SessionForm({ item, currentPage = 0, session, onClose, onLogged }: Omit<Props, 'isOpen' | 'item'> & { item: MediaItem }) {
  const { t } = useLanguage()
  const editing = !!session
  const [startPage, setStartPage] = useState(
    session ? (session.start_page ? String(session.start_page) : '') : currentPage > 0 ? String(currentPage) : '',
  )
  const [endPage, setEndPage] = useState(session?.end_page ? String(session.end_page) : '')
  // A session logged without a page range stores plain pages; surface it as the
  // range-less "pages read" so editing it doesn't lose the number.
  const [loosePages, setLoosePages] = useState(
    session && !(session.start_page && session.end_page) && session.pages > 0 ? String(session.pages) : '',
  )
  const [minutes, setMinutes] = useState(session?.minutes ? String(session.minutes) : '')
  const initialDay = session ? toDay(new Date(session.session_date * 1000)) : today()
  const [date, setDate] = useState(initialDay)
  const [note, setNote] = useState(session?.note ?? '')
  const [updateProgress, setUpdateProgress] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const start = num(startPage)
  const end = num(endPage)
  const hasRange = start > 0 && end > 0
  const pages = hasRange ? end - start : num(loosePages)
  const mins = num(minutes)
  const canSave = (pages > 0 || mins > 0) && !(hasRange && end < start)

  const submit = async () => {
    if (hasRange && end < start) { setError(t('sessionEndBeforeStart')); return }
    if (pages === 0 && mins === 0) { setError(t('sessionNeedsValue')); return }
    setBusy(true)
    setError('')
    const body = {
      startPage: hasRange ? start : undefined,
      endPage: hasRange ? end : undefined,
      pages: hasRange ? undefined : pages || undefined,
      minutes: mins || undefined,
      note: note.trim() || undefined,
      // Editing without touching the date keeps the exact stored timestamp.
      sessionDate: editing && date === initialDay ? undefined : dayToUnix(date),
    }
    try {
      if (session) await readingService.updateSession(session.id, body)
      else await readingService.logSession({ mediaId: item.id, ...body })
      if (!editing && updateProgress && end > currentPage) {
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

  // 16px text on inputs: anything smaller makes iOS Safari zoom the page on focus.
  const inputCls =
    'h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-base text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'
  const labelCls = 'flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]'
  const chip = (on: boolean) =>
    `h-10 flex-shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
      on
        ? 'border-nonsprimary bg-[var(--primary-soft)] text-nonsprimary'
        : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] active:bg-[var(--surface-hover)]'
    }`

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--overlay)] sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? t('editSession') : t('logSession')}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-[var(--container)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl"
      >
        <div aria-hidden className="mx-auto -mt-2 h-1 w-10 flex-shrink-0 rounded-full bg-[var(--border)] sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {item.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.coverUrl} alt="" className="h-14 w-10 flex-shrink-0 rounded object-cover" />
            ) : (
              <div className="h-14 w-10 flex-shrink-0 rounded bg-[var(--container-2)]" />
            )}
            <div className="min-w-0">
              <h3 className="text-lg font-semibold leading-tight tracking-wide text-[var(--text)]">
                {editing ? t('editSession') : t('logSession')}
              </h3>
              <p className="truncate text-sm text-[var(--text-muted)]">{item.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('cancel')}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        {/* When — quick chips for the common backdates, a calendar for the rest. */}
        <div className={labelCls}>
          {t('sessionDate')}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setDate(today())} className={chip(date === today())}>
              {t('today')}
            </button>
            <button type="button" onClick={() => setDate(yesterday())} className={chip(date === yesterday())}>
              {t('sessionYesterday')}
            </button>
            <div className="min-w-[11rem] flex-1">
              <DatePicker value={date} onChange={setDate} max={today()} placeholder={t('sessionOtherDay')} centered />
            </div>
          </div>
        </div>

        {/* How much */}
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            {t('sessionStartPage')}
            <input type="number" inputMode="numeric" min={0} value={startPage} onChange={(e) => setStartPage(e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            {t('sessionEndPage')}
            <input type="number" inputMode="numeric" min={0} value={endPage} onChange={(e) => setEndPage(e.target.value)} className={inputCls} />
          </label>
        </div>
        {/* No page numbers (audiobook, away from the book): log plain pages read. */}
        {!start && !end && (
          <label className={labelCls}>
            {t('sessionPages')}
            <input type="number" inputMode="numeric" min={0} value={loosePages} onChange={(e) => setLoosePages(e.target.value)} className={inputCls} />
          </label>
        )}
        {hasRange && pages > 0 && (
          <p className="-mt-2 text-sm font-medium text-nonsprimary">{t('sessionPagesOnly', { pages })}</p>
        )}

        <div className="flex flex-col gap-2">
          <label className={labelCls}>
            {t('sessionMinutes')}
            <input type="number" inputMode="numeric" min={0} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={inputCls} />
          </label>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {MINUTE_CHIPS.map((m) => (
              <button key={m} type="button" onClick={() => setMinutes(String(m))} className={chip(mins === m)}>
                {t('sessionMinutesOnly', { minutes: m })}
              </button>
            ))}
          </div>
        </div>

        <label className={labelCls}>
          {t('sessionNote')}
          <textarea
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('sessionNotePlaceholder')}
            className="resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] p-3 text-base normal-case tracking-normal text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
          />
        </label>

        {!editing && end > currentPage && (
          <label className="flex cursor-pointer items-center gap-3 py-1 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={updateProgress}
              onChange={(e) => setUpdateProgress(e.target.checked)}
              className="h-5 w-5 rounded border-[var(--border-subtle)]"
            />
            {t('sessionUpdateProgress')}
          </label>
        )}

        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="h-12 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] sm:flex-none sm:px-6"
          >
            {t('cancel')}
          </button>
          <button
            onClick={submit}
            disabled={busy || !canSave}
            className="h-12 flex-[2] rounded-xl bg-nonsprimary text-sm font-semibold text-white hover:bg-nonsprimaryfocus disabled:opacity-50 sm:flex-none sm:px-8"
          >
            {busy ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
