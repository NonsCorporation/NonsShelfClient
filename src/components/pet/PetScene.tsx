'use client'

import { useMemo } from 'react'
import type { PetScene as SceneId } from '@/lib/pet'

// Pixel-art backdrops on a 72x40 grid. Shown 8px per pixel in a 576x320 stage,
// so they line up with the 32px pet sprite shown at 256px. Ground starts at row 32.
const SW = 72
const SH = 40
type G = string[][]

const mk = (): G => Array.from({ length: SH }, () => Array<string>(SW).fill('.'))

function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function px(g: G, x: number, y: number, c: string) {
  x = Math.round(x)
  y = Math.round(y)
  if (x >= 0 && x < SW && y >= 0 && y < SH) g[y][x] = c
}
function rect(g: G, x: number, y: number, w: number, h: number, c: string) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(g, xx, yy, c)
}
function disc(g: G, cx: number, cy: number, r: number, c: string) {
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) g[y][x] = c
}
function ellipse(g: G, cx: number, cy: number, rx: number, ry: number, c: string) {
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) g[y][x] = c
}
/** Checkerboard-dithered ellipse (soft glows, nebulae). */
function dither(g: G, cx: number, cy: number, rx: number, ry: number, c: string) {
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if ((x + y) % 2 === 0 && ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) g[y][x] = c
}
function art(g: G, rowsArt: string[], x0: number, y0: number) {
  rowsArt.forEach((r, dy) => [...r].forEach((ch, dx) => ch !== '.' && px(g, x0 + dx, y0 + dy, ch)))
}
function line(g: G, x0: number, y0: number, x1: number, y1: number, c: string) {
  x0 = Math.round(x0)
  y0 = Math.round(y0)
  x1 = Math.round(x1)
  y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    px(g, x0, y0, c)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0 += sy
    }
  }
}
/** Vertical colour bands with a dithered seam between them. */
function bands(g: G, y0: number, y1: number, chars: string[]) {
  const n = chars.length
  for (let y = y0; y < y1; y++) {
    const t = ((y - y0) / (y1 - y0)) * n
    const i = Math.min(n - 1, Math.floor(t))
    const frac = t - i
    for (let x = 0; x < SW; x++) g[y][x] = i > 0 && frac < 0.34 && (x + y) % 2 === 0 ? chars[i - 1] : chars[i]
  }
}
function hill(g: G, base: number, amp: number, freq: number, phase: number, c: string, bottom: number) {
  for (let x = 0; x < SW; x++) {
    const top = Math.round(base - amp * (0.5 + 0.5 * Math.sin(x * freq + phase)))
    for (let y = top; y < bottom; y++) px(g, x, y, c)
  }
}
function speckle(g: G, y0: number, y1: number, c: string, density: number, r: () => number) {
  for (let y = y0; y < y1; y++) for (let x = 0; x < SW; x++) if (r() < density) px(g, x, y, c)
}
function mountain(g: G, cx: number, peakY: number, baseY: number, slope: number, c: string, shade: string, snow?: string) {
  for (let y = peakY; y <= baseY; y++) {
    const half = (y - peakY) * slope
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      let col = x > cx + half * 0.1 ? shade : c
      if (snow && y - peakY < 3 + ((x * 7) % 4) * 0.8) col = snow
      px(g, x, y, col)
    }
  }
}
function pine(g: G, x: number, baseY: number, h: number, c: string) {
  for (let i = 0; i < h; i++) {
    const half = Math.round((i + 1) * 0.42)
    rect(g, x - half, baseY - h + i, half * 2 + 1, 1, c)
  }
  px(g, x, baseY, c)
  px(g, x, baseY + 1, c)
}
function roundTree(g: G, x: number, baseY: number, r: number, dark: string, light: string, trunk: string) {
  rect(g, x, baseY - 3, 2, 4, trunk)
  disc(g, x + 1, baseY - 3 - r * 0.7, r, dark)
  disc(g, x + 0.2, baseY - 3 - r * 0.9, r * 0.62, light)
}

type Scene = {
  grid: G
  colors: Record<string, string>
  /** Pixels that blink; drawn above the grid. */
  twinkle?: { x: number; y: number; c: string }[]
  /** A full-scene flash (explosions). */
  flash?: string
}

const CLOUD_BIG = ['....WWWW....', '..WWWWWWWW..', '.WWWWWWWWWWW', 'WWWWWWWWWWWW', '.VVVVVVVVVV.']
const CLOUD_SMALL = ['..WWW...', '.WWWWWW.', 'WWWWWWWW', '.VVVVVV.']
const BIRD = ['k.k', '.k.']

