import 'server-only'
import sharp from 'sharp'
import { dominantFromRGBA } from './coverColor'

// Server-side counterpart of coverColor.ts for the link-preview image: decodes
// the cover with sharp and reuses the same dominant-colour routine.

// Same rule as the app's covers: OpenLibrary returns a 1x1 image for ISBNs it
// has no cover for, so anything tiny counts as "no cover".
const MIN_COVER_DIM = 4

/** `data:` URL (as produced by avatarDataUrl) -> usable cover + glow colour. */
export async function analyzeCover(
  dataUrl: string | null,
): Promise<{ usable: boolean; rgb: [number, number, number] | null }> {
  if (!dataUrl) return { usable: false, rgb: null }
  try {
    const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
    const img = sharp(bytes)
    const meta = await img.metadata()
    if ((meta.width ?? 0) < MIN_COVER_DIM || (meta.height ?? 0) < MIN_COVER_DIM) {
      return { usable: false, rgb: null }
    }
    const { data } = await img
      .resize(32, 32, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    // Brighter floor than the calendar's: a dark cover must still light the glow.
    const hex = dominantFromRGBA(data, [0.32, 0.7])
    const rgb = hex
      ? ([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number])
      : null
    return { usable: true, rgb }
  } catch {
    return { usable: false, rgb: null }
  }
}

/** HSL (h 0-359, s/l 0-1) -> RGB, for glows derived from the placeholder hue. */
export function hslToRgb255(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return [f(0), f(8), f(4)]
}
