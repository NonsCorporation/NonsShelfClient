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
  photo_url?: string
  bio?: string
  birth_year?: number
  credit_count: number
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
    author: item.author || item.director || '',
    director: item.director || '',
    year: item.year || 0,
    genres,
    cover_url: item.coverUrl || '',
    description: item.description || '',
    pages: item.pages || 0,
    duration_min: durationMin,
    isbn: item.isbn || '',
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

  async deleteEdition(mediaId: string, editionId: number): Promise<void> {
    await jsonOrThrow(
      await authedFetch(`/api/media/${mediaId}/editions/${editionId}`, { method: 'DELETE' }),
    )
  },

  // ── people ──
  async searchPeople(q: string): Promise<PersonSummary[]> {
    if (!q.trim()) return []
    const data = (await jsonOrThrow(
      await authedFetch(`/api/people?q=${encodeURIComponent(q.trim())}`),
    )) as { items: PersonSummary[] }
    return data.items ?? []
  },

  async updatePerson(
    uuid: string,
    fields: { name: string; bio?: string; photo_url?: string; birth_year?: number },
  ): Promise<PersonSummary> {
    return jsonOrThrow(
      await authedFetch(`/api/people/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }),
    ) as Promise<PersonSummary>
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