// ─────────────────────────────── meadow ───────────────────────────────
function meadow(): Scene {
  const r = rng(11)
  const g = mk()
  bands(g, 0, 33, ['A', 'B', 'C', 'D', 'E', 'F'])
  disc(g, 58, 8, 7, 'T')
  disc(g, 58, 8, 5, 'S')
  disc(g, 57, 7, 2.5, 'U')
  art(g, CLOUD_BIG, 5, 5)
  art(g, CLOUD_SMALL, 30, 11)
  art(g, CLOUD_BIG, 36, 2)
  art(g, CLOUD_SMALL, 20, 16)
  art(g, BIRD, 24, 7)
  art(g, BIRD, 29, 5)
  art(g, BIRD, 46, 12)
  mountain(g, 14, 12, 27, 1.15, 'N', 'n', 'W')
  mountain(g, 42, 15, 27, 1.0, 'N', 'n', 'W')
  mountain(g, 66, 11, 27, 1.2, 'N', 'n', 'W')
  hill(g, 25, 3.5, 0.18, 0.5, 'F2', 31)
  hill(g, 27.5, 3, 0.25, 2.0, 'M', 32)
  hill(g, 30, 2.2, 0.3, 4.0, 'H2', 33)
  // windmill on the mid hill
  rect(g, 25, 23, 4, 7, 'Bw')
  rect(g, 25, 23, 1, 7, 'Bs')
  art(g, ['..ZZ..', '.ZZZZ.'], 24, 21)
  const hubX = 27
  const hubY = 24
  line(g, hubX, hubY, hubX - 5, hubY - 5, 'K')
  line(g, hubX, hubY, hubX + 5, hubY + 5, 'K')
  line(g, hubX, hubY, hubX + 5, hubY - 5, 'K')
  line(g, hubX, hubY, hubX - 5, hubY + 5, 'K')
  px(g, hubX, hubY, 'Z')
  roundTree(g, 6, 31, 5, 'Q', 'R', 'T2')
  roundTree(g, 62, 31, 6, 'Q', 'R', 'T2')
  roundTree(g, 67, 31, 4, 'Q', 'R', 'T2')
  roundTree(g, 47, 29, 3, 'Q', 'R', 'T2')
  // ground
  rect(g, 0, 32, SW, 8, 'G')
  speckle(g, 32, 40, 'H', 0.1, r)
  speckle(g, 36, 40, 'J', 0.08, r)
  // fences
  for (const x0 of [0, 54]) {
    for (let x = x0; x < x0 + 18; x += 4) rect(g, x, 29, 1, 5, 'T2')
    rect(g, x0, 30, 18, 1, 'Bw')
    rect(g, x0, 32, 18, 1, 'Bw')
  }
  // grass tufts, flowers, stones
  for (let i = 0; i < 34; i++) {
    const x = Math.floor(r() * SW)
    const y = 33 + Math.floor(r() * 6)
    px(g, x, y, 'g')
    px(g, x + 1, y, 'g')
    px(g, x, y - 1, 'g')
    if (r() < 0.4) px(g, x - 1, y - 2, 'g')
  }
  const flowers = ['r', 'y', 'u', 'w']
  for (let i = 0; i < 22; i++) {
    const x = 1 + Math.floor(r() * (SW - 3))
    const y = 34 + Math.floor(r() * 5)
    px(g, x, y, 'g')
    px(g, x, y - 1, 'g')
    px(g, x, y - 2, flowers[i % 4])
    if (i % 3 === 0) {
      px(g, x - 1, y - 2, flowers[i % 4])
      px(g, x + 1, y - 2, flowers[i % 4])
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = 2 + Math.floor(r() * (SW - 6))
    const y = 36 + Math.floor(r() * 3)
    rect(g, x, y, 2, 1, 'X')
    px(g, x, y - 1, 'X')
  }
  const twinkle = [
    { x: 20, y: 28, c: '#ffd166' },
    { x: 44, y: 26, c: '#ff9bb0' },
    { x: 15, y: 30, c: '#ffffff' },
    { x: 56, y: 31, c: '#ffd166' },
  ]
  return {
    grid: g,
    twinkle,
    colors: {
      A: '#6ec3f5', B: '#85d0f9', C: '#9bdcfb', D: '#b4e6fd', E: '#cdf0fe', F: '#e6f8ff',
      S: '#ffd84d', T: '#fff1b8', U: '#fff7cf', W: '#ffffff', V: '#dfeaf6',
      N: '#93aecb', n: '#7893b0', k: '#2b3a4a',
      F2: '#8fcf93', M: '#6ab87a', H2: '#58a869',
      Bw: '#c9a27a', Bs: '#a98258', Z: '#c0504d', K: '#6b4a2b',
      Q: '#3f8f55', R: '#5bb06c', T2: '#7a5230',
      G: '#4e9a5c', H: '#468d54', J: '#3f8450', g: '#6fc07c', X: '#a3a8a0',
      r: '#ff7a85', y: '#ffd166', u: '#b79bff', w: '#ffffff',
    },
  }
}

// ─────────────────────────────── night ───────────────────────────────
function night(): Scene {
  const r = rng(23)
  const g = mk()
  bands(g, 0, 33, ['A', 'B', 'C', 'D', 'E', 'F'])
  const twinkle: Scene['twinkle'] = []
  for (let i = 0; i < 64; i++) {
    const x = Math.floor(r() * SW)
    const y = Math.floor(r() * 24)
    if (i % 5 === 0) twinkle.push({ x, y, c: '#ffffff' })
    else px(g, x, y, i % 3 === 0 ? 'w' : 'x')
  }
  for (const [x, y] of [[30, 6], [48, 12], [64, 4], [24, 17]]) {
    px(g, x, y, 'w')
    px(g, x - 1, y, 'x')
    px(g, x + 1, y, 'x')
    px(g, x, y - 1, 'x')
    px(g, x, y + 1, 'x')
  }
  // moon with halo
  dither(g, 14, 10, 9.5, 9.5, 'V')
  disc(g, 14, 10, 6.4, 'N')
  disc(g, 15.5, 11.5, 4.6, 'M')
  disc(g, 13.5, 9, 4.6, 'N')
  rect(g, 16, 11, 3, 2, 'm')
  rect(g, 11, 8, 2, 2, 'm')
  px(g, 12, 13, 'm')
  px(g, 17, 8, 'm')
  // shooting star
  line(g, 60, 6, 50, 11, 'w')
  line(g, 61, 5, 56, 8, 'x')
  line(g, 50, 11, 46, 13, 'V')
  // mountains and hills
  mountain(g, 40, 12, 28, 1.3, 'P', 'p', 'S')
  mountain(g, 62, 15, 28, 1.1, 'P', 'p', 'S')
  hill(g, 25, 3.5, 0.2, 1.2, 'F2', 31)
  hill(g, 28, 3, 0.27, 3.0, 'G', 33)
  for (const x of [4, 9, 14, 52, 57, 63, 68]) pine(g, x, 30, 8 + (x % 3), 'Q')
  for (const x of [6, 11, 55, 66]) pine(g, x, 31, 5, 'Q')
  // cabin with a lit window
  rect(g, 58, 25, 9, 6, 'C2')
  art(g, ['....ZZ....', '..ZZZZZZ..', '.ZZZZZZZZZ', 'ZZZZZZZZZZZ'.slice(0, 10)], 57, 21)
  rect(g, 60, 27, 3, 3, 'Y')
  rect(g, 64, 27, 1, 4, 'Dr')
  rect(g, 63, 19, 2, 3, 'C2')
  // ground
  rect(g, 0, 32, SW, 8, 'L')
  speckle(g, 32, 40, 'l', 0.1, r)
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * SW)
    const y = 33 + Math.floor(r() * 6)
    px(g, x, y, 't')
    px(g, x, y - 1, 't')
    px(g, x + 1, y, 't')
  }
  // pond with the moon reflected
  ellipse(g, 12, 36, 10, 2.8, 'W2')
  ellipse(g, 12, 36, 8, 1.8, 'B2')
  for (let i = 0; i < 4; i++) rect(g, 9 + i * 2, 35 + (i % 2), 2, 1, 'N')
  for (const x of [3, 4, 21]) {
    line(g, x, 36, x + 1, 32, 't')
    px(g, x + 1, 31, 'D2')
  }
  for (let i = 0; i < 10; i++) twinkle.push({ x: 3 + Math.floor(r() * 64), y: 24 + Math.floor(r() * 14), c: '#ffe27a' })
  twinkle.push({ x: 61, y: 28, c: '#ffd166' })
  return {
    grid: g,
    twinkle,
    colors: {
      A: '#070a22', B: '#0b1030', C: '#101a45', D: '#16235a', E: '#1e2f72', F: '#2a3f86',
      x: '#8a90c0', w: '#ffffff', V: '#27397a', N: '#fffbe0', M: '#e4e0b4', m: '#cfcb9c',
      P: '#162055', p: '#0f1844', S: '#9aa6e0', F2: '#18265a',
      G: '#101b45', Q: '#0a1230',
      C2: '#0d1230', Z: '#1a1030', Y: '#ffd166', Dr: '#2a1a10',
      L: '#133021', l: '#0f2818', t: '#1d4a30',
      W2: '#1b3b78', B2: '#234a90', D2: '#4a3a20',
    },
  }
}

