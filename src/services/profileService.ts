import { authApi, authedFetch } from '../lib/api'
import type { ProfilePatch } from '../lib/profile'

// Talks to nons-library-server's profile endpoints. After a successful call the
// caller re-reads /api/me (AuthContext.refreshUser) to pick up the new values.

export type SaveResult =
  | { ok: true }
  | { ok: false; error: string; field?: string; status?: number }

async function failure(res: Response): Promise<SaveResult> {
  let error = 'Something went wrong. Please try again.'
  let field: string | undefined
  try {
    const data = await res.json()
    if (typeof data?.error === 'string') error = data.error
    if (typeof data?.field === 'string') field = data.field
  } catch {
    /* non-JSON error body */
  }
  return { ok: false, error, field, status: res.status }
}

const NETWORK: SaveResult = { ok: false, error: 'Could not reach the server. Please try again.' }

/** Partial update of your own name, username, bio, location, visibilities and the
 *  welcome-step flag. 400 carries `field`; 409 means the username is taken. */
export async function updateMyProfile(patch: ProfilePatch): Promise<SaveResult> {
  try {
    const res = await authedFetch('/api/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    return res.ok ? { ok: true } : await failure(res)
  } catch {
    return NETWORK
  }
}

/** Uploads a new profile picture (a JPEG/PNG blob, max 1 MB). */
export async function uploadAvatar(image: Blob): Promise<SaveResult> {
  try {
    const body = new FormData()
    body.append('file', image, 'avatar.jpg')
    // No Content-Type header: the browser adds the multipart boundary itself.
    const res = await authedFetch('/api/me/avatar', { method: 'PUT', body })
    return res.ok ? { ok: true } : await failure(res)
  } catch {
    return NETWORK
  }
}

/** Removes your profile picture (falls back to the generated avatar). */
export async function removeAvatar(): Promise<SaveResult> {
  try {
    const res = await authedFetch('/api/me/avatar', { method: 'DELETE' })
    return res.ok ? { ok: true } : await failure(res)
  } catch {
    return NETWORK
  }
}

/** A random, currently free username (a misspelled book/film/series
 *  character, e.g. "wolter_quill") for the dice in the editor. Null on failure.
 *  Nothing is reserved: it only becomes yours when the profile is saved. */
export async function suggestUsername(): Promise<string | null> {
  try {
    const res = await authedFetch('/api/usernames/suggest')
    if (!res.ok) return null
    const data = await res.json()
    return typeof data?.username === 'string' ? data.username : null
  } catch {
    return null
  }
}

/** Mints fresh session tokens from the database. Session tokens carry the
 *  username, so after a rename this keeps them in step instead of leaving the
 *  old name in them until the next automatic refresh. Best effort. */
export async function renewSession(): Promise<void> {
  try {
    await authApi('/api/auth/refresh', { method: 'POST' })
  } catch {
    /* the next automatic refresh will do it */
  }
}
