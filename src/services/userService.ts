import { nonsFetch } from '../lib/api'

// A public profile resolved from nons-server (the identity provider). The
// numeric `id` is the shared SSO user id — the same id nons-library-server keys
// shelves/ratings by — so it's how we fetch a user's library after resolving
// their identity here.
export type PublicProfile = {
  id: number
  name: string
  username: string
  avatarUrl?: string
}

// nons-server GET /api/user/profile/:username (UserPublicProfileResponse).
type ProfileResponse = {
  id: number
  name?: string
  surname?: string
  username: string
  profile_picture?: string
  avatar_url?: string
}

// Resolve a public profile by username via the identity provider. Returns null
// when the user doesn't exist or nons-server is unreachable.
export async function fetchPublicProfile(username: string): Promise<PublicProfile | null> {
  try {
    const res = await nonsFetch(`/api/user/profile/${encodeURIComponent(username)}`)
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
