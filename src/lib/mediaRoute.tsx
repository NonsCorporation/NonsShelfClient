import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicMedia, getPublicCredits, getPublicEditions } from './serverApi'
import { toMediaItem, type BackendMedia } from './mediaMap'
import { mediaJsonLd } from './jsonld'
import MediaOne from '@/screens/MediaOne'

// Shared server-side rendering for the public book (/b) and film (/m) pages.
// Both routes are identical at the data level — the catalog row's `type` drives
// the book/film differences — so they delegate here.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://shelf.nonsapp.com').replace(/\/+$/, '')

function canonicalPath(m: BackendMedia): string {
  return `/${m.type === 'book' ? 'b' : 'm'}/${m.uuid || m.id}`
}

// Per-page <title>/description/OpenGraph for crawlers and social cards.
export async function buildMediaMetadata(id: string): Promise<Metadata> {
  const m = await getPublicMedia(id)
  if (!m) return { title: 'Not found :: Nons Shelf' }

  const title = `${m.title}${m.year ? ` (${m.year})` : ''} :: Nons Shelf`
  const description = (
    m.description || `${m.title} on Nons Shelf — track it, rate it, and see what your friends think.`
  ).slice(0, 200)
  const url = `${SITE_URL}${canonicalPath(m)}`

  // Force HTTPS — Google Books covers come back as http:// which Telegram rejects.
  // Always include an image: Telegram won't render a preview card without og:image.
  const rawCover = m.cover_url ? m.cover_url.replace(/^http:\/\//i, 'https://') : null
  const ogImage = { url: rawCover ?? `${SITE_URL}/logo.png`, alt: m.title }

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'Nons Shelf', images: [ogImage], type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

// Server component: fetch public catalog data, emit JSON-LD, and render the
// MediaOne screen with that data as its initial state (so the SEO content is in
// the server HTML). MediaOne overlays the signed-in user's shelf/rating on the
// client when there's a session.
export default async function MediaRoute({ id }: { id: string }) {
  const media = await getPublicMedia(id)
  if (!media) notFound()

  const [credits, editions] = await Promise.all([
    getPublicCredits(id),
    media.type === 'book' ? getPublicEditions(id) : Promise.resolve([]),
  ])

  const item = toMediaItem(media)
  const url = `${SITE_URL}${canonicalPath(media)}`

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mediaJsonLd(media, url)) }}
      />
      <MediaOne ssr initialItem={item} initialCredits={credits} initialEditions={editions} />
    </>
  )
}
