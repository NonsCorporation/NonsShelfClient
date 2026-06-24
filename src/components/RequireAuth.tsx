import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Login from '../screens/Login'
import AppLoadingSkeleton from './Skeletons'

// Gates the app behind the shared nons SSO session. While we check /api/me we
// show the app shell with content-shaped ghost placeholders (rather than a bare
// spinner), so entering the app feels instant; if the user isn't signed in, we
// show the SSO entry screen which sends them to the main nons login (and back
// here afterwards).
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useAuth()

  if (loading) {
    return <AppLoadingSkeleton />
  }

  if (!isAuthenticated) {
    return <Login />
  }

  return <>{children}</>
}
