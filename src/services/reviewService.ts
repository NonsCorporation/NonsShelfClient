import { authedFetch } from '../lib/api'

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
