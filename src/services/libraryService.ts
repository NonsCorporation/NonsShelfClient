import { authedFetch } from '../lib/api'
import type { MediaItem, ShelfStatus } from '../types.ts'

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
}

// ── Backend wire types ──────────────────────────────────────────────────────

type BackendMedia = {
  id: number
  uuid: string
  type: 'book' | 'movie'
  title: string
  author: string
  director: string
  year: number
  genres: string // comma-separated
  cover_url: string
  description: string
  duration_min: number
  pages: number
  maker_uuid: string
  created_at: number
  updated_at: number
}

type ShelfEntry = { media_id: number; status: ShelfStatus; created_at: number; media?: BackendMedia }
type FavoriteEntry = { media_id: number; media?: BackendMedia }
type RatingEntry = { media_id: number; value: number; media?: BackendMedia }

// ── Mapping ─────────────────────────────────────────────────────────────────

type Signals = { status?: ShelfStatus; favorite?: boolean; rating?: number; createdAt?: number }

function toItem(m: BackendMedia, s: Signals = {}): MediaItem {
  return {
    id: String(m.id),
    uuid: m.uuid || undefined,
    type: m.type,
    title: m.title,
    author: m.author || m.director,
    director: m.director || undefined,
    makerUuid: m.maker_uuid || undefined,
    coverUrl: m.cover_url || undefined,
    year: m.year || undefined,
    genre: m.genres ? m.genres.split(',').map((g) => g.trim()).filter(Boolean) : undefined,
    description: m.description || undefined,
    pages: m.pages || undefined,
    duration: m.duration_min ? `${m.duration_min} min` : undefined,
    status: s.status,
    favorite: s.favorite,
    rating: s.rating,
    dateAdded: s.createdAt ? new Date(s.createdAt * 1000).toISOString() : undefined,
  }
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
    author: item.author || item.director || '',
    director: item.director || '',
    year: item.year || 0,
    genres,
    cover_url: item.coverUrl || '',
    description: item.description || '',
    pages: item.pages || 0,
    duration_min: parseDuration(item.duration),
  }
}

async function items<T>(res: Response): Promise<T[]> {
  if (!res.ok) return []
  const data = await res.json()
  return (data.items ?? []) as T[]
}

export interface ILibraryService {
  getItems(): Promise<MediaItem[]>
  getItem(id: string): Promise<MediaItem | undefined>
  addItem(item: Omit<MediaItem, 'id'> & { id?: string }): Promise<MediaItem>
  updateItem(id: string, updates: Partial<MediaItem>): Promise<MediaItem>
  deleteItem(id: string): Promise<void>
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
    const ratMap = new Map(ratings.map((r) => [r.media_id, r.value]))

    return shelf
      .filter((e) => e.media)
      .map((e) =>
        toItem(e.media!, {
          status: e.status,
          favorite: favSet.has(e.media_id),
          rating: ratMap.get(e.media_id),
          createdAt: e.created_at,
        }),
      )
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

    const [ratRes, favRes, shelfRes] = await Promise.all([
      authedFetch(`/api/media/${mediaId}/rating`),
      authedFetch(`/api/media/${mediaId}/favorite`),
      authedFetch('/api/shelf'),
    ])
    const rating = ratRes.ok ? ((await ratRes.json()).own as number | undefined) : undefined
    const favorite = favRes.ok ? Boolean((await favRes.json()).liked) : false
    const entry = (await items<ShelfEntry>(shelfRes)).find((e) => e.media_id === mediaId)

    return toItem(media, { status: entry?.status, favorite, rating, createdAt: entry?.created_at })
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

  private setFavorite(mediaId: number, on: boolean) {
    return authedFetch(`/api/media/${mediaId}/favorite`, { method: on ? 'PUT' : 'DELETE' })
  }

  private setRating(mediaId: number, value: number) {
    return authedFetch(`/api/media/${mediaId}/rating`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
  }
}

export const libraryService: ILibraryService = new ApiLibraryService()
