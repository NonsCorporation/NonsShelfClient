import { authedFetch } from '../lib/api'
import type { MediaItem } from '../types'

// The librarian (writer/admin) tools for curating the shared catalog: creating
// and editing catalog rows, managing a book's editions, and de-duplicating
// people and works. These all hit writer-guarded endpoints on
// nons-library-server; a visitor calling them gets a 403.

// ── People ────────────────────────────────────────────────────────────────────

// A person as returned by the author-management search: the catalog Person row
// plus how many media they're credited on (the signal for telling a real entity
// from a stray duplicate when merging).
export interface PersonSummary {
  id: number
  uuid: string
  name: string
  name_lang?: string // BCP-47 tag for the canonical name spelling
  photo_url?: string
  bio?: string
  birth_year?: number
  birth_date?: string // YYYY-MM-DD
  death_year?: number
  death_date?: string // YYYY-MM-DD; absent = living or unknown
  credit_count: number
}

// A TMDB person match previewed before import (GET /api/people/:uuid/tmdb/suggest).
export interface TmdbPersonSuggestion {
  tmdb_id: number
  name: string
  biography: string
  photo_url: string
  birthday: string // YYYY-MM-DD
  deathday: string // YYYY-MM-DD; empty = living or unknown
  also_known_as: string[]
}

// An OpenLibrary author match previewed before import (GET /api/people/:uuid/ol/suggest).
export interface OlPersonSuggestion {
  ol_key: string
  name: string
  biography: string
  photo_url: string
  birth_date: string
  death_date: string
  also_known_as: string[]
}

// One name variant: a spelling plus its optional language tag (e.g.
// { name: 'Достоевский', lang: 'ru' }).
export interface PersonAlias {
  name: string
  lang?: string
}

// Editable fields for a person (create/update).
export interface PersonInput {
  name: string
  name_lang?: string // BCP-47 tag for the canonical name spelling
  bio?: string
  photo_url?: string
  birth_date?: string
  death_date?: string
  aliases?: PersonAlias[]
}

// A credit role and which media kinds it applies to.
export interface CreditRole {
  role: string
  kinds: string[] // 'book' | 'movie' | 'series'
}

// One credit on a media item (cast/crew member in a role).
export interface Credit {
  id: number
  role: string
  character?: string
  person: { uuid: string; name: string; photo_url?: string }
}

// An edition of a book work (GET /api/media/:id/editions).
export interface Edition {
  id: number
  media_id: number
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
}

// An episode of a series. Mirrors media_model.Episode's JSON.
export interface Episode {
  id: number
  media_id?: number
  season: number
  number: number
  title?: string
  overview?: string
  air_date?: string // YYYY-MM-DD
  runtime_min?: number
  still_url?: string
}

// Fields a librarian can set when adding/editing an episode.
export type EpisodeInput = Omit<Episode, 'id' | 'media_id'>

// Wire shape of GET /api/media/:id/episodes (seasons grouped).
type EpisodesResponse = {
  seasons?: { season: number; episodes: Episode[] }[]
}

// A TMDB search candidate (GET /api/tmdb/search).
export interface TmdbCandidate {
  tmdb_id: number
  title: string
  year?: number
  overview?: string
  poster_url?: string
}

// Result of POST /api/tmdb/import.
export interface TmdbImportResult {
  id: number
  uuid?: string
  created: boolean
  imported_episodes: number
}

// Live progress of a bulk import job (GET /api/tmdb/import-bulk/:jobId).
export interface BulkJob {
  id: string
  type: 'movie' | 'series'
  total: number
  processed: number
  created: number
  skipped: number
  failed: number
  episodes: number
  status: 'running' | 'done' | 'error'
  error?: string
}

async function jsonOrThrow(res: Response): Promise<unknown> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch { /* keep status */ }
    throw new Error(msg)
  }
  return res.json()
}

