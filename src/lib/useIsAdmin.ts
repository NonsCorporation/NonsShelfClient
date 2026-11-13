import { useAuth } from '@/contexts/AuthContext'

/** True when the signed-in user is a library admin (only they can mark things official). */
export function useIsAdmin(): boolean {
  const { user } = useAuth()
  return user?.role === 'admin'
}
