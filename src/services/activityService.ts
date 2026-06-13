import { authedFetch, nonsFetch } from '../lib/api'
import type { MediaType } from '../types'

export type ActivityType = 'rated' | 'finished' | 'started' | 'added' | 'reviewed'

export type Activity = {
  id: string
  user: { name: string; handle: string; color: string; uuid?: string }
  type: ActivityType
  mediaTitle: string
  mediaType: MediaType
  coverUrl?: string
  /** Rating out of 10, when the activity carries one. */
  rating?: number
  /** Short review snippet for `reviewed` activities. */
  text?: string
  /** Relative time, e.g. "2h", "1d". */
  timeAgo: string
}

// ── Wire types ──────────────────────────────────────────────────────────────

// nons-server GET /api/friendships/friends — username/name belong to the
// *other* user; which side is the friend depends on who requested.
type Friendship = {
  requester_id: number
  addressee_id: number
  status: string
  uuid: string // the *other* user's public id, for /u/<uuid> links
  username: string
  name: string
}

// nons-library-server GET /api/activity
type ActivityEvent = {
  user_id: number
  type: 'added' | 'started' | 'finished' | 'rated'
  value?: number
  at: number // unix seconds
  media?: { id: number; type: MediaType; title: string; cover_url: string }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const PALETTE = ['#6768ab', '#c2557a', '#3e8e7e', '#b8843b', '#5b6cc0', '#8a5bc0', '#c05b5b', '#3e8ec0']

/** Deterministic avatar colour per handle, so friends keep their colour. */
function colorFor(handle: string): string {
  let h = 0
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function timeAgo(at: number): string {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - at))
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`
  return `${Math.floor(s / (7 * 86400))}w`
}

export interface IActivityService {
  /** Recent library activity of the user's nons friends. `myId` is the caller's nons user id. */
  getFriendsActivity(myId: number): Promise<Activity[]>
}

// Two-step fetch across the nons family: friendships live in nons-server (the
// social platform), the library events live in nons-library-server. We resolve
// friend ids + display names there, then ask our own backend for their recent
// shelf/rating events.
class ApiActivityService implements IActivityService {
  async getFriendsActivity(myId: number): Promise<Activity[]> {
    let friendships: Friendship[] = []
    try {
      const res = await nonsFetch('/api/friendships/friends?limit=50')
      if (!res.ok) return []
      friendships = (await res.json()).friendships ?? []
    } catch {
      return [] // nons-server unreachable — feed is just empty
    }

    const friends = new Map<number, Activity['user']>()
    for (const f of friendships) {
      const friendId = f.requester_id === myId ? f.addressee_id : f.requester_id
      friends.set(friendId, {
        name: f.name || f.username,
        handle: f.username,
        color: colorFor(f.username),
        uuid: f.uuid || undefined,
      })
    }
    if (friends.size === 0) return []

    const ids = [...friends.keys()].join(',')
    const res = await authedFetch(`/api/activity?user_ids=${ids}&limit=30`)
    if (!res.ok) return []
    const events: ActivityEvent[] = (await res.json()).items ?? []

    return events
      .filter((e) => e.media && friends.has(e.user_id))
      .map((e) => ({
        id: `${e.user_id}-${e.media!.id}-${e.type}-${e.at}`,
        user: friends.get(e.user_id)!,
        type: e.type,
        mediaTitle: e.media!.title,
        mediaType: e.media!.type,
        coverUrl: e.media!.cover_url || undefined,
        rating: e.value || undefined,
        timeAgo: timeAgo(e.at),
      }))
  }
}

export const activityService: IActivityService = new ApiActivityService()
