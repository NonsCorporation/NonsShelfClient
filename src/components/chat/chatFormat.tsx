'use client'

import DOMPurify from 'dompurify'
import { useMemo, type ReactNode } from 'react'
import BoringAvatar from '@/components/ui/BoringAvatar'
import type { Chat, ChatParticipant } from '@/services/chatService'
import { parseLink, type LinkRef } from '@/lib/linkPreview'
import { LinkHoverCard, LinkPreviewCard } from './LinkPreview'

// Display helpers shared by the chat screens.

/** The other person in a direct chat (undefined if they left / were deleted). */
export function otherParticipant(chat: Chat, meId: number): ChatParticipant | undefined {
  return chat.participants.find((p) => p.user_id !== meId)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** What goes in /messages?chat=: the other person's username for a direct chat
 *  (no "@" — it would be percent-encoded), the chat's uuid for a group (numeric
 *  id only as a last resort). A username can't be all digits or uuid-shaped, so
 *  the three forms never collide. */
export function chatRef(chat: Chat, meId: number): string {
  if (chat.type === 'direct') {
    const other = otherParticipant(chat, meId)
    if (other?.username) return other.username
  }
  return chat.uuid || String(chat.id)
}

/** Finds the chat a ?chat= value points at: a uuid (group), an old numeric id,
 *  or a username (the direct chat with that person; a leading "@" is tolerated). */
export function findChatByRef(chats: Chat[], ref: string, meId: number): Chat | null {
  if (UUID_RE.test(ref)) return chats.find((c) => c.uuid?.toLowerCase() === ref.toLowerCase()) ?? null
  if (/^\d+$/.test(ref)) {
    const id = Number(ref)
    return id ? chats.find((c) => c.id === id) ?? null : null
  }
  const name = ref.replace(/^@/, '').toLowerCase()
  return chats.find((c) => c.type === 'direct' && otherParticipant(c, meId)?.username.toLowerCase() === name) ?? null
}

/** True when a ?chat= value can be fetched from the server (uuid or numeric id). */
export const isFetchableChatRef = (ref: string) => UUID_RE.test(ref) || /^\d+$/.test(ref)

export function chatTitle(chat: Chat, meId: number, deletedLabel: string): string {
  if (chat.type === 'group') return chat.title || deletedLabel
  const other = otherParticipant(chat, meId)
  return other ? other.name || other.username : deletedLabel
}

export function ChatAvatar({ chat, meId, size = 40 }: { chat: Chat; meId: number; size?: number }) {
  const other = chat.type === 'direct' ? otherParticipant(chat, meId) : undefined
  const url = chat.type === 'direct' ? other?.avatar_url : chat.avatar_url
  const seed = chat.type === 'direct' ? `user-${other?.user_id ?? 0}` : `chat-${chat.id}`
  return (
    <span className="block flex-shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <BoringAvatar size={size} name={seed} variant={chat.type === 'group' ? 'marble' : 'bauhaus'} />
      )}
    </span>
  )
}

export function PersonAvatar({ p, size = 32 }: { p: { user_id?: number; id?: number; avatar_url?: string; avatarUrl?: string }; size?: number }) {
  const url = p.avatar_url ?? p.avatarUrl
  return (
    <span className="block flex-shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <BoringAvatar size={size} name={`user-${p.user_id ?? p.id ?? 0}`} />
      )}
    </span>
  )
}

const looksLikeHtml = (s: string) => /<\/?[a-z][^>]*>/i.test(s)

/** One-line plain text of a message, for chat-list previews and reply quotes. */
export function previewText(content: string): string {
  // Spoilers must not leak into previews (chat list, reply quotes).
  const text = looksLikeHtml(content)
    ? (DOMPurify.sanitize(content.replace(/<span[^>]*data-spoiler[^>]*>[\s\S]*?<\/span>/gi, '▒▒▒'), { ALLOWED_TAGS: [] }) as string)
    : content
  return text.replace(/\s+/g, ' ').trim()
}

/** Most preview cards shown under a single message. */
const MAX_PREVIEWS = 5

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/gi

const RICH_TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'span']

/** Rich (HTML) message → safe HTML plus the SomeShelf links it contains.
 *  Always sanitized with a small allow-list — nons rendered messages unsanitized,
 *  which let a crafted message run script in other people's browsers. Spoiler
 *  spans keep only a data attribute (we add our own class, never theirs), bare
 *  URLs in the text become links, and links open in a new tab without giving the
 *  target page access to ours. */
