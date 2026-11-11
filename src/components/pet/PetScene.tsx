'use client'

import { useMemo } from 'react'
import type { PetScene as SceneId } from '@/lib/pet'

// Pixel-art backdrops on a 64x32 grid (about the same pixel size as the 24px
// pet sprite when both are shown in the stage). The ground starts at row 25.
const SW = 64
const SH = 32
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
function rows(g: G, art: string[], x0: number, y0: number) {
  art.forEach((r, dy) => [...r].forEach((ch, dx) => ch !== '.' && px(g, x0 + dx, y0 + dy, ch)))
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

type Scene = {
  grid: G
  colors: Record<string, string>
  /** Pixels that blink; drawn above the grid. */
  twinkle?: { x: number; y: number; c: string }[]
  /** A full-scene flash (explosions). */
  flash?: string
}

const CLOUD = ['..WWW...', '.WWWWWW.', 'WWWWWWWW', '.VVVVVV.']

function meadow(): Scene {
  const r = rng(11)
  const g = mk()
  bands(g, 0, 25, ['A', 'B', 'C', 'D'])
  disc(g, 52, 7, 4.2, 'T')
  disc(g, 52, 7, 3.2, 'S')
  rows(g, CLOUD, 7, 5)
  rows(g, CLOUD, 29, 10)
  rows(g, CLOUD, 40, 3)
  hill(g, 20, 4, 0.18, 0.5, 'F', 27)
  hill(g, 23, 3, 0.25, 2.0, 'M', 27)
  rect(g, 0, 25, SW, 7, 'G')
  speckle(g, 25, 32, 'H', 0.09, r)
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(r() * SW)
    const y = 26 + Math.floor(r() * 5)
    px(g, x, y, 'g')
    px(g, x + 1, y, 'g')
    px(g, x, y - 1, 'g')
  }
  const flowers = ['r', 'y', 'u']
  for (let i = 0; i < 9; i++) {
    const x = 2 + Math.floor(r() * (SW - 4))
    const y = 27 + Math.floor(r() * 4)
    px(g, x, y, 'g')
    px(g, x, y - 1, flowers[i % 3])
  }
  return {
    grid: g,
    colors: {
      A: '#8fd3ff', B: '#a9deff', C: '#c6e9ff', D: '#e2f4ff', S: '#ffe27a', T: '#fff3b0',
      W: '#ffffff', V: '#e2edf8', F: '#7fbf8a', M: '#5fae6e', G: '#4e9a5c', H: '#468d54',
      g: '#6fc07c', r: '#ff7a85', y: '#ffd166', u: '#b79bff',
    },
  }
}

function night(): Scene {
  const r = rng(23)
  const g = mk()
  bands(g, 0, 25, ['A', 'B', 'C', 'D'])
  const twinkle: Scene['twinkle'] = []
  for (let i = 0; i < 38; i++) {
    const x = Math.floor(r() * SW)
    const y = Math.floor(r() * 17)
    if (i % 5 === 0) twinkle.push({ x, y, c: '#ffffff' })
    else px(g, x, y, 'x')
  }
  disc(g, 13, 8, 4.6, 'N')
  disc(g, 13, 8, 4, 'M')
  px(g, 11, 7, 'm')
  rect(g, 14, 9, 2, 2, 'm')
  px(g, 11, 10, 'm')
  hill(g, 20, 4, 0.2, 1.2, 'F', 27)
  hill(g, 23, 3, 0.27, 3.0, 'G', 27)
  rect(g, 0, 25, SW, 7, 'L')
  speckle(g, 25, 32, 'l', 0.08, r)
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(r() * SW)
    const y = 26 + Math.floor(r() * 5)
    px(g, x, y, 't')
    px(g, x, y - 1, 't')
  }
  for (let i = 0; i < 6; i++) twinkle.push({ x: 4 + Math.floor(r() * 56), y: 20 + Math.floor(r() * 10), c: '#ffe27a' })
  return {
    grid: g,
    twinkle,
    colors: {
      A: '#0b1030', B: '#121a4a', C: '#1c2a66', D: '#2c3d85', x: '#8a90c0', N: '#fffbe0', M: '#f1eec8', m: '#d2cea0',
      F: '#18224f', G: '#101a3d', L: '#14301f', l: '#0f2818', t: '#1f4a2f',
    },
  }
}

