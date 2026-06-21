'use client'

import { useState } from 'react'
import { IoCalendarOutline } from 'react-icons/io5'
import { libraryService } from '../services/libraryService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'

// A unix-seconds / ISO value → "YYYY-MM-DD" for <input type="date">.
function toDateInput(v?: string | number): string {
  if (!v) return ''
  const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

// "YYYY-MM-DD" → unix seconds (0 when empty/invalid).
function toUnix(v: string): number {
  if (!v) return 0
  const t = new Date(v).getTime()
  return isNaN(t) ? 0 : Math.floor(t / 1000)
}

// Editable "I started/finished this on…" relationship for an item on the shelf.
// Persists to the per-user reading dates (the same started/finished events the
// calendar draws), so changes here move the reading span too.
export default function ReadingDates({ item, onSaved }: { item: MediaItem; onSaved?: () => void }) {
  const { t } = useLanguage()
  const isBook = item.type === 'book'
  // Initialised from the item's dates. The parent keys this component on those
  // dates, so it re-mounts (re-initialising) whenever freshly-loaded signals
  // change them — no prop-syncing effect needed.
  const [started, setStarted] = useState(toDateInput(item.startedAt))
  const [finished, setFinished] = useState(toDateInput(item.finishedAt))
  const [saving, setSaving] = useState(false)

  const save = async (nextStarted: string, nextFinished: string) => {
    setSaving(true)
    try {
      await libraryService.setReadDates(item.id, { started_at: toUnix(nextStarted), finished_at: toUnix(nextFinished) })
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const onStarted = (v: string) => { setStarted(v); save(v, finished) }
  const onFinished = (v: string) => { setFinished(v); save(started, v) }

  const dateInput =
    'h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
        <IoCalendarOutline className="h-3.5 w-3.5" />
        {isBook ? t('readingDates') : t('watchingDates')}
        {saving && <span className="ml-auto normal-case tracking-normal text-[var(--text-muted)]">{t('saving')}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-[var(--text-muted)]">
          {isBook ? t('dateStarted') : t('dateStartedWatching')}
          <input type="date" max={finished || undefined} value={started} onChange={(e) => onStarted(e.target.value)} className={dateInput} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-[var(--text-muted)]">
          {isBook ? t('dateFinished') : t('dateFinishedWatching')}
          <input type="date" min={started || undefined} value={finished} onChange={(e) => onFinished(e.target.value)} className={dateInput} />
        </label>
      </div>
    </div>
  )
}
