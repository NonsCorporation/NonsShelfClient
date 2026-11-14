'use client'

import { useEffect, useState } from 'react'
import { coverColor } from './coverColor'

/**
 * The dominant colour (#rrggbb) of an image — e.g. a profile picture — or null
 * while it loads, when there's no image, or when the host doesn't allow reading
 * its pixels (CORS). Results are memoized per URL by coverColor().
 */
export function useDominantColor(url?: string | null): string | null {
  // Keep the url the colour belongs to, so a stale colour is never shown for a new url.
  const [found, setFound] = useState<{ url: string; color: string | null } | null>(null)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    coverColor(url).then((color) => {
      if (!cancelled) setFound({ url, color })
    })
    return () => {
      cancelled = true
    }
  }, [url])

  return url && found?.url === url ? found.color : null
}