function battlefield(): Scene {
  const r = rng(7)
  const g = mk()
  bands(g, 0, 23, ['A', 'B', 'C', 'D', 'E'])

  // drifting smoke
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(r() * SW)
    const y = 2 + Math.floor(r() * 12)
    const rad = 2.5 + r() * 3.5
    disc(g, x, y, rad, i % 2 ? 'K' : 'L')
    disc(g, x + 1, y - 1, rad * 0.6, i % 2 ? 'L' : 'K')
  }
  // bombers high up
  rows(g, ['.kk....', 'kkkkkkk', '..kk...'], 10, 4)
  rows(g, ['.kk....', 'kkkkkkk', '..kk...'], 22, 2)
  rows(g, ['....kk.', 'kkkkkkk', '...kk..'], 52, 5)

  // ruined skyline
  let x = 0
  while (x < SW) {
    const w = 3 + Math.floor(r() * 5)
    const h = 2 + Math.floor(r() * 7)
    rect(g, x, 23 - h, w, h + 3, 'R')
    px(g, x + Math.floor(r() * w), 23 - h - 1, 'R')
    if (r() < 0.5) px(g, x + 1, 23 - h + 2, 'E')
    x += w + Math.floor(r() * 2)
  }

  // distant explosion with a smoke column
  for (let i = 0; i < 9; i++) disc(g, 44 + Math.sin(i * 1.3) * 1.5, 16 - i, 1.4 + i * 0.35, i % 2 ? 'L' : 'K')
  disc(g, 44, 19, 3.6, 'O')
  disc(g, 44, 19, 2.4, 'Y')
  px(g, 44, 18, 'W')
  px(g, 41, 17, 'O')
  px(g, 47, 17, 'O')

  // far tank silhouette
  rows(g, ['....kk....', '...kkkkk==', '.kkkkkkkk.', 'kkkkkkkkkk'], 18, 19)

  // flare
  disc(g, 30, 5, 1.2, 'F')
  px(g, 29, 7, 'f')
  px(g, 28, 9, 'f')
  px(g, 27, 11, 'f')

  // churned mud
  rect(g, 0, 25, SW, 7, 'U')
  speckle(g, 25, 32, 'V', 0.16, r)
  speckle(g, 25, 32, 'T', 0.05, r)

  // craters
  ellipse(g, 11, 29.5, 6, 2, 'T')
  ellipse(g, 11, 30, 5, 1.5, 'I')
  ellipse(g, 54, 30, 7, 1.8, 'T')
  ellipse(g, 54, 30.4, 6, 1.3, 'I')
  ellipse(g, 38, 31, 3, 0.9, 'P')

  // sandbag walls
  for (let i = 0; i < 3; i++) {
    const row = ['nNNnNNnNNnNNnN', 'NnNNnNNnNNnNNn'][i % 2]
    rows(g, [row], i % 2 ? 0 : 1, 22 + i)
    rows(g, [row], i % 2 ? 50 : 51, 22 + i)
  }
  // barbed wire
  for (let px0 = 18; px0 <= 46; px0 += 7) rect(g, px0, 21, 1, 5, 'Z')
  for (let xx = 18; xx <= 46; xx++) {
    px(g, xx, 22 + ((xx >> 1) % 2), 'x')
    px(g, xx, 24 - ((xx >> 1) % 2), 'x')
  }
  // dead tree
  rect(g, 58, 13, 2, 12, 'Z')
  rows(g, ['.Z', 'Z.'], 56, 14)
  rows(g, ['Z.', '.Z'], 60, 16)
  rows(g, ['.Z.', 'Z..'], 59, 11)

  return {
    grid: g,
    flash: '#ffb347',
    colors: {
      A: '#2e2d34', B: '#3f3b3e', C: '#5a4a45', D: '#8a5a3c', E: '#c27a38',
      K: '#25242a', L: '#34323a', k: '#17161a', R: '#2a2224', O: '#ff9a3c', Y: '#ffd166', W: '#fff3b0',
      F: '#fff3a0', f: '#ffd166', U: '#5b4630', V: '#4b3925', T: '#7a6444', I: '#3a2c1c', P: '#5d6b74',
      n: '#8c7a55', N: '#a8956a', Z: '#1e1a18', x: '#b9bcc0', '=': '#17161a',
    },
  }
}

