import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { authedFetch, nonsFetch, setOnSessionExpired } from '../lib/api'

// Shape of nons-library-server's /api/me response.
export interface LibraryUser {
  id: number
  /** Stable public id used in /u/<uuid> URLs. */
  uuid?: string
  username: string
  email: string
  name?: string
  role?: string
  avatar_url?: string
}

interface AuthContextType {
  user: LibraryUser | null
  loading: boolean
  isAuthenticated: boolean
  /** Sign out of the nons SSO session (domain-wide — affects all nons apps). */
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Fetch the current user via the shared nons SSO cookie. authedFetch already
// renews an expired session and retries on 401, so this just reads the result.
// Never throws — network/CORS failures resolve to null so the app never hangs.
async function fetchMe(): Promise<LibraryUser | null> {
  try {
    const res = await authedFetch('/api/me')
    if (!res.ok) return null
    return (await res.json()) as LibraryUser
  } catch (err) {
    console.error('library auth check failed:', err)
    return null
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<LibraryUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // When a token refresh ultimately fails, the SSO session is gone — drop the
    // user so RequireAuth falls back to the login screen, no page reload needed.
    setOnSessionExpired(() => setUser(null))

    let cancelled = false
    fetchMe()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      setOnSessionExpired(null)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      // Logout happens at the identity provider: it revokes the refresh token
      // and clears the domain-wide cookies, signing out every nons app at once.
      await nonsFetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
