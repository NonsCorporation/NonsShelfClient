// Cropping an image in the browser: the pure part of the avatar cropper (the UI is
// components/ui/ImageCropModal.tsx). Reusable for any image that needs a chosen
// area cut out of it (a banner later).

/** A pixel rectangle of the source image, as react-easy-crop reports it. */
export type PixelCrop = { x: number; y: number; width: number; height: number }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('could not read image'))
    img.src = src
  })
}

/**
 * Cuts `area` out of the image at `src` (an object URL) and scales it to
 * `width`×`height`, returning a JPEG blob. For an avatar: a square area and
 * size = 256, about 20 KB, well under the server's 1 MB limit.
 */
export async function cropToBlob(src: string, area: PixelCrop, width = 256, height = width, quality = 0.85): Promise<Blob> {
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not encode image'))), 'image/jpeg', quality)
  })
}
