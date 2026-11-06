'use client'

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { IoArrowBack, IoArrowUndoOutline, IoClose, IoCreateOutline, IoPaperPlane, IoPeopleOutline, IoTrashOutline } from 'react-icons/io5'
import { Link } from '@/lib/router'
import { useLanguage } from '@/contexts/LanguageContext'
import { useChat } from '@/contexts/ChatContext'
import DropdownMenu from '@/components/ui/DropdownMenu'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { userPath } from '@/lib/paths'
import { MESSAGE_MAX, type Chat, type ChatMessage } from '@/services/chatService'
import MessageEditor, { type MessageEditorHandle } from './MessageEditor'
import { contentToEditorHtml, toMessageContent } from './messageContent'
import { ChatAvatar, MessageText, PersonAvatar, chatTitle, dayLabel, formatClock, otherParticipant, previewText } from './chatFormat'

type Props = {
  chat: Chat
  meId: number
  /** Mobile: back to the list. */
  onBack: () => void
  /** Groups: open the settings panel. */
  onOpenSettings: () => void
}

// Distance from the bottom (px) within which new messages keep the view pinned.
const STICK_PX = 120

const isTouch = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches

// One open conversation: messages, reply/edit/delete, and the composer.
//
// Scrolling note (a lesson from nons): the list is scrolled by setting its own
// scrollTop, never with scrollIntoView — scrollIntoView scrolls every ancestor
// including the page, and on iOS with the keyboard open that panned the whole
// viewport and shoved the chat header off screen.
// Render with key={chat.id}: switching chats remounts, which resets the composer.
export default function ChatThread({ chat, meId, onBack, onOpenSettings }: Props) {
  const { t, language } = useLanguage()
  const { thread, openThread, loadOlder, send, edit, remove } = useChat()
  const th = thread(chat.id)

  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ChatMessage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<MessageEditorHandle>(null)
  const stickToBottom = useRef(true)
  const prevHeight = useRef<{ height: number; top: number } | null>(null)

  // Load (or refresh) this chat's messages whenever it's opened.
  useEffect(() => {
    stickToBottom.current = true
    void openThread(chat.id)
  }, [chat.id, openThread])

  const people = useMemo(() => new Map(chat.participants.map((p) => [p.user_id, p])), [chat.participants])
  const nameOf = (id: number) => (id === meId ? t('chatYou') : people.get(id)?.name || people.get(id)?.username || t('chatDeletedUser'))

  // Keep the view where it should be after messages change:
  // - older messages prepended -> keep the same message under the eye;
  // - otherwise, if we were at the bottom (or just sent) -> stay at the bottom.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (prevHeight.current) {
      el.scrollTop = el.scrollHeight - prevHeight.current.height + prevHeight.current.top
      prevHeight.current = null
      return
    }
    if (stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [th.messages])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX
    if (el.scrollTop < 80 && th.hasMore && !th.loadingOlder) {
      prevHeight.current = { height: el.scrollHeight, top: el.scrollTop }
      void loadOlder(chat.id)
    }
  }

  const startEdit = (m: ChatMessage) => {
    setReplyTo(null)
    setEditing(m)
    // Plain text keeps its line breaks; formatted (HTML) messages open with
    // their formatting.
    setText(contentToEditorHtml(m.content))
    setTimeout(() => input.current?.focus(), 0)
  }
  const startReply = (m: ChatMessage) => {
    setEditing(null)
    setReplyTo(m)
    setTimeout(() => input.current?.focus(), 0)
  }
  const cancelMode = () => {
    if (editing) setText('')
    setEditing(null)
    setReplyTo(null)
  }

  const submit = async () => {
    const content = toMessageContent(text)
    if (!content || sending) return
    if ([...content].length > MESSAGE_MAX) {
      setError(t('chatTooLong', { n: [...content].length, max: MESSAGE_MAX }))
      return
    }
    setError(null)
    if (editing) {
      setSending(true)
      const r = await edit(chat.id, editing.id, content)
      setSending(false)
      if (r.ok) {
        setEditing(null)
        setText('')
      } else setError(r.error)
      return
    }
    const quoted = replyTo
    const draft = text
    setText('')
    setReplyTo(null)
    stickToBottom.current = true
    setSending(true)
    const r = await send(chat.id, content, quoted)
    setSending(false)
    if (!r.ok) {
      // Give the text back so nothing typed is lost.
      setText((cur) => cur || draft)
      setReplyTo((cur) => cur ?? quoted)
      setError(r.error || t('chatSendFailed'))
    }
    if (!isTouch()) input.current?.focus()
  }

  // Escape cancels a reply/edit in progress.
  const onEscape = () => {
    if (!editing && !replyTo) return false
    cancelMode()
    return true
  }

  const doDelete = async () => {
    const m = confirmDelete
    setConfirmDelete(null)
    if (!m) return
    const r = await remove(chat.id, m.id)
    if (!r.ok) setError(r.error)
  }

  // Jump to the message a reply quotes (if it's loaded) and flash it.
  const jumpTo = (id: number) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-mid="${id}"]`)
    const box = scroller.current
    if (!el || !box) return
    box.scrollTop = el.offsetTop - box.clientHeight / 3
    el.classList.add('ring-2', 'ring-nonsprimary')
    setTimeout(() => el.classList.remove('ring-2', 'ring-nonsprimary'), 1200)
  }

  const other = chat.type === 'direct' ? otherParticipant(chat, meId) : undefined
  const title = chatTitle(chat, meId, t('chatDeletedUser'))
  const outgoing = toMessageContent(text)
  const charCount = [...outgoing].length

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2.5">
        <button
          onClick={onBack}
          aria-label={t('chatBack')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] lg:hidden"
        >
          <IoArrowBack className="h-5 w-5" />
        </button>
        {other ? (
          <Link to={userPath(other.username)} className="flex min-w-0 flex-1 items-center gap-3">
            <ChatAvatar chat={chat} meId={meId} size={38} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[var(--text)] hover:underline">{title}</span>
              <span className="block truncate text-xs text-[var(--text-muted)]">@{other.username}</span>
            </span>
          </Link>
        ) : (
          <button onClick={chat.type === 'group' ? onOpenSettings : undefined} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <ChatAvatar chat={chat} meId={meId} size={38} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[var(--text)]">{title}</span>
              {chat.type === 'group' && (
                <span className="block truncate text-xs text-[var(--text-muted)]">{t('chatMembers', { n: chat.participants.length })}</span>
              )}
            </span>
          </button>
        )}
        {chat.type === 'group' && (
          <button
            onClick={onOpenSettings}
            aria-label={t('chatGroupSettings')}
            title={t('chatGroupSettings')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            <IoPeopleOutline className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* messages */}
      <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5">
        {th.loading && th.messages.length === 0 ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 ? 'justify-end' : ''}`}>
                <div className="h-9 w-2/5 animate-pulse rounded-2xl bg-[var(--surface)]" />
              </div>
            ))}
          </div>
        ) : th.error && th.messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--text-muted)]">{th.error}</p>
        ) : th.messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-1 px-6 py-10 text-center">
            <ChatAvatar chat={chat} meId={meId} size={88} />
            <p className="mt-3 text-lg font-semibold text-[var(--text)]">{title}</p>
            <p className="text-sm text-[var(--text-muted)]">
              {other ? `@${other.username}` : t('chatMembers', { n: chat.participants.length })}
            </p>
            {other && (
              <Link
                to={userPath(other.username)}
                className="mt-3 rounded-full border border-[var(--border-subtle)] px-4 py-1.5 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
              >
                {t('chatViewProfile')}
              </Link>
            )}
            <p className="mt-5 text-sm text-[var(--text-muted)]">{t('chatNoMessages')}</p>
          </div>
        ) : (
          <>
            {th.hasMore && (
              <div className="flex justify-center pb-2">
                <button
                  onClick={() => {
                    const el = scroller.current
                    if (el) prevHeight.current = { height: el.scrollHeight, top: el.scrollTop }
                    void loadOlder(chat.id)
                  }}
                  disabled={th.loadingOlder}
                  className="rounded-full px-3 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] disabled:opacity-50"
                >
                  {th.loadingOlder ? t('loading') : t('chatLoadEarlier')}
                </button>
              </div>
            )}
            {th.messages.map((m, i) => {
              const prev = th.messages[i - 1]
              const own = m.sender_id === meId
              const newDay = !prev || new Date(prev.created_at * 1000).toDateString() !== new Date(m.created_at * 1000).toDateString()
              const firstOfRun = newDay || !prev || prev.sender_id !== m.sender_id || m.created_at - prev.created_at > 300
              const deleted = !!m.deleted_at
              const showSender = chat.type === 'group' && !own && firstOfRun
              return (
                <Fragment key={m.client_id && m.pending ? m.client_id : m.id}>
                  {newDay && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                        {dayLabel(m.created_at, language, t('chatToday'), t('chatYesterday'))}
                      </span>
                    </div>
                  )}
                  <div className={`group flex items-end gap-2 ${own ? 'flex-row-reverse' : ''} ${firstOfRun ? 'mt-3' : 'mt-0.5'}`}>
                    {chat.type === 'group' && !own && (
                      <span className="w-7 flex-shrink-0">
                        {firstOfRun && <PersonAvatar p={people.get(m.sender_id) ?? { user_id: m.sender_id }} size={28} />}
                      </span>
                    )}
                    <div className={`flex max-w-[78%] flex-col ${own ? 'items-end' : 'items-start'}`}>
                      {showSender && <span className="mb-0.5 px-1 text-[11px] font-medium text-[var(--text-muted)]">{nameOf(m.sender_id)}</span>}
                      <div
                        data-mid={m.id}
                        className={`rounded-2xl px-3.5 py-2 text-sm transition-shadow ${
                          deleted
                            ? 'border border-dashed border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)]'
                            : own
                              ? 'bg-[color-mix(in_srgb,var(--text)_16%,transparent)] text-[var(--text)]'
                              : 'bg-[var(--surface)] text-[var(--text)]'
                        } ${m.pending ? 'opacity-60' : ''}`}
                      >
                        {!deleted && m.reply_to && (
                          <button
                            onClick={() => jumpTo(m.reply_to!.id)}
                            className="mb-1.5 block w-full rounded-lg border-l-2 border-nonsprimary bg-[var(--container)] px-2 py-1 text-left text-xs text-[var(--text-muted)]"
                          >
                            <span className="block font-semibold">{nameOf(m.reply_to.sender_id)}</span>
                            <span className="line-clamp-2">
                              {m.reply_to.deleted ? t('chatDeleted') : previewText(m.reply_to.content) || ' '}
                            </span>
                          </button>
                        )}
                        {deleted ? <span className="italic">{t('chatDeleted')}</span> : <MessageText content={m.content} />}
                        <span className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[var(--text-muted)]`}>
                          {m.edited_at && !deleted && <span>{t('chatEdited')}</span>}
                          <span>{formatClock(m.created_at, language)}</span>
                        </span>
                      </div>
                    </div>
                    {!deleted && !m.pending && (
                      <div className="mb-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                        <button
                          onClick={() => startReply(m)}
                          aria-label={t('chatReply')}
                          title={t('chatReply')}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                        >
                          <IoArrowUndoOutline className="h-4 w-4" />
                        </button>
                        {own && (
                          <DropdownMenu
                            items={[
                              { label: t('chatEdit'), icon: <IoCreateOutline className="h-4 w-4" />, onClick: () => startEdit(m) },
                              { label: t('chatDelete'), icon: <IoTrashOutline className="h-4 w-4" />, onClick: () => setConfirmDelete(m), danger: true },
                            ]}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </Fragment>
              )
            })}
          </>
        )}
      </div>

      {/* composer */}
      <div className="flex-shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {(replyTo || editing) && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-[var(--surface)] px-3 py-2 text-xs">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-nonsprimary">
                {editing ? t('chatEditing') : t('chatReplyingTo', { name: nameOf(replyTo!.sender_id) })}
              </span>
              {replyTo && <span className="block truncate text-[var(--text-muted)]">{previewText(replyTo.content)}</span>}
            </span>
            <button onClick={cancelMode} aria-label={t('cancel')} className="rounded-full p-1 text-[var(--text-muted)] hover:text-[var(--text)]">
              <IoClose className="h-4 w-4" />
            </button>
          </div>
        )}
        {error && <p role="alert" className="mb-2 px-1 text-xs text-red-400">{error}</p>}
        <div className="flex items-end gap-1 rounded-3xl border border-[var(--border-subtle)] bg-[var(--input)] py-1 pl-4 pr-1 transition-colors focus-within:border-[var(--primary-ring)]">
          <MessageEditor
            ref={input}
            value={text}
            onChange={setText}
            placeholder={t('chatTypeMessage')}
            submitOnEnter={!isTouch()}
            onSubmit={() => void submit()}
            onEscape={onEscape}
          />
          <button
            onClick={() => void submit()}
            disabled={!outgoing || sending}
            aria-label={editing ? t('save') : t('chatSend')}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-nonsprimary text-white transition-all hover:bg-nonsprimaryfocus disabled:scale-90 disabled:bg-transparent disabled:text-[var(--text-muted)]"
          >
            <IoPaperPlane className="h-4 w-4" />
          </button>
        </div>
        {charCount > MESSAGE_MAX - 500 && (
          <p className={`mt-1 px-1 text-right text-[10px] ${charCount > MESSAGE_MAX ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
            {charCount}/{MESSAGE_MAX}
          </p>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={t('chatDeleteTitle')}
          message={t('chatDeleteText')}
          confirmText={t('chatDelete')}
          cancelText={t('cancel')}
          variant="danger"
          onConfirm={() => void doDelete()}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
