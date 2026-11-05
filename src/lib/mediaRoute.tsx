import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicMedia, getPublicCredits, getPublicRating } from './serverApi'
import { toMediaItem, type BackendMedia } from './mediaMap'
import { parseLang, loadLocalizations, localizedFor, availableLangs } from './mediaLocalize'
import { mediaJsonLd } from './jsonld'
import MediaOne from '@/screens/MediaOne'

// Shared server-side rendering for the public book (/b) and film (/m) pages.
// Both routes are identical at the data level — the catalog row's `type` drives
// the book/film differences — so they delegate here.
//
// Language: `?lang=xx` (ISO 639-1) renders the page in that language when the
// catalog has a translation — localized og:title/description, JSON-LD and
// visible content (films: alt titles; books: the edition in that language).
// Each language is its own indexable URL, cross-linked with hreflang.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://someshelf.com').replace(/\/+$/, '')

// og:locale wants language_TERRITORY; these are the usual defaults per language.
const OG_LOCALES: Record<string, string> = {
  en: 'en_US', ru: 'ru_RU', de: 'de_DE', fr: 'fr_FR', es: 'es_ES', it: 'it_IT', pt: 'pt_PT',
  ja: 'ja_JP', ko: 'ko_KR', zh: 'zh_CN', ar: 'ar_AR', tr: 'tr_TR', pl: 'pl_PL', nl: 'nl_NL',
  sv: 'sv_SE', da: 'da_DK', fi: 'fi_FI', nb: 'nb_NO', cs: 'cs_CZ', uk: 'uk_UA',
}

export type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

function canonicalPath(m: BackendMedia): string {
  return `/${m.type === 'book' ? 'b' : 'm'}/${m.uuid || m.id}`
}

// Per-page <title>/description/OpenGraph for crawlers and social cards.
export async function buildMediaMetadata(id: string, rawLang?: string | string[]): Promise<Metadata> {
  const m = await getPublicMedia(id)
  if (!m) return { title: 'Not found :: SomeShelf' }

  const [loc, rating] = await Promise.all([loadLocalizations(m, id), getPublicRating(String(m.id))])
  const langs = availableLangs(m, loc)
  const localized = localizedFor(m, loc, parseLang(rawLang))
  const lang = localized ? parseLang(rawLang) : ''

  const name = localized?.title ?? m.title
  const title = `${name}${m.year ? ` (${m.year})` : ''} :: SomeShelf`
  // Lead the snippet with the facts a link preview should show at a glance:
  // score and who made it, then the (localized) synopsis.
  const byline = m.type === 'book' ? m.author : m.director
  const facts = [rating.count > 0 ? `★ ${rating.average.toFixed(1)}/10` : '', byline]
    .filter(Boolean)
    .join(' · ')
  const synopsis =
    localized?.description ||
    m.description ||
    `${name} on SomeShelf — track it, rate it, and see what your friends think.`
  const description = (facts ? `${facts} — ${synopsis}` : synopsis).slice(0, 200)

  const baseUrl = `${SITE_URL}${canonicalPath(m)}`
  const url = lang ? `${baseUrl}?lang=${lang}` : baseUrl

  // Horizontal 1200x630 card (cover, title, rating, director/author) rendered by
  // /api/og/media/[id]; the image route itself falls back to a brand card.
  const ogImage = {
    url: `${SITE_URL}/api/og/media/${encodeURIComponent(m.uuid || String(m.id))}${lang ? `?lang=${lang}` : ''}`,
    width: 1200,
    height: 630,
    alt: name,
  }

  const languages: Record<string, string> = {}
  if (langs.length) {
    for (const l of langs) languages[l] = `${baseUrl}?lang=${l}`
    languages['x-default'] = baseUrl
  }

  return {
    title,
    description,
    alternates: { canonical: url, ...(langs.length ? { languages } : {}) },
    openGraph: {
      title,
      description,
      url,
      siteName: 'SomeShelf',
      images: [ogImage],
      type: 'website',
      ...(lang && OG_LOCALES[lang] ? { locale: OG_LOCALES[lang] } : {}),
      ...(langs.length
        ? { alternateLocale: langs.filter((l) => l !== lang && OG_LOCALES[l]).map((l) => OG_LOCALES[l]) }
        : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

// Server component: fetch public catalog data, emit JSON-LD, and render the
// MediaOne screen with that data as its initial state (so the SEO content is in
// the server HTML). MediaOne overlays the signed-in user's shelf/rating on the
// client when there's a session.
export default async function MediaRoute({ id, lang: rawLang }: { id: string; lang?: string | string[] }) {
  const media = await getPublicMedia(id)
  if (!media) notFound()

  const [credits, loc] = await Promise.all([getPublicCredits(id), loadLocalizations(media, id)])

  const localized = localizedFor(media, loc, parseLang(rawLang))
  const lang = localized ? parseLang(rawLang) : ''

  const item = toMediaItem(media)
  const baseUrl = `${SITE_URL}${canonicalPath(media)}`
  const url = lang ? `${baseUrl}?lang=${lang}` : baseUrl
  const ldMedia = localized
    ? { ...media, title: localized.title, description: localized.description || media.description }
    : media

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mediaJsonLd(ldMedia, url)) }}
      />
      <MediaOne
        ssr
        initialItem={item}
        initialCredits={credits}
        initialEditions={loc.editions}
        initialAltTitles={loc.altTitles}
        initialLang={lang}
        initialEditionId={localized?.editionId}
      />
    </>
  )
}
