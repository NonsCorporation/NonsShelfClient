import { authedFetch } from '../lib/api'

// Comments hang off a stored feed post (one per shared activity event). Each
// post is auto-created when the event happens, so the client only needs its id.

export interface CommentAuthor {
  id: number
  username: string
  name: string
  avatar_url?: string
}

export interface FeedComment {
  id: number
  parent_id: number | null
  body: string
  created_at: number
  author: CommentAuthor
}

// All comments (and replies) on a feed post, oldest first.
export async function getComments(postId: number): Promise<FeedComment[]> {
  const res = await authedFetch(`/api/feed/comments?post_id=${postId}`)
  if (!res.ok) return []
  return ((await res.json()).items ?? []) as FeedComment[]
}

// Post a comment, or a reply when parentId is given. Returns the saved comment
// with its author resolved.
export async function addComment(postId: number, body: string, parentId?: number): Promise<FeedComment> {
  const res = await authedFetch('/api/feed/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_id: postId, parent_id: parentId ?? null, body }),
  })
  if (!res.ok) throw new Error('Failed to post comment')
  return (await res.json()) as FeedComment
}

// ── Review comments ──────────────────────────────────────────────────────────
// The media-page review section has its OWN comment thread per review, separate
// from any feed post's (unlike likes, review comments and feed comments never
// merge). Keyed by review (rating row) id. Deletion reuses deleteComment below.

export async function getReviewComments(reviewId: number): Promise<FeedComment[]> {
  const res = await authedFetch(`/api/reviews/${reviewId}/comments`)
  if (!res.ok) return []
  return ((await res.json()).items ?? []) as FeedComment[]
}

export async function addReviewComment(reviewId: number, body: string, parentId?: number): Promise<FeedComment> {
  const res = await authedFetch(`/api/reviews/${reviewId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent_id: parentId ?? null, body }),
  })
  if (!res.ok) throw new Error('Failed to post comment')
  return (await res.json()) as FeedComment
}

// Batch comment counts for a list of review ids, keyed by review id (as a string).
export async function getReviewCommentCounts(reviewIds: number[]): Promise<Record<string, number>> {
  if (reviewIds.length === 0) return {}
  const res = await authedFetch('/api/reviews/comment-counts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_ids: reviewIds }),
  })
  if (!res.ok) return {}
  return ((await res.json()).counts ?? {}) as Record<string, number>
}

// Delete the caller's own comment (and any replies beneath it).
export async function deleteComment(id: number): Promise<void> {
  await authedFetch(`/api/feed/comments/${id}`, { method: 'DELETE' })
}

// Delete a feed post (and its comments). The underlying event is kept. Allowed
// for the post's owner or an admin; the server enforces it.
export async function deletePost(postId: number): Promise<void> {
  await authedFetch(`/api/feed/posts/${postId}`, { method: 'DELETE' })
}

// Batch comment counts for a list of post ids, keyed by post id (as a string).
export async function getCommentCounts(postIds: number[]): Promise<Record<string, number>> {
  if (postIds.length === 0) return {}
  const res = await authedFetch('/api/feed/comment-counts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_ids: postIds }),
  })
  if (!res.ok) return {}
  return ((await res.json()).counts ?? {}) as Record<string, number>
}
