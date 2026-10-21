import { authedFetch } from '../lib/api'

// Reading sessions, streaks and yearly totals (nons-library-server /api/reading).

export type ReadingSession = {
  id: number
  media_id: number
  start_page?: number
  end_page?: number
  pages: number
  minutes: number
  note?: string
  /** When the sitting happened, unix seconds. */
  session_date: number
}

export type LogSessionInput = {
  mediaId: string
  startPage?: number
  endPage?: number
  /** Used when no page range is given. */
  pages?: number
  minutes?: number
  note?: string
  /** Unix seconds; omitted = now. */
  sessionDate?: number
}

export type ReadingStreak = {
  current: number
  longest: number
  active_today: boolean
  last_active_day?: string
  /** Active days (YYYY-MM-DD) of the last 28, oldest first. */
  recent: string[]
}

export type ReadingSummary = {
  year: number
  sessions: number
  pages: number
  minutes: number
  active_days: number
  streak: ReadingStreak
}

// The server buckets days in the caller's zone, so send it with every streak/
// summary request.
const tzParam = (): string => {
  try {
    return `tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`
  } catch {
    return ''
  }
}

async function logSession(input: LogSessionInput): Promise<ReadingSession> {
  const res = await authedFetch('/api/reading/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_id: Number(input.mediaId),
      start_page: input.startPage ?? 0,
      end_page: input.endPage ?? 0,
      pages: input.pages ?? 0,
      minutes: input.minutes ?? 0,
      note: input.note ?? '',
      session_date: input.sessionDate ?? 0,
    }),
  })
  const data = await res.json().catch(() => ({}))
  // The server's validation message is user-facing ("end page cannot be before
  // start page"), so surface it as the error text.
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not save the session')
  return data as ReadingSession
}

/** Edit a session (fix numbers or backdate it). Omit sessionDate to keep the
 *  stored date. The book can't change. */
async function updateSession(id: number, input: Omit<LogSessionInput, 'mediaId'>): Promise<ReadingSession> {
  const res = await authedFetch(`/api/reading/sessions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_page: input.startPage ?? 0,
      end_page: input.endPage ?? 0,
      pages: input.pages ?? 0,
      minutes: input.minutes ?? 0,
      note: input.note ?? '',
      session_date: input.sessionDate ?? 0,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not save the session')
  return data as ReadingSession
}

async function listSessions(opts: { mediaId?: string; limit?: number } = {}): Promise<ReadingSession[]> {
  const q = new URLSearchParams()
  if (opts.mediaId) q.set('media_id', String(Number(opts.mediaId)))
  if (opts.limit) q.set('limit', String(opts.limit))
  const res = await authedFetch(`/api/reading/sessions?${q}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.items ?? []) as ReadingSession[]
}

async function deleteSession(id: number): Promise<boolean> {
  const res = await authedFetch(`/api/reading/sessions/${id}`, { method: 'DELETE' })
  return res.ok
}

async function getStreak(): Promise<ReadingStreak | null> {
  const res = await authedFetch(`/api/reading/streak?${tzParam()}`)
  return res.ok ? ((await res.json()) as ReadingStreak) : null
}

async function getSummary(year?: number): Promise<ReadingSummary | null> {
  const q = [tzParam(), year ? `year=${year}` : ''].filter(Boolean).join('&')
  const res = await authedFetch(`/api/reading/summary?${q}`)
  return res.ok ? ((await res.json()) as ReadingSummary) : null
}

export const readingService = { logSession, updateSession, listSessions, deleteSession, getStreak, getSummary }
