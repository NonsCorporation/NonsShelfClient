import { authedFetch } from '../lib/api'
import type { MediaType } from '../types'

// A community catalog item — popular media with aggregate/social signals.
// This is separate from the user's own library; it stands in for a backend
// "discover" endpoint. Items can be added into the personal library.
export type CatalogItem = {
  id: string
  /** Stable public id used in /b/<uuid> and /m/<uuid> URLs. */
  uuid?: string
  type: MediaType
  title: string
  author: string
  director?: string
  coverUrl?: string
  year?: number
  genre?: string[]
  description?: string
  /** Aggregate community rating, 0–10. */
  communityRating: number
  /** How many members have rated it. */
  ratingsCount: number
  /** How many members are reading/watching it right now. */
  activeNow: number
  /** Higher = more trending this week. */
  trendScore: number
  /** How many members have this item on a shelf — the popularity signal. */
  popularity: number
  /** Short, social reason this is recommended to the user. */
  recommendedBecause?: string
}

// A notable person for the Discover "notable names" row (GET /api/people/popular).
export type PersonHit = {
  uuid: string
  name: string
  photoUrl?: string
  /** How many catalog titles they're credited on. */
  creditCount: number
}

// Shape of a media row as returned by nons-library-server’s GET /api/media.
type BackendMedia = {
  id: number
  uuid: string
  type: MediaType
  title: string
  author: string
  director: string
  year: number
  genres: string // comma-separated
  cover_url: string
  description: string
  duration_min: number
  pages: number
  created_by: number
  created_at: number
  updated_at: number
  popularity?: number
}

// mapMedia adapts a backend row to the CatalogItem the UI renders. The social
// signals (rating, active-now, trend) aren’t computed server-side yet, so they
// default to 0 until the backend aggregates shelf/rating data.
function mapMedia(m: BackendMedia): CatalogItem {
  return {
    id: String(m.id),
    uuid: m.uuid || undefined,
    type: m.type,
    title: m.title,
    author: m.author,
    director: m.director || undefined,
    coverUrl: m.cover_url || undefined,
    year: m.year || undefined,
    genre: m.genres ? m.genres.split(',').map((g) => g.trim()).filter(Boolean) : [],
    description: m.description || undefined,
    communityRating: 0,
    ratingsCount: 0,
    activeNow: 0,
    trendScore: 0,
    popularity: m.popularity ?? 0,
  }
}

export interface ICatalogService {
  /** Fetch the catalog; `q` searches the whole DB by title/author server-side. */
  getCatalog(q?: string): Promise<CatalogItem[]>
  /** Most-shelved items (optionally one media type), for Discover's popular rows. */
  popular(type: MediaType | undefined, limit: number): Promise<CatalogItem[]>
  /** Most recently added catalog items (optionally one media type). */
  recent(type: MediaType | undefined, limit: number): Promise<CatalogItem[]>
  /** Most-credited people (authors/actors/directors), for the notable-names row. */
  notablePeople(limit: number): Promise<PersonHit[]>
  /** Fuzzy, typo-tolerant search for people by name — the "People" tab on the
   *  main search page. Empty query returns no results. */
  searchPeople(q: string, limit?: number): Promise<PersonHit[]>
  /** Search externally and auto-import up to `limit` books and films (and series
   *  if requested), then return the rows. By default this only imports when `q`
   *  has no local results; pass `force` to import even when locals exist (the
   *  "Load more" path), which repeated calls extend via a growing `limit`. */
  searchFill(q: string, opts?: { limit?: number; series?: boolean; force?: boolean }): Promise<{ items: CatalogItem[]; autoImported: boolean }>
}

// Talks to nons-library-server over the shared SSO session (authedFetch sends
// the access_token cookie). The component layer only knows ICatalogService, so
// this swaps in for the old mock without any UI changes.
class ApiCatalogService implements ICatalogService {
  // The backend caps a page at 100 rows, so browsing fetches books and films
  // as two parallel pages (Discover sections split by type anyway). A search
  // stays a single mixed query.
  async getCatalog(q?: string): Promise<CatalogItem[]> {
    if (q?.trim()) {
      return this.fetchPage(`/api/media?limit=100&q=${encodeURIComponent(q.trim())}`)
    }
    const [books, movies, series] = await Promise.all([
      this.fetchPage('/api/media?type=book&limit=100'),
      this.fetchPage('/api/media?type=movie&limit=100'),
      this.fetchPage('/api/media?type=series&limit=100'),
    ])
    return [...books, ...movies, ...series]
  }

  async searchFill(q: string, opts?: { limit?: number; series?: boolean; force?: boolean }): Promise<{ items: CatalogItem[]; autoImported: boolean }> {
    if (!q.trim()) return { items: [], autoImported: false }
    try {
      const p = new URLSearchParams({ q: q.trim() })
      if (opts?.limit) p.set('limit', String(opts.limit))
      if (opts?.series) p.set('series', '1')
      if (opts?.force) p.set('force', '1')
      const res = await authedFetch(`/api/media/search-fill?${p}`)
      if (!res.ok) return { items: [], autoImported: false }
      const data: { items: BackendMedia[]; auto_imported: boolean } = await res.json()
      return { items: (data.items ?? []).map(mapMedia), autoImported: data.auto_imported ?? false }
    } catch {
      return { items: [], autoImported: false }
    }
  }

  // Builds a /api/media URL with optional type/sort. type omitted ⇒ all types.
  private mediaUrl(opts: { type?: MediaType; sort?: string; limit: number }): string {
    const p = new URLSearchParams({ limit: String(opts.limit) })
    if (opts.type) p.set('type', opts.type)
    if (opts.sort) p.set('sort', opts.sort)
    return `/api/media?${p}`
  }

  popular(type: MediaType | undefined, limit: number): Promise<CatalogItem[]> {
    return this.fetchPage(this.mediaUrl({ type, sort: 'popular', limit }))
  }

  recent(type: MediaType | undefined, limit: number): Promise<CatalogItem[]> {
    return this.fetchPage(this.mediaUrl({ type, limit }))
  }

  async notablePeople(limit: number): Promise<PersonHit[]> {
    try {
      const res = await authedFetch(`/api/people/popular?limit=${limit}`)
      if (!res.ok) return []
      const data: { items?: { uuid: string; name: string; photo_url?: string; credit_count?: number }[] } = await res.json()
      return (data.items ?? []).map((p) => ({
        uuid: p.uuid,
        name: p.name,
        photoUrl: p.photo_url || undefined,
        creditCount: p.credit_count ?? 0,
      }))
    } catch {
      return []
    }
  }

  async searchPeople(q: string, limit = 30): Promise<PersonHit[]> {
    if (!q.trim()) return []
    try {
      const res = await authedFetch(`/api/people/search?q=${encodeURIComponent(q.trim())}&limit=${limit}`)
      if (!res.ok) return []
      const data: { items?: { uuid: string; name: string; photo_url?: string; credit_count?: number }[] } = await res.json()
      return (data.items ?? []).map((p) => ({
        uuid: p.uuid,
        name: p.name,
        photoUrl: p.photo_url || undefined,
        creditCount: p.credit_count ?? 0,
      }))
    } catch {
      return []
    }
  }

  private async fetchPage(url: string): Promise<CatalogItem[]> {
    const res = await authedFetch(url)
    if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`)
    const data: { items: BackendMedia[] } = await res.json()
    return data.items.map(mapMedia)
  }
}

export const catalogService: ICatalogService = new ApiCatalogService()

/** Compact count formatter: 184200 -> "184k", 1840 -> "1.8k". */
export function compactCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}
