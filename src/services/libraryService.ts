import { authedFetch, nonsFetch } from '../lib/api'
import { toMediaItem as toItem, type BackendMedia, type Signals } from '../lib/mediaMap'
import type { MediaItem, MediaType, ShelfStatus } from '../types.ts'

// The user's library lives in nons-library-server, split across three resources
// that all reference a shared catalog row (media):
//   - shelf      -> which items the user added + their status (wishlist/active/done)
//   - favorites  -> which items the user liked
//   - ratings    -> the user's 1..10 score per item
// This service stitches those back into the flat MediaItem the UI works with.
// The component layer only knows ILibraryService, so this is a drop-in swap for
// the old localStorage mock.

/** Static, presentational metadata for each shelf status. */
export const SHELF_META: Record<ShelfStatus, { key: string; dot: string }> = {
  wishlist: { key: 'shelfWishlist', dot: '#6768ab' },
  active: { key: 'shelfActive', dot: '#f5a623' },
  done: { key: 'shelfDone', dot: '#3ec98a' },
  dnf: { key: 'shelfDNF', dot: '#647da3' },
}

// ── Backend wire types ──────────────────────────────────────────────────────
// BackendMedia, Signals and the toItem mapper live in ../lib/mediaMap so the
// Next.js server can reuse them for the public /b and /m pages.

type EditionRef = { id: number; title?: string; cover_url?: string; pages?: number; language?: string }
type ShelfEntry = { media_id: number; status: ShelfStatus; edition_id?: number; note?: string; created_at: number; finished_at?: number; collection_ids?: number[]; media?: BackendMedia; edition?: EditionRef }
type FavoriteEntry = { media_id: number; media?: BackendMedia }
type RatingEntry = { media_id: number; value: number; review?: string; updated_at?: number; media?: BackendMedia }

// One page of a user's ratings & reviews, for the profile section.
export interface ReviewsPage {
  items: MediaItem[]
  total: number
}

/** Parse a leading integer out of a duration string like "180 min" -> 180. */
function parseDuration(d?: string): number {
  if (!d) return 0
  const n = parseInt(d, 10)
  return Number.isNaN(n) ? 0 : n
}

/** Map a MediaItem (from the add/edit form) onto the backend catalog shape. */
function toMediaBody(item: Partial<MediaItem>) {
  const genres = Array.isArray(item.genre) ? item.genre.join(', ') : item.genre || ''
  return {
    type: item.type,
    title: item.title,
    original_title: item.titleEn || '',
    author: item.author || item.director || '',
    director: item.director || '',
    year: item.year || 0,
    genres,
    cover_url: item.coverUrl || '',
    description: item.description || '',
    pages: item.pages || 0,
    duration_min: parseDuration(item.duration),
    isbn: item.isbn || '',
  }
}

async function items<T>(res: Response): Promise<T[]> {
  if (!res.ok) return []
  const data = await res.json()
  return (data.items ?? []) as T[]
}

// Result of a library import (mirrors importer_service.Summary).
export interface ImportSummary {
  total: number
  created: number
  matched: number
  shelved: number
  rated: number
  skipped: number
}

// Live progress of a background import job (mirrors importer_service.ImportJob).
// A superset of ImportSummary, so it can be shown directly as the final result.
export interface ImportJob extends ImportSummary {
  id: string
  source: string
  processed: number
  status: 'running' | 'done' | 'error'
  error?: string
}

// Called with each progress snapshot while an import job runs.
export type ImportProgress = (job: ImportJob) => void

// One reading/watching progress update. `eventDate` is unix seconds (0 = now),
// so progress can be backdated like on Goodreads.
export interface ProgressUpdate {
  page?: number
  pct?: number
  note?: string
  eventDate?: number
  /** Post this update to the feed (default true). */
  share?: boolean
}

// The user's editable reading period for an item (unix seconds; 0 = unset).
export interface ReadDates {
  started_at: number
  finished_at: number
}

// One logged reading-progress update for a book (page/percent on a given day).
export interface ProgressEntry {
  page: number
  progress_pct: number
  note?: string
  event_date: number
}

// A reading span from GET /api/calendar — a book/film being read/watched from
// started_at to finished_at (unix seconds). finished_at 0/absent + ongoing=true
// means still in progress.
export interface ReadingSpan {
  media?: { id: number; uuid?: string; title: string; type: MediaType; cover_url: string }
  started_at: number
  finished_at?: number
  ongoing: boolean
}

export interface CalendarData {
  reading: ReadingSpan[]
}

