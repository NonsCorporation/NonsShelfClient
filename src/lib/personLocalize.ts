// Language handling for person pages (/p/<uuid>?lang=xx). Pure and shared by the
// server (metadata, OG card) and the client (the visible heading) so both agree
// on which spelling of the name a given ?lang= shows.

export type PersonAlias = { name: string; lang?: string }
type NamedPerson = { name: string; name_lang?: string }

/** "pt-BR" / "RU" / "ru" -> "pt" / "ru" / "ru"; '' when it isn't a 2-letter code. */
export function langCode(raw?: string): string {
  const code = (raw ?? '').toLowerCase().split(/[-_]/)[0]
  return /^[a-z]{2}$/.test(code) ? code : ''
}

// Most aliases come from imports that record a spelling but not its language.
// For those, the script is a decent signal: Hangul is Korean, kana is Japanese,
// and so on. Latin is deliberately absent (many languages share it, and the
// canonical name is usually Latin anyway). Cyrillic defaults to Russian, with
// the letters only Ukrainian uses as the tell. Han alone is read as Chinese, so
// a Japanese name written only in kanji would be mislabelled — the cost of the
// heuristic; an alias with an explicit language is never second-guessed.
const SCRIPTS: [RegExp, string][] = [
  [/[\p{Script=Hiragana}\p{Script=Katakana}]/u, 'ja'],
  [/\p{Script=Hangul}/u, 'ko'],
  [/\p{Script=Han}/u, 'zh'],
  [/\p{Script=Arabic}/u, 'ar'],
  [/\p{Script=Greek}/u, 'el'],
  [/\p{Script=Hebrew}/u, 'he'],
  [/\p{Script=Thai}/u, 'th'],
]

/** The language an alias is spelled in: its tagged language, else guessed from its script, else ''. */
export function aliasLang(a: PersonAlias): string {
  const tagged = langCode(a.lang)
  if (tagged) return tagged
  if (/[іїєґІЇЄҐ]/.test(a.name)) return 'uk'
  if (/\p{Script=Cyrillic}/u.test(a.name)) return 'ru'
  return SCRIPTS.find(([re]) => re.test(a.name))?.[1] ?? ''
}

/** The person's name as spelled in `lang` (an alias in that language), else the canonical name. */
export function nameForLang(person: NamedPerson, aliases: PersonAlias[], lang: string): string {
  if (!lang) return person.name
  return aliases.find((a) => a.name && aliasLang(a) === lang)?.name ?? person.name
}

/** Languages the person has a distinct spelling in — each becomes its own indexable URL. */
export function personLangs(person: NamedPerson, aliases: PersonAlias[]): string[] {
  const codes = new Set<string>()
  for (const a of aliases) {
    const c = aliasLang(a)
    if (c && a.name) codes.add(c)
  }
  const own = langCode(person.name_lang)
  if (own) codes.add(own)
  return [...codes].sort()
}

/** "(1821–1881)", "(1821–)" or '' — years only, so it reads the same in every language. */
export function lifeSpan(p: { birth_year?: number; death_year?: number }): string {
  if (!p.birth_year && !p.death_year) return ''
  return `(${p.birth_year || ''}–${p.death_year || ''})`
}
