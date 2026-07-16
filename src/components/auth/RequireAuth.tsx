'use client'

import { useEffect, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLoginModal } from '@/contexts/LoginModalContext'
import { useLocation, useNavigate } from '@/lib/router'
import AppLoadingSkeleton from '@/components/ui/Skeletons'

// Routes anyone may open. Home shows Discover to signed-out visitors (see
// screens/Home.tsx), and Discover itself is the same screen — both render the
// shared catalog and route every gated control through the login modal. The
// rest of the app (your library, shelf, stats, notifications) is personal and
// has nothing to show without a session.
const PUBLIC_PATHS = new Set(['/', '/discover'])

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

  const blocked = !loading && !isAuthenticated && !PUBLIC_PATHS.has(pathname)

  useEffect(() => {
    if (!blocked) return
    navigate('/', { replace: true })
    openLogin()
  }, [blocked, navigate, openLogin])

  // Placeholders cover both the session check and the redirect that follows it,
  // so a private route never flashes its signed-in chrome on the way out.
  if (loading || blocked) {
    return <AppLoadingSkeleton />
  }

  return <>{children}</>
}
