'use client'

import { useMemo } from 'react'
import type { PetBreed, PetLook, PetMood, PetStage } from '@/lib/pet'

type Props = {
  stage: PetStage
  mood: PetMood
  look: PetLook
  className?: string
  /** Briefly plays a chomp animation (set after feeding). */
  eating?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Pixel-art pet on a 24x24 grid. Bodies are generated from shape masks with
// light/shadow dithering and an automatic outline; breed features are small
// ASCII stamps. Each letter is a palette slot:
//   b body  d shade  h highlight  l belly  q belly shade  p inner ear / blush
//   o outline  k ink  w white  y gold  Y dark gold  s sweat  e/E egg shell  m egg spot
// ─────────────────────────────────────────────────────────────────────────────

const W = 24
const H = 24
type Grid = string[][]

const BASES = ['#6768ab', '#5aa9e6', '#4fbf8f', '#f09a4a', '#ec7fb0', '#e0605f', '#e8c547', '#7d8794']

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

function paletteFor(color: number): Record<string, string> {
  const b = BASES[color % BASES.length]
  const l = mix(b, '#ffffff', 0.62)
  return {
    b,
    o: mix(b, '#000000', 0.72),
    d: mix(b, '#000000', 0.3),
    h: mix(b, '#ffffff', 0.28),
    l,
    q: mix(l, b, 0.4),
    p: mix(l, '#ff7fa6', 0.5),
    m: b,
    k: '#1a1a24',
    w: '#ffffff',
    y: '#f5b83a',
    Y: '#c98a1a',
    s: '#8ecbff',
    e: '#efeaff',
    E: '#cfc8ec',
  }
}

const blank = (): Grid => Array.from({ length: H }, () => Array<string>(W).fill('.'))

/** Stamp ASCII rows onto the grid. `behind` only fills empty cells, `clip` only fills occupied cells. */
function stamp(g: Grid, rows: string[], x0: number, y0: number, mode: 'over' | 'behind' | 'clip' = 'over') {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const ch = row[dx]
      const x = x0 + dx
      const y = y0 + dy
      if (ch === '.' || x < 0 || x >= W || y < 0 || y >= H) continue
      if (mode === 'behind' && g[y][x] !== '.') continue
      if (mode === 'clip' && g[y][x] === '.') continue
      g[y][x] = ch
    }
  })
}

const flip = (rows: string[]) => rows.map((r) => [...r].reverse().join(''))

function fillBody(g: Grid, cy: number, rx: number, ry: number) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5 - W / 2) / rx
      const ny = (y + 0.5 - cy) / ry
      if (Math.abs(nx) ** 2.4 + Math.abs(ny) ** 2.4 > 1) continue
      const lit = -(nx * 0.5 + ny * 0.8) // light comes from the top-left
      const odd = (x + y) % 2 === 0
      let c = 'b'
      if (lit > 0.62) c = 'h'
      else if (lit > 0.5 && odd) c = 'h'
      else if (lit < -0.5) c = 'd'
      else if (lit < -0.38 && odd) c = 'd'
      g[y][x] = c
    }
  }
}

function fillBelly(g: Grid, cy: number, rx: number, ry: number) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g[y][x] === '.') continue
      const nx = (x + 0.5 - W / 2) / rx
      const ny = (y + 0.5 - cy) / ry
      if (nx * nx + ny * ny > 1) continue
      g[y][x] = ny > 0.45 || (ny > 0.2 && (x + y) % 2 === 0) ? 'q' : 'l'
    }
  }
}

function outline(g: Grid) {
  const add: [number, number][] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g[y][x] !== '.') continue
      if (
        (y > 0 && g[y - 1][x] !== '.') ||
        (y < H - 1 && g[y + 1][x] !== '.') ||
        (x > 0 && g[y][x - 1] !== '.') ||
        (x < W - 1 && g[y][x + 1] !== '.')
      ) {
        add.push([x, y])
      }
    }
  }
  for (const [x, y] of add) g[y][x] = 'o'
}

// ── egg ──
const EGG_SPOTS: [number, number, number, number][] = [
  [14, 8, 3, 2],
  [8, 13, 3, 3],
  [14, 15, 2, 2],
  [10, 19, 3, 1],
  [11, 6, 2, 1],
]
const EGG_CRACK: [number, number][] = [
  [7, 11], [8, 10], [9, 11], [10, 10], [11, 11], [12, 10], [13, 11], [14, 10], [15, 11], [16, 10],
]