function beach(): Scene {
  const r = rng(5)
  const g = mk()
  bands(g, 0, 17, ['A', 'B', 'C'])
  disc(g, 14, 7, 4.2, 'T')
  disc(g, 14, 7, 3.2, 'S')
  rows(g, CLOUD, 33, 4)
  rows(g, CLOUD, 46, 9)
  bands(g, 17, 25, ['a', 'b', 's'])
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * SW)
    const y = 18 + Math.floor(r() * 6)
    px(g, x, y, 'F')
    px(g, x + 1, y, 'F')
  }
  rect(g, 0, 24, SW, 8, 'Q')
  speckle(g, 25, 32, 'R', 0.1, r)
  for (let x = 0; x < SW; x++) px(g, x, 24 + ((x >> 2) % 2), 'F')
  for (let x = 0; x < SW; x++) px(g, x, 26, x % 2 ? 'R' : 'Q')
  // palm
  for (let i = 0; i < 14; i++) {
    const x = 52 - Math.round(Math.sin(i / 5) * 3)
    px(g, x, 27 - i, 'D')
    px(g, x + 1, 27 - i, 'D')
  }
  const lx = 52 - Math.round(Math.sin(13 / 5) * 3)
  rows(g, ['..LLL.....LLL..', '.LLLLL...LLLLL.', 'LLLlLLLLLLlLLLL', '..LL.LLLLL.LL..', '.L...LlLL...L.'], lx - 6, 10)
  px(g, lx, 14, 'c')
  px(g, lx + 1, 14, 'c')
  // shells
  px(g, 8, 29, 'p')
  px(g, 27, 30, 'p')
  px(g, 40, 28, 'p')
  return {
    grid: g,
    colors: {
      A: '#79d2ff', B: '#a2e3ff', C: '#cdf4ff', S: '#ffe27a', T: '#fff3b0', W: '#ffffff', V: '#e2edf8',
      a: '#1e9bd7', b: '#2fb0e6', s: '#58c8f2', F: '#ffffff', Q: '#f2d79a', R: '#e6c586', D: '#8b5a2b',
      L: '#2f9e57', l: '#3fb96a', c: '#6b4423', p: '#ff9bb0',
    },
  }
}

function space(): Scene {
  const r = rng(31)
  const g = mk()
  bands(g, 0, 25, ['A', 'B', 'C'])
  const twinkle: Scene['twinkle'] = []
  for (let i = 0; i < 52; i++) {
    const x = Math.floor(r() * SW)
    const y = Math.floor(r() * 24)
    if (i % 4 === 0) twinkle.push({ x, y, c: '#ffffff' })
    else px(g, x, y, i % 2 ? 'x' : 'w')
  }
  // ringed planet
  for (let x = -9; x <= 9; x++) px(g, 16 + x, 9 + Math.round(x * 0.22), 'r')
  disc(g, 16, 9, 5, 'P')
  for (let y = 5; y < 14; y += 3) for (let x = 11; x < 22; x++) if ((x - 16) ** 2 + (y - 9) ** 2 < 25) px(g, x, y, 'p')
  for (let x = 7; x <= 25; x++) {
    const yy = 9 + Math.round((x - 16) * 0.22)
    if (x >= 11 && x <= 21 && yy < 11) continue // ring passes behind the planet's top half
    px(g, x, yy, 'r')
  }
  // earth
  disc(g, 50, 8, 4.2, 'E')
  rect(g, 48, 6, 3, 2, 'G')
  rect(g, 51, 9, 2, 2, 'G')
  px(g, 49, 10, 'G')
  // moon ground
  rect(g, 0, 25, SW, 7, 'M')
  speckle(g, 25, 32, 'N', 0.12, r)
  ellipse(g, 12, 29.5, 6, 1.9, 'N')
  ellipse(g, 12, 30, 5, 1.4, 'O')
  ellipse(g, 52, 30, 7, 1.9, 'N')
  ellipse(g, 52, 30.4, 6, 1.4, 'O')
  ellipse(g, 34, 31, 3, 0.9, 'O')
  px(g, 24, 27, 'N')
  px(g, 25, 27, 'N')
  px(g, 44, 28, 'N')
  return {
    grid: g,
    twinkle,
    colors: {
      A: '#04050c', B: '#080a1c', C: '#0f1236', x: '#8a90c0', w: '#d6d9f5',
      P: '#d98a5b', p: '#b86d46', r: '#f2d9a6', E: '#3b82f6', G: '#4ade80',
      M: '#8a8fa3', N: '#767b8f', O: '#5f6376',
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
    // group by row so each run is one <rect>; sort rows so overlapping runs never matter
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
          <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={built.colors[r.c] ?? '#f0f'} />
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