function prepareHtml(content: string): { html: string; links: LinkRef[] } {
  const clean = DOMPurify.sanitize(content, { ALLOWED_TAGS: RICH_TAGS, ALLOWED_ATTR: ['href', 'data-spoiler'] }) as string
  if (typeof DOMParser === 'undefined') return { html: clean, links: [] }
  const doc = new DOMParser().parseFromString(clean, 'text/html')

  doc.body.querySelectorAll('span[data-spoiler]').forEach((el) => el.classList.add('spoiler-text'))

  // Bare URLs in text nodes (outside existing links) → <a>.
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!(n.parentElement?.closest('a'))) texts.push(n as Text)
  }
  for (const node of texts) {
    const value = node.data
    const matches = [...value.matchAll(URL_RE)]
    if (!matches.length) continue
    const frag = doc.createDocumentFragment()
    let last = 0
    for (const m of matches) {
      const i = m.index ?? 0
      if (i > last) frag.append(value.slice(last, i))
      const a = doc.createElement('a')
      a.setAttribute('href', m[0])
      a.textContent = m[0]
      frag.append(a)
      last = i + m[0].length
    }
    if (last < value.length) frag.append(value.slice(last))
    node.replaceWith(frag)
  }

  const links = new Map<string, LinkRef>()
  doc.body.querySelectorAll('a[href]').forEach((a) => {
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer nofollow')
    const link = parseLink(a.getAttribute('href') ?? '')
    if (link && links.size < MAX_PREVIEWS) links.set(`${link.kind}:${link.id}`, link)
  })
  return { html: doc.body.innerHTML, links: [...links.values()] }
}

/** Message body. New messages are plain text (URLs become links). Messages
 *  copied from nons may be rich-text HTML: those are ALWAYS sanitized with a
 *  small allow-list — nons rendered them unsanitized, which let a crafted
 *  message run script in other people's browsers. */
export function MessageText({ content, className = '' }: { content: string; className?: string }) {
  const rich = looksLikeHtml(content)
  const prepared = useMemo(() => (rich ? prepareHtml(content) : null), [content, rich])
  if (prepared) {
    return (
      <div className={className}>
        <div
          className="review-content chat-html break-words"
          // Reveal a tapped spoiler (delegated: one handler for all of them).
          onClick={(e) => (e.target as HTMLElement).closest('.spoiler-text')?.classList.toggle('revealed')}
          dangerouslySetInnerHTML={{ __html: prepared.html }}
        />
        {prepared.links.map((link) => <LinkPreviewCard key={`${link.kind}:${link.id}`} link={link} />)}
      </div>
    )
  }
  const parts: ReactNode[] = []
  // Every SomeShelf link gets a hover card, and also a preview card under the
  // text (like a pasted YouTube link) — each distinct link once, up to
  // MAX_PREVIEWS per message.
  const cards = new Map<string, LinkRef>()
  let last = 0
  for (const m of content.matchAll(URL_RE)) {
    const i = m.index ?? 0
    if (i > last) parts.push(content.slice(last, i))
    const anchor = (
      <a key={i} href={m[0]} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
        {m[0]}
      </a>
    )
    const link = parseLink(m[0])
    if (link && cards.size < MAX_PREVIEWS) cards.set(`${link.kind}:${link.id}`, link)
    parts.push(link ? <LinkHoverCard key={i} link={link}>{anchor}</LinkHoverCard> : anchor)
    last = i + m[0].length
  }
  if (last < content.length) parts.push(content.slice(last))
  return (
    <div className={className}>
      <div className="whitespace-pre-wrap break-words">{parts}</div>
      {[...cards.entries()].map(([key, link]) => <LinkPreviewCard key={key} link={link} />)}
    </div>
  )
}

/** "14:05" today, "Mon" this week, "12 Mar" this year, else "12.03.2025". */
export function formatChatTime(unix: number, lang: string): string {
  const d = new Date(unix * 1000)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
  const days = (now.getTime() - d.getTime()) / 86_400_000
  if (days < 6) return d.toLocaleDateString(lang, { weekday: 'short' })
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(lang, { day: 'numeric', month: 'short' })
  return d.toLocaleDateString(lang)
}

export const formatClock = (unix: number, lang: string) =>
  new Date(unix * 1000).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })

/** Day separator label: "Today", "Yesterday" or a date. */
export function dayLabel(unix: number, lang: string, today: string, yesterday: string): string {
  const d = new Date(unix * 1000)
  const now = new Date()
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return today
  if (d.toDateString() === y.toDateString()) return yesterday
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
}
