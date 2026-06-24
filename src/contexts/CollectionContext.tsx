'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { collectionService } from '../services/collectionService'
import { useAuth } from './AuthContext'
import type { Collection } from '../types'

interface CollectionContextValue {
  collections: Collection[]
  loading: boolean
  refresh: () => Promise<void>
  createCollection: (name: string) => Promise<Collection>
  renameCollection: (id: number, name: string) => Promise<void>
  deleteCollection: (id: number) => Promise<void>
}

const CollectionContext = createContext<CollectionContextValue | null>(null)

export function CollectionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return
    const cols = await collectionService.listCollections()
    setCollections(cols)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return }
    collectionService.listCollections().then((cols) => {
      setCollections(cols)
      setLoading(false)
    })
  }, [isAuthenticated])

  const createCollection = useCallback(async (name: string): Promise<Collection> => {
    const col = await collectionService.createCollection(name)
    setCollections((prev) => [...prev, col])
    return col
  }, [])

  const renameCollection = useCallback(async (id: number, name: string) => {
    await collectionService.renameCollection(id, name)
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
  }, [])

  const deleteCollection = useCallback(async (id: number) => {
    await collectionService.deleteCollection(id)
    setCollections((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return (
    <CollectionContext.Provider value={{ collections, loading, refresh, createCollection, renameCollection, deleteCollection }}>
      {children}
    </CollectionContext.Provider>
  )
}

export function useCollections() {
  const ctx = useContext(CollectionContext)
  if (!ctx) throw new Error('useCollections must be used inside CollectionProvider')
  return ctx
}
