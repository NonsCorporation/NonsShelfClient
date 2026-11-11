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
// Pixel-art pet on a 32x32 grid. Bodies are generated from shape masks with
// light/shadow dithering and an automatic outline; breed features and markings
// are ASCII stamps. Each letter is a palette slot:
//   b body  d shade  h highlight  l belly  q belly shade  p inner ear / blush
//   o outline  k ink  w white  y gold  Y dark gold  s sweat  e/E egg shell  m egg spot
// ─────────────────────────────────────────────────────────────────────────────

const W = 32
const H = 32
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
    o: mix(b, '#000000', 0.74),
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
      if (lit > 0.64) c = 'h'
      else if (lit > 0.52 && odd) c = 'h'
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
  [18, 8, 4, 3],
  [10, 18, 4, 4],
  [19, 19, 3, 3],
  [13, 26, 5, 2],
  [14, 6, 2, 2],
  [22, 12, 2, 2],
  [9, 24, 2, 2],
]
const EGG_CRACK: [number, number][] = [
  [8, 14], [9, 13], [10, 14], [11, 13], [12, 14], [13, 12], [14, 13], [15, 12], [16, 13],
  [17, 12], [18, 13], [19, 12], [20, 13], [21, 12], [22, 13], [23, 12],
]

function buildEgg(): Grid {
  const g = blank()
  const cy = 17.2
  const ry = 12.8
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const py = y + 0.5 - cy
      const rx = 10 * (1 + (0.14 * py) / ry) // wider at the bottom, like an egg
      const nx = (x + 0.5 - W / 2) / rx
      const ny = py / ry
      if (nx * nx + ny * ny > 1) continue
      const lit = -(nx * 0.5 + ny * 0.8)
      const odd = (x + y) % 2 === 0
      g[y][x] = lit > 0.64 ? 'w' : lit < -0.5 || (lit < -0.38 && odd) ? 'E' : 'e'
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
  /** Markings painted on the body only (stripes, face discs); mirrored. */
  markSide?: Block[]
  /** Markings on the axis. */
  markCenter?: Block[]
  /** Drawn after the outline and face, on the axis (noses, beaks). */
  post?: Block[]
  /** Like `post`, mirrored (whiskers). */
  postSide?: Block[]
}

