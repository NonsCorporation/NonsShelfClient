'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { PreferencesProvider } from '@/contexts/PreferencesContext'

// Providers for the public /b and /m pages. Same context tree as the app, but
// WITHOUT the mount gate and RequireAuth: these pages render their public
// catalog content on the server (for SEO) and stay readable when logged out.
// The contexts are SSR-safe (they guard localStorage), and AuthProvider simply
// resolves to "anonymous" on the server / before the session check completes.
export default function PublicProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <PreferencesProvider>{children}</PreferencesProvider>
      </LanguageProvider>
    </AuthProvider>
  )
}
