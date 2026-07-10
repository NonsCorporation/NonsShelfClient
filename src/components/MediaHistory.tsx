'use client'

import { useEffect, useState } from 'react'
import type { IconType } from 'react-icons'
import {
  IoTimeOutline,
  IoBookmarkOutline,
  IoPlayOutline,
  IoCheckmarkDoneOutline,
  IoCloseCircleOutline,
  IoStar,
  IoChatbubbleOutline,
  IoStatsChartOutline,
} from 'react-icons/io5'
import { libraryService, type HistoryEvent, type HistoryKind } from '../services/libraryService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'

// unix seconds → short localized date.
function formatDate(unix: number): string {
  const d = new Date(unix * 1000)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const ICON: Record<HistoryKind, IconType> = {
  added: IoBookmarkOutline,
  started: IoPlayOutline,
  progress: IoStatsChartOutline,
  finished: IoCheckmarkDoneOutline,
  dnf: IoCloseCircleOutline,
  rated: IoStar,
  reviewed: IoChatbubbleOutline,
}

// A media item's interaction timeline (Goodreads-style): added → started →
// progress updates → finished → rated/reviewed, newest first. Backed by the
// activity log; renders nothing until there's at least one event.
export default function MediaHistory({ item, refreshKey = 0 }: { item: MediaItem; refreshKey?: number }) {
  const { t } = useLanguage()
  const [events, setEvents] = useState<HistoryEvent[] | null>(null)

  useEffect(() => {
    let cancelled = false
    libraryService.getHistory(item.id).then((rows) => {
      if (cancelled) return
      // For overwrite-style events (rated, reviewed) keep only the latest
      // occurrence — events arrive newest-first so the first seen wins.
      const seen = new Set<string>()
      const deduped = rows.filter((e) => {
        if (e.type !== 'rated' && e.type !== 'reviewed') return true
        if (seen.has(e.type)) return false
        seen.add(e.type)
        return true
      })
      setEvents(deduped)
    })
    return () => {
      cancelled = true
    }
  }, [item.id, refreshKey])

  if (!events || events.length === 0) return null

  const isBook = item.type === 'book'
  // events arrive newest-first; a 'finished' event's chronological ordinal
  // (1 = the first-ever finish) is its position counting from the *oldest*
  // finish, not from where it sits in this newest-first list.
  const totalFinishes = events.filter((e) => e.type === 'finished').length
  let finishesSeen = 0

  // Builds the human label + optional detail for one event.
  const describe = (e: HistoryEvent): { label: string; detail?: string } => {
    switch (e.type) {
      case 'added':
        return { label: t('histAdded') }
      case 'started':
        return { label: t('histStarted') }
      case 'finished': {
        finishesSeen += 1
        const ordinal = totalFinishes - finishesSeen + 1
        if (ordinal > 1) {
          return { label: isBook ? t('histFinishedReread', { n: ordinal }) : t('histFinishedRewatch', { n: ordinal }) }
        }
        return { label: t('histFinished') }
      }
      case 'dnf':
        return { label: t('didNotFinish') }
      case 'rated':
        return { label: t('histRated', { rating: ((e.value ?? 0) / 2).toFixed(1) }) }
      case 'reviewed':
        return { label: t('histReviewed'), detail: e.note || undefined }
      case 'progress': {
        const parts: string[] = []
        if (e.page) parts.push(t('pageN', { page: e.page }))
        if (e.progress_pct) parts.push(`${e.progress_pct}%`)
        if (e.note) parts.push(e.note)
        return { label: t('histProgress'), detail: parts.join(' · ') || undefined }
      }
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      {/* The summary count ("Read 2×") now lives in the ReadsList section
          above; this stays the granular event-by-event timeline. */}
      <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
        <IoTimeOutline className="h-3.5 w-3.5" />
        {t('historyTitle')}
      </div>

      <ol className="flex flex-col">
        {events.map((e, i) => {
          const Icon = ICON[e.type] ?? IoTimeOutline
          const { label, detail } = describe(e)
          const last = i === events.length - 1
          return (
            <li key={`${e.type}-${e.at}-${i}`} className="flex gap-3">
              {/* Rail: dot + connecting line */}
              <div className="flex flex-col items-center">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--container-2)] text-[var(--text-muted)]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {!last && <span className="w-px flex-1 bg-[var(--border-subtle)]" />}
              </div>
              <div className={`min-w-0 flex-1 ${last ? '' : 'pb-3'}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--text)]">{label}</span>
                  <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">{formatDate(e.at)}</span>
                </div>
                {detail && <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{detail}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
