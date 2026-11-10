import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Person from '@/screens/Person'
import { getPublicPerson } from '@/lib/serverApi'
import { buildPersonMetadata, personJsonLd, resolvePersonLang } from '@/lib/personSeo'

type Props = {
  params: Promise<{ uuid: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// <title>, description, OpenGraph/Twitter and hreflang for crawlers and link
// previews. ?lang=xx shows the person's name in that language (see lib/personSeo).
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { uuid } = await params
  const { lang } = await searchParams
  return buildPersonMetadata(uuid, lang)
}

// Server component: fetch the public person once, emit JSON-LD, and hand the
// data to the screen as its initial state so the bio and credits are in the
// server HTML. The screen still refreshes it on the client.
export default async function Page({ params, searchParams }: Props) {
  const { uuid } = await params
  const { lang: rawLang } = await searchParams
  const data = await getPublicPerson(uuid)
  if (!data) notFound() // a real 404 for crawlers, not a 200 "not found" page

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: personJsonLd(data, rawLang) }} />
      <Person initialData={data} initialLang={resolvePersonLang(data, rawLang)} />
    </>
  )
}
