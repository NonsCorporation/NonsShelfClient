import { authedFetch, nonsFetch, NONS_API_URL } from '../lib/api'
import type { MediaType } from '../types'

export type ActivityType = 'rated' | 'finished' | 'started' | 'added' | 'reviewed' | 'progress' | 'dnf' | 'challenge_joined'

// Drives the "<Name> liked/reposted/commented on this" banner shown atop a
// post, above its own author row — surfaced when the actor is one of the
// viewer's friends who reacted to that (someone else's) post, so the reaction
// itself becomes visible in the feed, not just on the reacted-to post's own
// page. 'repost' has no backend equivalent yet (kept for forward-compat).
export type UserReactionPayload = {
  type: 'like' | 'repost' | 'comment'
  actorId: number
  actorName: string
  actorAvatarUrl?: string
}

export type Activity = {
  id: string
  /** The stored feed post's id — what comments attach to and deletion targets. */
  postId: number
  /** The subject's nons user id — who performed the action (the comment target). */
  userId: number
  user: { name: string; handle: string; color: string; uuid?: string; avatarUrl?: string; role?: string }
  type: ActivityType
  mediaId: number
  mediaUuid?: string
  mediaTitle: string
  mediaType: MediaType
  mediaAuthor?: string
  /** Public uuid of the primary author/director, for linking to /p/<uuid>. */
  makerUuid?: string
  mediaYear?: number
  mediaDescription?: string
  coverUrl?: string
  /** Rating out of 10, when the activity carries one. */
  rating?: number
  /** Short review snippet for `reviewed` activities. */
  text?: string
  /** `progress` activities: how far through (percent and/or page). */
  progressPct?: number
  page?: number
  /** Relative time, e.g. "2h", "1d". */
  timeAgo: string
  /** Absolute event time, Unix seconds — used for date grouping. */
  at: number
  /** Who reacted to this post and how, for the banner above the author row. */
  userReactionPayload?: UserReactionPayload
  /** Set for `challenge_joined` events (no media): the joined challenge, so the
   *  feed can render a challenge card and link to it. */
  challenge?: {
    uuid: string
    title: string
    official: boolean
    period: '' | 'yearly' | 'monthly'
    year: number
    /** The subject's numeric goal (their personal goal, else the shared target);
     *  undefined when the challenge has no fixed number. */
    goal?: number
    /** What the goal is counted in ('book' | 'film' | 'series'), for the label. */
    mediaType?: MediaType
  }
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
  avatar_url?: string // may be a nons-relative path (/img/avatars/…)
}

// nons-library-server GET /api/activity
type ActivityEvent = {
  user_id: number
  post_id: number
  type: ActivityType
  value?: number
  note?: string // reviewed: the review text
  progress_pct?: number // progress: 0..100
  page?: number // progress: current page (books)
  at: number // unix seconds
  user_role?: string // librarian role, when the server includes it
  media?: { id: number; uuid?: string; type: MediaType; title: string; author?: string; maker_uuid?: string; year?: number; description?: string; cover_url: string }
  // Set for challenge_joined events (no media): the full challenge row.
  challenge?: { uuid: string; title: string; official: boolean; period: string; start_date: number; media_type?: string }
  // The subject's goal on a challenge_joined event (personal goal, else shared
  // target); absent when the challenge has no fixed number.
  goal?: number
  // The subject user's chosen edition (when set) — overrides the work's cover/
  // title so the feed matches their library/reading list.
  edition_title?: string
  edition_cover?: string
  // Set when this event is a group member's like/comment on someone else's
  // post rather than that post's own author posting it.
  reaction?: { actor_id: number; type: 'like' | 'comment' }
}

// The current user, so their own activity (shelf state changes, ratings) shows
// in the feed alongside friends'.
export type FeedSelf = { id: number; name: string; handle: string; uuid?: string; avatar?: string; role?: string }

