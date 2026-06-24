'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { PreferencesProvider } from '@/contexts/PreferencesContext'
import { CollectionProvider } from '@/contexts/CollectionContext'
import RequireAuth from '@/components/RequireAuth'

// Mirrors the old src/main.tsx provider tree, with RequireAuth gating every
// route (the whole app was behind the shared SSO session before, and still is).
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
        <LanguageProvider>
          <PreferencesProvider>
            <RequireAuth>
              {children}
            </RequireAuth>
          </PreferencesProvider>
        </LanguageProvider>
      </CollectionProvider>
    </AuthProvider>
  )
}