const BREEDS: Record<PetBreed, Features> = {
  cat: {
    side: [{ x: 6, y: 2, rows: ['bb......', 'bbd.....', 'bpbd....', 'bppbd...', 'bpppbd..', 'bppppbd.', 'bpppppbd', 'bbbbbbbb'] }],
    markCenter: [{ x: 13, y: 9, rows: ['d.dd.d', 'd.dd.d', '.d..d.'] }],
    markSide: [{ x: 3, y: 22, low: true, rows: ['ddd.', '.ddd'] }],
    post: [{ x: 15, y: 19, low: true, rows: ['pp'] }],
    postSide: [
      { x: 0, y: 21, low: true, rows: ['kkk'] },
      { x: 0, y: 23, low: true, rows: ['kkk'] },
    ],
  },
  bunny: {
    side: [{ x: 8, y: 0, rows: ['.bbbb.', 'bhppbd', 'bhppbd', 'bhppbd', 'bhppbd', 'bhppbd', 'bhppbd', 'bbppbd', 'bbbbbd', 'bbbbbb'] }],
    tail: [{ x: 28, y: 24, low: true, rows: ['.ww.', 'wwww', 'wwww', '.ww.'] }],
    markSide: [{ x: 4, y: 20, low: true, rows: ['.ll', 'lll'] }],
    post: [{ x: 15, y: 19, low: true, rows: ['pp'] }],
  },
  bear: {
    side: [{ x: 6, y: 4, rows: ['.bbbb.', 'bqqqqb', 'bqqqqb', 'bqqqqb', 'bbbbbb', 'bbbbbb'] }],
    center: [{ x: 12, y: 18, low: true, rows: ['.llllll.', 'llllllll', 'llllllll', 'llllllll', '.llllll.', '..llll..'] }],
    post: [{ x: 14, y: 18, low: true, rows: ['kkkk', '.kk.'] }],
  },
  dino: {
    center: [{ x: 10, y: 4, rows: ['..d..dd..d..', '.dd.dhdd.dd.', '.dd.dddd.dd.', 'dddddddddddd'] }],
    tail: [{ x: 28, y: 18, low: true, rows: ['..dd', '.ddd', 'dddd', 'dddd', 'dddd', 'ddd.'] }],
    markCenter: [
      { x: 11, y: 24, low: true, rows: ['qqqqqqqqqq'] },
      { x: 11, y: 26, low: true, rows: ['qqqqqqqqqq'] },
    ],
    markSide: [
      { x: 5, y: 17, low: true, rows: ['dd', 'dd'] },
      { x: 7, y: 23, low: true, rows: ['dd'] },
    ],
  },
  owl: {
    side: [
      { x: 7, y: 3, rows: ['d.....', 'dd....', 'ddd...', 'dddd..', 'ddddd.', 'dddddd'] },
      { x: 0, y: 15, low: true, rows: ['...d', '..dd', '.ddd', 'dddd', 'dddd', 'dddd', 'dddd', '.ddd', '.ddd', '..dd', '...d'] },
    ],
    markSide: [{ x: 6, y: 12, low: true, rows: ['.lllll.', 'lllllll', 'lllllll', 'lllllll', 'lllllll', 'lllllll', '.lllll.'] }],
    markCenter: [{ x: 11, y: 23, low: true, rows: ['q.q.q.q.q.q', '.q.q.q.q.q.', 'q.q.q.q.q.q'] }],
    post: [{ x: 14, y: 18, low: true, rows: ['yyyy', '.yy.'] }],
  },
  frog: {
    side: [{ x: 7, y: 3, rows: ['..bbbb..', '.bhhhbb.', 'bhhhhbbb', 'bhhhbbbb', 'bbbbbbbb', 'bbbbbbbb'] }],
    markSide: [
      { x: 5, y: 12, rows: ['dd', 'dd'] },
      { x: 8, y: 10, rows: ['d'] },
    ],
    markCenter: [{ x: 12, y: 24, low: true, rows: ['d..d..d..d', '.d..d..d..'] }],
    post: [{ x: 9, y: 22, low: true, rows: ['o............o', '.oooooooooooo.'] }],
  },
  alien: {
    side: [{ x: 9, y: 0, rows: ['yyy..', 'yyy..', '..d..', '..d..', '...d.', '...d.', '....d', '....d'] }],
    markCenter: [{ x: 13, y: 10, rows: ['d..d..d', '.d.dd.d'] }],
  },
  fox: {
    side: [{ x: 5, y: 0, rows: ['d.......', 'dd......', 'ddb.....', 'ddbb....', 'dlbbb...', 'dllbbb..', 'dlllbbb.', 'dllllbbb', 'dbbbbbbb', 'bbbbbbbb'] }],
    tail: [
      { x: 26, y: 10, low: true, rows: ['.....l', '....ll', '...lll', '...ddl', '..dddd', '.ddddd', '.ddddd', 'dddddd', 'dddddd', 'dddddd', 'dddddd', '.ddddd', '..dddd'] },
    ],
    markSide: [{ x: 3, y: 19, low: true, rows: ['..ll', '.lll', 'llll', 'lll.'] }],
    post: [{ x: 15, y: 19, low: true, rows: ['kk'] }],
  },
  mouse: {
    side: [{ x: 3, y: 2, rows: ['..bbbb..', '.bppppb.', 'bppppppb', 'bppppppb', 'bppppppb', '.bppppb.', '..bbbb..'] }],
    tail: [{ x: 26, y: 23, low: true, rows: ['....pp', '....pp', '...pp.', '..pp..', '.pp...', 'pp....'] }],
    post: [{ x: 15, y: 19, low: true, rows: ['pp'] }],
    postSide: [
      { x: 0, y: 21, low: true, rows: ['kkk'] },
      { x: 0, y: 23, low: true, rows: ['kk'] },
    ],
  },
  unicorn: {
    side: [{ x: 7, y: 5, rows: ['..bb.', '.bppb', 'bppbd', 'bbbbb'] }],
    center: [{ x: 13, y: 2, rows: ['....yy', '...wyy', '..yyy.', '..wyy.', '.yyy..', '.yyy..'] }],
    tail: [{ x: 27, y: 18, low: true, rows: ['..yy', '.yyy', 'yyyy', 'yyyy', 'yyy.', 'yy..'] }],
    markCenter: [{ x: 15, y: 10, rows: ['.y.', 'yyy', '.y.'] }],
    markSide: [{ x: 4, y: 11, rows: ['pp', 'ppp', 'pp'] }],
  },
}

