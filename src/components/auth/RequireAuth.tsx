'use client'

import { useEffect, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLoginModal, type LoginReason } from '@/contexts/LoginModalContext'
import { useLocation, useNavigate } from '@/lib/router'
import AppLoadingSkeleton from '@/components/ui/Skeletons'

// Routes anyone may open. Home shows Discover to signed-out visitors (see
// screens/Home.tsx), and Discover itself is the same screen — both render the
// shared catalog and route every gated control through the login modal. The
// rest of the app (your library, shelf, stats, notifications) is personal and
// has nothing to show without a session.
const PUBLIC_PATHS = new Set(['/', '/discover'])

// A user's profile (/u/<handle>) is public too — a shared profile link must open
// for anyone. Their full library and the edit page stay signed-in only.
// A group invite link (/messages/invite/<token>) opens too, so the screen can
// show which group it is and offer sign-in instead of bouncing to home.
// A shared bingo (/bingo/<board>/<user>/<run>) opens for anyone too.
const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.has(pathname) ||
  /^\/u\/[^/]+\/?$/.test(pathname) ||
  /^\/messages\/invite\/[^/]+\/?$/.test(pathname) ||
  /^\/bingo(\/|$)/.test(pathname)

// Which login-modal copy names the thing a blocked route was actually for
// ("view this profile", "see your notifications", …) instead of the generic
// fallback. Checked longest-prefix-first isn't needed since these don't nest.
function reasonFor(pathname: string): LoginReason | undefined {
  if (pathname.startsWith('/u/')) return 'profile'
  if (pathname.startsWith('/library') || pathname.startsWith('/lists') || pathname.startsWith('/shelf')) return 'library'
  if (pathname.startsWith('/notifications')) return 'notifications'
  if (pathname.startsWith('/statistics')) return 'statistics'
  if (pathname.startsWith('/challenge')) return 'challenge'
  if (pathname.startsWith('/messages')) return 'messages'
  return undefined
}

// Gates the personal app behind the shared nons SSO session. While we check
// /api/me we show the app shell with content-shaped ghost placeholders (rather
// than a bare spinner), so entering the app feels instant. A signed-out visitor
// who lands on a private route is sent home — to Discover, which is browsable —
// with the login modal open, rather than onto a dead end.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { openLogin } = useLoginModal()

  const blocked = !loading && !isAuthenticated && !isPublicPath(pathname)

  useEffect(() => {
    if (!blocked) return
    const reason = reasonFor(pathname)
    navigate('/', { replace: true })
    openLogin(reason)
  }, [blocked, pathname, navigate, openLogin])

  // Placeholders cover both the session check and the redirect that follows it,
  // so a private route never flashes its signed-in chrome on the way out.
  if (loading || blocked) {
    return <AppLoadingSkeleton />
  }

  return <>{children}</>
}
