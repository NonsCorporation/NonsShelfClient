import { authedFetch } from './api'
import { fetchPublicProfile } from '../services/userService'
import type { BackendMedia } from './mediaMap'
import type { CuratedListDetail, MediaType } from '../types'

// Link previews for chat: a pasted SomeShelf link (book, film/series, list or
// profile) becomes a small card, like a pasted YouTube link does elsewhere.
// Only our own pages are recognised — the preview data comes from our API, so
// nothing is fetched from third-party sites.

export type LinkRef =
  | { kind: 'media'; id: string }
  | { kind: 'list'; id: string }
  | { kind: 'user'; id: string }

export type LinkPreview = {
  /** Site-relative path, for in-app navigation. */
  href: string
  kind: LinkRef['kind']
  /** Media type for books/films/series (drives the badge). */
  mediaType?: MediaType
  title: string
  subtitle?: string
  description?: string
  image?: string
  /** Round image (profile photo) instead of a cover. */
  round?: boolean
}

const SITE_HOSTS = new Set(['someshelf.com', 'www.someshelf.com'])
const siteHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://someshelf.com').host
  } catch {
    return 'someshelf.com'
  }
})()

const isOurHost = (host: string) =>
  SITE_HOSTS.has(host) || host === siteHost || (typeof window !== 'undefined' && host === window.location.host)

/** Which SomeShelf page a URL points at, or null for anything else. */
export function parseLink(raw: string): LinkRef | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (!isOurHost(u.host)) return null
  const m = u.pathname.match(/^\/(b|m|list|u)\/([^/]+)\/?$/)
  if (!m) return null
  const id = decodeURIComponent(m[2])
  return m[1] === 'b' || m[1] === 'm' ? { kind: 'media', id } : m[1] === 'list' ? { kind: 'list', id } : { kind: 'user', id }
}

const https = (url?: string) => (url ? url.replace(/^http:\/\//i, 'https://') : undefined)
const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s)

async function load(ref: LinkRef): Promise<LinkPreview | null> {
  try {
    if (ref.kind === 'media') {
      const res = await authedFetch(`/api/media/${encodeURIComponent(ref.id)}`)
      if (!res.ok) return null
      const m = (await res.json()) as BackendMedia
      return {
        href: `/${m.type === 'book' ? 'b' : 'm'}/${m.uuid || m.id}`,
        kind: 'media',
        mediaType: m.type,
        title: m.title,
        subtitle: [m.author || m.director, m.year || undefined].filter(Boolean).join(' · ') || undefined,
        description: m.description ? clip(m.description) : undefined,
        image: https(m.cover_url),
      }
    }
    if (ref.kind === 'list') {
      const res = await authedFetch(`/api/lists/${encodeURIComponent(ref.id)}`)
      if (!res.ok) return null
      const l = ((await res.json()) as { list: CuratedListDetail }).list
      return {
        href: `/list/${l.uuid}`,
        kind: 'list',
        title: l.title,
        subtitle: l.owner_name || l.owner_username,
        description: l.description ? clip(l.description) : undefined,
        image: https(l.items.find((it) => it.media?.cover_url)?.media?.cover_url),
      }
    }
    const p = await fetchPublicProfile(ref.id)
    if (!p) return null
    return {
      href: `/u/${p.username}`,
      kind: 'user',
      title: p.name,
      subtitle: `@${p.username}`,
      description: p.bio ? clip(p.bio) : undefined,
      image: p.avatarUrl,
      round: true,
    }
  } catch {
    return null
  }
}

// One request per link per session, however many messages repeat it.
const cache = new Map<string, Promise<LinkPreview | null>>()
export function loadLinkPreview(ref: LinkRef): Promise<LinkPreview | null> {
  const key = `${ref.kind}:${ref.id}`
  let p = cache.get(key)
  if (!p) {
    p = load(ref)
    cache.set(key, p)
  }
  return p
}
