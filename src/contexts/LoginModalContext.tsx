'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import LoginModal from '@/components/auth/LoginModal'

// What the visitor was trying to do when they got stopped — picks the modal's
// headline/body (see LoginModal's COPY map) so the prompt names the actual
// thing they're missing out on ("view profiles", "join challenges", …) instead
// of always the same generic blurb. Omit for a plain "Sign in" click with no
// specific action behind it.
export type LoginReason = 'shelf' | 'challenge' | 'profile' | 'library' | 'notifications' | 'statistics'

// Signed-out visitors can browse (discover, catalog pages, public lists), so
// every gated action — add to shelf, rate, join a challenge, the header's
// "Sign in" — needs the same answer: explain the shared nons account, then hand
// off. Holding that modal in one context keeps the copy and the handoff in a
// single place instead of scattering redirectToNonsLogin() across the screens.
type LoginModalValue = {
  openLogin: (reason?: LoginReason) => void
  closeLogin: () => void
}

const LoginModalContext = createContext<LoginModalValue | undefined>(undefined)

// ?auth_error=<code> is how the server reports a Google sign-in that didn't
// complete (it redirects the browser back here). "cancelled" is the person
// backing out of Google, which needs no explanation.
const AUTH_ERROR_KEYS: Record<string, string> = {
  google_failed: 'authErrGoogle',
  google_state: 'authErrGoogle',
  google_unverified: 'authErrGoogleUnverified',
  banned: 'authErrBanned',
  deleted: 'authErrDeleted',
}

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage()
  const [reason, setReason] = useState<LoginReason | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [initialError, setInitialError] = useState('')

  const openLogin = useCallback((r?: LoginReason) => { setReason(r); setInitialError(''); setOpen(true) }, [])
  const closeLogin = useCallback(() => setOpen(false), [])

  // Coming back from a failed Google sign-in: reopen the modal with the reason,
  // and strip the param so a refresh doesn't show it again.
  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('auth_error')
    if (!code) return
    url.searchParams.delete('auth_error')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    const key = AUTH_ERROR_KEYS[code]
    if (!key) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialError(t(key))
    setOpen(true)
    // Runs once on load; t is stable enough for a one-off message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const value = useMemo(() => ({ openLogin, closeLogin }), [openLogin, closeLogin])

  return (
    <LoginModalContext.Provider value={value}>
      {children}
      {open && <LoginModal reason={reason} onClose={closeLogin} initialError={initialError} />}
    </LoginModalContext.Provider>
  )
}

export function useLoginModal(): LoginModalValue {
  const ctx = useContext(LoginModalContext)
  if (!ctx) throw new Error('useLoginModal must be used within a LoginModalProvider')
  return ctx
}