// One entry in a media item's interaction timeline (GET /api/activity/history).
export type HistoryKind = 'added' | 'started' | 'progress' | 'finished' | 'dnf' | 'rated' | 'reviewed'
export interface HistoryEvent {
  type: HistoryKind
  value?: number // rated: 1..10
  progress_pct?: number
  page?: number
  note?: string // reviewed text / progress note
  at: number // unix seconds
}

// One derived read cycle (GET /api/activity/read-cycles) — a single attempt at
// a media item. `started_at`/`ended_at` are unix seconds (0 = unset/ongoing).
export type ReadOutcome = 'reading' | 'finished' | 'dnf'
export interface ReadCycle {
  index: number // 1-based, chronological (1 = first ever)
  started_at: number
  ended_at: number
  outcome: ReadOutcome
  note?: string // the dnf "why I stopped", when present
}

// What the DNF ("did not finish") modal collects.
export interface DNFOptions {
  endedAt?: number // unix seconds (0 = now)
  note?: string
  /** Post the abandonment to the feed (default true). */
  share?: boolean
}

// What the "ending" (finish) modal collects.
export interface FinishOptions {
  rating?: number | null
  review?: string
  finishedAt?: number // unix seconds
  /** Post the finish (and its rating/review) to the feed (default true). */
  share?: boolean
}

// What the "Post to Nons" cross-post collects — a real post title + body,
// distinct from the shelf review (which the FinishModal preview seeds it from
// but the user can edit before it's sent to nons-server).
export interface NonsPostOptions {
  title: string
  content: string
}

// Query for searchLibrary — mirrors nons-library-server's GET /api/shelf
// filters (status/type/collection/q/rated_only/reviewed_only/sort/dir) plus
// client-side pagination (page is zero-based, like getReviews).
export interface LibrarySearchQuery {
  status?: ShelfStatus
  type?: MediaType
  collectionId?: number
  query?: string
  ratedOnly?: boolean
  reviewedOnly?: boolean
  sort?: 'added' | 'rating' | 'title' | 'year' | 'finished'
  dir?: 'asc' | 'desc'
  page?: number
  perPage?: number
}

// One page of a server-filtered/sorted library search.
export interface LibraryPage {
  items: MediaItem[]
  total: number
}

