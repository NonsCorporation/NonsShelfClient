'use client'

import type { PetMood, PetStage } from '@/lib/pet'

type Props = {
  stage: PetStage
  mood: PetMood
  className?: string
  /** Briefly plays a chomp animation (set after feeding). */
  eating?: boolean
}

// Pixel-art pet: every sprite is a 16x16 grid of palette letters, drawn as
// <rect> runs with crisp edges. '.' is transparent.
const COLORS: Record<string, string> = {
  o: '#2b2457', // outline
  b: '#6768ab', // body
  d: '#4e4f86', // dark body (ears, feet)
  l: '#b6b7ee', // belly
  w: '#ffffff', // eye highlight
  k: '#1a1a24', // eyes, mouth, glasses
  p: '#ff7a85', // cheeks, tongue
  y: '#f5a623', // gold
  s: '#8ecbff', // sweat
  e: '#efeaff', // egg shell
  m: '#9a8fd6', // egg spots
}

const EGG = [
  '................',
  '.....oooooo.....',
  '....oeeeeeeo....',
  '...oeeeeeeeeo...',
  '...oeeeeeeeeo...',
  '..oeeeeeeeeeeo..',
  '..oeeeeeeeeeeo..',
  '..oeeeeeeeeeeo..',
  '..oeeeeeeeeeeo..',
  '..oeeeeeeeeeeo..',
  '..oeeeeeeeeeeo..',
  '..oeeeeeeeeeeo..',
  '...oeeeeeeeeo...',
  '...oeeeeeeeeo...',
  '....oooooooo....',
  '................',
]

// [x, y, colour] overlays on the egg: spots and a crack.
const EGG_DETAILS: [number, number, string][] = [
  [5, 5, 'm'], [6, 5, 'm'], [5, 6, 'm'],
  [10, 8, 'm'], [9, 8, 'm'], [10, 9, 'm'], [9, 9, 'm'],
  [4, 10, 'm'], [5, 10, 'm'],
  [4, 3, 'o'], [5, 4, 'o'], [6, 3, 'o'], [7, 4, 'o'], [8, 3, 'o'], [9, 4, 'o'],
]

const HATCHLING = [
  '................',
  '................',
  '................',
  '................',
  '....oooooooo....',
  '...obbbbbbbbo...',
  '..obbbbbbbbbbo..',
  '..obbbbbbbbbbo..',
  '..obbbbbbbbbbo..',
  '..obbbbbbbbbbo..',
  '..obbbllllbbbo..',
  '..obbbllllbbbo..',
  '...obbbbbbbbo...',
  '...oddo..oddo...',
  '...oooo..oooo...',
  '................',
]

const BLOB = [
  '................',
  '...oo......oo...',
  '...odo....odo...',
  '..oooooooooooo..',
  '.obbbbbbbbbbbbo.',
  'obbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbo',
  'obbbbllllllbbbbo',
  'obbbbllllllbbbbo',
  '.obbbllllllbbbo.',
  '.oobbbbbbbbbboo.',
  '..oddo....oddo..',
  '..oooo....oooo..',
]

type Px = [number, number, string]

type Face = { eyeY: number; mouthY: number; cheekY: number }
const FACE_BIG: Face = { eyeY: 6, mouthY: 9, cheekY: 8 }
const FACE_SMALL: Face = { eyeY: 7, mouthY: 10, cheekY: 9 }

