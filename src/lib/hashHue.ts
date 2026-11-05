// Deterministic hue (0-359) from a string, so an item with no cover always gets
// the same generated placeholder colour. Shared by the statistics page, the
// reading calendar and the link-preview image.
export function hashHue(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % 360
}