// Maps a MediaItem (edit form) onto the backend catalog body. Mirrors
// libraryService.toMediaBody but lives here so catalog editing doesn't depend on
// the shelf service.
function toMediaBody(item: Partial<MediaItem>) {
  const genres = Array.isArray(item.genre) ? item.genre.join(', ') : item.genre || ''
  const durationMin = item.duration ? parseInt(item.duration, 10) || 0 : 0
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
    duration_min: durationMin,
    isbn: item.isbn || '',
    tmdb_id: item.tmdbId || 0,
  }
}

export const librarianService = {
  // ── catalog rows ──
  // Create a catalog row WITHOUT shelving it (unlike libraryService.addItem,
  // which is the user-facing "add to my library"). Returns the new numeric id.
  async createMedia(item: Partial<MediaItem>): Promise<number> {
    const data = (await jsonOrThrow(
      await authedFetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toMediaBody(item)),
      }),
    )) as { id: number }
    return data.id
  },

  async updateMedia(id: string, item: Partial<MediaItem>): Promise<void> {
    await jsonOrThrow(
      await authedFetch(`/api/media/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toMediaBody(item)),
      }),
    )
  },

  async deleteMedia(id: string): Promise<void> {
    await jsonOrThrow(await authedFetch(`/api/media/${id}`, { method: 'DELETE' }))
  },

  // Fold a duplicate work into the canonical one: the duplicate becomes an
  // edition of `keepId` and every reference (credits, shelves, ratings…) is
  // repointed before it's deleted.
  async mergeMedia(keepId: string, dup: { id?: string; uuid?: string }): Promise<void> {
    await jsonOrThrow(
      await authedFetch(`/api/media/${keepId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dup.id ? { dup_id: Number(dup.id) } : { dup_uuid: dup.uuid }),
      }),
    )
  },

  // ── editions ──
  async addEdition(mediaId: string, edition: Partial<Edition>): Promise<Edition> {
    return jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/editions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edition),
      }),
    ) as Promise<Edition>
  },

  async updateEdition(mediaId: string, editionId: number, edition: Partial<Edition>): Promise<Edition> {
    return jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/editions/${editionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edition),
      }),
    ) as Promise<Edition>
  },

  async deleteEdition(mediaId: string, editionId: number): Promise<void> {
    await jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/editions/${editionId}`, { method: 'DELETE' }),
    )
  },

  async deduplicateEditions(mediaId: string): Promise<number> {
    const data = await jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/editions/dedup`, { method: 'POST' }),
    ) as { removed: number }
    return data.removed
  },

  // Reassign an edition from one book work to another (e.g. it was filed under
  // the wrong book). `targetMediaId` is the destination book's numeric id.
  async moveEdition(mediaId: string, editionId: number, targetMediaId: number): Promise<void> {
    await jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/editions/${editionId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_media_id: targetMediaId }),
      }),
    )
  },

  // Look up edition fields for an ISBN (Google Books + OpenLibrary, server-side).
  async lookupEdition(isbn: string): Promise<Partial<Edition> | null> {
    const res = await authedFetch(`/api/books/isbn?isbn=${encodeURIComponent(isbn)}`)
    if (!res.ok) return null
    return (await res.json()) as Partial<Edition>
  },

  // Resolve the book's work and auto-import all its editions (idempotent).
  // title/author override the stored work values for the search query.
  // Returns how many editions were written.
  async autoFindEditions(mediaId: string, title?: string, author?: string): Promise<number> {
    const params = new URLSearchParams()
    if (title) params.set('title', title)
    if (author) params.set('author', author)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const data = (await jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/editions/auto${qs}`, { method: 'POST' }),
    )) as { imported: number }
    return data.imported
  },

  // Convert a romanized edition title to Cyrillic (ISBN lookup, then reverse
  // transliteration). Returns the updated edition.
  async rusifyEdition(editionId: number): Promise<Edition> {
    return jsonOrThrow(
      await authedFetch(`/api/books/editions/${editionId}/rusify`, { method: 'POST' }),
    ) as Promise<Edition>
  },

  // ── episodes (series) ──
  // Reads a series' episodes through the same endpoint the series page uses,
  // flattened to a single ordered list for the editor.
  async getEpisodes(mediaId: string): Promise<Episode[]> {
    const res = await authedFetch(`/api/media/${mediaId}/episodes`)
    if (!res.ok) return []
    const data = (await res.json()) as EpisodesResponse
    return (data.seasons ?? []).flatMap((s) => s.episodes)
  },

  async addEpisode(mediaId: string, ep: EpisodeInput): Promise<Episode> {
    return jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ep),
      }),
    ) as Promise<Episode>
  },

  async updateEpisode(mediaId: string, episodeId: number, ep: EpisodeInput): Promise<Episode> {
    return jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/episodes/${episodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ep),
      }),
    ) as Promise<Episode>
  },

  async deleteEpisode(mediaId: string, episodeId: number): Promise<void> {
    await jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/episodes/${episodeId}`, { method: 'DELETE' }),
    )
  },

  // Remove an entire season's episodes at once (e.g. TMDB's season 0 specials).
  // Returns how many episodes were deleted.
  async deleteSeason(mediaId: string, season: number): Promise<number> {
    const data = (await jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/seasons/${season}`, { method: 'DELETE' }),
    )) as { deleted: number }
    return data.deleted
  },

  // ── TMDB import (movies & series) ──
  // Search TMDB by title via the server proxy (the API key stays server-side).
  async tmdbSearch(type: 'movie' | 'series', q: string): Promise<TmdbCandidate[]> {
    if (!q.trim()) return []
    const data = (await jsonOrThrow(
      await authedFetch(`/api/tmdb/search?type=${type}&q=${encodeURIComponent(q.trim())}`),
    )) as { items: TmdbCandidate[] }
    return data.items ?? []
  },

  // Import (or enrich) a catalog row from a TMDB id; series also pull all their
  // episodes. Returns the catalog id to jump into the editor.
  async tmdbImport(type: 'movie' | 'series', tmdbId: number): Promise<TmdbImportResult> {
    return jsonOrThrow(
      await authedFetch('/api/tmdb/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdb_id: tmdbId, type }),
      }),
    ) as Promise<TmdbImportResult>
  },

  // Start a background bulk import of the top `count` popular movies/series.
  async tmdbBulkImport(type: 'movie' | 'series', count: number): Promise<string> {
    const data = (await jsonOrThrow(
      await authedFetch('/api/tmdb/import-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, count }),
      }),
    )) as { job_id: string }
    return data.job_id
  },

  async tmdbBulkStatus(jobId: string): Promise<BulkJob> {
    return jsonOrThrow(await authedFetch(`/api/tmdb/import-bulk/${jobId}`)) as Promise<BulkJob>
  },

  // ── people ──
  async searchPeople(q: string): Promise<PersonSummary[]> {
    if (!q.trim()) return []
    const data = (await jsonOrThrow(
      await authedFetch(`/api/people?q=${encodeURIComponent(q.trim())}`),
    )) as { items: PersonSummary[] }
    return data.items ?? []
  },

  // Full person detail incl. alternative names with their language tags (the
  // search list omits aliases).
  async getPerson(uuid: string): Promise<{ person: PersonSummary; aliases: PersonAlias[] }> {
    const data = (await jsonOrThrow(await authedFetch(`/api/people/${uuid}`))) as {
      person: PersonSummary
      aliases?: PersonAlias[]
    }
    return { person: data.person, aliases: data.aliases ?? [] }
  },

  // Create a new person (or return the existing one with the same name). Returns
  // the PersonSummary so it can be linked as a maker straight away.
  async createPerson(fields: PersonInput): Promise<PersonSummary> {
    return jsonOrThrow(
      await authedFetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }),
    ) as Promise<PersonSummary>
  },

  async updatePerson(uuid: string, fields: PersonInput): Promise<PersonSummary> {
    return jsonOrThrow(
      await authedFetch(`/api/people/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }),
    ) as Promise<PersonSummary>
  },

  // Preview a TMDB match for a person (by stored id, or a name search when none
  // is stored) without applying it — the UI confirms before importing.
  async suggestPersonFromTMDB(uuid: string): Promise<TmdbPersonSuggestion> {
    return jsonOrThrow(
      await authedFetch(`/api/people/${uuid}/tmdb/suggest`),
    ) as Promise<TmdbPersonSuggestion>
  },

  // Pull a person's bio/photo/birth date + name variants from TMDB. Pass the
  // accepted suggestion's tmdbId to import that record (and store the id);
  // omit it to use the person's already-stored id.
  async enrichPersonFromTMDB(uuid: string, tmdbId?: number): Promise<PersonSummary> {
    return jsonOrThrow(
      await authedFetch(`/api/people/${uuid}/tmdb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tmdbId ? { tmdb_id: tmdbId } : {}),
      }),
    ) as Promise<PersonSummary>
  },

  // Preview an OpenLibrary author match without applying it.
  async suggestPersonFromOL(uuid: string): Promise<OlPersonSuggestion> {
    return jsonOrThrow(
      await authedFetch(`/api/people/${uuid}/ol/suggest`),
    ) as Promise<OlPersonSuggestion>
  },

  // Pull a person's bio/photo/birth date + name variants from OpenLibrary.
  // Pass the accepted suggestion's olKey to import that record (and store it);
  // omit it to use the person's already-stored OL key.
  async enrichPersonFromOL(uuid: string, olKey?: string): Promise<PersonSummary> {
    return jsonOrThrow(
      await authedFetch(`/api/people/${uuid}/ol`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(olKey ? { ol_key: olKey } : {}),
      }),
    ) as Promise<PersonSummary>
  },

  // ── credits (cast/crew) ──
  async getCreditRoles(): Promise<CreditRole[]> {
    const data = (await jsonOrThrow(await authedFetch('/api/credit-roles'))) as { roles: CreditRole[] }
    return data.roles ?? []
  },

  async getCredits(mediaId: string): Promise<Credit[]> {
    const res = await authedFetch(`/api/media/${mediaId}/credits`)
    if (!res.ok) return []
    const data = (await res.json()) as { credits?: Credit[] }
    return data.credits ?? []
  },

  async addCredit(mediaId: string, fields: { person_uuid: string; role: string; character?: string }): Promise<void> {
    await jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }),
    )
  },

  async deleteCredit(mediaId: string, creditId: number): Promise<void> {
    await jsonOrThrow(await authedFetch(`/api/media/${mediaId}/credits/${creditId}`, { method: 'DELETE' }))
  },

  // Auto-import a movie/series' cast & crew from TMDB (people + credits).
  async autoFindCredits(mediaId: string): Promise<number> {
    const data = (await jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/credits/auto`, { method: 'POST' }),
    )) as { imported: number }
    return data.imported
  },

  // Fetch and store alternative titles for a movie/series from TMDB.
  async importAltTitles(mediaId: string): Promise<number> {
    const data = (await jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/alt-titles/import`, { method: 'POST' }),
    )) as { imported: number }
    return data.imported
  },

  // Read the stored alternative titles for a media work.
  async getAltTitles(mediaId: string): Promise<{ id: number; country_code: string; language: string; title: string; overview: string; title_type: string }[]> {
    const data = (await jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/alt-titles`),
    )) as { titles: { id: number; country_code: string; language: string; title: string; overview: string; title_type: string }[] }
    return data.titles ?? []
  },

  // Fold `dupUuid` into `keepUuid` (the survivor).
  async mergePeople(keepUuid: string, dupUuid: string): Promise<void> {
    await jsonOrThrow(
      await authedFetch('/api/people/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keep_uuid: keepUuid, dup_uuid: dupUuid }),
      }),
    )
  },

  // Link a media item's primary maker to an existing person, recording the
  // credit + denormalizing maker_uuid so the byline links to /p/<uuid>.
  async setMaker(mediaId: string, personUuid: string, role: 'author' | 'director'): Promise<void> {
    await jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/maker`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_uuid: personUuid, role }),
      }),
    )
  },
}

// True when the signed-in user may use the librarian tools.
export function isLibrarian(role?: string): boolean {
  return role === 'writer' || role === 'admin'
}