function buildEgg(): Grid {
  const g = blank()
  const cy = 13.2
  const ry = 9.6
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const py = y + 0.5 - cy
      const rx = 7.6 * (1 + (0.14 * py) / ry) // wider at the bottom, like an egg
      const nx = (x + 0.5 - W / 2) / rx
      const ny = py / ry
      if (nx * nx + ny * ny > 1) continue
      const lit = -(nx * 0.5 + ny * 0.8)
      const odd = (x + y) % 2 === 0
      g[y][x] = lit > 0.62 ? 'w' : lit < -0.5 || (lit < -0.38 && odd) ? 'E' : 'e'
    }
  }
  for (const [sx, sy, sw, sh] of EGG_SPOTS) {
    for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) if (g[y]?.[x] && g[y][x] !== '.') g[y][x] = 'm'
  }
  for (const [x, y] of EGG_CRACK) if (g[y][x] !== '.') g[y][x] = 'o'
  outline(g)
  return g
}

// ── breeds ──
type Block = {
  x: number
  y: number
  rows: string[]
  /** Attached to the face/body rather than the top of the head (shifts less on the small body). */
  low?: boolean
}
type Features = {
  /** Left-side stamps, mirrored to the right. Drawn before the outline. */
  side?: Block[]
  /** Centred stamps. Drawn before the outline. */
  center?: Block[]
  /** Not mirrored, drawn behind the body (tails). */
  tail?: Block[]
  /** Drawn after the outline and face, on the axis (noses, beaks). */
  post?: Block[]
  /** Like `post`, mirrored (whiskers). */
  postSide?: Block[]
}

const BREEDS: Record<PetBreed, Features> = {
  cat: {
    side: [{ x: 5, y: 1, rows: ['b....', 'bb...', 'bpb..', 'bppb.', 'bpppb', 'bbbbb'] }],
    post: [{ x: 11, y: 13, low: true, rows: ['pp'] }],
    postSide: [
      { x: 0, y: 14, low: true, rows: ['kk'] },
      { x: 0, y: 16, low: true, rows: ['kk'] },
    ],
  },
  bunny: {
    side: [{ x: 6, y: 0, rows: ['.bb.', 'bppb', 'bppb', 'bppb', 'bppb', 'bppb', 'bbbb'] }],
    post: [{ x: 11, y: 13, low: true, rows: ['pp'] }],
  },
  bear: {
    side: [{ x: 4, y: 2, rows: ['.bb.', 'bddb', 'bddb', 'bbbb'] }],
    center: [{ x: 9, y: 13, low: true, rows: ['.llll.', 'llllll', 'llllll', '.llll.'] }],
    post: [{ x: 11, y: 13, low: true, rows: ['kk'] }],
  },
  dino: {
    side: [{ x: 6, y: 3, rows: ['.d.', 'ddd', 'ddd'] }],
    center: [{ x: 10, y: 1, rows: ['.dd.', '.dd.', 'dddd', 'dddd'] }],
    tail: [{ x: 21, y: 14, low: true, rows: ['..d', '.dd', 'bdd', 'bd.'] }],
  },
  owl: {
    side: [
      { x: 5, y: 2, rows: ['d...', 'dd..', 'ddd.', 'dddd'] },
      { x: 0, y: 10, low: true, rows: ['..d', '.dd', '.dd', 'ddd', 'ddd', 'ddd', '.dd', '.dd', '..d'] },
    ],
    post: [{ x: 11, y: 12, low: true, rows: ['yy', 'yy'] }],
  },
  frog: {
    side: [{ x: 5, y: 2, rows: ['.bbb.', 'bhhbb', 'bbbbb', 'bbbbb'] }],
  },
  alien: {
    side: [{ x: 5, y: 0, rows: ['yy..', 'yy..', '.d..', '..d.', '..d.', '...d'] }],
  },
  fox: {
    side: [{ x: 4, y: 0, rows: ['d.....', 'dd....', 'dbb...', 'dbbb..', 'dblbb.', 'dbllbb', 'bbbbbb'] }],
    tail: [
      { x: 20, y: 8, low: true, rows: ['...l', '..ll', '..dl', '.ddd', '.ddd', 'dddd', 'dddd', 'dddd'] },
    ],
    post: [{ x: 11, y: 13, low: true, rows: ['kk'] }],
  },
  mouse: {
    side: [{ x: 2, y: 1, rows: ['.bbbb.', 'bppppb', 'bppppb', 'bppppb', '.bbbb.'] }],
    tail: [{ x: 19, y: 16, low: true, rows: ['....p', '....p', '...p.', '..p..', 'pp...'] }],
    post: [{ x: 11, y: 13, low: true, rows: ['pp'] }],
    postSide: [{ x: 0, y: 14, low: true, rows: ['kk'] }],
  },
  unicorn: {
    side: [{ x: 6, y: 3, rows: ['.b.', 'bpb', 'bbb'] }],
    center: [{ x: 11, y: 0, rows: ['yy', 'wy', 'yy', 'wy', 'yy', 'yy'] }],
    tail: [{ x: 21, y: 15, low: true, rows: ['.yy', 'yyy', 'yyy', '.yy', '..y'] }],
  },
}