export interface ILibraryService {
  getItems(): Promise<MediaItem[]>
  /** The signed-in user's shelf status for a set of media ids — only ids that
   *  are on their shelf are present in the returned map. A cheap, targeted read
   *  (one small query) for badging a results grid, instead of fetching the whole
   *  shelf via getItems(). Empty input ⇒ empty map, no request. */
  getStatuses(mediaIds: string[]): Promise<Map<string, ShelfStatus>>
  /** Another user's public library (shelf + ratings), for their profile page. */
  getUserItems(userId: number): Promise<MediaItem[]>
  /** One page of the signed-in user's shelf, filtered/sorted server-side —
   *  the search/pagination-capable alternative to getItems() (which always
   *  fetches everything for client-side filtering). Pass userId to search
   *  another user's public shelf instead of the caller's own. */
  searchLibrary(q?: LibrarySearchQuery, userId?: number): Promise<LibraryPage>
  /** Just the match count for a searchLibrary()-style query — a cheap `total`-only
   *  read (limit=1, item bodies discarded) for header stats that shouldn't force
   *  a full library fetch. */
  countLibrary(q?: Omit<LibrarySearchQuery, 'page' | 'perPage'>, userId?: number): Promise<number>
  /** Average of the signed-in user's own ratings (1..10 scale, halved to a
   *  /5 display value), formatted to one decimal, or '—' if they haven't
   *  rated anything. Powers Library's header stat card. */
  averageOwnRating(): Promise<string>
  /** One page of a user's rated-or-reviewed items, newest first. Pass the numeric
   *  user id for another user, or undefined for the signed-in user. `page` is
   *  zero-based. Powers the profile's paginated "Ratings & reviews" section. */
  getReviews(userId: number | undefined, page: number, perPage: number): Promise<ReviewsPage>
  getItem(id: string): Promise<MediaItem | undefined>
  /** The signed-in user's personal overlay (shelf/like/rating/review) on a
   *  catalog row — used to enrich the server-rendered public /b and /m pages
   *  after the page learns who's logged in. */
  getSignals(mediaId: string): Promise<Signals>
  addItem(item: Omit<MediaItem, 'id'> & { id?: string }): Promise<MediaItem>
  updateItem(id: string, updates: Partial<MediaItem>): Promise<MediaItem>
  /** Choose the book edition (printing) the user is reading; 0 clears it. */
  setEdition(mediaId: string, editionId: number): Promise<void>
  /** Save (or clear) the user's free-text review. Posts to the feed unless share is false. */
  setReview(mediaId: string, review: string, share?: boolean): Promise<void>
  /** Save (or clear) the user's private note for a shelf item. Never shared. */
  setNote(mediaId: string, note: string): Promise<void>
  /** The user's started/finished reading dates for an item (unix seconds; 0 = unset). */
  getReadDates(mediaId: string): Promise<ReadDates>
  /** Update the user's started/finished reading dates (0 clears a date). */
  setReadDates(mediaId: string, dates: ReadDates): Promise<void>
  /** Append a reading/watching progress event (book page or percent). */
  logProgress(mediaId: string, p: ProgressUpdate): Promise<void>
  /** The user's logged reading-progress updates for a book, newest first. */
  getProgress(mediaId: string): Promise<ProgressEntry[]>
  /** The user's full interaction timeline for a media item, newest first. */
  getHistory(mediaId: string): Promise<HistoryEvent[]>
  /** The user's derived read cycles for a media item (each read/reread as one
   *  cycle with its dates + outcome), oldest first. Powers the "Your reads" list. */
  getReadCycles(mediaId: string): Promise<ReadCycle[]>
  /** Reading/watching spans over [from, to] (unix seconds) for the calendar. */
  getCalendar(from: number, to: number): Promise<CalendarData>
  /** Watched/total episode counts for a series (lightweight). */
  getEpisodeStats(mediaId: string): Promise<{ watched: number; total: number }>
  /** Mark/unmark a series episode as watched. */
  setEpisodeWatched(episodeId: number, watched: boolean): Promise<void>
  /** Finish an item: shelf → done, save rating/review, log a (backdatable) finished event. */
  finish(mediaId: string, opts: FinishOptions): Promise<void>
  /** Abandon an item: shelf → dnf, log a dated (backdatable) dnf event with an
   *  optional "why I stopped" note. The mirror of finish(). */
  markDNF(mediaId: string, opts: DNFOptions): Promise<void>
  /** Cross-post a finished item to the main nons feed (a real post on
   *  nons-server/nons-client) mentioning it, independent of the shelf's own
   *  internal feed (`share` above). Throws if the post couldn't be created. */
  postToNons(item: { uuid?: string; type: MediaType }, opts: NonsPostOptions): Promise<void>
  deleteItem(id: string): Promise<void>
  /** Permanently delete the whole personal library (shelf, ratings, favorites, activity, feed posts). */
  wipeLibrary(): Promise<void>
  importGoodreads(file: File, onProgress?: ImportProgress): Promise<ImportJob>
  importBookDiary(file: File, onProgress?: ImportProgress): Promise<ImportJob>
  importBookDiaryDB(file: File, onProgress?: ImportProgress): Promise<ImportJob>
  importStoryGraph(file: File, onProgress?: ImportProgress): Promise<ImportJob>
  importLetterboxd(file: File, onProgress?: ImportProgress): Promise<ImportJob>
  importIMDb(file: File, onProgress?: ImportProgress): Promise<ImportJob>
}

class ApiLibraryService implements ILibraryService {
  // The library view is the user's shelf, enriched with their favorites and
  // ratings (both keyed by media id).
  async getStatuses(mediaIds: string[]): Promise<Map<string, ShelfStatus>> {
    const out = new Map<string, ShelfStatus>()
    const ids = mediaIds.map((id) => id.trim()).filter(Boolean)
    if (ids.length === 0) return out
    const res = await authedFetch(`/api/shelf/statuses?ids=${encodeURIComponent(ids.join(','))}`)
    if (!res.ok) return out
    const data: { statuses?: Record<string, ShelfStatus> } = await res.json()
    for (const [id, status] of Object.entries(data.statuses ?? {})) out.set(id, status)
    return out
  }

