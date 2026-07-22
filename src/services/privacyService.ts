import { authedFetch } from '../lib/api'
import type { Privacy } from '../contexts/PreferencesContext'

// Profile-visibility settings live on the server (per user). These talk to
// nons-library-server's /api/privacy; both fail soft so a logged-out visitor or
// a network hiccup just falls back to defaults rather than throwing.

export type PrivacySettings = Privacy & {
  /** Whether the viewer's own likes/comments on someone else's post surface as
   *  a "<you> liked/commented on this" event in their friends' feeds. */
  showActivityReactions: boolean
}

export async function getPrivacy(): Promise<PrivacySettings | null> {
  try {
    const res = await authedFetch('/api/privacy')
    if (!res.ok) return null
    const d = (await res.json()) as Partial<Privacy> & { show_activity_reactions?: boolean }
    if (!d.shelf || !d.ratings || !d.activity) return null
    return { shelf: d.shelf, ratings: d.ratings, activity: d.activity, showActivityReactions: d.show_activity_reactions ?? true }
  } catch {
    return null
  }
}

export async function savePrivacy(p: PrivacySettings): Promise<void> {
  try {
    await authedFetch('/api/privacy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shelf: p.shelf,
        ratings: p.ratings,
        activity: p.activity,
        show_activity_reactions: p.showActivityReactions,
      }),
    })
  } catch {
    /* best-effort; the optimistic UI already reflects the change */
  }
}
