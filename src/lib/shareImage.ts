// Helpers shared by the exported share cards (profile, reading year): the
// html-to-image capture can't read cross-origin images, so covers/avatars are
// proxied and converted to same-origin data: URLs first.

// Several avatar hosts (nons-server, Google, etc.) don't send CORS headers, so
// an <img crossOrigin="anonymous"> request fails outright and html-to-image
// can't capture it. Route through a CORS-enabled proxy, same as ShareModal.
export function corsCover(url?: string): string | undefined {
  if (!url) return undefined
  if (!/^https?:\/\//i.test(url)) return url
  const upstream = 'ssl:' + url.replace(/^https?:\/\//i, '')
  return `https://images.weserv.nl/?url=${encodeURIComponent(upstream)}`
}

export async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) =>
      img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = () => res(null) }),
    ),
  )
}

export type AvatarLoad = { dataUrl: string; color: { r: number; g: number; b: number } | null }

// Loads the avatar cross-origin exactly once and derives both a same-origin
// data: URL (so html-to-image can capture it without tainting the canvas) and
// its dominant accent color (for the card's background glow) — mirrors
// ShareModal.tsx's loadCoverImage.
export function loadAvatarImage(src: string): Promise<AvatarLoad | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

        // Sample a small region for the dominant accent color.
        const size = 60
        const sampleCanvas = document.createElement('canvas')
        sampleCanvas.width = size
        sampleCanvas.height = size
        const sampleCtx = sampleCanvas.getContext('2d')
        let color: { r: number; g: number; b: number } | null = null
        if (sampleCtx) {
          sampleCtx.drawImage(img, 0, 0, size, size)
          const { data } = sampleCtx.getImageData(0, 0, size, size)
          let bestScore = -1
          let bestR = 0, bestG = 0, bestB = 0
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
            if (a < 128) continue
            const max = Math.max(r, g, b), min = Math.min(r, g, b)
            const sat = max === 0 ? 0 : (max - min) / max
            const score = sat * (max / 255)
            if (score > bestScore) { bestScore = score; bestR = r; bestG = g; bestB = b }
          }
          color = bestScore > 0.08 ? { r: bestR, g: bestG, b: bestB } : null
        }
        resolve({ dataUrl, color })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}
