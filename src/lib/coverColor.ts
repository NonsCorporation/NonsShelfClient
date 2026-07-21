// Dominant color of a cover image, used to tint the calendar's reading bars so
// each book's stripe carries its own artwork's color.
//
// Runs entirely client-side on a tiny offscreen canvas: the cover is downsampled
// to 32x32 and its pixels are quantized into a coarse color histogram; the most
// populous bucket — the color that actually covers the most area, not the most
// saturated one — wins. Reading pixels back requires the host to allow CORS
// (covers.openlibrary.org, image.tmdb.org and books.google.com all do); anything
// that fails — a tainted canvas, a 404, a fully-neutral cover — resolves to null
// so the caller can fall back to a palette.
//
// Results are memoized per URL for the session, and concurrent requests for the
// same URL share one decode.

const cache = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()

/** Dominant color of `url` as a hex string, or null when it can't be read. */
export function coverColor(url: string): Promise<string | null> {
  const hit = cache.get(url)
  if (hit !== undefined) return Promise.resolve(hit)

  const pending = inflight.get(url)
  if (pending) return pending

  const job = extract(url)
    .catch(() => null)
    .then((color) => {
      cache.set(url, color)
      inflight.delete(url)
      return color
    })
  inflight.set(url, job)
  return job
}

// Channel step for the quantization bucket — pixels within this distance on
// every channel are treated as "the same color" when counting area.
const BUCKET = 24

async function extract(url: string): Promise<string | null> {
  if (typeof document === 'undefined') return null

  const img = new Image()
  // Without this the canvas is tainted and getImageData throws; with it the
  // image only loads at all if the host sends Access-Control-Allow-Origin.
  img.crossOrigin = 'anonymous'
  img.src = url
  await img.decode()

  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, size, size)

  const { data } = ctx.getImageData(0, 0, size, size)
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>()

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue // transparent

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const lightness = (max + min) / 2
    // Paper-white margins and black bars/shadows aren't the cover's color,
    // even when they cover the most area.
    if (lightness > 245 || lightness < 10) continue

    const key = `${Math.round(r / BUCKET)},${Math.round(g / BUCKET)},${Math.round(b / BUCKET)}`
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.r += r
      bucket.g += g
      bucket.b += b
      bucket.count += 1
    } else {
      buckets.set(key, { r, g, b, count: 1 })
    }
  }

  // The most populous bucket wins — the color occupying the most area, i.e.
  // the actual dominant color, not whichever pixel happened to be most vivid.
  let best: { r: number; g: number; b: number; count: number } | null = null
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket
  }
  if (!best) return null

  return legible(best.r / best.count, best.g / best.count, best.b / best.count)
}

// The dominant color as found, only nudged off the extremes of lightness so a
// thin bar stays visible against the page — hue and saturation are untouched,
// so a genuinely muted cover still renders muted.
function legible(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b)
  const [nr, ng, nb] = hslToRgb(h, s, clamp(l, 0.18, 0.82))
  return `#${[nr, ng, nb].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255]
}

function hue(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}
