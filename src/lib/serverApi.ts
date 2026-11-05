import 'server-only'
import type { BackendMedia, MediaCredits, Edition } from './mediaMap'
import type { CuratedListDetail } from '../types'

// Server-side reads of nons-library-server's public catalog endpoints, used to
// server-render the /b and /m pages for anonymous visitors and crawlers.
//
// The browser talks to the API same-origin (NEXT_PUBLIC_LIBRARY_API_URL=''),
// but the Next.js server has no "same origin" — it must reach the library
// server directly. Set LIBRARY_SERVER_URL in production; dev falls back to the
// public URL and then localhost:8081.
const SERVER_API =
  process.env.LIBRARY_SERVER_URL ||
  process.env.NEXT_PUBLIC_LIBRARY_API_URL ||
  'http://localhost:8081'

// Catalog data changes rarely; cache server responses and revalidate hourly so
// pages stay fast and we don't hammer the API on every crawl.
const REVALIDATE_SECONDS = 3600

async function getJson<T>(path: string, revalidate = REVALIDATE_SECONDS): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_API}${path}`, {
      next: { revalidate },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** Public catalog row by numeric id or uuid. Null when missing/unreachable. */
export function getPublicMedia(id: string): Promise<BackendMedia | null> {
  return getJson<BackendMedia>(`/api/media/${encodeURIComponent(id)}`)
}

/** Cast & crew, normalized to the shape MediaOne expects (never null). */
export async function getPublicCredits(id: string): Promise<MediaCredits> {
  const data = await getJson<MediaCredits>(`/api/media/${encodeURIComponent(id)}/credits`)
  return (
    data ?? { cast: [], directors: [], writers: [], authors: [], translators: [] }
  )
}

/** Community score: mean of scored ratings (1..10) and how many there are. */
export async function getPublicRating(id: string): Promise<{ average: number; count: number }> {
  const data = await getJson<{ average?: number; count?: number }>(
    `/api/media/${encodeURIComponent(id)}/reviews?limit=1`,
  )
  return { average: data?.average ?? 0, count: data?.count ?? 0 }
}

export type PublicAltTitle = {
  id: number
  country_code: string
  language: string
  title: string
  overview: string
  title_type: string
}

/** Localized titles/synopses for films & series (empty for books/unavailable). */
export async function getPublicAltTitles(id: string): Promise<PublicAltTitle[]> {
  const data = await getJson<{ titles: PublicAltTitle[] }>(
    `/api/media/${encodeURIComponent(id)}/alt-titles`,
  )
  return data?.titles ?? []
}

/** Book editions (empty for films/series or when unavailable). */
export async function getPublicEditions(id: string): Promise<Edition[]> {
  const data = await getJson<{ editions: Edition[] }>(
    `/api/media/${encodeURIComponent(id)}/editions`,
  )
  return data?.editions ?? []
}

/** Public curated list by numeric id or uuid. Null when missing/unreachable. */
export async function getPublicList(id: string): Promise<CuratedListDetail | null> {
  const data = await getJson<{ list: CuratedListDetail }>(`/api/lists/${encodeURIComponent(id)}`)
  return data?.list ?? null
}

/** What anyone may see of a profile (GET /api/profiles/:username/card): name,
 *  @handle and photo; bio only if public; stats/rating only if the owner's
 *  privacy settings make them public. Null when missing/unreachable. */
export type PublicProfileCard = {
  username: string
  name: string
  avatar_url?: string
  bio?: string
  stats?: { books: number; movies: number; series: number; finished: number }
  rating?: { average: number; count: number }
}

// Profiles change more often than catalog rows: refresh every few minutes.
const PROFILE_REVALIDATE_SECONDS = 300

export function getPublicProfileCard(username: string): Promise<PublicProfileCard | null> {
  return getJson<PublicProfileCard>(`/api/profiles/${encodeURIComponent(username)}/card`, PROFILE_REVALIDATE_SECONDS)
}