// ── face ──
type Layout = {
  /** Top row of the 4x4 eyes. */
  y0: number
  /** Top row of the mouth. */
  m: number
  /** Row of the cheeks and the x of the left cheek. */
  ch: number
  cx: number
  /** Left eyebrow pixels for sad moods. */
  brow: [number, number][]
  sweat: [number, number][]
}
const LAYOUT_BIG: Layout = {
  y0: 10, m: 14, ch: 14, cx: 3,
  brow: [[5, 8], [6, 8], [7, 7], [8, 7]],
  sweat: [[21, 8], [21, 9], [22, 9]],
}
const LAYOUT_SMALL: Layout = {
  y0: 12, m: 16, ch: 15, cx: 5,
  brow: [[6, 11], [7, 11], [8, 10], [9, 10]],
  sweat: [[19, 10], [19, 11], [20, 11]],
}

const EYE_X = 6 // left eye spans x 6..9, the right one mirrors to 14..17
const EYES: Record<PetMood, string[]> = {
  happy: ['....', '.kk.', 'k..k', '....'],
  content: ['.kk.', 'kwkk', 'kkkk', '.kk.'],
  hungry: ['kkkk', 'kwkk', '.kk.', '....'],
  starving: ['....', '....', 'kkkk', '....'],
}
const MOUTHS: Record<PetMood, string[]> = {
  happy: ['kkkk', 'kppk', '.kk.'],
  content: ['k..k', '.kk.'],
  hungry: ['.kk.', 'k..k'],
  starving: ['.kk.', 'kkkk', '.kk.'],
}

function glasses(g: Grid, y0: number) {
  const ring = ['kkkkkk', 'k....k', 'k....k', 'k....k', 'k....k', 'kkkkkk']
  for (const x of [EYE_X - 1, W - EYE_X - 5]) {
    stamp(g, ring, x, y0 - 1)
  }
  stamp(g, ['kk'], 11, y0 + 1)
  stamp(g, ['kk'], 3, y0 + 1)
  stamp(g, ['kk'], 19, y0 + 1)
}