  async getItems(): Promise<MediaItem[]> {
    const [shelfRes, favRes, ratRes] = await Promise.all([
      authedFetch('/api/shelf'),
      authedFetch('/api/favorites'),
      authedFetch('/api/ratings'),
    ])
    const [shelf, favs, ratings] = await Promise.all([
      items<ShelfEntry>(shelfRes),
      items<FavoriteEntry>(favRes),
      items<RatingEntry>(ratRes),
    ])

    const favSet = new Set(favs.map((f) => f.media_id))
    const ratMap = new Map(ratings.map((r) => [r.media_id, r] as const))

    return shelf
      .filter((e) => e.media)
      .map((e) =>
        toItem(e.media!, {
          status: e.status,
          favorite: favSet.has(e.media_id),
          rating: ratMap.get(e.media_id)?.value,
          review: ratMap.get(e.media_id)?.review,
          note: e.note,
          createdAt: e.created_at,
          finishedAt: e.finished_at || undefined,
          editionId: e.edition_id,
          editionTitle: e.edition?.title,
          editionCover: e.edition?.cover_url,
          editionPages: e.edition?.pages,
          collectionIds: e.collection_ids,
        }),
      )
  }

  // Another user's public library: their shelf joined with their ratings (no
  // favorites — those stay private). Addressed by the shared numeric user id.
  async getUserItems(userId: number): Promise<MediaItem[]> {
    const [shelfRes, ratRes] = await Promise.all([
      authedFetch(`/api/users/${userId}/shelf`),
      authedFetch(`/api/users/${userId}/ratings`),
    ])
    const [shelf, ratings] = await Promise.all([
      items<ShelfEntry>(shelfRes),
      items<RatingEntry>(ratRes),
    ])
    const ratMap = new Map(ratings.map((r) => [r.media_id, r] as const))
    return shelf
      .filter((e) => e.media)
      .map((e) =>
        toItem(e.media!, {
          status: e.status,
          rating: ratMap.get(e.media_id)?.value,
          review: ratMap.get(e.media_id)?.review,
          createdAt: e.created_at,
          finishedAt: e.finished_at || undefined,
          editionTitle: e.edition?.title,
          editionCover: e.edition?.cover_url,
          editionPages: e.edition?.pages,
          collectionIds: e.collection_ids,
        }),
      )
  }

  // One page of a shelf (the signed-in user's own, or another user's public
  // one when userId is given), filtered/sorted server-side via nons-library-
  // server's GET /api/shelf query params. Favorites/ratings are still fetched
  // in full and joined client-side (same as getItems/getUserItems) since
  // those are separate resources the shelf endpoint doesn't return inline —
  // favorites in particular is normally small (only liked items), so fetching
  // it whole alongside one shelf page is cheap.
  async searchLibrary(q: LibrarySearchQuery = {}, userId?: number): Promise<LibraryPage> {
    const perPage = q.perPage ?? 25
    const params = new URLSearchParams({ limit: String(perPage), offset: String((q.page ?? 0) * perPage) })
    if (q.status) params.set('status', q.status)
    if (q.type) params.set('type', q.type)
    if (q.collectionId) params.set('collection_id', String(q.collectionId))
    if (q.query) params.set('q', q.query)
    if (q.ratedOnly) params.set('rated_only', '1')
    if (q.reviewedOnly) params.set('reviewed_only', '1')
    if (q.sort) params.set('sort', q.sort)
    if (q.dir) params.set('dir', q.dir)

    const shelfPath = userId ? `/api/users/${userId}/shelf?${params}` : `/api/shelf?${params}`
    const ratingsPath = userId ? `/api/users/${userId}/ratings` : '/api/ratings'
    const [shelfRes, favRes, ratRes] = await Promise.all([
      authedFetch(shelfPath),
      userId ? Promise.resolve(undefined) : authedFetch('/api/favorites'),
      authedFetch(ratingsPath),
    ])
    if (!shelfRes.ok) return { items: [], total: 0 }
    const shelfData: { items?: ShelfEntry[]; total?: number } = await shelfRes.json()
    const [favs, ratings] = await Promise.all([
      favRes ? items<FavoriteEntry>(favRes) : Promise.resolve([]),
      items<RatingEntry>(ratRes),
    ])
    const favSet = new Set(favs.map((f) => f.media_id))
    const ratMap = new Map(ratings.map((r) => [r.media_id, r] as const))

    const shelf = shelfData.items ?? []
    return {
      items: shelf
        .filter((e) => e.media)
        .map((e) =>
          toItem(e.media!, {
            status: e.status,
            favorite: favSet.has(e.media_id),
            rating: ratMap.get(e.media_id)?.value,
            review: ratMap.get(e.media_id)?.review,
            note: e.note,
            createdAt: e.created_at,
            finishedAt: e.finished_at || undefined,
            editionId: e.edition_id,
            editionTitle: e.edition?.title,
            editionCover: e.edition?.cover_url,
            editionPages: e.edition?.pages,
            collectionIds: e.collection_ids,
          }),
        ),
      total: shelfData.total ?? 0,
    }
  }