// ─────────────────────────────── battlefield ───────────────────────────────
function battlefield(): Scene {
  const r = rng(7)
  const g = mk()
  bands(g, 0, 33, ['A', 'B', 'C', 'D', 'E', 'F'])

  // searchlight beams
  for (const [bx, lean] of [[8, 0.42], [58, -0.4]] as const) {
    for (let y = 0; y < 31; y++) {
      const cx = bx + (31 - y) * lean
      const half = 0.6 + (31 - y) * 0.1
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) if ((x + y) % 2 === 0) px(g, x, y, 'J')
    }
  }
  // billowing smoke
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(r() * SW)
    const y = 1 + Math.floor(r() * 17)
    const rad = 2.5 + r() * 4.5
    const tone = ['K', 'L', 'M'][i % 3]
    disc(g, x, y, rad, tone)
    disc(g, x + 1.2, y - 1.2, rad * 0.62, ['L', 'M', 'K'][i % 3])
  }
  // bomber formation
  for (const [x, y] of [[10, 5], [24, 3], [18, 9], [52, 6]]) art(g, ['...kk.....', 'kkkkkkkkkk', '...kk.....', '..k..k....'], x, y)

  // ruined skyline (two layers)
  for (const [layer, base, hMin, hVar] of [['r', 29, 4, 7], ['R', 30, 3, 9]] as const) {
    let x = layer === 'r' ? -2 : 0
    while (x < SW) {
      const w = 3 + Math.floor(r() * 6)
      const h = hMin + Math.floor(r() * hVar)
      rect(g, x, base - h, w, h + 3, layer)
      // jagged broken top
      for (let k = 0; k < w; k++) if (r() < 0.45) rect(g, x + k, base - h - 1 - Math.floor(r() * 2), 1, 2, layer)
      if (layer === 'R') {
        for (let wy = base - h + 2; wy < base - 1; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) if (r() < 0.22) px(g, wx, wy, 'Wn')
      }
      x += w + Math.floor(r() * 2)
    }
  }
  // distant explosion with a mushroom cloud
  for (let i = 0; i < 13; i++) disc(g, 53 + Math.sin(i * 1.3) * 1.2, 26 - i, 1.4 + i * 0.12, i % 2 ? 'L' : 'K')
  disc(g, 53, 11, 5, 'K')
  disc(g, 51, 10, 3.2, 'L')
  disc(g, 55, 12, 3.4, 'M')
  disc(g, 53, 27, 4.6, 'O')
  disc(g, 53, 27, 3.2, 'Y')
  disc(g, 53, 27, 1.6, 'W')
  px(g, 48, 24, 'O')
  px(g, 58, 25, 'O')
  px(g, 56, 22, 'Y')
  // tank on the horizon
  art(g, ['......kkk....', '....kkkkkkkk=', '..kkkkkkkkkkk', '.kkkkkkkkkkkk', 'k.k.k.k.k.k.k'], 62, 25)
  // flare
  dither(g, 30, 6, 4, 4, 'f')
  disc(g, 30, 6, 1.6, 'F2')
  px(g, 29, 9, 'f')
  px(g, 28, 11, 'f')
  px(g, 27, 13, 'f')

  // ground
  rect(g, 0, 32, SW, 8, 'U')
  speckle(g, 32, 40, 'V', 0.16, r)
  speckle(g, 32, 40, 'T', 0.05, r)

  // trenches with sandbag parapets, left and right
  for (const x0 of [0, 54]) {
    rect(g, x0, 31, 18, 3, 'Dt')
    for (let x = x0 + 1; x < x0 + 18; x += 5) rect(g, x, 31, 1, 3, 'Bp')
    for (let i = 0; i < 3; i++) {
      const rowArt = ['nNNnNNnNNnNNnNNnNN', 'NnNNnNNnNNnNNnNNnN'][i % 2]
      art(g, [rowArt], x0 + (i % 2 ? 0 : 0), 28 + i)
    }
    rect(g, x0 + 6, 26, 6, 2, 'N')
    rect(g, x0 + 7, 25, 4, 1, 'n')
  }
  // barbed wire
  for (let x = 20; x <= 52; x += 8) rect(g, x, 27, 1, 6, 'Z')
  for (let x = 20; x <= 52; x++) {
    px(g, x, 28 + ((x >> 1) % 2), 'x')
    px(g, x, 31 - ((x >> 1) % 2), 'x')
    if (x % 3 === 0) px(g, x, 30, 'x')
  }
  // tank traps
  for (const x of [26, 46]) {
    line(g, x - 2, 33, x + 2, 29, 'Z')
    line(g, x + 2, 33, x - 2, 29, 'Z')
    line(g, x, 29, x, 34, 'Z')
  }
  // dead tree
  rect(g, 67, 13, 2, 19, 'Z')
  line(g, 67, 17, 63, 13, 'Z')
  line(g, 68, 20, 71, 16, 'Z')
  line(g, 67, 24, 64, 21, 'Z')
  line(g, 68, 14, 66, 10, 'Z')
  // craters, puddles and debris
  ellipse(g, 11, 36.5, 8, 2.6, 'T')
  ellipse(g, 11, 37, 6.6, 1.9, 'I')
  ellipse(g, 11, 37.4, 4, 1, 'P')
  ellipse(g, 60, 37, 9, 2.6, 'T')
  ellipse(g, 60, 37.5, 7.4, 1.9, 'I')
  ellipse(g, 38, 38.5, 5, 1, 'P')
  px(g, 36, 38, 'p')
  px(g, 37, 38, 'p')
  for (let i = 0; i < 9; i++) {
    const x = 20 + Math.floor(r() * 30)
    const y = 35 + Math.floor(r() * 4)
    rect(g, x, y, 2, 1, i % 2 ? 'Bp' : 'Y')
  }
  line(g, 28, 36, 32, 35, 'Bp')
  line(g, 44, 35, 47, 37, 'Bp')

  const twinkle: Scene['twinkle'] = [
    { x: 50, y: 21, c: '#ff9a3c' },
    { x: 5, y: 21, c: '#ff9a3c' },
    { x: 15, y: 22, c: '#ffd166' },
    { x: 30, y: 21, c: '#ff9a3c' },
    { x: 41, y: 22, c: '#ffd166' },
    { x: 22, y: 15, c: '#ffd166' },
    { x: 46, y: 10, c: '#fff3b0' },
  ]
  return {
    grid: g,
    twinkle,
    flash: '#ffb347',
    colors: {
      A: '#26252c', B: '#34313a', C: '#4a3f45', D: '#6e4a40', E: '#a1573a', F: '#d68037',
      J: '#b9b4a0', K: '#1e1d22', L: '#2d2b33', M: '#3b3841', k: '#15141a',
      r: '#2a2227', R: '#1f1a1d', O: '#ff9a3c', Y: '#ffd166', W: '#fff3b0', f: '#ffe9a0', F2: '#fff3a0', Wn: '#e8913a', Dt: '#241a12', Bp: '#6b5230',
      U: '#5b4630', V: '#4b3925', T: '#7a6444', I: '#3a2c1c', P: '#5d6b74', p: '#8fa0aa',
      n: '#8c7a55', N: '#a8956a', Z: '#1e1a18', x: '#b9bcc0', '=': '#15141a',
    },
  }
}

