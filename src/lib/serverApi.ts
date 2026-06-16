import 'server-only'
import type { BackendMedia, MediaCredits, Edition } from './mediaMap'

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

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_API}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
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

/** Book editions (empty for films/series or when unavailable). */
export async function getPublicEditions(id: string): Promise<Edition[]> {
  const data = await getJson<{ editions: Edition[] }>(
    `/api/media/${encodeURIComponent(id)}/editions`,
  )
  return data?.editions ?? []
}
