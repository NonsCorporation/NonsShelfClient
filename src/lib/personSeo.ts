import type { Metadata } from 'next'
import { getPublicPerson, type PublicPerson } from './serverApi'
import { parseLang } from './mediaLocalize'
import { OG_LOCALES } from './mediaRoute'
import { lifeSpan, nameForLang, personLangs } from './personLocalize'

// SEO for person pages (/p/<uuid>): <title>, description, OpenGraph/Twitter
// tags, hreflang alternates and JSON-LD. Language-based: ?lang=xx renders the
// person's name as spelled in that language (an alias) with the surrounding text
// in that language, and each language is its own indexable URL cross-linked with
// hreflang — so "Достоевский" and "Dostoevsky" searches both land here.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://someshelf.com').replace(/\/+$/, '')

type Tpl = { on: string; works: string; books: string; screen: string; both: string }

// Page text per language. A language the person has a name in but we have no
// template for falls back to English around that localized name.
const TPL: Record<string, Tpl> = {
  en: { on: 'on SomeShelf', works: 'Works', books: 'books', screen: 'films and series', both: 'books, films and series' },
  ru: { on: 'на SomeShelf', works: 'Произведения', books: 'книги', screen: 'фильмы и сериалы', both: 'книги, фильмы и сериалы' },
  ro: { on: 'pe SomeShelf', works: 'Lucrări', books: 'cărți', screen: 'filme și seriale', both: 'cărți, filme și seriale' },
  uk: { on: 'на SomeShelf', works: 'Твори', books: 'книги', screen: 'фільми та серіали', both: 'книги, фільми та серіали' },
  de: { on: 'auf SomeShelf', works: 'Werke', books: 'Bücher', screen: 'Filme und Serien', both: 'Bücher, Filme und Serien' },
  fr: { on: 'sur SomeShelf', works: 'Œuvres', books: 'livres', screen: 'films et séries', both: 'livres, films et séries' },
  es: { on: 'en SomeShelf', works: 'Obras', books: 'libros', screen: 'películas y series', both: 'libros, películas y series' },
  it: { on: 'su SomeShelf', works: 'Opere', books: 'libri', screen: 'film e serie', both: 'libri, film e serie' },
  pt: { on: 'no SomeShelf', works: 'Obras', books: 'livros', screen: 'filmes e séries', both: 'livros, filmes e séries' },
}

/** The language a request resolves to: ?lang= if the person has a name in it, else '' (default). */
export function resolvePersonLang(d: PublicPerson, rawLang?: string | string[]): string {
  const want = parseLang(rawLang)
  return want && personLangs(d.person, d.aliases).includes(want) ? want : ''
}

/** Distinct works (a person credited twice on one title counts once), in credit order (newest first). */
export function distinctWorks(d: PublicPerson) {
  const seen = new Set<string>()
  return d.credits
    .map((c) => c.media)
    .filter((m) => {
      if (seen.has(m.uuid)) return false
      seen.add(m.uuid)
      return true
    })
}

function kindsPhrase(d: PublicPerson, tpl: Tpl): string {
  const works = distinctWorks(d)
  const book = works.some((m) => m.type === 'book')
  const screen = works.some((m) => m.type !== 'book')
  return book && screen ? tpl.both : screen ? tpl.screen : tpl.books
}

export async function buildPersonMetadata(uuid: string, rawLang?: string | string[]): Promise<Metadata> {
  const d = await getPublicPerson(uuid)
  if (!d) return { title: 'Not found :: SomeShelf' }

  const langs = personLangs(d.person, d.aliases)
  const lang = resolvePersonLang(d, rawLang)
  const tpl = TPL[lang] ?? TPL.en
  const name = nameForLang(d.person, d.aliases, lang)
  const life = lifeSpan(d.person)
  const kinds = kindsPhrase(d, tpl)

  const title = `${name}${life ? ` ${life}` : ''} — ${kinds} :: SomeShelf`

  const titles = distinctWorks(d).slice(0, 4).map((m) => m.title).join(', ')
  const generated = `${name} — ${kinds} ${tpl.on}.${titles ? ` ${tpl.works}: ${titles}.` : ''}`
  // The stored bio is one text in one language (in practice English), so it only
  // describes the default and English pages; other languages get the localized line.
  const description = ((!lang || lang === 'en') && d.person.bio ? d.person.bio : generated).slice(0, 200)

  const baseUrl = `${SITE_URL}/p/${d.person.uuid}`
  const url = lang ? `${baseUrl}?lang=${lang}` : baseUrl
  const ogImage = {
    url: `${SITE_URL}/api/og/person/${d.person.uuid}${lang ? `?lang=${lang}` : ''}`,
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
      type: 'profile',
      ...(lang && OG_LOCALES[lang] ? { locale: OG_LOCALES[lang] } : {}),
      ...(langs.length
        ? { alternateLocale: langs.filter((l) => l !== lang && OG_LOCALES[l]).map((l) => OG_LOCALES[l]) }
        : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

/** schema.org Person, serialized safely for a <script> tag. */
export function personJsonLd(d: PublicPerson, rawLang?: string | string[]): string {
  const lang = resolvePersonLang(d, rawLang)
  const name = nameForLang(d.person, d.aliases, lang)
  const url = `${SITE_URL}/p/${d.person.uuid}${lang ? `?lang=${lang}` : ''}`
  const others = [...new Set([d.person.name, ...d.aliases.map((a) => a.name)].filter((n) => n && n !== name))]
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    url,
    ...(others.length ? { alternateName: others } : {}),
    ...(d.person.photo_url ? { image: d.person.photo_url } : {}),
    ...(d.person.bio ? { description: d.person.bio } : {}),
    ...(d.person.birth_date || d.person.birth_year ? { birthDate: d.person.birth_date || String(d.person.birth_year) } : {}),
    ...(d.person.death_date || d.person.death_year ? { deathDate: d.person.death_date || String(d.person.death_year) } : {}),
  }
  // Escape "<" so a bio containing "</script>" can't end the script tag early.
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
