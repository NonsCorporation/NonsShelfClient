import { authedFetch } from '../lib/api'
import type { ShelfStatus } from '../types'

// Community ratings & reviews for a catalog item, computed server-side from all
// users' ratings (nons-library-server resolves the reviewers' names/avatars from
// nons-server). Powers the "Community" section on the media page.

export type ReviewSort = 'newest' | 'oldest' | 'high' | 'low'

export type CommunityReview = {
  userId: number
  username?: string
  name?: string
  avatarUrl?: string
  /** 1..10, or 0 for a review with no score. */
  value: number
  review?: string
  createdAt: number
  updatedAt: number
}

export type ReviewsPage = {
  items: CommunityReview[]
  /** Entries matching the current filter, for pagination. */
  total: number
  /** Mean score over scored ratings, 1..10 (0 when none). */
  average: number
  /** Number of scored ratings. */
  count: number
}

type WireReview = {
  user_id: number
  username?: string
  name?: string
  avatar_url?: string
  value: number
  review?: string
  created_at: number
  updated_at: number
}

type WirePage = { items?: WireReview[]; total?: number; average?: number; count?: number }

const EMPTY: ReviewsPage = { items: [], total: 0, average: 0, count: 0 }

export interface ReviewQuery {
  sort?: ReviewSort
  withReview?: boolean
  page?: number
  perPage?: number
  /** When set, only return reviews from these user IDs (friends filter). */
  userIds?: number[]
}

// Fetch a page of community reviews + the aggregate score. `mediaId` is the
// numeric catalog id. Never throws — failures resolve to an empty page.
export async function getReviews(mediaId: number | string, q: ReviewQuery = {}): Promise<ReviewsPage> {
  const perPage = q.perPage ?? 10
  const params = new URLSearchParams({
    sort: q.sort ?? 'newest',
    limit: String(perPage),
    offset: String((q.page ?? 0) * perPage),
  })
  if (q.withReview) params.set('with_review', '1')
  if (q.userIds && q.userIds.length > 0) params.set('user_ids', q.userIds.join(','))
  try {
    const res = await authedFetch(`/api/media/${mediaId}/reviews?${params}`)
    if (!res.ok) return EMPTY
    const data: WirePage = await res.json()
    return {
      items: (data.items ?? []).map((r) => ({
        userId: r.user_id,
        username: r.username || undefined,
        name: r.name || undefined,
        avatarUrl: r.avatar_url || undefined,
        value: r.value,
        review: r.review || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total: data.total ?? 0,
      average: data.average ?? 0,
      count: data.count ?? 0,
    }
  } catch {
    return EMPTY
  }
}

// Friends' shelf statuses (want-to-read/reading/etc.) for a catalog item —
// the shelf-status counterpart of getReviews, for friends who added the item
// without rating or reviewing it. Powers the media page's "Friends" section
// alongside getReviews.

export type FriendShelfStatus = {
  userId: number
  username?: string
  name?: string
  avatarUrl?: string
  status: ShelfStatus
  updatedAt: number
}

type WireFriendStatus = {
  user_id: number
  username?: string
  name?: string
  avatar_url?: string
  status: ShelfStatus
  updated_at: number
}

// Fetch friends' shelf statuses for a media item. `userIds` scopes the result
// to that set of users (the friends list). Never throws — failures resolve to
// an empty array.
export async function getFriendShelfStatuses(mediaId: number | string, userIds: number[]): Promise<FriendShelfStatus[]> {
  if (userIds.length === 0) return []
  try {
    const params = new URLSearchParams({ user_ids: userIds.join(',') })
    const res = await authedFetch(`/api/media/${mediaId}/shelf-statuses?${params}`)
    if (!res.ok) return []
    const data: { items?: WireFriendStatus[] } = await res.json()
    return (data.items ?? []).map((s) => ({
      userId: s.user_id,
      username: s.username || undefined,
      name: s.name || undefined,
      avatarUrl: s.avatar_url || undefined,
      status: s.status,
      updatedAt: s.updated_at,
    }))
  } catch {
    return []
  }
}
