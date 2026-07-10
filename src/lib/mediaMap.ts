import type { MediaItem, MediaType, ShelfStatus } from '../types'

// Pure mapping between nons-library-server's wire shapes and the flat MediaItem
// the UI works with. Kept free of fetch/auth so it can run on the Next.js server
// (for the public, server-rendered /b and /m pages) as well as in the browser
// service layer (libraryService).

export type BackendMedia = {
  id: number
  uuid: string
  type: MediaType
  title: string
  original_title?: string
  author: string
  director: string
  year: number
  genres: string // comma-separated
  cover_url: string
  description: string
  duration_min: number
  pages: number
  maker_uuid: string
  isbn: string
  work_id: string
  tmdb_id?: number
  details?: { original_language?: string; title_en?: string; ol_work?: string } | null
  created_at: number
  updated_at: number
}

// The signed-in user's personal overlay on a catalog row (their shelf status,
// like, score and review). Public reads carry none of these.
export type Signals = {
  status?: ShelfStatus
  favorite?: boolean
  rating?: number
  review?: string
  note?: string
  createdAt?: number
  editionId?: number
  /** The chosen edition's own title/cover, when one is selected — these
   *  override the work's in list views so the user sees the printing they read. */
  editionTitle?: string
  editionCover?: string
  /** The chosen edition's page count, when set — used as the reading-progress
   *  total (the printing's pages), falling back to the work's. */
  editionPages?: number
  /** The chosen edition's language (2-letter code), so the page can localize the
   *  byline (author credits) to the printing the user is reading, even before the
   *  editions carousel loads that edition. */
  editionLanguage?: string
  /** The user's reading period (unix seconds; 0/undefined = unset). */
  startedAt?: number
  finishedAt?: number
  /** IDs of the user's custom collections that contain this item. */
  collectionIds?: number[]
}

export function toMediaItem(m: BackendMedia, s: Signals = {}): MediaItem {
  return {
    id: String(m.id),
    uuid: m.uuid || undefined,
    type: m.type,
    // A selected edition's title/cover override the work's so the shelf and
    // library lists show the exact printing the user picked.
    title: s.editionTitle || m.title,
    author: m.author || m.director,
    director: m.director || undefined,
    makerUuid: m.maker_uuid || undefined,
    isbn: m.isbn || undefined,
    workId: m.work_id || undefined,
    tmdbId: m.tmdb_id || undefined,
    originalLanguage: m.details?.original_language || undefined,
    titleEn: m.original_title || m.details?.title_en || undefined,
    coverUrl: s.editionCover || m.cover_url || undefined,
    year: m.year || undefined,
    genre: m.genres ? m.genres.split(',').map((g) => g.trim()).filter(Boolean) : undefined,
    description: m.description || undefined,
    pages: s.editionPages || m.pages || undefined,
    duration: m.duration_min ? `${m.duration_min} min` : undefined,
    status: s.status,
    favorite: s.favorite,
    rating: s.rating,
    review: s.review || undefined,
    note: s.note || undefined,
    editionId: s.editionId || undefined,
    dateAdded: s.createdAt ? new Date(s.createdAt * 1000).toISOString() : undefined,
    startedAt: s.startedAt ? new Date(s.startedAt * 1000).toISOString() : undefined,
    finishedAt: s.finishedAt ? new Date(s.finishedAt * 1000).toISOString() : undefined,
    collectionIds: s.collectionIds?.length ? s.collectionIds : undefined,
  }
}

// ── Shared catalog read shapes (used by MediaOne + server-side fetch) ─────────

// Cast & crew from GET /api/media/:id/credits, each carrying the person's stable
// uuid so names can link to their /p/<uuid> page.
export interface CreditPerson {
  uuid: string
  name: string
  photo_url?: string
}

export interface MediaCredits {
  cast: { person: CreditPerson; character?: string }[]
  directors: { person: CreditPerson }[]
  writers: { person: CreditPerson }[]
  authors: { person: CreditPerson }[]
  translators: { person: CreditPerson }[]
}

// Book editions from GET /api/media/:id/editions.
export interface Edition {
  id: number
  uuid?: string
  language?: string
  title?: string
  isbn13?: string
  isbn10?: string
  publisher?: string
  published_year?: number
  pages?: number
  cover_url?: string
  /** Optional per-edition synopsis override; falls back to the work's. */
  description?: string
  /** The edition shown by default when no ?e= param or shelf copy picks one. */
  is_primary?: boolean
}
