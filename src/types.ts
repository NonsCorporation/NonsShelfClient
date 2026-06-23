export type MediaType = 'book' | 'movie' | 'series'

// Shelf status — the Goodreads/IMDb "what am I doing with this" axis.
//   wishlist -> Want to Read / Want to Watch
//   active   -> Currently Reading / Watching
//   done     -> Read / Watched
//   dnf      -> Did Not Finish (abandoned mid-read)
export type ShelfStatus = 'wishlist' | 'active' | 'done' | 'dnf'

export type MediaItem = {
  id: string
  /** Stable public id used in /b/<uuid> and /m/<uuid> URLs. */
  uuid?: string
  type: MediaType
  title: string
  author: string
  /** Public uuid of the primary author/director, for linking to /p/<uuid>. */
  makerUuid?: string
  coverUrl?: string
  year?: number
  genre?: string | string[]
  director?: string
  actors?: string[]
  tags?: string[]
  rating?: number
  /** The user's own free-text review. */
  review?: string
  pages?: number
  description?: string
  duration?: string
  // Book metadata (from the catalog row / its OpenLibrary work).
  isbn?: string
  workId?: string // OpenLibrary work key, e.g. "/works/OL…W"
  originalLanguage?: string
  titleEn?: string // original/English title when the catalog title is localized
  dateAdded?: string
  /** The user's own reading period for this item (ISO strings; editable on the
   *  media page). Backed by the started/finished activity rows. */
  startedAt?: string
  finishedAt?: string
  status?: ShelfStatus
  favorite?: boolean
  /** The book edition (printing) the user is reading, when chosen. 0/undefined = none. */
  editionId?: number
}
