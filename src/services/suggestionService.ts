import { authedFetch } from '../lib/api'

export type ActionType =
  | 'add_edition'
  | 'update_edition'
  | 'delete_edition'
  | 'update_media'
  | 'add_credit'
  | 'delete_credit'
  | 'add_person'
  | 'update_person'
  | 'set_maker'
  | 'add_episode'
  | 'update_episode'
  | 'delete_episode'
  | 'add_relation'
  | 'delete_relation'
  | 'add_series_item'
  | 'remove_series_item'
  | 'add_franchise_member'
  | 'remove_franchise_member'

export interface Suggestion {
  id: number
  uuid: string
  user_id: number
  user_handle?: string
  action_type: ActionType
  target_id?: string
  payload: unknown
  note?: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by?: number
  review_note?: string
  created_at: number
  reviewed_at?: number
}

async function jsonOrThrow(res: Response): Promise<unknown> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch { /* keep status */ }
    throw new Error(msg)
  }
  return res.json()
}

export const suggestionService = {
  async submit(actionType: ActionType, targetId: string, payload: unknown, note?: string): Promise<Suggestion> {
    return jsonOrThrow(
      await authedFetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: actionType,
          target_id: targetId,
          payload,
          note: note ?? '',
        }),
      }),
    ) as Promise<Suggestion>
  },

  async list(params?: {
    status?: 'pending' | 'approved' | 'rejected'
    offset?: number
    limit?: number
  }): Promise<{ items: Suggestion[]; total: number }> {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.offset) q.set('offset', String(params.offset))
    if (params?.limit) q.set('limit', String(params.limit))
    const qs = q.toString() ? `?${q.toString()}` : ''
    return jsonOrThrow(await authedFetch(`/api/suggestions${qs}`)) as Promise<{
      items: Suggestion[]
      total: number
    }>
  },

  async approve(id: number): Promise<void> {
    await jsonOrThrow(await authedFetch(`/api/suggestions/${id}/approve`, { method: 'POST' }))
  },

  async reject(id: number, note?: string): Promise<void> {
    await jsonOrThrow(
      await authedFetch(`/api/suggestions/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note ?? '' }),
      }),
    )
  },
}
