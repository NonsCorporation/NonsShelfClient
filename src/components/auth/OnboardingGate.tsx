'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLocation, useNavigate } from '@/lib/router'

const WELCOME_PATH = '/welcome'

// Keeps an account that hasn't finished its profile setup on the welcome step,
// as nons did with finish-signup: every page of the app sends it back to
// /welcome until the step is saved (first name + a username of their own). The
// server decides: `finished_introduction` on /api/me is false until then
// (accounts that completed nons' version of it arrive with it already true).
// Signing out from the header still works. Renders nothing.
export default function OnboardingGate() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || !user) return
    // `=== false`, not falsy: a server that predates the flag leaves it out, and
    // that must not send everyone to the welcome page.
    if (user.finished_introduction !== false) return
    if (pathname === WELCOME_PATH) return
    navigate(WELCOME_PATH, { replace: true })
  }, [loading, user, pathname, navigate])

  return null
}
