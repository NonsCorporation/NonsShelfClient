import { authedFetch } from '../lib/api'

// Client for the site-wishes board (nons-library-server's idea module): ideas
// people post about the site, upvotes, and the librarians' status + reply.

export type IdeaStatus = 'open' | 'ignored' | 'taken' | 'in_work' | 'done'

export const IDEA_STATUSES: IdeaStatus[] = ['open', 'taken', 'in_work', 'done', 'ignored']

export type Idea = {
  id: number
  uuid: string
  title: string
  body: string
  status: IdeaStatus
  /** The team's reply, when there is one. */
  reply?: string
  replied_at?: number
  votes: number
  /** The signed-in viewer upvoted it. */
  voted: boolean
  /** The viewer posted it. */
  mine: boolean
  created_at: number
  author: { id: number; username?: string; name?: string; avatar_url?: string }
}

export type IdeaPage = {
  ideas: Idea[]
  total: number
  page_size: number
  /** The viewer is a librarian/admin and may set statuses and replies. */
  can_moderate: boolean
}

export type IdeaSort = 'top' | 'new'

async function jsonOrThrow<T>(res: Response): Promise<T> {
  let body: unknown = null
  try {
    body = await res.json()
  } catch { /* empty body */ }
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error || `Request failed (${res.status})`
    throw new Error(msg)
  }
  return body as T
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
})

async function listIdeas(p: { q?: string; status?: IdeaStatus | ''; sort?: IdeaSort; page?: number }): Promise<IdeaPage> {
  const params = new URLSearchParams()
  if (p.q?.trim()) params.set('q', p.q.trim())
  if (p.status) params.set('status', p.status)
  params.set('sort', p.sort ?? 'top')
  params.set('page', String(p.page ?? 1))
  const res = await authedFetch(`/api/ideas?${params}`)
  const d = await jsonOrThrow<Partial<IdeaPage>>(res)
  return { ideas: d.ideas ?? [], total: d.total ?? 0, page_size: d.page_size ?? 20, can_moderate: !!d.can_moderate }
}

async function createIdea(title: string, body: string): Promise<Idea> {
  const d = await jsonOrThrow<{ idea: Idea }>(await authedFetch('/api/ideas', json('POST', { title, body })))
  return d.idea
}

async function setVote(id: number, on: boolean): Promise<Idea> {
  const d = await jsonOrThrow<{ idea: Idea }>(await authedFetch(`/api/ideas/${id}/vote`, { method: on ? 'PUT' : 'DELETE' }))
  return d.idea
}

async function deleteIdea(id: number): Promise<void> {
  await jsonOrThrow(await authedFetch(`/api/ideas/${id}`, { method: 'DELETE' }))
}

/** Librarians: set the badge and (optionally) a reply. */
async function setStatus(id: number, status: IdeaStatus, reply: string): Promise<Idea> {
  const d = await jsonOrThrow<{ idea: Idea }>(await authedFetch(`/api/ideas/${id}/status`, json('PUT', { status, reply })))
  return d.idea
}

export const ideaService = { listIdeas, createIdea, setVote, deleteIdea, setStatus }
