import { useEffect, useState } from 'react'
import { IoClose } from 'react-icons/io5'
import StarsSelector from '../StarsSelector'
import { libraryService } from '../services/libraryService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'

type Props = {
  isOpen: boolean
  item: MediaItem | null
  onClose: () => void
  onFinished: () => void
}

// A unix-seconds / ISO value → "YYYY-MM-DD" for <input type="date">.
function toDateInput(v?: string | number): string {
  if (!v) return ''
  const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

const today = () => new Date().toISOString().slice(0, 10)

// The Goodreads-style "ending" modal: rate, review, set the dates and post. The
// "Post to Nons" checkbox is a disabled placeholder until cross-posting exists.
export default function FinishModal({ isOpen, item, onClose, onFinished }: Props) {
  const { t } = useLanguage()
  const [rating, setRating] = useState<number | null>(null)
  const [review, setReview] = useState('')
  const [started, setStarted] = useState('')
  const [finished, setFinished] = useState(today())
  const [share, setShare] = useState(true)
  const [busy, setBusy] = useState(false)

  // Pull the user's current rating/review + the started date when opening.
  useEffect(() => {
    if (!isOpen || !item) return
    setRating(item.rating ?? null)
    setReview('')
    setStarted(toDateInput(item.startedAt ?? item.dateAdded))
    setFinished(toDateInput(item.finishedAt) || today())
    let cancelled = false
    libraryService.getItem(item.id).then((full) => {
      if (cancelled || !full) return
      setRating(full.rating ?? null)
      setReview(full.review ?? '')
      setStarted(toDateInput(full.startedAt ?? full.dateAdded))
      if (full.finishedAt) setFinished(toDateInput(full.finishedAt))
    })
    return () => {
      cancelled = true
    }
  }, [isOpen, item])

  if (!isOpen || !item) return null

  const isBook = item.type === 'book'
  const finishedLabel = isBook ? t('dateRead') || 'Date read' : t('dateWatched') || 'Date watched'

  const post = async () => {
    setBusy(true)
    try {
      const finishedAt = finished ? Math.floor(new Date(finished).getTime() / 1000) : undefined
      await libraryService.finish(item.id, { rating, review, finishedAt, share })
      // Persist the chosen started/finished dates as the authoritative reading
      // period (so they match what shows on the media page and the calendar).
      await libraryService.setReadDates(item.id, {
        started_at: started ? Math.floor(new Date(started).getTime() / 1000) : 0,
        finished_at: finishedAt ?? 0,
      })
      onFinished()
    } finally {
      setBusy(false)
    }
  }

  const dateInput =
    'h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] disabled:opacity-60'

  return (
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
              <h3 className="text-lg font-semibold leading-tight tracking-wide text-[var(--text)]">{item.title}</h3>
              <p className="text-sm text-[var(--text-muted)]">{item.author}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--text)]">{t('rating') || 'Rating'}</span>
          <StarsSelector initialValue={rating} onChange={setRating} isEditable />
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
          {t('yourReview') || 'Review'}
          <textarea
            rows={4}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder={t('reviewPlaceholder', { type: isBook ? t('book').toLowerCase() : t('film').toLowerCase() })}
            className="resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('dateStarted') || 'Date started'}
            <input type="date" value={started} onChange={(e) => setStarted(e.target.value)} className={dateInput} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {finishedLabel}
            <input type="date" value={finished} onChange={(e) => setFinished(e.target.value)} className={dateInput} />
          </label>
        </div>

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
            onClick={post}
            disabled={busy}
            className="h-10 rounded-lg bg-nonsprimary px-6 text-sm font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
          >
            {busy ? t('saving') || 'Saving…' : t('post') || 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}
