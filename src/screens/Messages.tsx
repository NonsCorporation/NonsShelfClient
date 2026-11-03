'use client'

import { useEffect, useState } from 'react'
import { IoChatbubblesOutline, IoClose } from 'react-icons/io5'
import { useSearchParams } from '@/lib/router'
import Layout from '../components/layout/Layout'
import { useAuth } from '../contexts/AuthContext'
import { useChat } from '../contexts/ChatContext'
import { useLanguage } from '../contexts/LanguageContext'
import { chatApi } from '../services/chatService'
import { useKeyboardViewport } from '../lib/useKeyboardViewport'
import { useMediaQuery } from '../lib/useMediaQuery'
import ChatList from '../components/chat/ChatList'
import ChatThread from '../components/chat/ChatThread'
import NewChatModal from '../components/chat/NewChatModal'
import GroupSettingsPanel from '../components/chat/GroupSettingsPanel'

// /messages — chat list + open conversation. The `?chat=<id>` param is the one
// source of truth for which chat is open (nons kept a parallel state copy that
// drifted from the URL and reopened the wrong chat on back/forward).
// Desktop: two panes. Mobile: the list is the page; an open chat is a
// full-screen overlay pinned to the visible viewport so the keyboard can't
// push the composer off-screen.
export default function Messages() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const { chats, chatsLoaded, loadChats, setActiveChat, upsertChat } = useChat()
  const [params, setParams] = useSearchParams()
  const chatParam = Number(params.get('chat')) || null

  const [newOpen, setNewOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // The id we tried to fetch and the server said no (not a member / gone).
  const [missingId, setMissingId] = useState<number | null>(null)

  const chat = chatParam ? chats.find((c) => c.id === chatParam) ?? null : null
  const desktop = useMediaQuery('(min-width: 1024px)')
  const overlay = !!chatParam && !desktop
  const kb = useKeyboardViewport(overlay)

  useEffect(() => {
    void loadChats()
  }, [loadChats])

  // Tell the context which chat is on screen (no unread bumps, mark-read on arrival).
  useEffect(() => {
    setActiveChat(chatParam)
    return () => setActiveChat(null)
  }, [chatParam, setActiveChat])

  // Deep link to a chat that isn't in the loaded list yet (e.g. from a
  // profile's "Message" button or a just-accepted invite) — fetch it directly.
  useEffect(() => {
    if (!chatParam || !chatsLoaded || chat) return
    let cancelled = false
    chatApi.getChat(chatParam).then((r) => {
      if (cancelled) return
      if (r.ok) upsertChat(r.data)
      else setMissingId(chatParam)
    })
    return () => { cancelled = true }
  }, [chatParam, chatsLoaded, chat, upsertChat])

  // Lock page scroll behind the mobile overlay.
  useEffect(() => {
    if (!overlay) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [overlay])

  if (!user) return null

  const open = (id: number, msg?: string) => {
    setNotice(msg ?? null)
    setSettingsOpen(false)
    const next = new URLSearchParams(params)
    next.set('chat', String(id))
    setParams(next)
  }
  const close = () => {
    setSettingsOpen(false)
    const next = new URLSearchParams(params)
    next.delete('chat')
    setParams(next)
  }

  const notFound = chatParam !== null && missingId === chatParam && !chat

  const threadPane = chat ? (
    <ChatThread key={chat.id} chat={chat} meId={user.id} onBack={close} onOpenSettings={() => setSettingsOpen(true)} />
  ) : notFound ? (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-[var(--text-muted)]">{t('chatNotFound')}</p>
      <button onClick={close} className="text-sm font-medium text-nonsprimary hover:underline">{t('chatBack')}</button>
    </div>
  ) : chatParam ? (
    <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">{t('loading')}</div>
  ) : (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-[var(--text-muted)]">
      <IoChatbubblesOutline className="h-10 w-10 opacity-60" />
      <p className="text-sm">{t('chatPick')}</p>
    </div>
  )

  return (
    <Layout>
      {notice && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-muted)]">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label={t('close')} className="rounded p-0.5 hover:text-[var(--text)]">
            <IoClose className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="lg:flex lg:h-[calc(100dvh-10rem)] lg:min-h-[480px] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-[var(--border)] lg:bg-[var(--container)]">
        <div className="lg:flex lg:w-80 lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-[var(--border-subtle)]">
          <ChatList
            chats={chats}
            loaded={chatsLoaded}
            meId={user.id}
            activeId={chatParam}
            onSelect={(id) => open(id)}
            onNew={() => setNewOpen(true)}
          />
        </div>

        {/* desktop: right pane */}
        {desktop && <div className="flex min-w-0 flex-1 flex-col">{threadPane}</div>}
      </div>

      {/* mobile: full-screen overlay */}
      {overlay && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg)]" style={kb}>
          {threadPane}
        </div>
      )}

      {newOpen && (
        <NewChatModal
          meId={user.id}
          onClose={() => setNewOpen(false)}
          onOpen={(id, msg) => {
            setNewOpen(false)
            open(id, msg)
          }}
        />
      )}

      {settingsOpen && chat && chat.type === 'group' && (
        <GroupSettingsPanel
          chat={chat}
          meId={user.id}
          onClose={() => setSettingsOpen(false)}
          onGone={() => {
            setSettingsOpen(false)
            close()
          }}
        />
      )}
    </Layout>
  )
}
