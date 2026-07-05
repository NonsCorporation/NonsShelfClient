// Generates the Open Graph / Twitter card image at public/img/og.png.
//
// Mirrors nons-client's own og.png (dark radial-glow background, centred
// logo-badge + headline + wordmark) and the way it's produced (SVG rendered to
// PNG with sharp — see nons-client/scripts/generate-icons.mjs). The badge is
// Shelf's real icon (public/shelf.svg, embedded verbatim); the scattered
// decoration is generated placeholder book covers and movie posters (not real
// artwork) instead of nons-client's star constellation.
//
// Run: node scripts/generate-og.mjs  (or: npm run generate-og)
import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/img')
const outPath = join(outDir, 'og.png')

const W = 1200
const H = 630
const BG = '#0a0a14'
const GLOW = '#3d3d78'
const INK = '#ffffff'
const ACCENT = '#9a9bdc' // lighter tint of --color-nonsprimary for contrast on dark

// Black-and-white covers — a few light-grey/white card tones, matching the
// monochrome badge + text. INK_DARK is the near-black used for internal
// details so they read on a light card.
const INK_DARK = '#14141c'
const CARD_A = '#ffffff'
const CARD_B = '#d0d0d8'
const CARD_C = '#e6e6ec'

// Darken a #rrggbb hex toward black by `f` (0..1) — for cover spines / bands.
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * (1 - f))
  const g = Math.round(((n >> 8) & 255) * (1 - f))
  const b = Math.round((n & 255) * (1 - f))
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

// A placeholder book cover: portrait card, a darker spine down the left edge,
// and a few short "title" bars near the top. Not real artwork — abstract, B&W.
function bookCover(x, y, { w = 74, rot = 0, color = CARD_A, opacity = 0.2 } = {}) {
  const h = w * 1.42
  const spine = w * 0.16
  const bar = (i) =>
    `<rect x="${x + spine + 8}" y="${y + 12 + i * 11}" width="${w - spine - 16 - i * 6}" height="4" rx="2" fill="${INK_DARK}" opacity="0.55"/>`
  return `<g opacity="${opacity}" transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${color}"/>
    <rect x="${x}" y="${y}" width="${spine}" height="${h}" rx="3" fill="${darken(color, 0.5)}"/>
    ${bar(0)}${bar(1)}${bar(2)}
  </g>`
}

// A placeholder movie poster: portrait card with a subtle bottom "title" band
// and a centred play glyph (dark circle + light triangle) — reads as a film, B&W.
function moviePoster(x, y, { w = 74, rot = 0, color = CARD_B, opacity = 0.2 } = {}) {
  const h = w * 1.42
  const cx = x + w / 2
  const cy = y + h * 0.44
  const r = w * 0.2
  const t = r * 0.62
  const tri = `${cx - t * 0.5},${cy - t} ${cx - t * 0.5},${cy + t} ${cx + t},${cy}`
  return `<g opacity="${opacity}" transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${color}"/>
    <rect x="${x}" y="${y + h * 0.72}" width="${w}" height="${h * 0.28}" rx="0" fill="${darken(color, 0.55)}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK_DARK}"/>
    <polygon points="${tri}" fill="${color}"/>
  </g>`
}

// Shelf's real icon (public/shelf.svg) embedded verbatim, nested so it sits at
// (x,y) sized `size`. Kept byte-identical to the source so the badge is the
// actual mark, not a reconstruction.
function shelfIcon(x, y, size) {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 512 512">
    <circle cx="256" cy="256" r="256" fill="#000000"/>
    <g fill="#ffffff" transform="translate(89.6, 89.6) scale(0.65)">
      <path d="m 281.77771,168.55891 a 58.151039,58.151039 47.226629 0 1 55.84784,60.36644 v 137.13181 h -55.84784 z" transform="matrix(2.446384,0,0,2.4904064,-337.33813,-404.93892)"/>
      <path d="m 281.77771,168.55891 a 58.151039,58.151039 47.226629 0 1 55.84784,60.36644 v 137.13181 h -55.84784 z" transform="matrix(-2.446384,0,0,2.4904064,837.74641,-411.14917)"/>
    </g>
    <g fill="#ffffff">
      <rect x="211" y="112" width="90" height="200" rx="16"/>
      <circle cx="256" cy="376" r="42"/>
    </g>
  </svg>`
}

// Scattered covers/posters, kept to the margins so the centre stays clear.
const decor = [
  bookCover(58, 46, { w: 82, rot: -8, color: CARD_A, opacity: 0.22 }),
  moviePoster(168, 92, { w: 70, rot: 10, color: CARD_B, opacity: 0.18 }),
  bookCover(44, 300, { w: 66, rot: 6, color: CARD_C, opacity: 0.16 }),
  moviePoster(66, 452, { w: 78, rot: -12, color: CARD_A, opacity: 0.2 }),
  bookCover(190, 486, { w: 64, rot: 8, color: CARD_B, opacity: 0.16 }),
  moviePoster(1030, 44, { w: 80, rot: 9, color: CARD_A, opacity: 0.22 }),
  bookCover(952, 96, { w: 66, rot: -10, color: CARD_C, opacity: 0.17 }),
  moviePoster(1092, 290, { w: 66, rot: -7, color: CARD_B, opacity: 0.16 }),
  bookCover(1044, 452, { w: 80, rot: 11, color: CARD_A, opacity: 0.2 }),
  moviePoster(936, 500, { w: 62, rot: -9, color: CARD_C, opacity: 0.15 }),
].join('\n  ')

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="${GLOW}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  ${decor}

  <!-- Logo badge — Shelf's real icon -->
  ${shelfIcon(562, 167, 76)}

  <!-- Headline -->
  <text x="600" y="345" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="62" font-weight="600" fill="${INK}">Your books and films,</text>
  <text x="600" y="415" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="62" font-weight="600" fill="${ACCENT}">all in one shelf.</text>

  <!-- Wordmark -->
  <text x="600" y="510" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="${INK}" letter-spacing="1">Shelf</text>
</svg>`

mkdirSync(outDir, { recursive: true })
await sharp(Buffer.from(svg)).png().toFile(outPath)
console.log(`✓ ${outPath} (${W}×${H})`)
