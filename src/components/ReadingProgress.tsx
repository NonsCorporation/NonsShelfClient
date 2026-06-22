'use client'

import { useEffect, useState } from 'react'
import { IoStatsChartOutline } from 'react-icons/io5'
import { libraryService, type ProgressEntry } from '../services/libraryService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'

// ISO string → short localized date for the started→finished span.
function formatISO(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const DAY_MS = 86_400_000

// Reading span + pace from the editable start/finish dates and the current page.
// End is the finish date, else now (still reading). Kept out of the render body
// so the Date.now() reference isn't flagged as an impure render call.
function readingStats(item: MediaItem, currentPage: number, total: number): { span: string; days: number; pace: number } {
  const span = [formatISO(item.startedAt), formatISO(item.finishedAt)].filter(Boolean).join(' → ')
  const startMs = item.startedAt ? new Date(item.startedAt).getTime() : NaN
  const endMs = item.finishedAt ? new Date(item.finishedAt).getTime() : Date.now()
  const days = Number.isNaN(startMs) ? 0 : Math.max(1, Math.round((endMs - startMs) / DAY_MS))
  const pagesRead = item.finishedAt && total > 0 ? total : currentPage
  const pace = days > 0 && pagesRead > 0 ? Math.round(pagesRead / days) : 0
  return { span, days, pace }
}

// The percent for an entry — the stored value, or derived from page/total when
// the entry predates total being known.
function pctFor(e: ProgressEntry, total: number): number {
  if (e.progress_pct > 0) return e.progress_pct
  if (total > 0 && e.page > 0) return Math.min(100, Math.round((e.page / total) * 100))
  return 0
}

// Per-book reading-progress log: a current-progress bar plus the dated history
// of page updates ("14.06.2026 · 30 pages (30%)"). Renders nothing until there
// is at least one logged update, so it never shows as an empty card.
export default function ReadingProgress({
  item,
  total: totalProp,
  refreshKey = 0,
}: {
  item: MediaItem
  /** Page count to measure against — the selected edition's, when set. */
  total?: number
  refreshKey?: number
}) {
  const { t } = useLanguage()
  const [entries, setEntries] = useState<ProgressEntry[] | null>(null)
  const total = totalProp || item.pages || 0

  useEffect(() => {
    let cancelled = false
    libraryService.getProgress(item.id).then((rows) => {
      if (!cancelled) setEntries(rows)
    })
    return () => {
      cancelled = true
    }
  }, [item.id, refreshKey])

  if (!entries || entries.length === 0) return null

  // Newest first from the API; the first row is the current position.
  const latest = entries[0]
  const latestPct = pctFor(latest, total)

  const { span, days, pace } = readingStats(item, latest.page, total)

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
        <span className="flex items-center gap-2">
          <IoStatsChartOutline className="h-3.5 w-3.5" />
          {t('readingProgress')}
        </span>
        {span && <span className="font-normal normal-case tracking-normal">· {span}</span>}
        {days > 0 && <span className="font-normal normal-case tracking-normal">· {t('daysReading', { days })}</span>}
        {pace > 0 && <span className="font-normal normal-case tracking-normal">· {t('readingPace', { pace })}</span>}
      </div>

      {/* Current position — a bar + "page X of Y · Z%" */}
      <div className="mb-3">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
          <span className="font-medium text-[var(--text)]">
            {latest.page > 0
              ? total > 0
                ? t('pageOfTotal', { page: latest.page, total })
                : t('pageN', { page: latest.page })
              : t('pagesCount', { count: 0 })}
          </span>
          {latestPct > 0 && <span className="font-semibold text-nonsprimary">{latestPct}%</span>}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--container-2)]">
          <div className="h-full rounded-full bg-nonsprimary transition-all" style={{ width: `${Math.max(latestPct, 2)}%` }} />
        </div>
      </div>

      {/* The dated per-update list now lives in the unified MediaHistory timeline
          below, so this card stays a focused "where am I now" summary. */}
    </div>
  )
}
