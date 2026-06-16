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
  createdAt?: number
  editionId?: number
}

export function toMediaItem(m: BackendMedia, s: Signals = {}): MediaItem {
  return {
    id: String(m.id),
    uuid: m.uuid || undefined,
    type: m.type,
    title: m.title,
    author: m.author || m.director,
    director: m.director || undefined,
    makerUuid: m.maker_uuid || undefined,
    isbn: m.isbn || undefined,
    workId: m.work_id || undefined,
    originalLanguage: m.details?.original_language || undefined,
    titleEn: m.original_title || m.details?.title_en || undefined,
    coverUrl: m.cover_url || undefined,
    year: m.year || undefined,
    genre: m.genres ? m.genres.split(',').map((g) => g.trim()).filter(Boolean) : undefined,
    description: m.description || undefined,
    pages: m.pages || undefined,
    duration: m.duration_min ? `${m.duration_min} min` : undefined,
    status: s.status,
    favorite: s.favorite,
    rating: s.rating,
    review: s.review || undefined,
    editionId: s.editionId || undefined,
    dateAdded: s.createdAt ? new Date(s.createdAt * 1000).toISOString() : undefined,
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
}