// ─────────────────────────────── beach ───────────────────────────────
function beach(): Scene {
  const r = rng(5)
  const g = mk()
  bands(g, 0, 20, ['A', 'B', 'C', 'D', 'E'])
  disc(g, 14, 8, 7.5, 'T')
  disc(g, 14, 8, 5.4, 'S')
  disc(g, 13, 7, 2.6, 'U')
  art(g, CLOUD_BIG, 34, 3)
  art(g, CLOUD_SMALL, 52, 10)
  art(g, CLOUD_SMALL, 26, 13)
  art(g, BIRD, 40, 10)
  art(g, BIRD, 45, 7)
  // far island
  hill(g, 18, 3.5, 0.3, 0.6, 'I', 21)
  // sea
  bands(g, 20, 31, ['a', 'b', 's', 't'])
  for (let i = 0; i < 46; i++) {
    const y = 21 + Math.floor(r() * 9)
    const x = Math.floor(r() * SW)
    const len = 1 + Math.floor(r() * 2 + (y - 20) / 4)
    rect(g, x, y, len, 1, 'F')
  }
  // sailboat
  rect(g, 33, 19, 8, 1, 'H')
  rect(g, 34, 20, 6, 1, 'H')
  line(g, 37, 12, 37, 19, 'P2')
  art(g, ['.WW', '.WWW', 'WWWW'.slice(0, 4)], 38, 13)
  art(g, ['W', 'WW', 'WWW', 'WWWW'], 33, 15)
  px(g, 37, 11, 'U2')
  px(g, 38, 11, 'U2')
  // shoreline foam and wet sand
  for (let x = 0; x < SW; x++) {
    px(g, x, 30 + ((x >> 2) % 2), 'F')
    px(g, x, 31, x % 3 === 0 ? 'F' : 'X')
  }
  rect(g, 0, 32, SW, 8, 'Q')
  rect(g, 0, 32, SW, 1, 'X')
  speckle(g, 33, 40, 'R', 0.1, r)
  speckle(g, 35, 40, 'Z2', 0.03, r)
  // umbrella and towel (left)
  line(g, 11, 24, 9, 37, 'P2')
  for (let i = 0; i < 6; i++) {
    const half = 3 + i * 2
    for (let x = 10 - half; x <= 10 + half; x++) px(g, x, 21 + i, Math.floor((x + 40) / 3) % 2 ? 'U2' : 'W')
  }
  for (let x = 0; x < 22; x += 3) px(g, x, 27, Math.floor(x / 3) % 2 ? 'U2' : 'W')
  rect(g, 3, 36, 14, 3, 'W')
  for (let x = 3; x < 17; x += 3) rect(g, x, 36, 2, 3, 'a')
  // sandcastle (right of centre)
  rect(g, 54, 35, 14, 4, 'Cs')
  rect(g, 54, 38, 14, 1, 'Cd')
  rect(g, 56, 31, 4, 4, 'Cs')
  rect(g, 62, 32, 4, 3, 'Cs')
  for (const x of [56, 58, 62, 64]) px(g, x, x < 60 ? 30 : 31, 'Cs')
  px(g, 57, 33, 'Cd')
  px(g, 63, 34, 'Cd')
  line(g, 58, 26, 58, 30, 'P2')
  art(g, ['UU', 'UUU', 'UU'], 59, 26)
  // palm (far right)
  for (let i = 0; i < 20; i++) {
    const x = 69 - Math.round(Math.sin(i / 6) * 3)
    px(g, x, 36 - i, 'D2')
    px(g, x + 1, 36 - i, 'D2')
  }
  const lx = 69 - Math.round(Math.sin(19 / 6) * 3)
  art(g, ['..LLLL.......LLLL..', '.LLLLLL.....LLLLLL.', 'LLLlLLLL...LLLLlLLL', '.LLLLlLLLLLLLlLLLL.', '...LL.LLlLLL.LL....', '..L....LLL....L....'], lx - 8, 14)
  px(g, lx, 19, 'c')
  px(g, lx + 1, 19, 'c')
  px(g, lx - 1, 20, 'c')
  // shells, starfish, bucket, crab
  for (const [x, y] of [[26, 36], [40, 38], [48, 34]]) {
    px(g, x, y, 'p')
    px(g, x + 1, y, 'p')
  }
  art(g, ['..m..', 'mmmmm', '.mmm.', 'mm.mm'], 22, 34)
  art(g, ['uuuu', 'uuuu', '.uu.'], 49, 36)
  art(g, ['R2.R2', 'R2R2R2', '.R2R2.'].map((s) => s.replaceAll('R2', 'e')), 18, 33)
  // footprints
  for (let i = 0; i < 6; i++) rect(g, 24 + i * 4, 37 + (i % 2), 2, 1, 'R')
  return {
    grid: g,
    twinkle: [
      { x: 8, y: 26, c: '#ffffff' },
      { x: 28, y: 24, c: '#ffffff' },
      { x: 50, y: 27, c: '#ffffff' },
      { x: 62, y: 23, c: '#ffffff' },
    ],
    colors: {
      A: '#6fcdfc', B: '#8fdafd', C: '#aee6fe', D: '#cdf1ff', E: '#e8f9ff',
      S: '#ffd84d', T: '#fff1b8', U: '#fff7cf', W: '#ffffff', V: '#dfeaf6', k: '#2b3a4a',
      I: '#5aa88a', a: '#1c8fd0', b: '#2aa4e2', s: '#42b9ef', t: '#5cc8f4', F: '#ffffff',
      H: '#8b5a2b', P2: '#6b4423', U2: '#e8525a',
      X: '#d9b673', Q: '#f3d99b', R: '#e7c783', Z2: '#b99a5a',
      Cs: '#e2c07c', Cd: '#d1ab62', D2: '#8b5a2b', L: '#2f9e57', l: '#46c070', c: '#5a3a1c', p: '#ff9bb0', m: '#ff8c42',
      u: '#4aa3df', e: '#e8525a',
    },
  }
}

