import type { Metadata } from 'next'
import ProfileClient from './ProfileClient'
import { getPublicProfileCard } from '@/lib/serverApi'
import { buildProfileMetadata, profileJsonLd } from '@/lib/profileSeo'

// /u/<username>: the profile itself is a signed-in client screen, but the server
// still answers with a proper <title>, description, OpenGraph/Twitter tags,
// JSON-LD and a preview image (opengraph-image.tsx), so shared links unfurl into
// a profile card and search engines know whose page it is.

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return buildProfileMetadata(decodeURIComponent(id))
}

export default async function Page({ params }: Props) {
  const { id } = await params
  const card = await getPublicProfileCard(decodeURIComponent(id))
  return (
    <>
      {card && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: profileJsonLd(card) }} />}
      <ProfileClient />
    </>
  )
}
