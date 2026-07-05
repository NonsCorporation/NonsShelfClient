// Recap: turn the user's finished items into period statistics for the
// statistics dashboard and the shareable "story" cards. Everything here is a
// pure function over MediaItem[] — no network — so any period (a month, a span
// of months, a year, or a custom date range) is just a [from, to) unix window.
import type { MediaItem, MediaType } from '../types'

/** Inclusive-start, exclusive-end window in unix seconds. */
export type Period = { from: number; to: number }

export type AuthorCount = {
  name: string
  count: number
  /** Public uuid of the author, for linking to /p/<uuid> when known. */
  makerUuid?: string
  covers: string[]
}

export type Recap = {
  from: number
  to: number
  /** Items finished within the period, sorted by finish date ascending. */
  items: MediaItem[]
  counts: { total: number; books: number; movies: number; series: number }
  /** Total pages across finished books. */
  pages: number
  /** Estimated total minutes spent (books via pages, films/series via runtime). */
  minutes: number
  /** Average rating on a 0–5 scale (half-star ratings are stored 1–10). */
  avgRating: number
  ratedCount: number
  /** Rating histogram, indexed 1..10 (index 0 unused). */
  ratingCounts: number[]
  /** Highest-rated finished items, best first (max 5). */
  topRated: MediaItem[]
  /** Most-read authors within the period, most first (books only, or all if no books). */
  authors: AuthorCount[]
  /** Finished count per calendar month within the period, chronological. */
  byMonth: { key: string; label: string; count: number }[]
  longestBook?: MediaItem
  firstFinished?: MediaItem
  lastFinished?: MediaItem
}

function toUnix(iso?: string): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : Math.floor(t / 1000)
}

// Rough time estimate: ~1.5 min per book page (≈40 pages/hour); films/series
// use their runtime when parseable, else a genre-agnostic average.
function estMinutes(i: MediaItem): number {
  if (i.type === 'book') return Math.round((i.pages || 0) * 1.5)
  const d = i.duration || ''
  const h = /(\d+)\s*h/i.exec(d)
  const m = /(\d+)\s*m/i.exec(d)
  if (h || m) return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0)
  const n = parseInt(d, 10)
  if (!Number.isNaN(n)) return n
  return i.type === 'series' ? 45 : 115
}

/** Finished items within [p.from, p.to), sorted by finish date ascending. */
export function finishedIn(all: MediaItem[], p: Period): MediaItem[] {
  return all
    .map((i) => ({ i, f: toUnix(i.finishedAt) }))
    .filter((x): x is { i: MediaItem; f: number } => x.f !== null && x.f >= p.from && x.f < p.to)
    .sort((a, b) => a.f - b.f)
    .map((x) => x.i)
}

export function buildRecap(all: MediaItem[], p: Period): Recap {
  const items = finishedIn(all, p)
  const of = (type: MediaType) => items.filter((i) => i.type === type)

  const rated = items.filter((i) => typeof i.rating === 'number' && i.rating! > 0)
  const ratingCounts = Array(11).fill(0) as number[]
  rated.forEach((i) => ratingCounts[i.rating!]++)

  // Most-read authors: books first (what "most read author" conventionally
  // means); fall back to every finished item's byline if the period has no books.
  const authorPool = of('book').length ? of('book') : items
  const authorMap = new Map<string, AuthorCount>()
  for (const i of authorPool) {
    const name = (i.author || '').trim()
    if (!name) continue
    const a = authorMap.get(name) || { name, count: 0, makerUuid: i.makerUuid, covers: [] }
    a.count++
    if (i.coverUrl && a.covers.length < 4) a.covers.push(i.coverUrl)
    if (!a.makerUuid && i.makerUuid) a.makerUuid = i.makerUuid
    authorMap.set(name, a)
  }
  const authors = [...authorMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  // Finished-per-month buckets across the period (only months with activity).
  const monthMap = new Map<string, number>()
  for (const i of items) {
    const f = toUnix(i.finishedAt)!
    const d = new Date(f * 1000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(key, (monthMap.get(key) || 0) + 1)
  }
  const byMonth = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => {
      const [y, m] = key.split('-').map(Number)
      const label = new Date(y, m - 1, 1).toLocaleString('en', { month: 'short', year: '2-digit' })
      return { key, label, count }
    })

  const books = of('book')
  const longestBook = books.reduce<MediaItem | undefined>(
    (best, i) => ((i.pages || 0) > (best?.pages || 0) ? i : best),
    undefined,
  )

  return {
    from: p.from,
    to: p.to,
    items,
    counts: { total: items.length, books: books.length, movies: of('movie').length, series: of('series').length },
    pages: books.reduce((s, i) => s + (i.pages || 0), 0),
    minutes: items.reduce((s, i) => s + estMinutes(i), 0),
    avgRating: rated.length ? rated.reduce((s, i) => s + (i.rating || 0), 0) / rated.length / 2 : 0,
    ratedCount: rated.length,
    ratingCounts,
    topRated: [...rated].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5),
    authors,
    byMonth,
    longestBook: longestBook && longestBook.pages ? longestBook : undefined,
    firstFinished: items[0],
    lastFinished: items[items.length - 1],
  }
}

/** "3,120" → grouped thousands for the current locale. */
export function fmtInt(n: number, locale = 'en-US'): string {
  return n.toLocaleString(locale)
}

/** Minutes → "42h" or "1d 6h" for compact display. */
export function fmtDuration(min: number): string {
  const h = Math.round(min / 60)
  if (h < 48) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}