// ─────────────────────────────── space ───────────────────────────────
function space(): Scene {
  const r = rng(31)
  const g = mk()
  bands(g, 0, 33, ['A', 'B', 'C', 'D', 'E'])
  // nebulae
  dither(g, 52, 13, 14, 7, 'N1')
  dither(g, 54, 12, 8, 4, 'N2')
  dither(g, 16, 22, 15, 6, 'N3')
  dither(g, 14, 21, 7, 3, 'N1')
  const twinkle: Scene['twinkle'] = []
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(r() * SW)
    const y = Math.floor(r() * 30)
    if (i % 5 === 0) twinkle.push({ x, y, c: '#ffffff' })
    else px(g, x, y, i % 2 ? 'x' : 'w')
  }
  for (const [x, y] of [[44, 6], [66, 20], [30, 18], [8, 5]]) {
    px(g, x, y, 'w')
    px(g, x - 1, y, 'x')
    px(g, x + 1, y, 'x')
    px(g, x, y - 1, 'x')
    px(g, x, y + 1, 'x')
  }
  // ringed planet: back half of the ring, the planet, then the front half
  const ring = (front: boolean) => {
    for (let t = 0; t < Math.PI * 2; t += 0.02) {
      const sin = Math.sin(t)
      if (front !== sin > 0) continue
      const cx = 18 + 13 * Math.cos(t)
      const cy = 14 + 3.2 * sin + (cx - 18) * 0.16
      px(g, cx, cy, 'r')
      px(g, cx, cy + 1, 'r2')
    }
  }
  ring(false)
  disc(g, 18, 14, 7.5, 'P')
  for (let y = 8; y < 21; y += 3) for (let x = 10; x < 27; x++) if ((x - 18) ** 2 + (y - 14) ** 2 < 56) px(g, x, y, 'p')
  for (let y = 9; y < 21; y += 3) for (let x = 10; x < 27; x++) if ((x - 18) ** 2 + (y - 14) ** 2 < 56 && (x + y) % 2 === 0) px(g, x, y, 'p')
  disc(g, 15, 11, 2.6, 'H')
  ring(true)
  // earth with clouds
  dither(g, 56, 9, 7.5, 7.5, 'e')
  disc(g, 56, 9, 5.8, 'Eo')
  rect(g, 52, 6, 4, 3, 'G')
  rect(g, 57, 10, 3, 3, 'G')
  px(g, 54, 9, 'G')
  rect(g, 53, 11, 2, 1, 'G')
  for (const [x, y] of [[53, 5], [58, 7], [55, 12]]) rect(g, x, y, 3, 1, 'W')
  // comet
  disc(g, 38, 5, 1.4, 'w')
  for (let i = 1; i < 14; i++) {
    px(g, 38 + i * 1.1, 5 - i * 0.2 + (i % 2 ? 0 : 1), i < 6 ? 'x' : 'V')
    if (i < 8) px(g, 38 + i * 1.1, 6 - i * 0.2, 'V')
  }
  // satellite
  art(g, ['bbb..bbb', 'bbbzzbbb', 'bbb..bbb'].map((s) => s.replaceAll('b', 'Z')), 30, 16)
  px(g, 34, 15, 'x')
  // UFO with a beam
  ellipse(g, 64, 21, 6, 2, 'z')
  ellipse(g, 64, 19, 3.4, 2.6, 'u')
  px(g, 62, 18, 'w')
  for (const x of [60, 64, 68]) px(g, x, 22, 'y')
  for (let y = 23; y < 32; y++) {
    const half = 1 + (y - 23) * 0.5
    for (let x = Math.floor(64 - half); x <= Math.ceil(64 + half); x++) if ((x + y) % 2 === 0) px(g, x, y, 'j')
  }
  // jagged horizon, then the moon's surface
  hill(g, 28, 3, 0.55, 0.3, 'T', 33)
  hill(g, 30, 2.4, 0.4, 2.2, 'S', 33)
  rect(g, 0, 32, SW, 8, 'M')
  speckle(g, 32, 40, 'N', 0.13, r)
  speckle(g, 34, 40, 'O', 0.05, r)
  for (const [cx, cy, rx, ry] of [[10, 36.5, 8, 2.4], [60, 37, 9, 2.6], [38, 38.6, 4, 0.9]] as const) {
    ellipse(g, cx, cy, rx, ry, 'N')
    ellipse(g, cx, cy + 0.4, rx - 1.4, ry - 0.7, 'O')
  }
  for (const [x, y] of [[22, 34], [46, 35], [30, 37]]) {
    rect(g, x, y, 3, 1, 'R')
    px(g, x + 1, y - 1, 'R')
  }
  // planted flag
  line(g, 70, 26, 70, 36, 'w')
  art(g, ['rrrr', 'rrrr', 'bbbb'].map((s) => s.replaceAll('r', 'F').replaceAll('b', 'f')), 66, 26)
  return {
    grid: g,
    twinkle: [...twinkle, { x: 60, y: 21, c: '#ffd166' }, { x: 64, y: 22, c: '#ffd166' }],
    colors: {
      A: '#03040a', B: '#060818', C: '#0a0d28', D: '#10143a', E: '#171c4a',
      N1: '#3a1f6e', N2: '#6a2f8f', N3: '#1f3b7a', x: '#8a90c0', w: '#d6d9f5', V: '#5a6aa8',
      P: '#d98a5b', p: '#b86d46', H: '#f0b080', r: '#f2d9a6', r2: '#c9a878',
      Eo: '#3b82f6', e: '#5a8fe0', G: '#4ade80', W: '#ffffff',
      Z: '#7a8196', z: '#a9afc4', u: '#9ad7ff', y: '#ffd166', j: '#7fb9ff',
      T: '#575b72', S: '#6b6f86', M: '#8a8fa3', O: '#5f6376', R: '#9a9fb3',
      F: '#e8525a', f: '#3b82f6', N: '#767b8f',
    },
  }
}

