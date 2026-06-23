import { authedFetch } from '../lib/api'
import type { Privacy } from '../contexts/PreferencesContext'

// Profile-visibility settings live on the server (per user). These talk to
// nons-library-server's /api/privacy; both fail soft so a logged-out visitor or
// a network hiccup just falls back to defaults rather than throwing.

export async function getPrivacy(): Promise<Privacy | null> {
  try {
    const res = await authedFetch('/api/privacy')
    if (!res.ok) return null
    const d = (await res.json()) as Partial<Privacy>
    if (!d.shelf || !d.ratings || !d.activity) return null
    return { shelf: d.shelf, ratings: d.ratings, activity: d.activity }
  } catch {
    return null
  }
}

export async function savePrivacy(p: Privacy): Promise<void> {
  try {
    await authedFetch('/api/privacy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    })
  } catch {
    /* best-effort; the optimistic UI already reflects the change */
  }
}
