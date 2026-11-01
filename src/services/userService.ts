import { authedFetch } from '../lib/api'

// A public profile resolved from the library backend. The numeric `id` is the
// user id nons-library-server keys shelves/ratings by, so it's how we fetch a
// user's library after resolving their identity here.
export type PublicProfile = {
  id: number
  name: string
  username: string
  avatarUrl?: string
}

// nons-library-server GET /api/profiles/:username.
type ProfileResponse = {
  id: number
  name?: string
  surname?: string
  username: string
  profile_picture?: string
  avatar_url?: string
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
    }
  } catch {
    return null
  }
}
