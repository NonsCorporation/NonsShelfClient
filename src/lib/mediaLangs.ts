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
}

export const MEDIA_LANG_OPTIONS = Object.entries(MEDIA_LANG_NAMES).map(([code, label]) => ({
  code,
  label,
}))
