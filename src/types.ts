export type MediaType = 'book' | 'movie' | 'series'

export type Collection = {
  id: number
  name: string
  count: number
  created_at: number
}

// ── Curated lists: Goodreads-style titled, described lists with a per-item
// note (e.g. "Best sci-fi of the 90s") — distinct from Collections, which are
// private, undescribed groupings. ──────────────────────────────────────────

export type CuratedList = {
  id: number
  /** Stable public id — lists are publicly viewable at /library/lists/<uuid>. */
  uuid: string
  user_id: number
  title: string
  description?: string
  count: number
  created_at: number
  updated_at: number
}

export type CuratedListItem = {
  media_id: number
  /** Optional per-item note — e.g. why this item belongs on the list. */
  description?: string
  created_at: number
  media?: MediaSummary
}

export type CuratedListDetail = CuratedList & {
  items: CuratedListItem[]
}

// ── Connections: how catalog works relate (series, franchises, adaptations) ──

/** Slim work shape embedded in connection payloads (card + link). */
export type MediaSummary = {
  id: number
  uuid: string
  type: MediaType
  title: string
  author?: string
  director?: string
  year?: number
  cover_url?: string
}

export type SeriesRef = { id: number; uuid: string; name: string; type: MediaType; role?: string }
export type FranchiseRef = { id: number; uuid: string; name: string }

/** A catalog series (ordered grouping of works in one medium). */
export type Series = {
  id: number
  uuid: string
  name: string
  type: MediaType
  description?: string
  franchise_id?: number | null
  parent_series_id?: number | null
  role?: string
  created_at?: number
}

/** A franchise / universe that groups sibling series across media. */
export type Franchise = {
  id: number
  uuid: string
  name: string
  description?: string
  created_at?: number
}

export type RelationKind = 'adaptation' | 'novelization' | 'remake' | 'companion' | 'crossover'

/** This work's place in one series, with neighbours (prev/next). */
export type SeriesMembership = {
  series: SeriesRef
  position: number
  label?: string
  total: number
  prev?: MediaSummary
  next?: MediaSummary
}

/** This work's place in a universe, plus that universe's sibling series. */
export type FranchiseMembership = {
  franchise: FranchiseRef
  order: number
  saga?: string
  role?: string
  siblings: SeriesRef[]
}

/** A typed edge from this work's point of view ('outgoing' = this is the source). */
export type WorkRelationView = {
  id: number
  kind: RelationKind
  direction: 'incoming' | 'outgoing'
  part?: number
  note?: string
  media: MediaSummary
}

/** The unified "connections" panel for one work. */
export type Connections = {
  series: SeriesMembership[]
  franchises: FranchiseMembership[]
  relations: WorkRelationView[]
}

export type SeriesPageData = {
  series: Series
  franchise?: FranchiseRef
  items: { position: number; label?: string; media: MediaSummary }[]
}

export type FranchisePageData = {
  franchise: Franchise
  series: SeriesRef[]
  members: { order: number; saga?: string; role?: string; media: MediaSummary }[]
}

/** Result of auto-building a movie's series from its TMDB collection. */
export type AutoConnectSummary = {
  series: string
  series_uuid: string
  linked: number
  skipped: number
  created: boolean
}

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
  /** The user's private personal note — never shown to others. */
  note?: string
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
  /** IDs of the user's custom collections that contain this item. */
  collectionIds?: number[]
  /** IDs of the user's curated lists that contain this item. */
  listIds?: number[]
}
