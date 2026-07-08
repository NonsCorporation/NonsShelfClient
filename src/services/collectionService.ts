import { authedFetch } from '../lib/api'
import type { Collection } from '../types'

async function listCollections(): Promise<Collection[]> {
  const res = await authedFetch('/api/collections')
  if (!res.ok) return []
  const data = await res.json()
  return (data.collections ?? []) as Collection[]
}

// Another user's collections (read-only) — for their profile/library page.
// Empty when their shelf is private or they have none.
async function getUserCollections(userId: number): Promise<Collection[]> {
  const res = await authedFetch(`/api/users/${userId}/collections`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.collections ?? []) as Collection[]
}

async function createCollection(name: string): Promise<Collection> {
  const res = await authedFetch('/api/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to create collection')
  }
  const data = await res.json()
  return data.collection as Collection
}

async function renameCollection(id: number, name: string): Promise<void> {
  const res = await authedFetch(`/api/collections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to rename collection')
  }
}

async function deleteCollection(id: number): Promise<void> {
  const res = await authedFetch(`/api/collections/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete collection')
}

async function getItemCollections(mediaId: string): Promise<number[]> {
  const res = await authedFetch(`/api/shelf/${Number(mediaId)}/collections`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.collection_ids ?? []) as number[]
}

async function setItemCollections(mediaId: string, collectionIds: number[]): Promise<void> {
  await authedFetch(`/api/shelf/${Number(mediaId)}/collections`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection_ids: collectionIds }),
  })
}

export const collectionService = {
  listCollections,
  getUserCollections,
  createCollection,
  renameCollection,
  deleteCollection,
  getItemCollections,
  setItemCollections,
}