/** Absolutize a nons-relative avatar path so it loads from any origin. */
function nonsAvatar(url?: string): string | undefined {
  if (!url) return undefined
  return url.startsWith('/') ? `${NONS_API_URL}${url}` : url
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const PALETTE = ['#6768ab', '#c2557a', '#3e8e7e', '#b8843b', '#5b6cc0', '#8a5bc0', '#c05b5b', '#3e8ec0']

/** Deterministic avatar colour per handle, so friends keep their colour. */
export function colorFor(handle: string): string {
  let h = 0
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

/** Fetch the caller's friends from nons-server and return a map of
 *  library-user-id → display info. Includes the caller themselves so their
 *  own entries appear alongside friends'. */
export async function getFriendUsers(me: FeedSelf): Promise<Map<number, Activity['user']>> {
  let friendships: Friendship[] = []
  try {
    const res = await nonsFetch('/api/friendships/friends?limit=50')
    if (res.ok) friendships = (await res.json()).friendships ?? []
  } catch {
    /* nons-server unreachable — fall back to just the caller */
  }
  const friends = new Map<number, Activity['user']>()
  friends.set(me.id, { name: me.name, handle: me.handle, color: colorFor(me.handle), uuid: me.uuid, avatarUrl: nonsAvatar(me.avatar), role: me.role })
  for (const f of friendships) {
    const friendId = f.requester_id === me.id ? f.addressee_id : f.requester_id
    friends.set(friendId, {
      name: f.name || f.username,
      handle: f.username,
      color: colorFor(f.username),
      uuid: f.uuid || undefined,
      avatarUrl: nonsAvatar(f.avatar_url),
    })
  }
  return friends
}

function timeAgo(at: number): string {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - at))
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`
  return `${Math.floor(s / (7 * 86400))}w`
}

// Resolves a wire reaction's actor against the friends map (which also
// includes the viewer themselves — see getFriendUsers) into a display-ready
// UserReactionPayload. undefined when there's no reaction, or the actor can't
// be resolved (e.g. getUserActivity's single-user queries, which pass no map).
function toReactionPayload(e: ActivityEvent, friends?: Map<number, Activity['user']>): UserReactionPayload | undefined {
  if (!e.reaction) return undefined
  const actor = friends?.get(e.reaction.actor_id)
  if (!actor) return undefined
  return { type: e.reaction.type, actorId: e.reaction.actor_id, actorName: actor.name, actorAvatarUrl: actor.avatarUrl }
}

// Map a wire event to an Activity, branching on whether it's a media event or a
// non-media challenge event (challenge_joined). Challenge events carry no media,
// so media fields get harmless placeholders and `challenge` is populated
// instead; the feed renders those with a dedicated card.
function toActivity(e: ActivityEvent, user: Activity['user'], friends?: Map<number, Activity['user']>): Activity {
  const base = {
    // Reaction events reuse the same postId as the post they reacted to, so
    // they need a distinct client id to avoid colliding as a React list key
    // when both appear on the same feed page.
    id: e.reaction ? `r-${e.post_id}-${e.reaction.actor_id}-${e.reaction.type}` : `p-${e.post_id}`,
    postId: e.post_id,
    userId: e.user_id,
    user,
    type: e.type,
    timeAgo: timeAgo(e.at),
    at: e.at,
    userReactionPayload: toReactionPayload(e, friends),
  }
  if (e.type === 'challenge_joined' && e.challenge) {
    return {
      ...base,
      mediaId: 0,
      mediaTitle: e.challenge.title,
      mediaType: 'book',
      challenge: {
        uuid: e.challenge.uuid,
        title: e.challenge.title,
        official: e.challenge.official,
        period: (e.challenge.period as '' | 'yearly' | 'monthly') || '',
        year: new Date(e.challenge.start_date * 1000).getUTCFullYear(),
        goal: e.goal || undefined,
        mediaType: (e.challenge.media_type as MediaType) || undefined,
      },
    }
  }
  return {
    ...base,
    mediaId: e.media!.id,
    mediaUuid: e.media!.uuid || undefined,
    mediaTitle: e.edition_title || e.media!.title,
    mediaType: e.media!.type,
    mediaAuthor: e.media!.author || undefined,
    makerUuid: e.media!.maker_uuid || undefined,
    mediaYear: e.media!.year || undefined,
    mediaDescription: e.media!.description || undefined,
    coverUrl: e.edition_cover || e.media!.cover_url || undefined,
    rating: e.value || undefined,
    text: e.note || undefined,
    progressPct: e.progress_pct || undefined,
    page: e.page || undefined,
  }
}

// One page of friends-activity plus the total event count, for pagination.
export type ActivityPage = { items: Activity[]; total: number }

export interface IActivityService {
  /** One page of library activity of the user + their nons friends, newest
   *  first. `page` is zero-based. */
  getFriendsActivity(me: FeedSelf, page?: number, perPage?: number): Promise<ActivityPage>
}

class ApiActivityService implements IActivityService {
  async getFriendsActivity(me: FeedSelf, page = 0, perPage = 20): Promise<ActivityPage> {
    const friends = await getFriendUsers(me)

    const ids = [...friends.keys()].join(',')
    const params = new URLSearchParams({ user_ids: ids, limit: String(perPage), offset: String(page * perPage) })
    const res = await authedFetch(`/api/activity?${params}`)
    if (!res.ok) return { items: [], total: 0 }
    const body = await res.json()
    const events: ActivityEvent[] = body.items ?? []

    const items = events
      .filter((e) => (e.media || e.challenge) && friends.has(e.user_id))
      .map((e) => toActivity(e, { ...friends.get(e.user_id)!, ...(e.user_role ? { role: e.user_role } : {}) }, friends))

    return { items, total: body.total ?? items.length }
  }
}

export const activityService: IActivityService = new ApiActivityService()

/** Fetch one page of a single user's public activity posts. */
export async function getUserActivity(
  userId: number,
  userInfo: Activity['user'],
  page = 0,
  perPage = 10,
): Promise<ActivityPage> {
  const params = new URLSearchParams({ user_ids: String(userId), limit: String(perPage), offset: String(page * perPage) })
  const res = await authedFetch(`/api/activity?${params}`)
  if (!res.ok) return { items: [], total: 0 }
  const body = await res.json()
  const events: ActivityEvent[] = body.items ?? []
  return {
    items: events
      .filter((e) => e.media || e.challenge)
      .map((e) => toActivity(e, { ...userInfo, ...(e.user_role ? { role: e.user_role } : {}) })),
    total: body.total ?? 0,
  }
}
