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
import { libraryService, type HistoryEvent, type HistoryKind } from '@/services/libraryService'
import type { MediaItem } from '@/types'
import { useLanguage } from '@/contexts/LanguageContext'

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

// Folds the several events one "finish" produces into a single timeline entry:
//  - the bookkeeping 100% progress row the finish flow logs (note 'finished')
//    is dropped — the finished event already says it;
//  - rated/reviewed are overwrite-style (events arrive newest-first, so the
//    first seen is the latest) and get merged into the newest finished entry,
//    which then shows the stars + review itself. With no finish yet (a rating
//    left mid-read) they stay as their own entries.
function collapseFinish(rows: HistoryEvent[]): HistoryEvent[] {
  const events = rows.filter((e) => !(e.type === 'progress' && e.note === 'finished'))
  const rated = events.find((e) => e.type === 'rated')
  const reviewed = events.find((e) => e.type === 'reviewed')
  const finishedIdx = events.findIndex((e) => e.type === 'finished')

  const out: HistoryEvent[] = []
  const seen = new Set<string>()
  events.forEach((e, i) => {
    if (e.type === 'rated' || e.type === 'reviewed') {
      if (seen.has(e.type)) return
      seen.add(e.type)
      if (finishedIdx !== -1) return // merged into the finished entry below
      out.push(e)
      return
    }
    if (i === finishedIdx) {
      out.push({ ...e, value: e.value || rated?.value, note: e.note || reviewed?.note })
      return
    }
    out.push(e)
  })
  return out
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
      setEvents(collapseFinish(rows))
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
  const describe = (e: HistoryEvent): { label: string; detail?: string; rating?: number } => {
    switch (e.type) {
      case 'added':
        return { label: t('histAdded') }
      case 'started':
        return { label: t('histStarted') }
      case 'finished': {
        finishesSeen += 1
        const ordinal = totalFinishes - finishesSeen + 1
        // A finish may carry the rating + review given with it (see collapseFinish).
        const extra = { detail: e.note || undefined, rating: e.value || undefined }
        if (ordinal > 1) {
          return { label: isBook ? t('histFinishedReread', { n: ordinal }) : t('histFinishedRewatch', { n: ordinal }), ...extra }
        }
        return { label: t('histFinished'), ...extra }
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
          const { label, detail, rating } = describe(e)
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
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-[var(--text)]">
                    {label}
                    {rating ? (
                      <span className="inline-flex items-center gap-0.5 text-xs text-[var(--text-muted)]">
                        <IoStar className="h-3 w-3" />
                        {(rating / 2).toFixed(1)}
                      </span>
                    ) : null}
                  </span>
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
