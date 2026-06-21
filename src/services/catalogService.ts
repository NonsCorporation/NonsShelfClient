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
