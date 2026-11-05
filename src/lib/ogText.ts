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
