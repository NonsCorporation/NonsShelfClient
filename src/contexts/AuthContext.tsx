import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { authedFetch, setOnSessionExpired } from '../lib/api'
import { logoutRequest } from '../services/authService'
import type { Visibility } from '../lib/profile'

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
  // Editable profile (see PUT /api/me/profile). Absent on a server that predates it.
  first_name?: string
  last_name?: string
  bio?: string
  /** Banner colour ("F12312"), empty = automatic; and a reserved banner image URL. */
  banner_color?: string
  banner_url?: string
  location_country?: string
  location_city?: string
  bio_visibility?: Visibility
  location_visibility?: Visibility
  /** False until the post-signup welcome step is saved or skipped. */
  finished_introduction?: boolean
}

interface AuthContextType {
  user: LibraryUser | null
  loading: boolean
  isAuthenticated: boolean
  /** Sign out: revokes the session server-side and clears the cookies. */
  logout: () => Promise<void>
  /** Re-read the signed-in user (call after login/signup sets the cookies). */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Fetch the current user via the session cookie. authedFetch already
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
    // When a token refresh ultimately fails, the session is gone — drop the
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
      // The server revokes the refresh token and clears both cookies.
      await logoutRequest()
    } finally {
      setUser(null)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    setUser(await fetchMe())
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, logout, refreshUser }}>
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
