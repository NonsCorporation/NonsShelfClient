'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { PreferencesProvider } from '@/contexts/PreferencesContext'
import { CollectionProvider } from '@/contexts/CollectionContext'
import { ListProvider } from '@/contexts/ListContext'
import { LoginModalProvider } from '@/contexts/LoginModalContext'

// Providers for the public /b and /m pages. Same context tree as the app, but
// WITHOUT the mount gate and RequireAuth: these pages render their public
// catalog content on the server (for SEO) and stay readable when logged out.
// LoginModalProvider is here too — the sign-in prompts on these pages open the
// same modal as the rest of the app (the modal itself renders nothing on the
// server, so it doesn't disturb the SSR'd HTML).
// The contexts are SSR-safe (they guard localStorage), and AuthProvider simply
// resolves to "anonymous" on the server / before the session check completes.
export default function PublicProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <PreferencesProvider>
          <CollectionProvider>
            <ListProvider>
              <LoginModalProvider>
                {children}
              </LoginModalProvider>
            </ListProvider>
          </CollectionProvider>
        </PreferencesProvider>
      </LanguageProvider>
    </AuthProvider>
  )
}