// ── face ──
type Layout = {
  /** Top row of the 5x5 eyes. */
  y0: number
  /** Top row of the mouth. */
  m: number
  /** Row of the cheeks and the x of the left cheek. */
  ch: number
  cx: number
  /** Left eyebrow pixels for sad moods. */
  brow: [number, number][]
  sweat: [number, number][]
  /** Shift applied to head-top features / face-level features / inward x on this body. */
  dyHead: number
  dyLow: number
  dx: number
}
const LAYOUT_BIG: Layout = {
  y0: 14, m: 20, ch: 20, cx: 4,
  brow: [[7, 12], [8, 12], [9, 11], [10, 11], [11, 10], [12, 10]],
  sweat: [[27, 9], [27, 10], [28, 10], [27, 11], [28, 11]],
  dyHead: 0, dyLow: 0, dx: 0,
}
const LAYOUT_SMALL: Layout = {
  y0: 17, m: 23, ch: 22, cx: 6,
  brow: [[8, 15], [9, 15], [10, 14], [11, 14], [12, 13]],
  sweat: [[24, 15], [24, 16], [25, 16], [24, 17], [25, 17]],
  dyHead: 5, dyLow: 3, dx: 3,
}

const EYE_X = 8 // left eye spans x 8..12, the right one mirrors to 19..23
const EYES: Record<PetMood, string[]> = {
  happy: ['.....', '.kkk.', 'kk.kk', 'k...k', '.....'],
  content: ['.kkk.', 'kwwkk', 'kkkkk', 'kkkwk', '.kkk.'],
  hungry: ['kkkkk', 'kwwkk', 'kkkkk', '.kkk.', '.....'],
  starving: ['.....', '.....', 'kkkkk', '.....', '.....'],
}
const MOUTHS: Record<PetMood, string[]> = {
  happy: ['kkkkkk', 'kppppk', '.kppk.', '..kk..'],
  content: ['k....k', '.kkkk.'],
  hungry: ['.kkkk.', 'k....k'],
  starving: ['.kkkk.', 'kkkkkk', 'kkkkkk', '.kkkk.'],
}

function glasses(g: Grid, y0: number) {
  const ring = ['kkkkkkk', 'k.....k', 'k.....k', 'k.....k', 'k.....k', 'k.....k', 'kkkkkkk']
  stamp(g, ring, EYE_X - 1, y0 - 1)
  stamp(g, ring, W - EYE_X - 6, y0 - 1)
  stamp(g, ['kkkk'], 14, y0 + 1)
  stamp(g, ['kk'], 5, y0 + 1)
  stamp(g, ['kk'], 25, y0 + 1)
}

