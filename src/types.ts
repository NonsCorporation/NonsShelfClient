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
  /** Stable public id — lists are publicly viewable at /list/<uuid>. */
  uuid: string
  user_id: number
  title: string
  description?: string
  count: number
  created_at: number
  updated_at: number
  /** Owner byline — only populated on a single-list fetch, not the listing. */
  owner_username?: string
  owner_name?: string
  owner_avatar_url?: string
}

/** A list as surfaced on the Discover page — a few cover images for a collage
 *  card, plus the owner's byline. */
export type CuratedListDiscoverEntry = CuratedList & {
  cover_urls?: string[]
  /** Approximate genre tags, derived from a sample of the list's own items. */
  genres?: string[]
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
  /** A few member covers (member order), for fanned-cover tiles — present
   *  only from the Discover-facing list endpoint, not the librarian picker. */
  cover_urls?: string[]
  /** Total works in the franchise — same endpoint as cover_urls. */
  count?: number
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

// ── Community tags (StoryGraph-style) ───────────────────────────────────────
// A normalized taxonomy (group -> facet -> tag) crowdsourced from users who
// mark an item finished. A facet's `multi` says whether its picker allows
// more than one selection (moods, genres) vs. exactly one (pacing, audience);
// `color` badges every tag in that facet (e.g. content warnings render red).
export type TagTaxonomyTag = {
  id: number
  key: string
  label: string
}

export type TagTaxonomyFacet = {
  key: string
  label: string
  color: string
  multi: boolean
  tags: TagTaxonomyTag[]
}

export type TagTaxonomyGroup = {
  key: string
  label: string
  facets: TagTaxonomyFacet[]
}

/** One tag that has crossed the applied-tag vote threshold for a media item. */
export type AppliedTag = {
  id: number
  key: string
  label: string
  facetKey: string
  facetLabel: string
  color: string
  groupKey: string
  groupLabel: string
  votes: number
}

// ── Community challenges ("read 60 books in 2026", "watch all Wes Anderson
// films") — a normalized goal definition any signed-in user can join, with
// live per-participant progress computed from their own shelf. Mirrors the
// backend's challenge_service.Entry JSON as-is (snake_case), same convention
// as CuratedList above rather than a mapped camelCase shape. ────────────────

/** One condition narrowing which media count toward a challenge. Conditions
 *  on the same challenge AND together. `list_id` scopes to a curated list's
 *  members (curated lists are public/shared, unlike collections, which are
 *  private per-user and so aren't a valid challenge scope); the rest match
 *  media attributes directly. `label`/`href` are populated server-side only
 *  when the condition is returned (never sent when creating) — e.g. a
 *  person_uuid condition comes back with the person's name and a link to
 *  /p/<uuid> so a challenge card can render "Wes Anderson" instead of a raw id. */
export type ChallengeCondition = {
  field: 'genre' | 'person_uuid' | 'tag_id' | 'year' | 'list_id'
  op: 'eq' | 'gte' | 'lte' | 'contains'
  value: string
  label?: string
  href?: string
}

export type Challenge = {
  id: number
  /** Stable public id used in /challenge/<uuid> URLs. */
  uuid: string
  title: string
  description: string
  created_by: number
  creator_name?: string
  /** Empty string means "any type". */
  media_type: '' | MediaType
  metric: 'finished' | 'added' | 'rated'
  /** null means "complete every item matching media_type + conditions". */
  target_count: number | null
  start_date: number
  end_date: number
  conditions: ChallengeCondition[]
  created_at: number
  participants: number
  joined: boolean
  /** Only meaningful (and only computed server-side) when `joined`. */
  progress?: number
  target?: number
  /** Unix seconds the viewer first hit the target; 0/absent = not completed. */
  completed_at?: number
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
