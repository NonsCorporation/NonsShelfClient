'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { listService } from '../services/listService'
import { useAuth } from './AuthContext'
import type { CuratedList } from '../types'

interface ListContextValue {
  lists: CuratedList[]
  loading: boolean
  refresh: () => Promise<void>
  createList: (title: string, description?: string) => Promise<CuratedList>
  updateList: (id: number, title: string, description?: string) => Promise<void>
  deleteList: (id: number) => Promise<void>
}

const ListContext = createContext<ListContextValue | null>(null)

export function ListProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [lists, setLists] = useState<CuratedList[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return
    const ls = await listService.listLists()
    setLists(ls)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return }
    listService.listLists().then((ls) => {
      setLists(ls)
      setLoading(false)
    })
  }, [isAuthenticated])

  const createList = useCallback(async (title: string, description?: string): Promise<CuratedList> => {
    const l = await listService.createList(title, description)
    setLists((prev) => [...prev, l])
    return l
  }, [])

  const updateList = useCallback(async (id: number, title: string, description?: string) => {
    await listService.updateList(id, title, description)
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, title, description } : l)))
  }, [])

  const deleteList = useCallback(async (id: number) => {
    await listService.deleteList(id)
    setLists((prev) => prev.filter((l) => l.id !== id))
  }, [])

  return (
    <ListContext.Provider value={{ lists, loading, refresh, createList, updateList, deleteList }}>
      {children}
    </ListContext.Provider>
  )
}

export function useLists() {
  const ctx = useContext(ListContext)
  if (!ctx) throw new Error('useLists must be used inside ListProvider')
  return ctx
}