const BUILDERS: Record<SceneId, () => Scene> = { meadow, night, battlefield, beach, space }

type Rect = { x: number; y: number; w: number; c: string }

function toRects(g: G): Rect[] {
  const out: Rect[] = []
  g.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      if (c === '.') {
        x++
        continue
      }
      let w = 1
      while (x + w < row.length && row[x + w] === c) w++
      out.push({ x, y, w, c })
      x += w
    }
  })
  return out
}

export default function PetScene({ scene, className }: { scene: SceneId; className?: string }) {
  const built = useMemo(() => {
    const s = BUILDERS[scene]()
    return { ...s, rects: toRects(s.grid) }
  }, [scene])

  return (
    <>
      <style>{`
        @keyframes scene-blink { 0%,60% { opacity: 1 } 61%,100% { opacity: 0 } }
        @keyframes scene-flash { 0%,93% { opacity: 0 } 94%,96% { opacity: .38 } 97%,100% { opacity: 0 } }
        .scene-blink { animation: scene-blink 2.4s steps(1) infinite }
        .scene-flash { animation: scene-flash 7s steps(1) infinite }
        @media (prefers-reduced-motion: reduce) { .scene-blink, .scene-flash { animation: none } .scene-flash { opacity: 0 } }
      `}</style>
      <svg
        viewBox={`0 0 ${SW} ${SH}`}
        preserveAspectRatio="xMidYMax slice"
        shapeRendering="crispEdges"
        className={className}
        style={{ imageRendering: 'pixelated' }}
        aria-hidden="true"
      >
        {built.rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={built.colors[r.c] ?? '#ff00ff'} />
        ))}
        {built.twinkle?.map((t, i) => (
          <rect
            key={`t${i}`}
            className="scene-blink"
            style={{ animationDelay: `${(i % 6) * -0.4}s` }}
            x={t.x}
            y={t.y}
            width={1}
            height={1}
            fill={t.c}
          />
        ))}
        {built.flash && <rect className="scene-flash" x={0} y={0} width={SW} height={SH} fill={built.flash} opacity={0} />}
      </svg>
    </>
  )
}
