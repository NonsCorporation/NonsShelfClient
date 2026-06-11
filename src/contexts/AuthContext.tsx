import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { authedFetch, nonsFetch } from '../lib/api'

// Shape of nons-library-server's /api/me response.
export interface LibraryUser {
  id: number
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

// Fetch the current user via the shared nons SSO cookie. On 401 we ask
// nons-server (the identity provider) to refresh the access token once, then
// retry. Never throws — network/CORS failures resolve to null so the app never
// hangs.
async function fetchMe(): Promise<LibraryUser | null> {
  try {
    let res = await authedFetch('/api/me')
    if (res.status === 401) {
      const refresh = await nonsFetch('/api/auth/refresh', { method: 'POST' })
      if (refresh.ok) {
        res = await authedFetch('/api/me')
      }
    }
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
