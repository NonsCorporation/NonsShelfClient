'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getUnreadCount, getNonsUnreadCount } from '../services/notificationService'
import { useAuth } from './AuthContext'

interface NotificationContextValue {
  /** Unread count from nons-library (this app). */
  unreadCount: number
  /** Unread count from the main nons social app. */
  nonsUnreadCount: number
  /** Combined badge total shown in the header. */
  totalUnread: number
  refresh: () => void
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  nonsUnreadCount: 0,
  totalUnread: 0,
  refresh: () => {},
})

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [nonsUnreadCount, setNonsUnreadCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(() => {
    if (!isAuthenticated) return
    getUnreadCount().then(setUnreadCount).catch(() => {})
    getNonsUnreadCount().then(setNonsUnreadCount).catch(() => {})
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0)
      setNonsUnreadCount(0)
      return
    }
    refresh()
    timerRef.current = setInterval(refresh, 60_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isAuthenticated, refresh])

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        nonsUnreadCount,
        totalUnread: unreadCount + nonsUnreadCount,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}
