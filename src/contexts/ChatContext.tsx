'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { chatApi, chatSocketUrl, type Chat, type ChatEvent, type ChatMessage, type Result } from '../services/chatService'

// Messaging state for the whole app: the chat list, a per-chat message cache,
// the unread total (header badge) and ONE live socket per tab that carries
// events for all of the user's chats.
//
// Lessons from nons' chat (kept here on purpose):
// - Threads are cached per chat id, so a slow load for a chat the user already
//   left can't overwrite the one they're looking at, and switching back is
//   instant instead of flashing a spinner.
// - Your own message can arrive over the socket before the send request
//   returns. Each send carries a client_id that comes back on both, so the
//   optimistic bubble is replaced exactly once (nons dropped *every* pending
//   bubble on any own echo, losing a second message sent in the meantime).
// - Reconnect forever with a capped backoff, and on reconnect re-sync what may
//   have been missed while offline (nons gave up after 5 tries).
// - A chat is only marked read while it's open AND the tab is visible.

export type Thread = {
  messages: ChatMessage[] // oldest first
  hasMore: boolean
  loading: boolean
  loadingOlder: boolean
  error: string | null
}

const EMPTY_THREAD: Thread = { messages: [], hasMore: false, loading: false, loadingOlder: false, error: null }

type ChatContextValue = {
  /** Unread messages across all chats (header badge). */
  unreadTotal: number
  chats: Chat[]
  chatsLoaded: boolean
  loadChats: () => Promise<void>
  connected: boolean

  /** The chat the messages page is showing (it sets this from the URL). */
  setActiveChat: (chatId: number | null) => void
  thread: (chatId: number) => Thread
  openThread: (chatId: number) => Promise<void>
  loadOlder: (chatId: number) => Promise<void>

  send: (chatId: number, content: string, replyTo?: ChatMessage | null) => Promise<Result<ChatMessage>>
  edit: (chatId: number, messageId: number, content: string) => Promise<Result<ChatMessage>>
  remove: (chatId: number, messageId: number) => Promise<Result<ChatMessage>>

  startDirect: (userId: number) => Promise<Result<Chat>>
  createGroup: (title: string, userIds: number[]) => Promise<Result<Chat & { skipped_user_ids?: number[] }>>
  /** Put a chat returned by an API call (rename, add members, join…) into the list. */
  upsertChat: (chat: Chat) => void
  /** Drop a chat locally after leaving / deleting it. */
  forgetChat: (chatId: number) => void
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined)

const byActivity = (a: Chat, b: Chat) =>
  (b.last_message?.created_at ?? b.updated_at) - (a.last_message?.created_at ?? a.updated_at) || b.id - a.id

