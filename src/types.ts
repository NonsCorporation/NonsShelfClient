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
  /** "Personal only": the challenge lists publicly, but nobody except its
   *  creator can join. */
  private: boolean
  /** A generic/system challenge — the yearly (and later monthly) reading
   *  goals seeded server-side — as opposed to a community-authored one. */
  official: boolean
  /** Set for a recurring per-participant goal challenge (each reader sets
   *  their own number); empty for ordinary community challenges. */
  period: '' | 'yearly' | 'monthly'
  /** null means "complete every item matching media_type + conditions". For a
   *  goal challenge (period set) the number is per-participant, in `target`. */
  target_count: number | null
  start_date: number
  end_date: number
  conditions: ChallengeCondition[]
  created_at: number
  participants: number
  /** Up to a dozen participants (joined earliest first) for an avatar-stack
   *  UI — not the full roster; use `participants` for the true count / "+N". */
  participant_preview: { id: number; name: string; avatar_url?: string }[]
  joined: boolean
  /** Only meaningful (and only computed server-side) when `joined`. */
  progress?: number
  target?: number
  /** Unix seconds the viewer first hit the target; 0/absent = not completed. */
  completed_at?: number
}

// ── Awards ──────────────────────────────────────────────────────────────────
// A librarian-curated catalog of recognitions (Oscars, Booker, Hugos…) applied
// to media and people, each with winner/nominee + year. The taxonomy (bodies →
// categories) drives the add-award picker; AppliedAward is one award a subject
// holds. Mirrors the backend JSON (snake_case), same convention as CuratedList.
export type AwardSubject = 'media' | 'person'
export type AwardStatus = 'winner' | 'nominee'

export type AwardCategory = {
  id: number
  key: string
  name: string
  subject_type: AwardSubject
}

export type AwardBody = {
  key: string
  name: string
  color: string
  categories: AwardCategory[]
}

/** One award that touches a page — either the page's own award, or (e.g. a
 *  movie page also showing its Best Actor win) a cross-linked award whose
 *  true subject is the other type. The trophy icon is derived from
 *  `body_key` in the frontend (see AwardIcon), not carried in the data.
 *  `subject_type`/`subject_name` identify the award's real subject — only
 *  worth rendering when `subject_type` differs from the page you're on.
 *  `linked_media_*`/`linked_person_*` are the optional cross-link, present
 *  when set (e.g. a person's Best Actor win names the film it was for). */
export type AppliedAward = {
  id: number
  year: number
  status: AwardStatus
  category_name: string
  body_name: string
  body_key: string
  color: string
  subject_type: AwardSubject
  subject_uuid?: string
  subject_name?: string
  /** Catalog type of whichever media entity this row touches (the subject
   *  when subject_type is 'media', or the linked media otherwise) — needed
   *  to build the right /b/ or /m/ link. */
  media_type?: MediaType
  linked_media_uuid?: string
  linked_media_title?: string
  linked_person_uuid?: string
  linked_person_name?: string
}

// ── Wikidata award auto-import ───────────────────────────────────────────────
// "Auto-import awards" resolves a media item or person on Wikidata and
// matches its award claims against the taxonomy above. Suggest never writes
// anything; the librarian confirms (optionally trimming items) before Import.

export type WikidataImportItem = {
  category_id: number
  category_name: string
  body_name: string
  body_key: string
  year: number
  status: AwardStatus
  subject_type: AwardSubject
  subject_id: number
  subject_name: string
  linked_media_id?: number
  linked_person_id?: number
}

export type WikidataUnmatched = {
  label: string
  year?: number
  status: AwardStatus
  reason: string
}

export type WikidataImportPreview = {
  subject_qid?: string
  subject_label?: string
  matched: WikidataImportItem[]
  unmatched: WikidataUnmatched[]
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
  /** TMDB id (movies/series) — editable by librarians so a merge that lost it,
   *  or a wrong/missing match, can be corrected by hand. */
  tmdbId?: number
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