  // Just the total for a searchLibrary()-style query — limit=1 so the server
  // does the same filtered COUNT it would for a real page, but no favorites/
  // ratings join and no item bodies are fetched. Used for header stats that
  // need an accurate count (e.g. "Books: 42") without pulling the whole
  // library just to .length the result.
  async countLibrary(q: Omit<LibrarySearchQuery, 'page' | 'perPage'> = {}, userId?: number): Promise<number> {
    const params = new URLSearchParams({ limit: '1', offset: '0' })
    if (q.status) params.set('status', q.status)
    if (q.type) params.set('type', q.type)
    if (q.collectionId) params.set('collection_id', String(q.collectionId))
    if (q.query) params.set('q', q.query)
    if (q.ratedOnly) params.set('rated_only', '1')
    if (q.reviewedOnly) params.set('reviewed_only', '1')
    const path = userId ? `/api/users/${userId}/shelf?${params}` : `/api/shelf?${params}`
    try {
      const res = await authedFetch(path)
      if (!res.ok) return 0
      const data: { total?: number } = await res.json()
      return data.total ?? 0
    } catch {
      return 0
    }
  }

  async averageOwnRating(): Promise<string> {
    try {
      const res = await authedFetch('/api/ratings')
      if (!res.ok) return '—'
      const data: { items?: { value?: number }[] } = await res.json()
      const values = (data.items ?? []).map((r) => r.value ?? 0).filter((v) => v > 0)
      if (!values.length) return '—'
      return (values.reduce((s, v) => s + v, 0) / values.length / 2).toFixed(1)
    } catch {
      return '—'
    }
  }

  // One page of a user's ratings & reviews (rated or reviewed items), newest
  // first. undefined userId → the signed-in user's own; otherwise the public,
  // privacy-gated read of another user's. The rating's updated_at drives the
  // displayed date, matching the newest-first server ordering.
  async getReviews(userId: number | undefined, page: number, perPage: number): Promise<ReviewsPage> {
    const params = new URLSearchParams({ limit: String(perPage), offset: String(page * perPage) })
    const path = userId ? `/api/users/${userId}/reviews?${params}` : `/api/reviews?${params}`
    const res = await authedFetch(path)
    if (!res.ok) return { items: [], total: 0 }
    const data = await res.json()
    const entries = (data.items ?? []) as RatingEntry[]
    return {
      items: entries
        .filter((e) => e.media)
        .map((e) =>
          toItem(e.media!, {
            rating: e.value || undefined,
            review: e.review,
            createdAt: e.updated_at,
          }),
        ),
      total: data.total ?? 0,
    }
  }

  // `id` is either the numeric catalog id or the media uuid (from /b/<uuid>
  // and /m/<uuid> URLs) — the backend resolves both. The user's own signals
  // (rating/favorite/shelf) are keyed by the numeric id, so fetch the media
  // first to learn it.
  async getItem(id: string): Promise<MediaItem | undefined> {
    const mediaRes = await authedFetch(`/api/media/${id}`)
    if (!mediaRes.ok) return undefined
    const media: BackendMedia = await mediaRes.json()
    const mediaId = media.id

    const [ratRes, favRes, shelfRes, dates] = await Promise.all([
      authedFetch(`/api/media/${mediaId}/rating`),
      authedFetch(`/api/media/${mediaId}/favorite`),
      authedFetch('/api/shelf'),
      this.getReadDates(String(mediaId)),
    ])
    const summary = ratRes.ok ? await ratRes.json() : {}
    const rating = summary.own as number | undefined
    const review = summary.own_review as string | undefined
    const favorite = favRes.ok ? Boolean((await favRes.json()).liked) : false
    const entry = (await items<ShelfEntry>(shelfRes)).find((e) => e.media_id === mediaId)

    return toItem(media, {
      status: entry?.status,
      favorite,
      rating,
      review,
      note: entry?.note,
      createdAt: entry?.created_at,
      editionId: entry?.edition_id,
      // The chosen edition's cover/title/pages override the work's, so the page
      // shows the printing the user is reading.
      editionTitle: entry?.edition?.title,
      editionCover: entry?.edition?.cover_url,
      editionPages: entry?.edition?.pages,
      editionLanguage: entry?.edition?.language,
      startedAt: dates.started_at || undefined,
      finishedAt: dates.finished_at || undefined,
    })
  }

