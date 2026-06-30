'use client'

import { useState, useRef } from 'react'
import { IoCalendarOutline, IoClose } from 'react-icons/io5'
import { libraryService } from '../services/libraryService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'

function toDateInput(v?: string | number): string {
  if (!v) return ''
  const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function toUnix(v: string): number {
  if (!v) return 0
  const t = new Date(v).getTime()
  return isNaN(t) ? 0 : Math.floor(t / 1000)
}

function formatDate(iso: string): string {
  if (!iso) return ''
  // noon to avoid DST off-by-one on the day boundary
  return new Date(iso + 'T12:00:00').toLocaleDateString('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface DateRowProps {
  label: string
  value: string
  min?: string
  max?: string
  onChange: (v: string) => void
  onClear: () => void
  saving: boolean
}

function DateRow({ label, value, min, max, onChange, onClear, saving }: DateRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const openPicker = () => {
    const el = inputRef.current
    if (!el) return
    try {
      // showPicker() is the spec-compliant way; requires a user-gesture context
      ;(el as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
    } catch {
      el.click()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={(e) => e.key === 'Enter' && openPicker()}
      className="relative flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--container)] px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)] select-none"
    >
      <IoCalendarOutline className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
        <p className={`mt-0.5 text-sm font-medium ${value ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
          {value ? formatDate(value) : '—'}
        </p>
      </div>

      {value && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear() }}
          disabled={saving}
          aria-label="Clear date"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:opacity-40"
        >
          <IoClose className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Anchors the picker near this row — absolute within the relative container,
          full-width but 1 px tall at the bottom edge, invisible to the user. */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 1, opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  )
}

export default function ReadingDates({ item, onSaved }: { item: MediaItem; onSaved?: () => void }) {
  const { t } = useLanguage()
  const isBook = item.type === 'book'
  const [started, setStarted] = useState(toDateInput(item.startedAt))
  const [finished, setFinished] = useState(toDateInput(item.finishedAt))
  const [saving, setSaving] = useState(false)

  const save = async (nextStarted: string, nextFinished: string) => {
    setSaving(true)
    try {
      await libraryService.setReadDates(item.id, {
        started_at: toUnix(nextStarted),
        finished_at: toUnix(nextFinished),
      })
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const onStarted  = (v: string) => { setStarted(v);  save(v, finished) }
  const onFinished = (v: string) => { setFinished(v); save(started, v) }
  const clearStarted  = () => { setStarted('');  save('', finished) }
  const clearFinished = () => { setFinished(''); save(started, '') }

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
        <IoCalendarOutline className="h-3.5 w-3.5" />
        {isBook ? t('readingDates') : t('watchingDates')}
        {saving && <span className="ml-auto normal-case tracking-normal">{t('saving')}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <DateRow
          label={isBook ? t('dateStarted') : t('dateStartedWatching')}
          value={started}
          max={finished || undefined}
          onChange={onStarted}
          onClear={clearStarted}
          saving={saving}
        />
        <DateRow
          label={isBook ? t('dateFinished') : t('dateFinishedWatching')}
          value={finished}
          min={started || undefined}
          onChange={onFinished}
          onClear={clearFinished}
          saving={saving}
        />
      </div>
    </div>
  )
}
