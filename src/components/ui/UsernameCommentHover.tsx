'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FeedComment } from '@/services/commentService'
import { useFloatingPosition } from '@/hooks/useFloatingPosition'
import BoringAvatar from '@/components/ui/BoringAvatar'

function timeAgo(at: number): string {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - at))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`
  return `${Math.floor(s / (7 * 86400))}w`
}

// Wraps a "replying to @username" mention so hovering it after a short delay
// shows the actual comment being referenced — laid out exactly like a
// comment row (avatar, name, handle, date, body), no separate profile
// header, since the comment already carries its author. Mirrors
// UserHoverCard's portal-to-body + useFloatingPosition pattern.
export default function UsernameCommentHover({ comment, children }: { comment: FeedComment; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const coords = useFloatingPosition(ref, open, false)

  const scheduleOpen = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(true), 350)
  }
  const scheduleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(false), 150)
  }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return (
    <span
      ref={ref}
      className="relative inline-block"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      {children}
      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current) }}
          onMouseLeave={scheduleClose}
          style={{ position: 'fixed', left: Math.min(coords.left, window.innerWidth - 272), top: coords.top, bottom: coords.bottom }}
          className="animate-fade-up z-[110] w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--container)_96%,transparent)] p-3 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-start gap-2">
            <span className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full">
              {comment.author.avatar_url
                ? <img src={comment.author.avatar_url} alt={comment.author.name} className="h-full w-full object-cover" />
                : <BoringAvatar size={28} name={`user-${comment.author.id}`} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
                <span className="font-semibold text-[var(--text)]">{comment.author.name}</span>
                <span className="text-[var(--text-muted)]">@{comment.author.username}</span>
                <span className="text-[var(--text-muted)]">· {timeAgo(comment.created_at)}</span>
              </div>
              <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-snug text-[var(--text)]">
                {comment.body}
              </p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