function build(stage: PetStage, mood: PetMood, breed: PetBreed): { body: Grid; mouth: Grid } {
  if (stage === 'egg') return { body: buildEgg(), mouth: blank() }

  const small = stage === 'hatchling'
  const g = blank()
  const L = small ? LAYOUT_SMALL : LAYOUT_BIG

  if (small) {
    fillBody(g, 15.5, 7.2, 6.2)
    fillBelly(g, 20, 3.8, 2.6)
    stamp(g, ['ddd', 'ddd'], 8, 21)
    stamp(g, ['ddd', 'ddd'], 13, 21)
    stamp(g, ['dd', 'dd', 'dd'], 3, 16)
    stamp(g, ['dd', 'dd', 'dd'], 19, 16)
  } else {
    fillBody(g, 13.5, 9.6, 8.2)
    fillBelly(g, 18.6, 5.2, 3.4)
    stamp(g, ['dddd', 'dddd'], 6, 21)
    stamp(g, ['dddd', 'dddd'], 14, 21)
    stamp(g, ['dd', 'dd', 'dd', 'dd'], 1, 14)
    stamp(g, ['dd', 'dd', 'dd', 'dd'], 21, 14)
  }

  // breed features (head-top ones drop 4px on the small body, face-level ones 2px)
  const f = BREEDS[breed]
  const place = (b: Block, mirrored: boolean, mode: 'over' | 'behind') => {
    const rows = mirrored ? flip(b.rows) : b.rows
    const w = b.rows[0].length
    const dy = small ? (b.low ? 2 : 4) : 0
    let x = mirrored ? W - b.x - w : b.x
    if (small) x += mirrored ? (b.x < W / 2 ? -2 : 2) : b.x < W / 2 ? 2 : -2
    stamp(g, rows, x, b.y + dy, mode)
  }
  const placeSide = (b: Block, mode: 'over' | 'behind' = 'over') => {
    place(b, false, mode)
    place(b, true, mode)
  }
  const placeAxis = (b: Block, mode: 'over' | 'behind' = 'over') => {
    const w = b.rows[0].length
    stamp(g, b.rows, Math.round(W / 2 - w / 2), b.y + (small ? (b.low ? 2 : 4) : 0), mode)
  }
  f.tail?.forEach((b) => {
    const dx = small ? -2 : 0
    stamp(g, b.rows, b.x + dx, b.y + (small ? 2 : 0), 'behind')
  })
  f.side?.forEach((b) => placeSide(b))
  f.center?.forEach((b) => placeAxis(b))

  if (stage === 'sage') {
    // gold scarf around the belly
    stamp(g, ['.....yyyyyyyyyyyyyy.....'], 0, 19, 'clip')
    stamp(g, ['......YYYYYYYYYYYY......'], 0, 20, 'clip')
    stamp(g, ['yY', 'yY'], 11, 21)
  }

  outline(g)

  // whiskers, noses and beaks sit on top of the outline
  f.postSide?.forEach((b) => placeSide(b))
  f.post?.forEach((b) => placeAxis(b))

  if (stage === 'bookworm' || stage === 'sage') glasses(g, L.y0)

  // eyes
  const eye = EYES[mood]
  stamp(g, eye, EYE_X, L.y0)
  stamp(g, eye, W - EYE_X - 4, L.y0)

  const put = (x: number, y: number, c: string) => {
    if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c
  }
  if (mood === 'hungry') {
    for (const [x, y] of L.brow) {
      put(x, y, 'o')
      put(W - 1 - x, y, 'o')
    }
  }
  if (mood === 'starving') for (const [x, y] of L.sweat) put(x, y, 's')
  if (mood === 'happy') {
    for (const dx of [0, 1]) {
      put(L.cx + dx, L.ch, 'p')
      put(W - 1 - L.cx - dx, L.ch, 'p')
    }
  }

  // mouth lives on its own layer so it can animate while eating
  const mouth = blank()
  stamp(mouth, MOUTHS[mood], 10, L.m)
  return { body: g, mouth }
}

function toRects(g: Grid) {
  const rects: { x: number; y: number; w: number; c: string }[] = []
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
      rects.push({ x, y, w, c })
      x += w
    }
  })
  return rects
}

export default function PetSprite({ stage, mood, look, className, eating }: Props) {
  const palette = useMemo(() => paletteFor(look.color), [look.color])
  const { bodyRects, mouthRects } = useMemo(() => {
    const { body, mouth } = build(stage, mood, look.breed)
    return { bodyRects: toRects(body), mouthRects: toRects(mouth) }
  }, [stage, mood, look.breed])

  // The bob is a 1px hop in `steps` so it reads as pixel-art, not tweened.
  const anim = mood === 'starving' ? 'none' : mood === 'hungry' ? 'pet-hop 2s steps(1) infinite' : 'pet-hop 1s steps(1) infinite'

  return (
    <>
      <style>{`
        @keyframes pet-hop { 0%,49.99% { transform: translateY(0) } 50%,100% { transform: translateY(-1px) } }
        @keyframes pet-shake { 0%,49.99% { transform: translateX(-.5px) } 50%,100% { transform: translateX(.5px) } }
        @keyframes pet-chomp { 0%,49.99% { transform: translateY(0) } 50%,100% { transform: translateY(.5px) } }
        .pet-hop { animation: var(--pet-anim) }
        .pet-shake { animation: pet-shake .8s steps(1) infinite }
        .pet-chomp { animation: pet-chomp .2s steps(1) 6 }
        @media (prefers-reduced-motion: reduce) { .pet-hop, .pet-shake, .pet-chomp { animation: none } }
      `}</style>
      <svg
        viewBox="0 0 24 25"
        shapeRendering="crispEdges"
        className={className}
        style={{ imageRendering: 'pixelated' }}
        role="img"
        aria-hidden="true"
      >
        {/* shadow */}
        <rect x={stage === 'egg' ? 6 : 5} y={24} width={stage === 'egg' ? 12 : 14} height={1} fill="currentColor" opacity={0.15} />
        <g className={stage === 'egg' ? 'pet-shake' : 'pet-hop'} style={{ ['--pet-anim' as string]: anim }}>
          {bodyRects.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={palette[r.c]} />
          ))}
          <g className={eating ? 'pet-chomp' : undefined}>
            {mouthRects.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={palette[r.c]} />
            ))}
          </g>
        </g>
      </svg>
    </>
  )
}
