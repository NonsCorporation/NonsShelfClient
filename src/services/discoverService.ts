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
