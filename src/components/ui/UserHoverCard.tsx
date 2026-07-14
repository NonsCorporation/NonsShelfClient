'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '@/lib/router'
import { userPath } from '@/lib/paths'
import { fetchPublicProfile, type PublicProfile } from '@/services/userService'
import { useFloatingPosition } from '@/hooks/useFloatingPosition'
import BoringAvatar from '@/components/ui/BoringAvatar'

// Cache profiles across hover cards in the same session — mentions of the
// same user (e.g. many replies in one thread) shouldn't each re-fetch.
const profileCache = new Map<string, Promise<PublicProfile | null>>()
function loadProfile(username: string): Promise<PublicProfile | null> {
  let p = profileCache.get(username)
  if (!p) {
    p = fetchPublicProfile(username)
    profileCache.set(username, p)
  }
  return p
}

// Wraps a username mention (e.g. "@handle") so hovering it after a short
// delay shows a small profile preview card — mirrors InfoTooltip's
// portal-to-body + useFloatingPosition pattern, so the card can't get
// clipped by a scrollable/overflow-hidden ancestor (e.g. a comment thread).
export default function UserHoverCard({ username, children }: { username: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined)
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

  useEffect(() => {
    if (!open) return
    let cancelled = false
    loadProfile(username).then((p) => {
      if (!cancelled) setProfile(p)
    })
    return () => {
      cancelled = true
    }
  }, [open, username])

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
          {profile === undefined ? (
            <div className="flex items-center gap-2.5 py-1">
              <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-[var(--surface-hover)]" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-hover)]" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-[var(--surface-hover)]" />
              </div>
            </div>
          ) : profile === null ? (
            <p className="py-1 text-xs text-[var(--text-muted)]">@{username}</p>
          ) : (
            <Link to={userPath(profile.username)} className="flex items-center gap-2.5">
              <span className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full">
                {profile.avatarUrl
                  ? <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
                  : <BoringAvatar size={40} name={`user-${profile.id}`} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--text)]">{profile.name}</span>
                <span className="block truncate text-xs text-[var(--text-muted)]">@{profile.username}</span>
              </span>
            </Link>
          )}
        </div>,
        document.body,
      )}
    </span>
  )
}
