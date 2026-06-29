import { authedFetch } from '../lib/api'
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
type ShelfEntry = { media_id: number; status: ShelfStatus; edition_id?: number; note?: string; created_at: number; collection_ids?: number[]; media?: BackendMedia; edition?: EditionRef }
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

// Result of a Goodreads import (mirrors importer_service.Summary).
export interface ImportSummary {
  total: number
  created: number
  matched: number
  shelved: number
  rated: number
  skipped: number
}

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

// What the "ending" (finish) modal collects.
export interface FinishOptions {
  rating?: number | null
  review?: string
  finishedAt?: number // unix seconds
  /** Post the finish (and its rating/review) to the feed (default true). */
  share?: boolean
}

export interface ILibraryService {
  getItems(): Promise<MediaItem[]>
  /** Another user's public library (shelf + ratings), for their profile page. */
  getUserItems(userId: number): Promise<MediaItem[]>
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
  /** Reading/watching spans over [from, to] (unix seconds) for the calendar. */
  getCalendar(from: number, to: number): Promise<CalendarData>
  /** Watched/total episode counts for a series (lightweight). */
  getEpisodeStats(mediaId: string): Promise<{ watched: number; total: number }>
  /** Mark/unmark a series episode as watched. */
  setEpisodeWatched(episodeId: number, watched: boolean): Promise<void>
  /** Finish an item: shelf → done, save rating/review, log a (backdatable) finished event. */
  finish(mediaId: string, opts: FinishOptions): Promise<void>
  deleteItem(id: string): Promise<void>
  /** Permanently delete the whole personal library (shelf, ratings, favorites, activity, feed posts). */
  wipeLibrary(): Promise<void>
  importGoodreads(file: File): Promise<ImportSummary>
  importBookDiary(file: File): Promise<ImportSummary>
  importBookDiaryDB(file: File): Promise<ImportSummary>
  importStoryGraph(file: File): Promise<ImportSummary>
}

class ApiLibraryService implements ILibraryService {
  // The library view is the user's shelf, enriched with their favorites and
  // ratings (both keyed by media id).
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
          editionTitle: e.edition?.title,
          editionCover: e.edition?.cover_url,
          editionPages: e.edition?.pages,
        }),
      )
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

  // Upload a CSV export; the backend creates/matches books and shelves + rates
  // them. Don't set Content-Type — the browser adds the multipart boundary.
  private async uploadCsv(path: string, file: File): Promise<ImportSummary> {
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
    return res.json() as Promise<ImportSummary>
  }

  // Permanently delete the user's entire personal library. The shared catalog
  // (media/editions/people) is untouched server-side.
  async wipeLibrary(): Promise<void> {
    const res = await authedFetch('/api/library', { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete library')
  }

  importGoodreads(file: File): Promise<ImportSummary> {
    return this.uploadCsv('/api/import/goodreads', file)
  }

  importBookDiary(file: File): Promise<ImportSummary> {
    return this.uploadCsv('/api/import/bookdiary', file)
  }

  importBookDiaryDB(file: File): Promise<ImportSummary> {
    return this.uploadCsv('/api/import/bookdiary-db', file)
  }

  importStoryGraph(file: File): Promise<ImportSummary> {
    return this.uploadCsv('/api/import/storygraph', file)
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
