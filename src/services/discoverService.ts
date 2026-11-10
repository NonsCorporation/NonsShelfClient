import { authedFetch } from '../lib/api'
import type { MediaType } from '../types'
import { mapMedia, type BackendMedia, type CatalogItem } from './catalogService'

// The Discover page's sections, each computed server-side (see the backend
// discover module) and fetched 1:1 by the calls below. The page renders what
// it's given — no in-memory grouping/sorting.

export type DiscoverGenre = { genre: string; items: CatalogItem[] }

export type DiscoverPerson = {
  key: string
  name: string
  role: 'author' | 'director'
  uuid?: string
  works: CatalogItem[]
}

// A review that members have reacted to, with the work it's about.
export type PopularReview = {
  /** Review (rating row) id — the like/comment target. */
  id: number
  /** Public id, for the ?review= link to the review on its media page. */
  uuid: string
  userId: number
  username?: string
  name?: string
  avatarUrl?: string
  /** 1..10, or 0 for a review with no score. */
  value: number
  review: string
  updatedAt: number
  likeCount: number
  commentCount: number
  media: CatalogItem
}

export type Spotlights = { book: CatalogItem[]; movie: CatalogItem[]; series: CatalogItem[] }

// scope → query string. "all" (undefined) omits the type param.
const scope = (type?: MediaType) => (type ? `?type=${type}` : '')

// Discovery data is live, so every call bypasses the HTTP cache — the browser
// must never replay a stale "newest/trending" snapshot from an earlier fetch.
const noCache: RequestInit = { cache: 'no-store' }

// Fetches a section that returns { items: [...media rows...] }.
async function items(path: string): Promise<CatalogItem[]> {
  try {
    const res = await authedFetch(path, noCache)
    if (!res.ok) return []
    const data = (await res.json()) as { items?: BackendMedia[] }
    return (data.items ?? []).map(mapMedia)
  } catch {
    return []
  }
}

export const discoverService = {
  hero: (type?: MediaType) => items(`/api/discover/hero${scope(type)}`),
  trending: (type?: MediaType) => items(`/api/discover/trending${scope(type)}`),
  newest: (type?: MediaType) => items(`/api/discover/newest${scope(type)}`),
  newReleases: (type?: MediaType) => items(`/api/discover/new-releases${scope(type)}`),

  async spotlights(): Promise<Spotlights> {
    try {
      const res = await authedFetch('/api/discover/spotlights', noCache)
      if (!res.ok) return { book: [], movie: [], series: [] }
      const d = (await res.json()) as Record<'book' | 'movie' | 'series', BackendMedia[] | undefined>
      return {
        book: (d.book ?? []).map(mapMedia),
        movie: (d.movie ?? []).map(mapMedia),
        series: (d.series ?? []).map(mapMedia),
      }
    } catch {
      return { book: [], movie: [], series: [] }
    }
  },

  // The most-liked / most-discussed reviews. Public, so signed-out visitors see
  // them too. Never throws — failures resolve to an empty list.
  async popularReviews(limit = 6, type?: MediaType): Promise<PopularReview[]> {
    try {
      const params = new URLSearchParams({ limit: String(limit) })
      if (type) params.set('type', type)
      const res = await authedFetch(`/api/reviews/popular?${params}`, noCache)
      if (!res.ok) return []
      const d = (await res.json()) as {
        items?: {
          id: number; uuid?: string; user_id: number; username?: string; name?: string; avatar_url?: string
          value: number; review: string; updated_at: number
          like_count: number; comment_count: number; media?: BackendMedia
        }[]
      }
      return (d.items ?? [])
        .filter((r) => r.media)
        .map((r) => ({
          id: r.id,
          uuid: r.uuid ?? '',
          userId: r.user_id,
          username: r.username || undefined,
          name: r.name || undefined,
          avatarUrl: r.avatar_url || undefined,
          value: r.value,
          review: r.review,
          updatedAt: r.updated_at,
          likeCount: r.like_count,
          commentCount: r.comment_count,
          media: mapMedia(r.media!),
        }))
    } catch {
      return []
    }
  },

  async genres(type?: MediaType): Promise<DiscoverGenre[]> {
    try {
      const res = await authedFetch(`/api/discover/genres${scope(type)}`, noCache)
      if (!res.ok) return []
      const d = (await res.json()) as { genres?: { genre: string; items?: BackendMedia[] }[] }
      return (d.genres ?? []).map((g) => ({ genre: g.genre, items: (g.items ?? []).map(mapMedia) }))
    } catch {
      return []
    }
  },

  async people(type?: MediaType): Promise<DiscoverPerson[]> {
    try {
      const res = await authedFetch(`/api/discover/people${scope(type)}`, noCache)
      if (!res.ok) return []
      const d = (await res.json()) as {
        people?: { key: string; name: string; role: 'author' | 'director'; uuid?: string; works?: BackendMedia[] }[]
      }
      return (d.people ?? []).map((p) => ({
        key: p.key,
        name: p.name,
        role: p.role,
        uuid: p.uuid || undefined,
        works: (p.works ?? []).map(mapMedia),
      }))
    } catch {
      return []
    }
  },
}