  // The signed-in user's personal overlay for one catalog row, keyed by numeric
  // media id. Mirrors the personal half of getItem, without re-fetching the
  // public catalog data (the server already rendered that).
  async getSignals(mediaId: string): Promise<Signals> {
    const numId = Number(mediaId)
    const [ratRes, favRes, shelfRes, dates] = await Promise.all([
      authedFetch(`/api/media/${numId}/rating`),
      authedFetch(`/api/media/${numId}/favorite`),
      authedFetch('/api/shelf'),
      this.getReadDates(mediaId),
    ])
    const summary = ratRes.ok ? await ratRes.json() : {}
    const favorite = favRes.ok ? Boolean((await favRes.json()).liked) : false
    const entry = (await items<ShelfEntry>(shelfRes)).find((e) => e.media_id === numId)
    return {
      status: entry?.status,
      favorite,
      rating: summary.own as number | undefined,
      review: summary.own_review as string | undefined,
      note: entry?.note,
      editionId: entry?.edition_id,
      // The chosen edition's own cover/title/pages, so the detail page can show
      // the printing the user is reading even when that edition isn't in the
      // first carousel page it loads.
      editionTitle: entry?.edition?.title,
      editionCover: entry?.edition?.cover_url,
      editionPages: entry?.edition?.pages,
      editionLanguage: entry?.edition?.language,
      createdAt: entry?.created_at,
      startedAt: dates.started_at || undefined,
      finishedAt: dates.finished_at || undefined,
    }
  }

  // The user's started/finished reading dates (unix seconds; 0 = unset). Backed
  // by the started/finished rows in the activity log, so they line up with the
  // calendar's reading spans.
  async getReadDates(mediaId: string): Promise<ReadDates> {
    const res = await authedFetch(`/api/activity/read-dates?media_id=${Number(mediaId)}`)
    if (!res.ok) return { started_at: 0, finished_at: 0 }
    const d = await res.json()
    return { started_at: d.started_at ?? 0, finished_at: d.finished_at ?? 0 }
  }

