import { authedFetch } from '../lib/api'

// Feed-post "likes" — shown in the UI as a chevron (^) rather than a heart.
// Mirrors commentService's shape: batched status/counts so the feed can avoid
// a call per card.

type LikeStatus = { liked: boolean; count: number }

// Every LikeButton asks for its own post's status when it mounts, so a feed page
// would fire one request per card. Calls made within a few ms of each other are
// collected here and answered by the two batch endpoints (counts + who-liked)
// instead — two requests per page however many cards there are.
type LikeBatch = Map<number, { promise: Promise<LikeStatus>; resolve: (s: LikeStatus) => void }>
let pending: LikeBatch | null = null

const BATCH_MS = 10

async function flushLikeStatuses(batch: LikeBatch): Promise<void> {
  const ids = [...batch.keys()]
  let counts: Record<string, number> = {}
  let liked: Record<string, boolean> = {}
  try {
    ;[counts, liked] = await Promise.all([getLikeCounts(ids), getLikeStatuses(ids)])
  } catch {
    /* fall through: everyone gets the empty default */
  }
  for (const [id, entry] of batch) {
    entry.resolve({ liked: !!liked[String(id)], count: counts[String(id)] ?? 0 })
  }
}

export function getLikeStatus(postId: number): Promise<LikeStatus> {
  if (!pending) {
    const batch: LikeBatch = new Map()
    pending = batch
    setTimeout(() => {
      pending = null
      void flushLikeStatuses(batch)
    }, BATCH_MS)
  }
  const existing = pending.get(postId)
  if (existing) return existing.promise // e.g. Strict Mode's second mount
  let resolve!: (s: LikeStatus) => void
  const promise = new Promise<LikeStatus>((r) => { resolve = r })
  pending.set(postId, { promise, resolve })
  return promise
}

export async function addLike(postId: number): Promise<void> {
  await authedFetch(`/api/feed/posts/${postId}/like`, { method: 'PUT' })
}

export async function removeLike(postId: number): Promise<void> {
  await authedFetch(`/api/feed/posts/${postId}/like`, { method: 'DELETE' })
}

// ── Review likes ─────────────────────────────────────────────────────────────
// A review lives on the media page, but its likes are SHARED with the feed post
// that echoes it (both target the same review row server-side) — so liking here
// and liking on the feed are one and the same tally.

export async function getReviewLikeStatus(reviewId: number): Promise<{ liked: boolean; count: number }> {
  const res = await authedFetch(`/api/reviews/${reviewId}/like`)
  if (!res.ok) return { liked: false, count: 0 }
  return res.json()
}

export async function addReviewLike(reviewId: number): Promise<void> {
  await authedFetch(`/api/reviews/${reviewId}/like`, { method: 'PUT' })
}

export async function removeReviewLike(reviewId: number): Promise<void> {
  await authedFetch(`/api/reviews/${reviewId}/like`, { method: 'DELETE' })
}

// Batch like counts for a list of post ids, keyed by post id (as a string).
export async function getLikeCounts(postIds: number[]): Promise<Record<string, number>> {
  if (postIds.length === 0) return {}
  const res = await authedFetch('/api/feed/like-counts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_ids: postIds }),
  })
  if (!res.ok) return {}
  return ((await res.json()).counts ?? {}) as Record<string, number>
}

// Batch like status (has the caller liked each post) for a list of post ids,
// keyed by post id (as a string).
export async function getLikeStatuses(postIds: number[]): Promise<Record<string, boolean>> {
  if (postIds.length === 0) return {}
  const res = await authedFetch('/api/feed/like-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_ids: postIds }),
  })
  if (!res.ok) return {}
  return ((await res.json()).liked ?? {}) as Record<string, boolean>
}
