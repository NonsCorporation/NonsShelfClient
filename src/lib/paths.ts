import type { MediaType } from '../types'

// Canonical client routes:
//   /b/<uuid>      book page
//   /m/<uuid>      movie page
//   /u/<username>  user profile (username resolves via nons-server; uuid is a
//                  fallback for the signed-in user only)
// The uuid is the media row's public id from nons-library-server. `id` (the
// numeric catalog id) is the fallback while older rows or cached payloads
// haven't carried a uuid yet — the backend accepts both forms.

export function mediaPath(item: { type: MediaType; uuid?: string; id: string }): string {
  return `/${item.type === 'book' ? 'b' : 'm'}/${item.uuid || item.id}`
}

export function userPath(uuidOrHandle: string): string {
  return `/u/${uuidOrHandle}`
}