/** Eyes, mouth and cheeks for a mood; x is mirrored around the 16px centre. */
function face(mood: PetMood, f: Face): { eyes: Px[]; mouth: Px[]; extra: Px[] } {
  const { eyeY: y, mouthY: m, cheekY: c } = f
  const mirror = (px: Px[]): Px[] => [...px, ...px.map(([x, yy, col]): Px => [15 - x, yy, col])]
  const extra: Px[] = []
  let eyes: Px[]
  let mouth: Px[]
  if (mood === 'happy') {
    // ^ ^ eyes, open smile, blushing cheeks
    eyes = mirror([[3, y + 1, 'k'], [4, y, 'k'], [5, y + 1, 'k']])
    mouth = [
      [5, m, 'k'], [6, m, 'k'], [7, m, 'k'], [8, m, 'k'], [9, m, 'k'], [10, m, 'k'],
      [6, m + 1, 'p'], [7, m + 1, 'p'], [8, m + 1, 'p'], [9, m + 1, 'p'],
    ]
    extra.push(...mirror([[2, c, 'p']]))
  } else if (mood === 'content') {
    eyes = mirror([[4, y, 'w'], [5, y, 'k'], [4, y + 1, 'k'], [5, y + 1, 'k']])
    mouth = [[6, m, 'k'], [7, m + 1, 'k'], [8, m + 1, 'k'], [9, m, 'k']]
  } else if (mood === 'hungry') {
    eyes = mirror([[4, y, 'w'], [5, y, 'k'], [4, y + 1, 'k'], [5, y + 1, 'k']])
    mouth = [[6, m + 1, 'k'], [7, m, 'k'], [8, m, 'k'], [9, m + 1, 'k']]
    extra.push(...mirror([[3, y - 2, 'k'], [4, y - 2, 'k']]))
  } else {
    // starving: flat eyes, open mouth, sweat drop
    eyes = mirror([[3, y + 1, 'k'], [4, y + 1, 'k'], [5, y + 1, 'k']])
    mouth = [[7, m, 'k'], [8, m, 'k'], [7, m + 1, 'k'], [8, m + 1, 'k']]
    extra.push([13, y - 2, 's'], [13, y - 1, 's'])
  }
  return { eyes, mouth, extra }
}

const GLASSES: Px[] = (() => {
  const out: Px[] = []
  const frame = (x0: number) => {
    for (let x = x0; x < x0 + 5; x++) for (let y = 5; y <= 8; y++) {
      if (x === x0 || x === x0 + 4 || y === 5 || y === 8) out.push([x, y, 'k'])
    }
  }
  frame(2)
  frame(9)
  out.push([7, 6, 'k'], [8, 6, 'k'])
  return out
})()

const CAP: Px[] = (() => {
  const out: Px[] = []
  for (let x = 6; x <= 9; x++) out.push([x, 0, 'k'])
  for (let x = 3; x <= 12; x++) out.push([x, 1, 'k'])
  for (let x = 4; x <= 11; x++) out.push([x, 2, 'k'])
  out.push([13, 2, 'y'], [13, 3, 'y'], [13, 4, 'y'], [12, 4, 'y'])
  return out
})()

/** Paint a base grid plus overlays into merged horizontal runs of pixels. */
function toRects(base: string[], overlays: Px[]) {
  const grid = base.map((row) => row.split(''))
  for (const [x, y, c] of overlays) if (grid[y]?.[x] !== undefined) grid[y][x] = c
  const rects: { x: number; y: number; w: number; c: string }[] = []
  grid.forEach((row, y) => {
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

export default function PetSprite({ stage, mood, className, eating }: Props) {
  let base: string[]
  let overlays: Px[]
  let mouthStart = -1

  if (stage === 'egg') {
    base = EGG
    overlays = EGG_DETAILS
  } else {
    const small = stage === 'hatchling'
    base = small ? HATCHLING : BLOB
    const { eyes, mouth, extra } = face(mood, small ? FACE_SMALL : FACE_BIG)
    // Mouth is drawn separately so it can animate while eating.
    overlays = [...(stage === 'hatchling' ? [] : stage === 'bookworm' || stage === 'sage' ? GLASSES : []), ...eyes, ...extra]
    if (stage === 'sage') overlays = [...overlays, ...CAP]
    mouthStart = overlays.length
    overlays = [...overlays, ...mouth]
  }

  const bodyRects = toRects(base, overlays.slice(0, mouthStart === -1 ? undefined : mouthStart))
  const mouthRects = mouthStart === -1 ? [] : toRects(Array(16).fill('.'.repeat(16)), overlays.slice(mouthStart))

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
        viewBox="0 0 16 17"
        shapeRendering="crispEdges"
        className={className}
        style={{ imageRendering: 'pixelated' }}
        role="img"
        aria-hidden="true"
      >
        {/* shadow */}
        <rect x={stage === 'egg' ? 4 : 3} y={16} width={stage === 'egg' ? 8 : 10} height={1} fill="currentColor" opacity={0.15} />
        <g
          className={stage === 'egg' ? 'pet-shake' : 'pet-hop'}
          style={{ ['--pet-anim' as string]: anim }}
        >
          {bodyRects.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={COLORS[r.c]} />
          ))}
          <g className={eating ? 'pet-chomp' : undefined}>
            {mouthRects.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={COLORS[r.c]} />
            ))}
          </g>
        </g>
      </svg>
    </>
  )
}
