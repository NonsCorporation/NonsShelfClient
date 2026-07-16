'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { PreferencesProvider } from '@/contexts/PreferencesContext'
import { CollectionProvider } from '@/contexts/CollectionContext'
import { ListProvider } from '@/contexts/ListContext'
import { LoginModalProvider } from '@/contexts/LoginModalContext'
import RequireAuth from '@/components/auth/RequireAuth'

// Mirrors the old src/main.tsx provider tree, with RequireAuth gating the
// personal routes behind the shared SSO session ('/' and '/discover' stay
// browsable when signed out). LoginModalProvider sits above RequireAuth because
// the gate itself opens the modal when it turns a visitor away.
//
// LanguageProvider and PreferencesProvider read localStorage/navigator in their
// useState initializers, so they cannot run on the server. We render nothing
// until mount — this keeps behavior identical to the previous client-only SPA
// (no SSR, no theme/language hydration flash). Server-rendering public pages
// for SEO is the deliberate next step, not part of this migration.
export default function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <AuthProvider>
      <CollectionProvider>
        <ListProvider>
          <LanguageProvider>
            <PreferencesProvider>
              <NotificationProvider>
                <LoginModalProvider>
                  <RequireAuth>
                    {children}
                  </RequireAuth>
                </LoginModalProvider>
              </NotificationProvider>
            </PreferencesProvider>
          </LanguageProvider>
        </ListProvider>
      </CollectionProvider>
    </AuthProvider>
  )
}
