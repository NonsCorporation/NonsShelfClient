'use client'

import { useCallback, useEffect, useState } from 'react'
import { IoAddOutline, IoTimerOutline, IoTrashOutline } from 'react-icons/io5'
import { libraryService } from '@/services/libraryService'
import { readingService, type ReadingSession } from '@/services/readingService'
import type { MediaItem } from '@/types'
import { useLanguage } from '@/contexts/LanguageContext'
import LogSessionModal from '@/components/reading/LogSessionModal'

const SHOWN = 5

function formatDay(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Per-book list of logged reading sessions with a "Log session" action. Always
// offers the action for a book being read; stays hidden otherwise until there is
// at least one session to show.
export default function ReadingSessions({
  item,
  active,
  refreshKey = 0,
  onChanged,
}: {
  item: MediaItem
  /** The book is currently being read (shelf status "active"). */
  active: boolean
  refreshKey?: number
  /** A session (and maybe a progress update) was saved or removed. */
  onChanged?: () => void
}) {
  const { t } = useLanguage()
  const [sessions, setSessions] = useState<ReadingSession[] | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  // 'new' = logging; a session = editing it; null = closed.
  const [editor, setEditor] = useState<ReadingSession | 'new' | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    readingService.listSessions({ mediaId: item.id, limit: 100 }).then((rows) => {
      if (!cancelled) setSessions(rows)
    })
    libraryService.getProgress(item.id).then((rows) => {
      if (!cancelled) setCurrentPage(rows[0]?.page ?? 0)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [item.id, refreshKey, tick])

  const remove = useCallback(async (id: number) => {
    setSessions((rows) => rows?.filter((s) => s.id !== id) ?? rows)
    if (await readingService.deleteSession(id)) onChanged?.()
    else setTick((n) => n + 1) // roll the optimistic removal back
  }, [onChanged])

  if (!sessions || (sessions.length === 0 && !active)) return null

  const rows = showAll ? sessions : sessions.slice(0, SHOWN)

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          <IoTimerOutline className="h-3.5 w-3.5" />
          {t('readingSessions')}
        </span>
        {active && (
          <button
            type="button"
            onClick={() => setEditor('new')}
            className="flex h-9 items-center gap-1 rounded-lg bg-[var(--primary-soft)] px-3 text-xs font-medium text-nonsprimary hover:bg-[var(--primary-ring)]"
          >
            <IoAddOutline className="h-3.5 w-3.5" />
            {t('logSession')}
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">{t('noSessionsYet')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
          {rows.map((s) => (
            <li key={s.id} className="flex items-center gap-1 py-0.5 text-xs">
              <button
                type="button"
                onClick={() => setEditor(s)}
                aria-label={`${t('editSession')}: ${formatDay(s.session_date)}`}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left hover:bg-[var(--surface-hover)]"
              >
                <span className="w-14 flex-shrink-0 text-[var(--text-muted)]">{formatDay(s.session_date)}</span>
                <span className="min-w-0 flex-1 truncate text-[var(--text)]">
                  {s.pages > 0 && s.minutes > 0
                    ? t('sessionPagesMinutes', { pages: s.pages, minutes: s.minutes })
                    : s.pages > 0
                      ? t('sessionPagesOnly', { pages: s.pages })
                      : t('sessionMinutesOnly', { minutes: s.minutes })}
                  {s.note && <span className="ml-2 text-[var(--text-muted)]">· {s.note}</span>}
                </span>
              </button>
              <button
                type="button"
                onClick={() => remove(s.id)}
                aria-label={t('deleteSession')}
                title={t('deleteSession')}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-red-500"
              >
                <IoTrashOutline className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {sessions.length > SHOWN && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-xs font-medium text-[var(--text-muted)] hover:text-nonsprimary"
        >
          {showAll ? t('showLess') : t('showAll')}
        </button>
      )}

      <LogSessionModal
        isOpen={editor !== null}
        item={item}
        currentPage={currentPage}
        session={editor && editor !== 'new' ? editor : null}
        onClose={() => setEditor(null)}
        onLogged={() => { setTick((n) => n + 1); onChanged?.() }}
      />
    </div>
  )
}
