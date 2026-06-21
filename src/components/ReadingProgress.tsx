'use client'

import { useEffect, useState } from 'react'
import { IoStatsChartOutline } from 'react-icons/io5'
import { libraryService, type ProgressEntry } from '../services/libraryService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'

// unix seconds → "DD.MM.YYYY"
function formatDMY(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
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

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
        <IoStatsChartOutline className="h-3.5 w-3.5" />
        {t('readingProgress')}
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

      {/* Dated history of updates — scrolls if it gets long. */}
      <ul className="-mr-1 flex max-h-44 flex-col gap-1.5 overflow-y-auto pr-1">
        {entries.map((e, i) => {
          const pct = pctFor(e, total)
          return (
            <li key={`${e.event_date}-${i}`} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[var(--text-muted)]">{formatDMY(e.event_date)}</span>
              <span className="flex items-center gap-1.5 text-right">
                {e.page > 0 && <span className="font-medium text-[var(--text)]">{t('pagesCount', { count: e.page })}</span>}
                {pct > 0 && <span className="text-[var(--text-muted)]">({pct}%)</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
