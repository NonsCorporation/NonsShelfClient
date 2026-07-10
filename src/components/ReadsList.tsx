'use client'

import { useEffect, useState } from 'react'
import { IoCheckmarkDoneOutline, IoCloseCircleOutline, IoTimeOutline, IoBookmarksOutline } from 'react-icons/io5'
import { libraryService, type ReadCycle, type ReadOutcome } from '../services/libraryService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'

// unix seconds → short localized date, or '' when unset.
function shortDate(unix: number): string {
  if (!unix) return ''
  const d = new Date(unix * 1000)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const OUTCOME_META: Record<ReadOutcome, { color: string; icon: typeof IoTimeOutline }> = {
  finished: { color: '#3ec98a', icon: IoCheckmarkDoneOutline },
  dnf: { color: '#647da3', icon: IoCloseCircleOutline },
  reading: { color: '#f5a623', icon: IoTimeOutline },
}

// "Your reads": each read/reread of an item as its own cycle — dates + outcome
// (finished / did not finish / reading now). Derived from the activity log by
// the backend (GET /api/activity/read-cycles), so it stays in step with the
// timeline below. Renders nothing until there's at least one cycle.
export default function ReadsList({ item, refreshKey = 0 }: { item: MediaItem; refreshKey?: number }) {
  const { t } = useLanguage()
  const [cycles, setCycles] = useState<ReadCycle[] | null>(null)
  const isBook = item.type === 'book'

  useEffect(() => {
    let cancelled = false
    libraryService.getReadCycles(item.id).then((rows) => {
      if (!cancelled) setCycles(rows)
    })
    return () => { cancelled = true }
  }, [item.id, refreshKey])

  if (!cycles || cycles.length === 0) return null

  const finishedCount = cycles.filter((c) => c.outcome === 'finished').length

  // The line label for one cycle: "Read", "Reread N", "Attempt N (DNF)",
  // "Reading now" — numbered by chronological index so it reads like a journey.
  const cycleLabel = (c: ReadCycle): string => {
    if (c.outcome === 'reading') return t('readingNow')
    if (c.outcome === 'dnf') return t('readAttempt', { n: c.index })
    // finished
    if (c.index === 1) return isBook ? t('readOnce') : t('watchedOnce')
    return isBook ? t('rereadN', { n: c.index }) : t('rewatchN', { n: c.index })
  }

  const dateRange = (c: ReadCycle): string => {
    const start = shortDate(c.started_at)
    const end = shortDate(c.ended_at)
    if (start && end) return `${start} – ${end}`
    if (end) return end
    if (start) return `${t('since')} ${start}`
    return ''
  }

  // Newest read first — the current/most recent cycle leads.
  const ordered = [...cycles].reverse()

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
        <IoBookmarksOutline className="h-3.5 w-3.5" />
        {t('yourReads')}
        {finishedCount > 1 && (
          <span className="ml-auto rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-nonsprimary">
            {isBook ? t('readNTimes', { n: finishedCount }) : t('watchedNTimes', { n: finishedCount })}
          </span>
        )}
      </div>

      <ol className="flex flex-col gap-2">
        {ordered.map((c) => {
          const meta = OUTCOME_META[c.outcome]
          const Icon = meta.icon
          const range = dateRange(c)
          return (
            <li key={c.index} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--text)]">{cycleLabel(c)}</span>
                  {range && <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">{range}</span>}
                </div>
                {c.note && <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{c.note}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
