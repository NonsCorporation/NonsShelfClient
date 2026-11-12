'use client'

import { useEffect, useState } from 'react'

// Loads bingo covers for the share picture: an inlined copy (so a canvas capture
// works) and the cover's vibrant colour (so the card's backdrop and glow take the
// colours of the books on it). Used by the share dialog and by the feed post, so
// both look the same.

export type CoverInfo = { data: string; color: [number, number, number] }

// Several image hosts send no CORS headers, which makes a canvas capture fail,
// so covers go through a CORS-enabled proxy and are inlined as data URLs.
function corsCover(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url
  return `https://images.weserv.nl/?url=${encodeURIComponent('ssl:' + url.replace(/^https?:\/\//i, ''))}`
}

// One load per cover for the whole session: a feed with several bingo posts, or a
// post and then its share dialog, never fetch the same cover twice.
const cache = new Map<string, Promise<CoverInfo | null>>()

export function loadCover(url: string): Promise<CoverInfo | null> {
  const hit = cache.get(url)
  if (hit) return hit
  const p = new Promise<CoverInfo | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const max = 200
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.naturalWidth * k))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        // The cover's vibrant colour: every pixel weighted by how saturated and bright it is.
        const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let r = 0
        let g = 0
        let b = 0
        let sum = 0
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 128) continue
          const max = Math.max(px[i], px[i + 1], px[i + 2])
          const min = Math.min(px[i], px[i + 1], px[i + 2])
          const w = ((max === 0 ? 0 : (max - min) / max) * (max / 255)) ** 2 + 0.002
          r += px[i] * w
          g += px[i + 1] * w
          b += px[i + 2] * w
          sum += w
        }
        resolve({ data: canvas.toDataURL('image/jpeg', 0.85), color: [Math.round(r / sum), Math.round(g / sum), Math.round(b / sum)] })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = corsCover(url)
  })
  cache.set(url, p)
  return p
}

const NONE_COVERS: Record<string, string | null> = {}
const NONE_COLORS: Record<string, [number, number, number] | null> = {}

/**
 * Loads every cover in `urls`. `ready` turns true once all have settled (a cover
 * that can't be loaded just has no entry). Results belong to the exact list of
 * urls they were loaded for, so a changed list never shows stale colours.
 */
export function useCoverInfos(urls: string[]) {
  const key = urls.join('\n')
  const [done, setDone] = useState<{
    key: string
    covers: Record<string, string | null>
    colors: Record<string, [number, number, number] | null>
  } | null>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    Promise.all(key.split('\n').map(async (u) => [u, await loadCover(u)] as const)).then((pairs) => {
      if (cancelled) return
      setDone({
        key,
        covers: Object.fromEntries(pairs.map(([u, r]) => [u, r?.data ?? null])),
        colors: Object.fromEntries(pairs.map(([u, r]) => [u, r?.color ?? null])),
      })
    })
    return () => {
      cancelled = true
    }
  }, [key])

  const fresh = done?.key === key ? done : null
  return { covers: fresh?.covers ?? NONE_COVERS, colors: fresh?.colors ?? NONE_COLORS, ready: !key || !!fresh }
}
