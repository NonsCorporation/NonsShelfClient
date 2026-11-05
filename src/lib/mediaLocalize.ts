import {
  getPublicEditions,
  getPublicAltTitles,
  type PublicAltTitle,
} from './serverApi'
import type { BackendMedia, Edition } from './mediaMap'

// Picks the translation of a catalog row for ?lang=xx (ISO 639-1): films/series
// use their TMDB alt titles, books use the edition printed in that language.

/** Normalizes ?lang= ("pt-BR", "RU") to a bare lowercase code, or '' if invalid. */
export function parseLang(raw: string | string[] | undefined): string {
  const v = (Array.isArray(raw) ? raw[0] : raw) ?? ''
  const code = v.toLowerCase().split(/[-_]/)[0]
  return /^[a-z]{2}$/.test(code) ? code : ''
}

export type Localizations = { altTitles: PublicAltTitle[]; editions: Edition[] }

export async function loadLocalizations(m: BackendMedia, id: string): Promise<Localizations> {
  if (m.type === 'book') return { altTitles: [], editions: await getPublicEditions(id) }
  return { altTitles: await getPublicAltTitles(id), editions: [] }
}

export type Localized = { title: string; description?: string; editionId?: number }

export function localizedFor(m: BackendMedia, loc: Localizations, lang: string): Localized | null {
  if (!lang) return null
  if (m.type === 'book') {
    const matches = loc.editions.filter((e) => e.language === lang)
    const ed = matches.find((e) => e.is_primary) ?? matches[0]
    if (!ed) return null
    return { title: ed.title || m.title, description: ed.description || undefined, editionId: ed.id }
  }
  const matches = loc.altTitles.filter((t) => t.language === lang && t.title)
  const t = matches.find((x) => x.overview) ?? matches[0]
  return t ? { title: t.title, description: t.overview || undefined } : null
}

// hreflang/og:locale need ISO 639-1; the catalog also holds 3-letter codes.
const isLang2 = (l?: string): l is string => !!l && /^[a-z]{2}$/.test(l)

export function availableLangs(m: BackendMedia, loc: Localizations): string[] {
  const codes = new Set<string>()
  if (m.type === 'book') {
    for (const e of loc.editions) if (isLang2(e.language) && (e.title || e.description)) codes.add(e.language)
  } else {
    for (const t of loc.altTitles) if (isLang2(t.language) && t.title) codes.add(t.language)
  }
  return [...codes].sort()
}