  // Update the user's reading period for an item (0 clears a date).
  async setReadDates(mediaId: string, dates: ReadDates): Promise<void> {
    await authedFetch('/api/activity/read-dates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_id: Number(mediaId), started_at: dates.started_at, finished_at: dates.finished_at }),
    })
  }

  // Save (or clear) the user's free-text review for a media item.
  async setReview(mediaId: string, review: string, share = true): Promise<void> {
    await authedFetch(`/api/media/${Number(mediaId)}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review, share }),
    })
  }

  async setNote(mediaId: string, note: string): Promise<void> {
    await authedFetch(`/api/shelf/${Number(mediaId)}/note`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
  }

  // Append a reading/watching progress event (book page and/or percent),
  // backdatable via eventDate. Powers the "update progress" modal + the calendar.
  async logProgress(mediaId: string, p: ProgressUpdate): Promise<void> {
    await authedFetch('/api/activity/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_id: Number(mediaId),
        page: p.page ?? 0,
        progress_pct: p.pct ?? 0,
        note: p.note ?? '',
        event_date: p.eventDate ?? 0,
        share: p.share ?? true,
      }),
    })
  }

  async getEpisodeStats(mediaId: string): Promise<{ watched: number; total: number }> {
    const res = await authedFetch(`/api/media/${Number(mediaId)}/episodes`)
    if (!res.ok) return { watched: 0, total: 0 }
    const data = await res.json()
    return { watched: data.watched_count ?? 0, total: data.total ?? 0 }
  }

  // The user's logged reading-progress updates for a book (newest first).
  async getProgress(mediaId: string): Promise<ProgressEntry[]> {
    const res = await authedFetch(`/api/activity/progress?media_id=${Number(mediaId)}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []) as ProgressEntry[]
  }

  // The user's full interaction timeline for a media item (newest first).
  async getHistory(mediaId: string): Promise<HistoryEvent[]> {
    const res = await authedFetch(`/api/activity/history?media_id=${Number(mediaId)}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []) as HistoryEvent[]
  }

  // The user's derived read cycles for a media item (oldest first).
  async getReadCycles(mediaId: string): Promise<ReadCycle[]> {
    const res = await authedFetch(`/api/activity/read-cycles?media_id=${Number(mediaId)}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.cycles ?? []) as ReadCycle[]
  }

  // Reading/watching spans over [from, to] (unix seconds) — started→finished
  // pairs from the activity log, for drawing multi-day spans on the calendar.
  async getCalendar(from: number, to: number): Promise<CalendarData> {
    const res = await authedFetch(`/api/calendar?from=${from}&to=${to}`)
    if (!res.ok) return { reading: [] }
    const data = await res.json()
    return { reading: (data.reading ?? []) as ReadingSpan[] }
  }

  // Mark/unmark a single series episode as watched.
  async setEpisodeWatched(episodeId: number, watched: boolean): Promise<void> {
    await authedFetch(`/api/episodes/${episodeId}/watch`, { method: watched ? 'PUT' : 'DELETE' })
  }

  // Finish an item: move the shelf entry to "done", save the rating/review, and
  // log a finished event (backdated to finishedAt) so the calendar is accurate.
  async finish(mediaId: string, opts: FinishOptions): Promise<void> {
    const id = Number(mediaId)
    const share = opts.share ?? true
    await authedFetch(`/api/shelf/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done', share }),
    })
    if (typeof opts.rating === 'number' && opts.rating > 0) await this.setRating(id, opts.rating, share)
    if (opts.review !== undefined && opts.review !== '') await this.setReview(mediaId, opts.review, share)
    if (opts.finishedAt) {
      // This progress row only carries the finished date — never its own post
      // (the shelf "finished" event above already represents the finish).
      await this.logProgress(mediaId, { pct: 100, eventDate: opts.finishedAt, note: 'finished', share: false })
    }
  }

  // Abandon an item: move the shelf entry to "dnf" and log a dated dnf event
  // with an optional "why I stopped" note — one backend call (the mirror of
  // finish(), which spans several because it also writes rating/review).
  async markDNF(mediaId: string, opts: DNFOptions): Promise<void> {
    await authedFetch(`/api/shelf/${Number(mediaId)}/dnf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_date: opts.endedAt ?? 0,
        note: opts.note ?? '',
        share: opts.share ?? true,
      }),
    })
  }

  // Cross-post to the main nons feed: creates a real post on nons-server
  // mentioning this item. Independent of finish()'s own `share` flag, which
  // only controls the library's internal activity feed.
  async postToNons(item: { uuid?: string; type: MediaType }, opts: NonsPostOptions): Promise<void> {
    if (!item.uuid) throw new Error('This item has no public link yet')
    const res = await nonsFetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: opts.title,
        content: opts.content,
        post_type: 'blog',
        media: [{ uuid: item.uuid, type: item.type }],
      }),
    })
    if (!res.ok) throw new Error('Failed to post to nons')
  }

  // Set (or clear, with 0) which book edition the user is reading on their shelf.
  async setEdition(mediaId: string, editionId: number): Promise<void> {
    await authedFetch(`/api/shelf/${Number(mediaId)}/edition`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edition_id: editionId }),
    })
  }

  // Adds an item to the user's library. When `id` is set the catalog row already
  // exists (e.g. added from Discover); otherwise a new catalog row is created
  // first (requires writer/admin on the backend).
  async addItem(item: Omit<MediaItem, 'id'> & { id?: string }): Promise<MediaItem> {
    let mediaId: number
    if (item.id) {
      mediaId = Number(item.id)
    } else {
      const res = await authedFetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toMediaBody(item)),
      })
      if (!res.ok) throw new Error(`create media failed: ${res.status}`)
      mediaId = ((await res.json()) as BackendMedia).id
    }

    await authedFetch(`/api/shelf/${mediaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: item.status || 'wishlist' }),
    })

    if (item.favorite) await this.setFavorite(mediaId, true)
    if (typeof item.rating === 'number' && item.rating > 0) await this.setRating(mediaId, item.rating)

    return (await this.getItem(String(mediaId)))!
  }

  // Routes each kind of change to the resource that owns it. Quick actions
  // (status / favorite / rating) work for any signed-in user; editing the
  // catalog fields requires writer/admin.
  async updateItem(id: string, updates: Partial<MediaItem>): Promise<MediaItem> {
    const mediaId = Number(id)

    if (updates.status) {
      await authedFetch(`/api/shelf/${mediaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: updates.status }),
      })
    }

    if ('favorite' in updates) await this.setFavorite(mediaId, !!updates.favorite)

    if ('rating' in updates) {
      const r = updates.rating
      if (typeof r === 'number' && r > 0) await this.setRating(mediaId, r)
      else await authedFetch(`/api/media/${mediaId}/rating`, { method: 'DELETE' })
    }

    // Catalog fields only — change the shared media row.
    const catalogKeys: (keyof MediaItem)[] = [
      'title', 'author', 'director', 'year', 'genre', 'coverUrl', 'description', 'pages', 'duration', 'type',
    ]
    if (catalogKeys.some((k) => k in updates)) {
      const current = await this.getItem(id)
      await authedFetch(`/api/media/${mediaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toMediaBody({ ...current, ...updates })),
      })
    }

    return (await this.getItem(id))!
  }

  // Removes the item from the user's library (off the shelf). The shared catalog
  // row stays; their like and rating are detached too.
  async deleteItem(id: string): Promise<void> {
    const mediaId = Number(id)
    await Promise.all([
      authedFetch(`/api/shelf/${mediaId}`, { method: 'DELETE' }),
      authedFetch(`/api/media/${mediaId}/favorite`, { method: 'DELETE' }),
      authedFetch(`/api/media/${mediaId}/rating`, { method: 'DELETE' }),
    ])
  }

  // Upload a library export and run it as a background job. The backend parses the
  // file up front (a bad file fails here) and returns a job id; a full library is
  // dozens of external lookups per book, far too slow to hold one request open
  // without a proxy/browser timeout, so we poll the job for progress instead.
  // Don't set Content-Type — the browser adds the multipart boundary.
  private async uploadImport(path: string, file: File, onProgress?: ImportProgress): Promise<ImportJob> {
    const form = new FormData()
    form.append('file', file)
    const res = await authedFetch(path, { method: 'POST', body: form })
    if (!res.ok) {
      let msg = `Import failed (${res.status})`
      try {
        const body = await res.json()
        if (body?.error) msg = body.error
      } catch { /* non-JSON error body (e.g. a 404 route) — keep the status */ }
      throw new Error(msg)
    }
    const { job_id: jobId } = await res.json() as { job_id: string }
    return this.pollImportJob(jobId, onProgress)
  }

  // Poll an import job until it finishes, reporting each snapshot to onProgress.
  // Resolves with the final job on success; rejects on an error status.
  private async pollImportJob(jobId: string, onProgress?: ImportProgress): Promise<ImportJob> {
    for (;;) {
      const res = await authedFetch(`/api/import/jobs/${jobId}`)
      if (!res.ok) throw new Error('Lost track of the import — please check your library.')
      const job = await res.json() as ImportJob
      onProgress?.(job)
      if (job.status === 'done') return job
      if (job.status === 'error') throw new Error(job.error || 'Import failed')
      await new Promise((r) => setTimeout(r, 800))
    }
  }

  // Permanently delete the user's entire personal library. The shared catalog
  // (media/editions/people) is untouched server-side.
  async wipeLibrary(): Promise<void> {
    const res = await authedFetch('/api/library', { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete library')
  }

  importGoodreads(file: File, onProgress?: ImportProgress): Promise<ImportJob> {
    return this.uploadImport('/api/import/goodreads', file, onProgress)
  }

  importBookDiary(file: File, onProgress?: ImportProgress): Promise<ImportJob> {
    return this.uploadImport('/api/import/bookdiary', file, onProgress)
  }

  importBookDiaryDB(file: File, onProgress?: ImportProgress): Promise<ImportJob> {
    return this.uploadImport('/api/import/bookdiary-db', file, onProgress)
  }

  importStoryGraph(file: File, onProgress?: ImportProgress): Promise<ImportJob> {
    return this.uploadImport('/api/import/storygraph', file, onProgress)
  }

  // file is the Letterboxd "Export Data" .zip, or a single CSV out of it
  // (watchlist.csv, watched.csv, ratings.csv, diary.csv, reviews.csv) — the
  // backend routes by the uploaded filename, so it must be kept as-is.
  importLetterboxd(file: File, onProgress?: ImportProgress): Promise<ImportJob> {
    return this.uploadImport('/api/import/letterboxd', file, onProgress)
  }

  // file is an IMDb "Your Ratings" or "Your Watchlist" CSV export — the
  // backend auto-detects which from its header, no filename convention needed.
  importIMDb(file: File, onProgress?: ImportProgress): Promise<ImportJob> {
    return this.uploadImport('/api/import/imdb', file, onProgress)
  }

  private setFavorite(mediaId: number, on: boolean) {
    return authedFetch(`/api/media/${mediaId}/favorite`, { method: on ? 'PUT' : 'DELETE' })
  }

  private setRating(mediaId: number, value: number, share = true) {
    return authedFetch(`/api/media/${mediaId}/rating`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, share }),
    })
  }
}

export const libraryService: ILibraryService = new ApiLibraryService()
