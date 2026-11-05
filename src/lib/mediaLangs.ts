// Common ISO 639-1 language codes and their display names, used for the
// preferred media language setting and the per-page language switcher.
export const MEDIA_LANG_NAMES: Record<string, string> = {
  en: 'English',
  ru: 'Русский',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  ar: 'العربية',
  tr: 'Türkçe',
  pl: 'Polski',
  nl: 'Nederlands',
  sv: 'Svenska',
  da: 'Dansk',
  fi: 'Suomi',
  nb: 'Norsk',
  cs: 'Čeština',
  uk: 'Українська',
  uz: 'Oʻzbekcha',
  lb: 'Lëtzebuergesch',
}

export const MEDIA_LANG_OPTIONS = Object.entries(MEDIA_LANG_NAMES).map(([code, label]) => ({
  code,
  label,
}))

// Names for a language code, in the language itself ("ru" -> "Русский") and in
// English ("Russian"). Falls back to the code for anything Intl doesn't know
// (the catalog also holds odd codes like 'fre').
const _en = typeof Intl !== 'undefined' ? new Intl.DisplayNames(['en'], { type: 'language' }) : null
const _cache = new Map<string, { native: string; english: string }>()

export function langNames(code: string): { native: string; english: string } {
  const hit = _cache.get(code)
  if (hit) return hit
  let english = code.toUpperCase()
  let native = MEDIA_LANG_NAMES[code] ?? ''
  try {
    english = _en?.of(code) ?? english
    if (!native) {
      const n = new Intl.DisplayNames([code], { type: 'language' }).of(code)
      native = n ? n.charAt(0).toLocaleUpperCase(code) + n.slice(1) : ''
    }
  } catch {
    /* unknown code — keep the fallbacks */
  }
  const out = { native: native || english, english }
  _cache.set(code, out)
  return out
}
