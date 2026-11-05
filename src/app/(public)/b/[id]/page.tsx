import type { Metadata } from 'next'
import MediaRoute, { buildMediaMetadata, type SearchParams } from '@/lib/mediaRoute'

type Props = { params: Promise<{ id: string }>; searchParams: SearchParams }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params
  const { lang } = await searchParams
  return buildMediaMetadata(id, lang)
}

export default async function BookPage({ params, searchParams }: Props) {
  const { id } = await params
  const { lang } = await searchParams
  return <MediaRoute id={id} lang={lang} />
}
