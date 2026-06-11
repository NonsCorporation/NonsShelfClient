import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Login from '../pages/Login'

// Gates the app behind the shared nons SSO session. While we check /api/me we
// show a spinner; if the user isn't signed in, we show the SSO entry screen
// which sends them to the main nons login (and back here afterwards).
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6768ab',
        }}
      >
        Loading…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login />
  }

  return <>{children}</>
}
