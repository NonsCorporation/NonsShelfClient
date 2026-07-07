import { authedFetch } from '../lib/api'
import type { CuratedList, CuratedListDetail, CuratedListDiscoverEntry } from '../types'

// Client for nons-library-server's list module: Goodreads-style curated lists
// (title + description, with an optional per-item note) — a separate feature
// from Collections (see collectionService.ts).

async function jsonOrThrow(res: Response): Promise<unknown> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch { /* keep status */ }
    throw new Error(msg)
  }
  return res.json()
}

async function listLists(): Promise<CuratedList[]> {
  const res = await authedFetch('/api/lists')
  if (!res.ok) return []
  const data = await res.json()
  return (data.lists ?? []) as CuratedList[]
}

/** The most substantial public lists across all users, for Discover. */
async function discoverLists(limit = 12): Promise<CuratedListDiscoverEntry[]> {
  const res = await authedFetch(`/api/lists/discover?limit=${limit}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.lists ?? []) as CuratedListDiscoverEntry[]
}

/** Lists are public reads — idOrUuid may be either the numeric id or the
 *  public uuid, both accepted by the same backend endpoint. */
async function getList(idOrUuid: string): Promise<CuratedListDetail | null> {
  const res = await authedFetch(`/api/lists/${idOrUuid}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.list as CuratedListDetail
}

async function createList(title: string, description?: string): Promise<CuratedList> {
  const data = (await jsonOrThrow(
    await authedFetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    }),
  )) as { list: CuratedList }
  return data.list
}

async function updateList(id: number, title: string, description?: string): Promise<void> {
  await jsonOrThrow(
    await authedFetch(`/api/lists/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    }),
  )
}

async function deleteList(id: number): Promise<void> {
  const res = await authedFetch(`/api/lists/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete list')
}

async function getItemLists(mediaId: string): Promise<number[]> {
  const res = await authedFetch(`/api/shelf/${Number(mediaId)}/lists`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.list_ids ?? []) as number[]
}

/** Adds a media item to a list (or updates its note if already present). */
async function addListItem(listId: number, mediaId: string, description?: string): Promise<void> {
  await jsonOrThrow(
    await authedFetch(`/api/lists/${listId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_id: Number(mediaId), description }),
    }),
  )
}

async function updateListItem(listId: number, mediaId: number, description: string): Promise<void> {
  await jsonOrThrow(
    await authedFetch(`/api/lists/${listId}/items/${mediaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    }),
  )
}

async function removeListItem(listId: number, mediaId: number): Promise<void> {
  await jsonOrThrow(await authedFetch(`/api/lists/${listId}/items/${mediaId}`, { method: 'DELETE' }))
}

export const listService = {
  listLists,
  discoverLists,
  getList,
  createList,
  updateList,
  deleteList,
  getItemLists,
  addListItem,
  updateListItem,
  removeListItem,
}