function build(stage: PetStage, mood: PetMood, breed: PetBreed): { body: Grid; mouth: Grid } {
  if (stage === 'egg') return { body: buildEgg(), mouth: blank() }

  const small = stage === 'hatchling'
  const g = blank()
  const L = small ? LAYOUT_SMALL : LAYOUT_BIG

  if (small) {
    fillBody(g, 21, 9.6, 8.3)
    fillBelly(g, 27, 5.6, 2.8)
    stamp(g, ['hddd', 'dddd'], 9, 29)
    stamp(g, ['hddd', 'dddd'], 19, 29)
    stamp(g, ['hd', 'dd', 'dd'], 4, 22)
    stamp(g, ['dh', 'dd', 'dd'], 26, 22)
  } else {
    fillBody(g, 18.5, 12.8, 10.9)
    fillBelly(g, 26.2, 7.4, 4.2)
    stamp(g, ['hdddd', 'ddddd'], 7, 29)
    stamp(g, ['hdddd', 'ddddd'], 20, 29)
    stamp(g, ['.hd', 'hdd', 'ddd', '.dd'], 1, 19)
    stamp(g, ['dh.', 'ddh', 'ddd', 'dd.'], 28, 19)
  }

  // breed features
  const f = BREEDS[breed]
  const dyOf = (b: Block) => (b.low ? L.dyLow : L.dyHead)
  const place = (b: Block, mirrored: boolean, mode: 'over' | 'behind' | 'clip') => {
    const w = b.rows[0].length
    const x = (mirrored ? W - b.x - w : b.x) + (mirrored ? -L.dx : L.dx)
    stamp(g, mirrored ? flip(b.rows) : b.rows, x, b.y + dyOf(b), mode)
  }
  const placeSide = (b: Block, mode: 'over' | 'behind' | 'clip' = 'over') => {
    place(b, false, mode)
    place(b, true, mode)
  }
  const placeAxis = (b: Block, mode: 'over' | 'behind' | 'clip' = 'over') => {
    const w = b.rows[0].length
    stamp(g, b.rows, Math.round(W / 2 - w / 2), b.y + dyOf(b), mode)
  }

  f.tail?.forEach((b) => stamp(g, b.rows, b.x - L.dx, b.y + dyOf(b), 'behind'))
  f.side?.forEach((b) => placeSide(b))
  f.center?.forEach((b) => placeAxis(b))
  f.markSide?.forEach((b) => placeSide(b, 'clip'))
  f.markCenter?.forEach((b) => placeAxis(b, 'clip'))

  if (stage === 'sage') {
    // gold scarf around the belly, with a short flap on one side
    stamp(g, ['......yyyyyyyyyyyyyyyyyyyy......'], 0, 25, 'clip')
    stamp(g, ['.......YYYYYYYYYYYYYYYYYY.......'], 0, 26, 'clip')
    stamp(g, ['yy', 'yY', 'YY'], 20, 27)
  }

  outline(g)

  // whiskers, noses and beaks sit on top of the outline
  f.postSide?.forEach((b) => placeSide(b))
  f.post?.forEach((b) => placeAxis(b))

  if (stage === 'bookworm' || stage === 'sage') glasses(g, L.y0)

  const eye = EYES[mood]
  stamp(g, eye, EYE_X, L.y0)
  stamp(g, eye, W - EYE_X - 5, L.y0)

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
    for (const dx of [0, 1, 2]) {
      put(L.cx + dx, L.ch, 'p')
      put(W - 1 - L.cx - dx, L.ch, 'p')
      if (!small) {
        put(L.cx + dx, L.ch + 1, 'p')
        put(W - 1 - L.cx - dx, L.ch + 1, 'p')
      }
    }
  }

  // mouth lives on its own layer so it can animate while eating
  const mouth = blank()
  stamp(mouth, MOUTHS[mood], 13, L.m)
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
        viewBox="0 0 32 33"
        shapeRendering="crispEdges"
        className={className}
        style={{ imageRendering: 'pixelated' }}
        role="img"
        aria-hidden="true"
      >
        {/* shadow */}
        <rect x={stage === 'egg' ? 8 : 6} y={32} width={stage === 'egg' ? 16 : 20} height={1} fill="currentColor" opacity={0.18} />
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
