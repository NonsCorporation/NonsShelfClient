import { ArabicShaper, PersianShaper } from 'arabic-persian-reshaper'
import bidiFactory from 'bidi-js'

// The link-preview renderer (satori) draws glyphs left-to-right in the order
// of the string and does no Arabic shaping, so Arabic comes out as unjoined
// isolated letters in reverse. We do both steps ourselves: join the letters
// into their contextual presentation forms (U+FE70–FEFF), then reorder into
// visual order. The result is drawn with a font that has those forms and no
// shaping tables (assets/fonts/noto-sans-arabic-*.woff) — a font that does ship
// them crashes the renderer.

const bidi = bidiFactory()

/** True when the text contains Arabic-script letters. */
export const hasArabicScript = (s: string) => /[\u0600-\u06FF]/.test(s)

/** Right-to-left text, ready for the renderer: shaped and in visual order. */
export function toVisualRtl(s: string, lang = 'ar'): string {
  const shaper = lang === 'fa' || lang === 'ur' ? PersianShaper : ArabicShaper
  const shaped = shaper.convertArabic(s)
  return bidi.getReorderedString(shaped, bidi.getEmbeddingLevels(shaped, 'rtl'))
}

// ── Drawable-text helpers shared by the link-preview cards ──────────────────

export const clipText = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

// Scripts the card can draw: Latin and Cyrillic (Onest) and Arabic (Noto Sans
// Arabic, pre-shaped above). Anything else would make the renderer fetch a
// fallback font at runtime — and for Arabic that font crashes it ("lookupType: 5
// - substFormat: 3 is not yet supported"), which once made /m/<id>?lang=ar a 500
// and left Telegram with no preview. So other scripts are dropped here and the
// card falls back to another spelling; the full text still goes in og:title.
const UNSUPPORTED = /[^\u0020-\u007E\u00A0-\u017F\u0400-\u04FF\u0600-\u06FF\u2010-\u2027\u2030-\u203A\u20AC\u2116]/g
export const safeText = (s: string) => s.replace(UNSUPPORTED, '').replace(/\s+/g, ' ').trim()
const isSafe = (s: string) => !!s && safeText(s) === s.replace(/\s+/g, ' ').trim()

/** First candidate fully drawable with our fonts; else the first one stripped. */
export function pickDrawable(candidates: (string | undefined)[], fallback = 'SomeShelf'): string {
  const list = candidates.filter((c): c is string => !!c)
  return list.find(isSafe) ?? list.map(safeText).find(Boolean) ?? fallback
}
