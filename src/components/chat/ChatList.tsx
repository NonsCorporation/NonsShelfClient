'use client'

import { useMemo, useState } from 'react'
import { IoCreateOutline, IoSearchOutline } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'
import type { Chat } from '@/services/chatService'
import { ChatAvatar, chatTitle, formatChatTime, otherParticipant, previewText } from './chatFormat'

type Props = {
  chats: Chat[]
  loaded: boolean
  meId: number
  activeId: number | null
  onSelect: (chatId: number) => void
  onNew: () => void
}

// The conversation list: most recent activity first, unread counts, and a quick
// filter by name. Selecting a chat only changes the URL (the page derives the
// open chat from ?chat=, see screens/Messages.tsx).
export default function ChatList({ chats, loaded, meId, activeId, onSelect, onNew }: Props) {
  const { t, language } = useLanguage()
  const [query, setQuery] = useState('')

  const deleted = t('chatDeletedUser')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return chats
    return chats.filter((c) => {
      const title = chatTitle(c, meId, deleted).toLowerCase()
      return title.includes(q) || c.participants.some((p) => p.username.toLowerCase().includes(q))
    })
  }, [chats, query, meId, deleted])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">{t('chatTitle')}</h1>
        <button
          onClick={onNew}
          aria-label={t('chatNew')}
          title={t('chatNew')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-nonsprimary"
        >
          <IoCreateOutline className="h-5 w-5" />
        </button>
      </div>

      <div className="relative mx-4 mb-2">
        <IoSearchOutline className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('chatSearchPlaceholder')}
          aria-label={t('chatSearchPlaceholder')}
          className="h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
        {!loaded ? (
          <div className="space-y-1 px-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
                <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--surface)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--surface)]" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--surface)]" />
                </div>
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-[var(--text)]">{query ? t('chatNoPeople') : t('chatEmpty')}</p>
            {!query && <p className="mt-1 text-xs text-[var(--text-muted)]">{t('chatEmptyHint')}</p>}
          </div>
        ) : (
          <ul className="px-2">
            {shown.map((c) => {
              const last = c.last_message
              const mine = last && last.sender_id === meId
              const other = c.type === 'direct' ? otherParticipant(c, meId) : undefined
              // A chat with no messages yet (just opened from a profile) shows who it is with.
              const preview = last
                ? last.deleted_at ? t('chatDeleted') : previewText(last.content)
                : other ? `@${other.username}` : t('chatMembers', { n: c.participants.length })
              const active = c.id === activeId
              return (
                <li key={c.id}>
                  <button
                    onClick={() => onSelect(c.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      active ? 'bg-[var(--surface-active)]' : 'hover:bg-[var(--surface)]'
                    }`}
                  >
                    <ChatAvatar chat={c} meId={meId} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${c.unread_count ? 'font-bold' : 'font-semibold'} text-[var(--text)]`}>
                          {chatTitle(c, meId, t('chatDeletedUser'))}
                        </span>
                        {last && (
                          <span className="flex-shrink-0 text-[11px] text-[var(--text-muted)]">{formatChatTime(last.created_at, language)}</span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={`truncate text-xs ${c.unread_count ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
                          {mine && `${t('chatYou')}: `}
                          {preview || ' '}
                        </span>
                        {c.unread_count > 0 && (
                          <span className="flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-nonsprimary px-1.5 text-[10px] font-bold text-white">
                            {c.unread_count > 99 ? '99+' : c.unread_count}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
