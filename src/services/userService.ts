import { authedFetch } from '../lib/api'

// A public profile resolved from the library backend. The numeric `id` is the
// user id nons-library-server keys shelves/ratings by, so it's how we fetch a
// user's library after resolving their identity here.
export type PublicProfile = {
  id: number
  name: string
  username: string
  avatarUrl?: string
  /** Banner colour as stored ("F12312"); empty/absent = automatic. */
  bannerColor?: string
  /** Reserved for an uploaded banner image (a Horizon feature). */
  bannerUrl?: string
  bio?: string
  /** "City, Country" when the owner lets this viewer see it. */
  location?: string
}

// nons-library-server GET /api/profiles/:username.
type ProfileResponse = {
  id: number
  name?: string
  surname?: string
  username: string
  profile_picture?: string
  avatar_url?: string
  banner_color?: string
  banner_url?: string
  bio?: string
  location_country?: string
  location_city?: string
}

// Resolve a public profile by username. Returns null when the user doesn't exist
// or the backend is unreachable.
export async function fetchPublicProfile(username: string): Promise<PublicProfile | null> {
  try {
    const res = await authedFetch(`/api/profiles/${encodeURIComponent(username)}`)
    if (!res.ok) return null
    const p: ProfileResponse = await res.json()
    return {
      id: p.id,
      name: [p.name, p.surname].filter(Boolean).join(' ') || p.username,
      username: p.username,
      avatarUrl: p.avatar_url || p.profile_picture || undefined,
      bannerColor: p.banner_color || undefined,
      bannerUrl: p.banner_url || undefined,
      bio: p.bio || undefined,
      location: [p.location_city, p.location_country].filter(Boolean).join(', ') || undefined,
    }
  } catch {
    return null
  }
}

// A SomeShelf account found by the search page's Users tab.
export type UserHit = {
  id: number
  username: string
  name: string
  avatarUrl?: string
}

// nons-library-server GET /api/search/users — username or name, exact matches
// first (the server ranks them). Signed-in only; [] when signed out or on error.
export async function searchUsers(q: string, limit = 30): Promise<UserHit[]> {
  try {
    const res = await authedFetch(`/api/search/users?q=${encodeURIComponent(q)}&limit=${limit}`)
    if (!res.ok) return []
    const data: { users?: { id: number; username: string; name?: string; avatar_url?: string }[] } = await res.json()
    return (data.users ?? []).map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name || u.username,
      avatarUrl: u.avatar_url || undefined,
    }))
  } catch {
    return []
  }
}
