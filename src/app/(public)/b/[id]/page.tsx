import type { Metadata } from 'next'
import MediaRoute, { buildMediaMetadata } from '@/lib/mediaRoute'

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  return buildMediaMetadata(id)
}

export default async function BookPage({ params }: Params) {
  const { id } = await params
  return <MediaRoute id={id} />
}
