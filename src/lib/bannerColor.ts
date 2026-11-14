// The banner colour as the server stores it: six hex digits, upper case, no '#'
// ("F12312"); empty = automatic. These helpers convert to and from CSS colours.

/** CSS colour (#rrggbb) for a stored value, or null when it is empty or malformed. */
export function bannerCss(stored?: string | null): string | null {
  return stored && /^[0-9a-f]{6}$/i.test(stored) ? `#${stored.toLowerCase()}` : null
}

/** The stored form ("F12312") of a #rrggbb colour. */
export function bannerStored(hex: string): string {
  return hex.replace('#', '').toUpperCase()
}

/** The default banner colour for a hue (0–359), used when there's nothing better. */
export const defaultBannerColor = (hue: number) => `hsl(${hue} 42% 28%)`

/** "#rrggbb" for an `hsl(h s% l%)` string (a #rrggbb passes through). */
export function hslToHex(hsl: string): string {
  const m = /^hsl\((\d+) (\d+)% (\d+)%\)$/.exec(hsl)
  if (!m) return hsl.startsWith('#') ? hsl : '#444444'
  const h = Number(m[1])
  const s = Number(m[2]) / 100
  const l = Number(m[3]) / 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** Black or white text, whichever reads better on `color` (a #rrggbb or hsl() string). */
export function textOn(color: string): '#000000' | '#ffffff' {
  const hex = hslToHex(color).replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  // Perceived brightness (ITU-R BT.601), 0–255.
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000000' : '#ffffff'
}
