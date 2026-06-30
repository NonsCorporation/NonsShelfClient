'use client'

import { useState } from 'react'
import { IoCalendarOutline } from 'react-icons/io5'
import { libraryService } from '../services/libraryService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import DatePicker from './DatePicker'

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

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
        <IoCalendarOutline className="h-3.5 w-3.5" />
        {isBook ? t('readingDates') : t('watchingDates')}
        {saving && <span className="ml-auto normal-case tracking-normal">{t('saving')}</span>}
      </div>
      <div className="flex flex-col gap-2">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            {isBook ? t('dateStarted') : t('dateStartedWatching')}
          </p>
          <DatePicker
            value={started}
            onChange={onStarted}
            max={finished || undefined}
            placeholder="—"
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            {isBook ? t('dateFinished') : t('dateFinishedWatching')}
          </p>
          <DatePicker
            value={finished}
            onChange={onFinished}
            min={started || undefined}
            placeholder="—"
          />
        </div>
      </div>
    </div>
  )
}