const newClientId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(36).slice(2)}`

const isVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible'

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const me = user?.id ?? 0

  const [unreadTotal, setUnreadTotal] = useState(0)
  const [chats, setChats] = useState<Chat[]>([])
  const [chatsLoaded, setChatsLoaded] = useState(false)
  const [threads, setThreads] = useState<Record<number, Thread>>({})
  const [connected, setConnected] = useState(false)

  // Latest values for the socket handlers (which outlive renders).
  const activeRef = useRef<number | null>(null)
  const meRef = useRef(me)
  const chatsLoadedRef = useRef(false)
  const threadsRef = useRef(threads)
  const chatsRef = useRef(chats)
  useEffect(() => { chatsRef.current = chats }, [chats])
  useEffect(() => { meRef.current = me }, [me])
  useEffect(() => { chatsLoadedRef.current = chatsLoaded }, [chatsLoaded])
  useEffect(() => { threadsRef.current = threads }, [threads])

  const patchThread = useCallback((chatId: number, fn: (t: Thread) => Thread) => {
    setThreads((prev) => ({ ...prev, [chatId]: fn(prev[chatId] ?? EMPTY_THREAD) }))
  }, [])

  const refreshUnread = useCallback(async () => {
    const r = await chatApi.unreadTotal()
    if (r.ok) setUnreadTotal(r.data.count)
  }, [])

  const loadChats = useCallback(async () => {
    const r = await chatApi.listChats()
    if (r.ok) {
      setChats([...r.data.chats].sort(byActivity))
      setChatsLoaded(true)
    }
  }, [])

  // Mark the open chat read (server + local counts), only when actually seen.
  const markRead = useCallback(
    async (chatId: number) => {
      if (!isVisible()) return
      let had = false
      setChats((prev) => prev.map((c) => {
        if (c.id !== chatId || c.unread_count === 0) return c
        had = true
        return { ...c, unread_count: 0 }
      }))
      const r = await chatApi.markRead(chatId)
      if (r.ok && (had || !chatsLoadedRef.current)) void refreshUnread()
    },
    [refreshUnread],
  )

  // ── applying events (from the socket or from our own API responses) ─────────

  /** Insert or replace a message in its thread; reconciles an optimistic bubble
   *  by client_id. Returns whether it was new to the thread. */
  const applyMessage = useCallback(
    (msg: ChatMessage) => {
      let isNew = false
      patchThread(msg.chat_id, (t) => {
        if (t.messages.some((m) => m.id === msg.id)) {
          return { ...t, messages: t.messages.map((m) => (m.id === msg.id ? { ...m, ...msg, pending: false } : m)) }
        }
        isNew = true
        if (msg.client_id) {
          const i = t.messages.findIndex((m) => m.pending && m.client_id === msg.client_id)
          if (i >= 0) {
            const next = t.messages.slice()
            next[i] = { ...msg, pending: false }
            return { ...t, messages: next }
          }
        }
        // Keep chronological order even if events arrive out of order.
        const next = [...t.messages, msg].sort((a, b) => (a.pending ? 1 : 0) - (b.pending ? 1 : 0) || a.id - b.id)
        return { ...t, messages: next }
      })
      return isNew
    },
    [patchThread],
  )

  const bumpChatPreview = useCallback((msg: ChatMessage, countUnread: boolean) => {
    setChats((prev) => {
      if (!prev.some((c) => c.id === msg.chat_id)) return prev
      return prev
        .map((c) =>
          c.id === msg.chat_id
            ? {
                ...c,
                last_message: msg,
                updated_at: Math.max(c.updated_at, msg.created_at),
                unread_count: countUnread ? c.unread_count + 1 : c.unread_count,
              }
            : c,
        )
        .sort(byActivity)
    })
  }, [])

  const refreshPreviewIfLast = useCallback((msg: ChatMessage) => {
    setChats((prev) => prev.map((c) => (c.id === msg.chat_id && c.last_message?.id === msg.id ? { ...c, last_message: msg } : c)))
  }, [])

  const handleEvent = useCallback(
    (ev: ChatEvent) => {
      switch (ev.type) {
        case 'new_message': {
          const msg = ev.message
          const fromOther = msg.sender_id !== meRef.current
          const seenNow = activeRef.current === msg.chat_id && isVisible()
          // A thread we never opened isn't cached: don't create a partial one.
          if (threadsRef.current[msg.chat_id]) applyMessage(msg)
          const countIt = fromOther && !seenNow
          // A chat we didn't know yet (someone just started it / added us): reload the list.
          if (chatsLoadedRef.current && !chatsRef.current.some((c) => c.id === msg.chat_id)) void loadChats()
          bumpChatPreview(msg, countIt)
          if (countIt) setUnreadTotal((n) => n + 1)
          if (fromOther && seenNow) void markRead(msg.chat_id)
          break
        }
        case 'message_updated':
        case 'message_deleted': {
          if (threadsRef.current[ev.message.chat_id]) applyMessage(ev.message)
          refreshPreviewIfLast(ev.message)
          // Replies quoting this message show its new text / deleted state.
          patchThread(ev.message.chat_id, (t) => ({
            ...t,
            messages: t.messages.map((m) =>
              m.reply_to?.id === ev.message.id
                ? { ...m, reply_to: { ...m.reply_to, content: ev.message.content, deleted: !!ev.message.deleted_at } }
                : m,
            ),
          }))
          break
        }
        case 'chat_updated':
          setChats((prev) => {
            const exists = prev.some((c) => c.id === ev.chat.id)
            const merged = exists
              ? prev.map((c) => (c.id === ev.chat.id ? { ...ev.chat, last_message: ev.chat.last_message ?? c.last_message, unread_count: c.unread_count } : c))
              : [...prev, ev.chat]
            return merged.sort(byActivity)
          })
          break
        case 'chat_removed':
          setChats((prev) => prev.filter((c) => c.id !== ev.chat_id))
          setThreads((prev) => {
            const next = { ...prev }
            delete next[ev.chat_id]
            return next
          })
          void refreshUnread()
          break
      }
    },
    [applyMessage, bumpChatPreview, refreshPreviewIfLast, patchThread, markRead, refreshUnread, loadChats],
  )

  // ── the socket ──────────────────────────────────────────────────────────────

  const handleEventRef = useRef(handleEvent)
  useEffect(() => { handleEventRef.current = handleEvent }, [handleEvent])

  useEffect(() => {
    if (!me) return
    let ws: WebSocket | null = null
    let stopped = false
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    // After any (re)connect, fetch what may have been missed while offline.
    const resync = async () => {
      void refreshUnread()
      if (chatsLoadedRef.current) void loadChats()
      const open = activeRef.current
      if (open != null && threadsRef.current[open]) {
        const r = await chatApi.messages(open)
        if (r.ok) [...r.data.messages].reverse().forEach((m) => applyMessage(m))
      }
    }

    const connect = async () => {
      if (stopped) return
      // A cheap authed call first: renews an expired session cookie (the socket
      // handshake itself can't trigger the refresh-and-retry dance).
      await refreshUnread()
      if (stopped) return
      try {
        ws = new WebSocket(chatSocketUrl())
      } catch {
        schedule()
        return
      }
      ws.onopen = () => {
        attempt = 0
        setConnected(true)
        void resync()
      }
      ws.onmessage = (e) => {
        try {
          handleEventRef.current(JSON.parse(e.data) as ChatEvent)
        } catch {
          /* ignore malformed frames */
        }
      }
      ws.onclose = () => {
        setConnected(false)
        ws = null
        schedule()
      }
    }

    const schedule = () => {
      if (stopped || timer) return
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)) + Math.random() * 500
      attempt += 1
      timer = setTimeout(() => {
        timer = null
        void connect()
      }, delay)
    }

    // Coming back to the tab / network: reconnect right away instead of waiting
    // out the backoff, and mark the open chat read if it has news.
    const wake = () => {
      if (!ws && !stopped && navigator.onLine !== false) {
        if (timer) clearTimeout(timer)
        timer = null
        attempt = 0
        void connect()
      }
      if (isVisible() && activeRef.current != null) void markRead(activeRef.current)
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)

    void connect()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
      ws?.close(1000, 'bye')
      setConnected(false)
    }
  }, [me, refreshUnread, loadChats, applyMessage, markRead])

  // Signed out: forget everything.
  useEffect(() => {
    if (me) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setChats([])
    setChatsLoaded(false)
    setThreads({})
    setUnreadTotal(0)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [me])

  // ── actions ─────────────────────────────────────────────────────────────────

  const setActiveChat = useCallback(
    (chatId: number | null) => {
      activeRef.current = chatId
      if (chatId != null) void markRead(chatId)
    },
    [markRead],
  )

  const openThread = useCallback(
    async (chatId: number) => {
      const cached = threadsRef.current[chatId]
      // Cached: show it instantly and refresh quietly; otherwise show loading.
      patchThread(chatId, (t) => ({ ...t, loading: !cached || cached.messages.length === 0, error: null }))
      const r = await chatApi.messages(chatId)
      if (!r.ok) {
        patchThread(chatId, (t) => ({ ...t, loading: false, error: r.error }))
        return
      }
      const fresh = [...r.data.messages].reverse()
      patchThread(chatId, (t) => {
        // Keep pending bubbles and anything newer that arrived meanwhile.
        const known = new Set(fresh.map((m) => m.id))
        const extra = t.messages.filter((m) => m.pending || (!known.has(m.id) && m.id > (fresh[fresh.length - 1]?.id ?? 0)))
        return { ...t, messages: [...fresh, ...extra], hasMore: r.data.has_more, loading: false, error: null }
      })
    },
    [patchThread],
  )

  const loadOlder = useCallback(
    async (chatId: number) => {
      const t = threadsRef.current[chatId]
      if (!t || t.loadingOlder || !t.hasMore) return
      const oldest = t.messages.find((m) => !m.pending)
      if (!oldest) return
      patchThread(chatId, (x) => ({ ...x, loadingOlder: true }))
      const r = await chatApi.messages(chatId, oldest.id)
      patchThread(chatId, (x) => {
        if (!r.ok) return { ...x, loadingOlder: false }
        const known = new Set(x.messages.map((m) => m.id))
        const older = [...r.data.messages].reverse().filter((m) => !known.has(m.id))
        return { ...x, messages: [...older, ...x.messages], hasMore: r.data.has_more, loadingOlder: false }
      })
    },
    [patchThread],
  )

  const send = useCallback(
    async (chatId: number, content: string, replyTo?: ChatMessage | null): Promise<Result<ChatMessage>> => {
      const clientId = newClientId()
      const optimistic: ChatMessage = {
        id: -Date.now(),
        chat_id: chatId,
        sender_id: meRef.current,
        content,
        created_at: Math.floor(Date.now() / 1000),
        client_id: clientId,
        pending: true,
        ...(replyTo ? { reply_to_id: replyTo.id, reply_to: { id: replyTo.id, sender_id: replyTo.sender_id, content: replyTo.content } } : {}),
      }
      patchThread(chatId, (t) => ({ ...t, messages: [...t.messages, optimistic] }))
      bumpChatPreview(optimistic, false)

      const r = await chatApi.send(chatId, content, clientId, replyTo?.id)
      if (r.ok) {
        applyMessage({ ...r.data, client_id: r.data.client_id ?? clientId })
        bumpChatPreview(r.data, false)
      } else {
        // Roll the bubble back; the caller shows the error and keeps the text.
        patchThread(chatId, (t) => ({ ...t, messages: t.messages.filter((m) => m.client_id !== clientId || !m.pending) }))
        void loadChats()
      }
      return r
    },
    [patchThread, bumpChatPreview, applyMessage, loadChats],
  )

  const edit = useCallback(
    async (chatId: number, messageId: number, content: string) => {
      const r = await chatApi.edit(chatId, messageId, content)
      if (r.ok) {
        applyMessage(r.data)
        refreshPreviewIfLast(r.data)
      }
      return r
    },
    [applyMessage, refreshPreviewIfLast],
  )

  const remove = useCallback(
    async (chatId: number, messageId: number) => {
      const r = await chatApi.remove(chatId, messageId)
      if (r.ok) {
        applyMessage(r.data)
        refreshPreviewIfLast(r.data)
      }
      return r
    },
    [applyMessage, refreshPreviewIfLast],
  )

  const upsertChat = useCallback((chat: Chat) => {
    setChats((prev) => {
      const old = prev.find((c) => c.id === chat.id)
      const merged = { ...chat, last_message: chat.last_message ?? old?.last_message, unread_count: old?.unread_count ?? chat.unread_count ?? 0 }
      return (old ? prev.map((c) => (c.id === chat.id ? merged : c)) : [...prev, merged]).sort(byActivity)
    })
  }, [])

  const forgetChat = useCallback((chatId: number) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId))
    setThreads((prev) => {
      const next = { ...prev }
      delete next[chatId]
      return next
    })
    void refreshUnread()
  }, [refreshUnread])

  const startDirect = useCallback(
    async (userId: number) => {
      const r = await chatApi.startDirect(userId)
      if (r.ok) upsertChat(r.data)
      return r
    },
    [upsertChat],
  )

  const createGroup = useCallback(
    async (title: string, userIds: number[]) => {
      const r = await chatApi.createGroup(title, userIds)
      if (r.ok) upsertChat(r.data)
      return r
    },
    [upsertChat],
  )

  const thread = useCallback((chatId: number) => threads[chatId] ?? EMPTY_THREAD, [threads])

  const value = useMemo<ChatContextValue>(
    () => ({
      unreadTotal,
      chats,
      chatsLoaded,
      loadChats,
      connected,
      setActiveChat,
      thread,
      openThread,
      loadOlder,
      send,
      edit,
      remove,
      startDirect,
      createGroup,
      upsertChat,
      forgetChat,
    }),
    [unreadTotal, chats, chatsLoaded, loadChats, connected, setActiveChat, thread, openThread, loadOlder, send, edit, remove, startDirect, createGroup, upsertChat, forgetChat],
  )
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within a ChatProvider')
  return ctx
}

/** For shared chrome (the header) that also renders on public pages without a ChatProvider. */
export function useOptionalChat(): ChatContextValue | null {
  return useContext(ChatContext) ?? null
}
