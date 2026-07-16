'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
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

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [reason, setReason] = useState<LoginReason | undefined>(undefined)
  const [open, setOpen] = useState(false)

  const openLogin = useCallback((r?: LoginReason) => { setReason(r); setOpen(true) }, [])
  const closeLogin = useCallback(() => setOpen(false), [])
  const value = useMemo(() => ({ openLogin, closeLogin }), [openLogin, closeLogin])

  return (
    <LoginModalContext.Provider value={value}>
      {children}
      {open && <LoginModal reason={reason} onClose={closeLogin} />}
    </LoginModalContext.Provider>
  )
}

export function useLoginModal(): LoginModalValue {
  const ctx = useContext(LoginModalContext)
  if (!ctx) throw new Error('useLoginModal must be used within a LoginModalProvider')
  return ctx
}
