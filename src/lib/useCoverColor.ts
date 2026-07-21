'use client'

import { useEffect, useState } from 'react'

export type RgbColor = { r: number; g: number; b: number }

// Drive a colour to a consistent, visible mid-tone (fixed moderate saturation,
// lightness clamped to a mid-range) so pale, near-black or greyscale covers
// still yield an accent worth showing, rather than a barely-there smudge.
// Mirrors the boost used for the Shelf12 spine outlines.
function vivid(r: number, g: number, b: number): RgbColor {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = 0.5
  const ll = Math.max(0.45, Math.min(0.62, l))
  const c = (1 - Math.abs(2 * ll - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ll - c / 2
  let rr = 0
  let gg = 0
  let bb = 0
  if (h < 60) [rr, gg, bb] = [c, x, 0]
  else if (h < 120) [rr, gg, bb] = [x, c, 0]
  else if (h < 180) [rr, gg, bb] = [0, c, x]
  else if (h < 240) [rr, gg, bb] = [0, x, c]
  else if (h < 300) [rr, gg, bb] = [x, 0, c]
  else [rr, gg, bb] = [c, 0, x]
  return {
    r: Math.round((rr + m) * 255),
    g: Math.round((gg + m) * 255),
    b: Math.round((bb + m) * 255),
  }
}

// Saturation-weighted average colour of a loaded image, boosted to a vivid
// accent via vivid(). Sampling a small canvas (rather than the full-size
// image) keeps this cheap.
function dominantColor(img: HTMLImageElement): RgbColor | undefined {
  const size = 24
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  ctx.drawImage(img, 0, 0, size, size)
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, size, size).data
  } catch {
    // Tainted canvas — the cover's host doesn't send permissive CORS headers.
    return undefined
  }
  let r = 0
  let g = 0
  let b = 0
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    const R = data[i]
    const G = data[i + 1]
    const B = data[i + 2]
    if (data[i + 3] < 125) continue
    const max = Math.max(R, G, B)
    const min = Math.min(R, G, B)
    const sat = max === 0 ? 0 : (max - min) / max
    const w = sat * sat + 0.04
    r += R * w
    g += G * w
    b += B * w
    total += w
  }
  if (!total) return undefined
  return vivid(r / total, g / total, b / total)
}

// Extracts a vivid accent colour from a cover/poster image, for gradient
// washes and glow shadows keyed to what's actually on the page. Resolves to
// undefined while loading, on load failure, or when the image doesn't allow
// canvas pixel access — callers should fall back to a neutral look in that case.
export function useCoverColor(url: string | undefined): RgbColor | undefined {
  const [color, setColor] = useState<RgbColor | undefined>(undefined)
  useEffect(() => {
    setColor(undefined)
    if (!url) return
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      setColor(dominantColor(img))
    }
    img.src = url
    return () => {
      cancelled = true
    }
  }, [url])
  return color
}
