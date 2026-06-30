import { authedFetch, nonsFetch } from '../lib/api'

export type NotificationType = 'comment' | 'reply' | 'suggestion_approved' | 'suggestion_rejected'

export interface NotificationActor {
  id: number
  username: string
  name: string
  avatar_url?: string
}

export interface NotificationPost {
  subject_user_id: number
  media_title: string
  media_uuid?: string
  media_type?: string
  kind: string
}

export interface NotificationComment {
  body: string
}

export interface LibNotification {
  id: number
  type: NotificationType
  actor_id?: number
  post_id?: number
  comment_id?: number
  suggestion_id?: number
  read_at?: number
  created_at: number
  actor?: NotificationActor
  comment?: NotificationComment
  post?: NotificationPost
}

export async function getNotifications(limit = 30, offset = 0): Promise<{ items: LibNotification[]; total: number }> {
  const res = await authedFetch(`/api/notifications?limit=${limit}&offset=${offset}`)
  if (!res.ok) return { items: [], total: 0 }
  return res.json()
}

export async function getUnreadCount(): Promise<number> {
  const res = await authedFetch('/api/notifications/unread-count')
  if (!res.ok) return 0
  const data = await res.json()
  return data.count ?? 0
}

export async function markAllRead(): Promise<void> {
  await authedFetch('/api/notifications/read-all', { method: 'PUT' })
}

export async function markRead(id: number): Promise<void> {
  await authedFetch(`/api/notifications/${id}/read`, { method: 'PUT' })
}

// Fetch the total unread count from nons-server (social app).
// Returns 0 on any error — best-effort cross-app count.
export async function getNonsUnreadCount(): Promise<number> {
  try {
    const res = await nonsFetch('/api/notifications/pending')
    if (!res.ok) return 0
    const d = await res.json()
    return (
      (d.post_likes_count ?? 0) +
      (d.comments_count ?? 0) +
      (d.comment_likes_count ?? 0) +
      (d.follows_count ?? 0) +
      (d.mentions_count ?? 0)
    )
  } catch {
    return 0
  }
}
