import { authedFetch } from '../lib/api'

// nons-library-server /api/bubbles — the message pills on the home feed.

export type BubbleAudience = 'all' | 'horizon' | 'no_horizon'

export type Bubble = {
  id: number
  text: string
  /** An in-app path ("/bingo") or an http(s) URL. */
  href: string
  /** A name from lib/bubbleIcons ("IoBulb"). */
  icon: string
  color: string
  /** The pill's own background; empty = the default near-black. */
  background: string
  preset: string
  audience: BubbleAudience
  enabled: boolean
  starts_at: number | null
  ends_at: number | null
  /** Appears this long after the page opens. */
  delay_seconds: number
  /** How long it holds the slot before the next bubble takes over. */
  duration_minutes: number
  dismissible: boolean
  /** After a dismissal it stays away this long (0 = for good). */
  reshow_hours: number
  position: number
}

/** The fields an admin edits. */
export type BubbleInput = Omit<Bubble, 'id'>

export type ActiveBubbles = {
  /** The server's clock (Unix seconds), so everyone rotates in step. */
  now: number
  /** Whether any bubble has ever been set up; if not, the built-in one shows. */
  any: boolean
  bubbles: Bubble[]
}

type Failure = { ok: false; status: number; error: string }

async function failure(res: Response): Promise<Failure> {
  let error = `Request failed (${res.status})`
  try {
    const body = await res.json()
    if (body?.error) error = body.error
  } catch {
    /* keep the status */
  }
  return { ok: false, status: res.status, error }
}

/** The bubbles this viewer may see now; null when the server can't be reached. */
export async function getActiveBubbles(): Promise<ActiveBubbles | null> {
  try {
    const res = await authedFetch('/api/bubbles')
    return res.ok ? ((await res.json()) as ActiveBubbles) : null
  } catch {
    return null
  }
}

// ── admin ──

export async function listAllBubbles(): Promise<{ ok: true; bubbles: Bubble[] } | Failure> {
  try {
    const res = await authedFetch('/api/admin/bubbles')
    if (!res.ok) return failure(res)
    return { ok: true, bubbles: ((await res.json()) as { bubbles: Bubble[] }).bubbles ?? [] }
  } catch {
    return { ok: false, status: 0, error: 'Network error' }
  }
}

export async function saveBubble(id: number | null, input: BubbleInput): Promise<{ ok: true; bubble: Bubble } | Failure> {
  try {
    const res = await authedFetch(id === null ? '/api/admin/bubbles' : `/api/admin/bubbles/${id}`, {
      method: id === null ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) return failure(res)
    return { ok: true, bubble: (await res.json()) as Bubble }
  } catch {
    return { ok: false, status: 0, error: 'Network error' }
  }
}

export async function deleteBubble(id: number): Promise<{ ok: true } | Failure> {
  try {
    const res = await authedFetch(`/api/admin/bubbles/${id}`, { method: 'DELETE' })
    return res.ok ? { ok: true } : failure(res)
  } catch {
    return { ok: false, status: 0, error: 'Network error' }
  }
}
