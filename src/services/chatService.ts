import { LIBRARY_API_URL, authedFetch } from '../lib/api'

// Messaging API (nons-library-server chat module). Plain REST for reads and
// writes; live updates arrive over one WebSocket per tab (see ChatContext).

export type ChatType = 'direct' | 'group'

export type ChatParticipant = {
  user_id: number
  role: 'admin' | 'member'
  username: string
  name: string
  avatar_url?: string
}

/** The quoted message shown above a reply. */
export type ReplyPreview = {
  id: number
  sender_id: number
  content: string
  deleted?: boolean
}

export type ChatMessage = {
  id: number
  chat_id: number
  sender_id: number
  content: string
  created_at: number
  reply_to_id?: number
  reply_to?: ReplyPreview
  edited_at?: number
  deleted_at?: number
  /** Echo of the id the sending tab generated — matches an optimistic bubble
   *  to its real message exactly (only present on the sender's own messages). */
  client_id?: string
  /** Client-only: still being sent (optimistic bubble). */
  pending?: boolean
}

export type Chat = {
  id: number
  type: ChatType
  title: string
  avatar_url?: string
  created_at: number
  updated_at: number
  participants: ChatParticipant[]
  last_message?: ChatMessage
  unread_count: number
}

export type ChatInvite = { token: string; created_at: number }

export type InvitePreview = {
  id: number
  title: string
  avatar_url?: string
  member_count: number
  participants: ChatParticipant[]
  is_member: boolean
}

export type MessagePrivacy = 'everyone' | 'friends' | 'following' | 'nobody'

/** Live events pushed over the socket. */
export type ChatEvent =
  | { type: 'new_message'; message: ChatMessage }
  | { type: 'message_updated'; message: ChatMessage }
  | { type: 'message_deleted'; message: ChatMessage }
  | { type: 'chat_updated'; chat: Chat }
  | { type: 'chat_removed'; chat_id: number }

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; status?: number; code?: string }

async function call<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<Result<T>> {
  try {
    const { json, ...rest } = init ?? {}
    const res = await authedFetch(path, {
      ...rest,
      ...(json !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) } : {}),
    })
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      /* empty / non-JSON body */
    }
    if (res.ok) return { ok: true, data: body as T }
    const b = (body ?? {}) as { error?: string; code?: string }
    return { ok: false, error: b.error || 'Something went wrong. Please try again.', status: res.status, code: b.code }
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }
}

export const chatApi = {
  listChats: () => call<{ chats: Chat[] }>('/api/chats?limit=100'),
  getChat: (id: number) => call<Chat>(`/api/chats/${id}`),
  /** Opens (or reuses) the 1-on-1 chat with a user. 403 code "messages_not_allowed"
   *  when their privacy settings don't let you start a conversation. */
  startDirect: (userId: number) => call<Chat>(`/api/chats/direct/${userId}`, { method: 'POST' }),
  createGroup: (title: string, userIds: number[]) =>
    call<Chat & { skipped_user_ids?: number[] }>('/api/chats/group', { method: 'POST', json: { title, user_ids: userIds } }),
  renameGroup: (id: number, title: string) => call<Chat>(`/api/chats/${id}`, { method: 'PUT', json: { title } }),
  deleteChat: (id: number) => call<unknown>(`/api/chats/${id}`, { method: 'DELETE' }),
  leaveChat: (id: number) => call<unknown>(`/api/chats/${id}/leave`, { method: 'POST' }),
  addMembers: (id: number, userIds: number[]) =>
    call<Chat & { skipped_user_ids?: number[] }>(`/api/chats/${id}/participants`, { method: 'POST', json: { user_ids: userIds } }),
  removeMember: (id: number, userId: number) => call<unknown>(`/api/chats/${id}/participants/${userId}`, { method: 'DELETE' }),

  /** Newest first; pass the oldest loaded id as `before` to page back. */
  messages: (id: number, before?: number, limit = 50) =>
    call<{ messages: ChatMessage[]; has_more: boolean }>(
      `/api/chats/${id}/messages?limit=${limit}${before ? `&before=${before}` : ''}`,
    ),
  send: (id: number, content: string, clientId: string, replyToId?: number) =>
    call<ChatMessage>(`/api/chats/${id}/messages`, {
      method: 'POST',
      json: { content, client_id: clientId, ...(replyToId ? { reply_to_id: replyToId } : {}) },
    }),
  edit: (id: number, messageId: number, content: string) =>
    call<ChatMessage>(`/api/chats/${id}/messages/${messageId}`, { method: 'PUT', json: { content } }),
  remove: (id: number, messageId: number) => call<ChatMessage>(`/api/chats/${id}/messages/${messageId}`, { method: 'DELETE' }),
  markRead: (id: number) => call<unknown>(`/api/chats/${id}/read`, { method: 'POST' }),
  unreadTotal: () => call<{ count: number }>('/api/chat-unread'),

  getInvite: (id: number) => call<{ invite: ChatInvite | null }>(`/api/chats/${id}/invite-link`),
  createInvite: (id: number) => call<{ invite: ChatInvite }>(`/api/chats/${id}/invite-link`, { method: 'POST' }),
  revokeInvite: (id: number) => call<unknown>(`/api/chats/${id}/invite-link`, { method: 'DELETE' }),
  previewInvite: (token: string) => call<InvitePreview>(`/api/chat-invites/${encodeURIComponent(token)}`),
  joinInvite: (token: string) => call<Chat>(`/api/chat-invites/${encodeURIComponent(token)}/join`, { method: 'POST' }),

  getPrivacy: () => call<{ message_privacy: MessagePrivacy }>('/api/chat-settings'),
  setPrivacy: (value: MessagePrivacy) =>
    call<{ message_privacy: MessagePrivacy }>('/api/chat-settings', { method: 'PUT', json: { message_privacy: value } }),
}

/** ws(s):// URL of the chat socket. The session cookie authenticates it (the API
 *  is on the same site), so no token goes in the URL. */
export function chatSocketUrl(): string {
  const base = LIBRARY_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  return base.replace(/^http/i, 'ws').replace(/\/+$/, '') + '/api/chat-socket'
}

/** Max message length (characters), same as the server's limit. */
export const MESSAGE_MAX = 4000
