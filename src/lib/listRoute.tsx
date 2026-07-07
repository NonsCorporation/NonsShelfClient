import type { Metadata } from 'next'
import { getPublicList } from './serverApi'
import ListDetailScreen from '@/screens/ListDetail'

// Server-side metadata for the public curated-list page (/list/<id-or-uuid>).
// Unlike mediaRoute.tsx, this doesn't also SSR the list content — the list
// still loads client-side via ListDetailScreen's own fetch — it only needs to
// give crawlers/social previews a real <title>/description/og:image.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://shelf.nonsapp.com').replace(/\/+$/, '')

export async function buildListMetadata(id: string): Promise<Metadata> {
  const l = await getPublicList(id)
  if (!l) return { title: 'Not found :: Nons Shelf' }

  const title = `${l.title} :: Nons Shelf`
  const description = (
    l.description || `A curated list of ${l.count} title${l.count !== 1 ? 's' : ''} on Nons Shelf.`
  ).slice(0, 200)
  const url = `${SITE_URL}/list/${l.uuid}`

  // Reuse the first item's cover as the preview image, same precedent as the
  // book/film pages reusing the entity's own cover_url — no new image infra.
  const firstCover = l.items.find((it) => it.media?.cover_url)?.media?.cover_url
  const rawCover = firstCover ? firstCover.replace(/^http:\/\//i, 'https://') : null
  const ogImage = { url: rawCover ?? `${SITE_URL}/logo.png`, alt: l.title }

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'Nons Shelf', images: [ogImage], type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

export default async function ListRoute() {
  return <ListDetailScreen />
}
