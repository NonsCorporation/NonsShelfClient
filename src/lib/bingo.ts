'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { MediaType } from '@/types'
import type { CatalogItem } from '@/services/catalogService'
import { useAuth } from '@/contexts/AuthContext'
import { bingoApi } from '@/services/bingoService'

// Bingo boards. The UI reads everything from this browser's localStorage
// (instant, works signed out); when signed in, every change is also pushed to
// nons-library-server (/api/bingo) and, once per page load, what's only on the
// server is pulled in — see "server sync" below.
//
// Two kinds of board:
//   list   – a fixed set of books/films (or prompts) that players tick off.
//   prompt – squares are descriptions like "The book I cried on"; every player
//            fills in their own pick for each one.
//
// A board is any size from 2×2 up to 100×100. Each player can play a board
// several times: every play-through is a "run" with its own id, and a finished
// run can be shared as  /bingo/<board uuid>/<user uuid>/<run id>.
// The link also carries the board and the result in a `d` query parameter, so it
// opens even where the server doesn't have the board (see bingoShareUrl).
//
// Editing a board never rewrites what people already played. Changing the
// squares, the size or the free centre starts a new *revision*; every run
// remembers the revision it was started on and keeps showing against it, and the
// owner of an unfinished run can choose to move it to the latest revision.
// Title and description changes apply to everyone straight away.

export const BINGO_DEFAULT = 5
export const BINGO_MIN = 2
export const BINGO_MAX = 100
export const BINGO_TITLE_MAX = 60
export const BINGO_DESC_MAX = 240
export const BINGO_CELL_MAX = 80

export type BingoKind = 'list' | 'prompt'

export type BingoCell = {
  /** `media` comes from the catalog; `text` is free text (a list item, a prompt, or a typed answer). */
  kind: 'media' | 'text'
  title: string
  type?: MediaType
  coverUrl?: string
  credit?: string
  year?: number
}

export type Bingo = {
  /** UUID — the public id used in links. */
  id: string
  kind: BingoKind
  title: string
  description: string
  author: string
  /** Free centre square; only possible when both dimensions are odd. */
  freeCenter: boolean
  rows: number
  cols: number
  /** For `list` boards the items to tick; for `prompt` boards the prompts to answer. Row-major, rows × cols long. */
  cells: (BingoCell | null)[]
  /** Starts at 1; goes up whenever the squares, size or free centre change. */
  revision: number
  createdAt: number
}

/** What an earlier revision of a board looked like (the parts an edit can change). */
export type BingoRevision = Pick<Bingo, 'revision' | 'rows' | 'cols' | 'freeCenter' | 'cells'>

/** The board as it was at a given revision (the current one, or a stored snapshot). */
export function boardAtRevision(board: Bingo, revisions: BingoRevision[] | undefined, revision: number): Bingo {
  if (revision === board.revision) return board
  const snap = revisions?.find((r) => r.revision === revision)
  return snap ? { ...board, ...snap } : board
}

/** True when an edit changes what the squares are (so earlier runs would no longer line up). */
export const structureChanged = (a: Bingo, b: Bingo): boolean =>
  a.rows !== b.rows || a.cols !== b.cols || a.freeCenter !== b.freeCenter || JSON.stringify(a.cells) !== JSON.stringify(b.cells)

/**
 * Moves a run onto a newer revision: a tick or answer survives only where the
 * square (same row and column) still holds the same thing. Returns how many
 * were dropped.
 */
export function migrateRun(from: Bingo, to: Bingo, run: BingoRun): { run: BingoRun; dropped: number } {
  const marks: boolean[] = []
  const answers: (BingoCell | null)[] = []
  let dropped = 0
  for (let r = 0; r < from.rows; r++) {
    for (let c = 0; c < from.cols; c++) {
      const oi = r * from.cols + c
      const had = from.kind === 'prompt' ? !!run.answers[oi] : !!run.marks[oi]
      if (!had) continue
      const same = r < to.rows && c < to.cols && (to.cells[r * to.cols + c]?.title ?? '') === (from.cells[oi]?.title ?? '') && !!from.cells[oi]
      if (!same) {
        dropped++
        continue
      }
      const ni = r * to.cols + c
      if (from.kind === 'prompt') answers[ni] = run.answers[oi]
      else marks[ni] = true
    }
  }
  return { run: { id: run.id, marks, answers, createdAt: run.createdAt, revision: to.revision }, dropped }
}

export const clampSize = (n: number): number =>
  Number.isFinite(n) ? Math.min(BINGO_MAX, Math.max(BINGO_MIN, Math.round(n))) : BINGO_DEFAULT

export const cellTotal = (b: Pick<Bingo, 'rows' | 'cols'>): number => b.rows * b.cols
export const emptyCells = (rows: number, cols: number): (BingoCell | null)[] => Array<BingoCell | null>(rows * cols).fill(null)

/** Index of the centre square, or null when a dimension is even (no single middle square). */
export function centerIndex(rows: number, cols: number): number | null {
  return rows % 2 === 1 && cols % 2 === 1 ? ((rows - 1) / 2) * cols + (cols - 1) / 2 : null
}
export const canFreeCenter = (rows: number, cols: number): boolean => centerIndex(rows, cols) !== null
export const isFreeSquare = (b: Pick<Bingo, 'rows' | 'cols' | 'freeCenter'>, i: number): boolean =>
  b.freeCenter && i === centerIndex(b.rows, b.cols)

/** Keeps squares at the same row/column when the board is resized; new squares are empty. */
export function resizeCells(
  cells: (BingoCell | null)[],
  oldRows: number,
  oldCols: number,
  rows: number,
  cols: number,
): (BingoCell | null)[] {
  const next = emptyCells(rows, cols)
  for (let r = 0; r < Math.min(rows, oldRows); r++)
    for (let c = 0; c < Math.min(cols, oldCols); c++) next[r * cols + c] = cells[r * oldCols + c] ?? null
  return next
}

// ── lines ──
const lineCache = new Map<string, number[][]>()

/**
 * Every line that wins: each row, each column, and — on square boards only —
 * both diagonals.
 */
export function linesFor(rows: number, cols: number): number[][] {
  const key = `${rows}x${cols}`
  const hit = lineCache.get(key)
  if (hit) return hit
  const lines: number[][] = []
  for (let r = 0; r < rows; r++) lines.push(Array.from({ length: cols }, (_, c) => r * cols + c))
  for (let c = 0; c < cols; c++) lines.push(Array.from({ length: rows }, (_, r) => r * cols + c))
  if (rows === cols) {
    lines.push(Array.from({ length: rows }, (_, i) => i * cols + i))
    lines.push(Array.from({ length: rows }, (_, i) => i * cols + (cols - 1 - i)))
  }
  lineCache.set(key, lines)
  return lines
}

/**
 * Which squares count as done: ticked ones on a list board, answered ones on a
 * prompt board. The free centre is always done.
 */
export function progressMask(
  b: Pick<Bingo, 'kind' | 'freeCenter' | 'rows' | 'cols'>,
  marks?: boolean[],
  answers?: (BingoCell | null)[],
): boolean[] {
  const centre = b.freeCenter ? centerIndex(b.rows, b.cols) : null
  return Array.from(
    { length: b.rows * b.cols },
    (_, i) => i === centre || (b.kind === 'prompt' ? !!answers?.[i] : !!marks?.[i]),
  )
}

export const completedLines = (mask: boolean[], rows: number, cols: number): number[][] =>
  linesFor(rows, cols).filter((line) => line.every((i) => mask[i]))
export const doneCount = (mask: boolean[]): number => mask.reduce((n, x) => n + (x ? 1 : 0), 0)

export function filledCount(b: Pick<Bingo, 'cells' | 'freeCenter' | 'rows' | 'cols'>): number {
  const centre = b.freeCenter ? centerIndex(b.rows, b.cols) : null
  return b.cells.reduce<number>((n, c, i) => n + (c || i === centre ? 1 : 0), 0)
}

/** A square (or answer) built from a catalog search result. */
export function cellFromCatalog(item: CatalogItem): BingoCell {
  return {
    kind: 'media',
    title: item.title.slice(0, BINGO_CELL_MAX),
    type: item.type,
    coverUrl: item.coverUrl || undefined,
    credit: ((item.type === 'book' ? item.author : item.director || item.author) || undefined)?.slice(0, BINGO_CELL_MAX),
    year: item.year || undefined,
  }
}

// ── runs (one play-through of a board) ──
export type BingoRun = {
  /** Short id used in the share link. */
  id: string
  /** List boards: ticked squares. */
  marks: boolean[]
  /** Prompt boards: the player's picks. */
  answers: (BingoCell | null)[]
  createdAt: number
  /** The board revision this run was started on. */
  revision: number
  /** Set when every square is done (or the player finishes it by hand); a finished run is locked until reopened. */
  finishedAt?: number
}

// ── ids and links ──
export function newUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.randomUUID) return c.randomUUID()
  const b = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
export const newBingoId = newUuid
/** A fresh board of your own (new id, new author) that starts from someone else's. */
export const copyOfBingo = (b: Bingo, author: string): Bingo => ({ ...b, id: newUuid(), author, revision: 1, createdAt: Date.now() })
export const newRunId = (): string => Math.random().toString(36).slice(2, 10).padEnd(8, '0')

/** /bingo/<board>  ·  /bingo/<board>/<user>  ·  /bingo/<board>/<user>/<run> */
export function bingoPath(boardId: string, userId?: string, runId?: string): string {
  const parts = [boardId, userId, userId ? runId : undefined].filter((p): p is string => !!p)
  return '/bingo/' + parts.map(encodeURIComponent).join('/')
}

// ── sharing ──
const clip = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '')

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): string {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

const packCell = (c: BingoCell | null) =>
  c ? [c.kind === 'media' ? 1 : 0, c.title, c.type ?? '', c.coverUrl ?? '', c.credit ?? '', c.year ?? 0] : 0

function unpackCell(c: unknown): BingoCell | null {
  if (!Array.isArray(c)) return null
  const title = clip(c[1], BINGO_CELL_MAX)
  if (!title) return null
  const type = c[2] === 'book' || c[2] === 'movie' || c[2] === 'series' ? (c[2] as MediaType) : undefined
  const cover = typeof c[3] === 'string' && /^https?:\/\//i.test(c[3]) ? c[3].slice(0, 500) : undefined
  const year = typeof c[5] === 'number' && c[5] > 0 && c[5] < 3000 ? c[5] : undefined
  return {
    kind: c[0] === 1 ? 'media' : 'text',
    title,
    type,
    coverUrl: cover,
    credit: clip(c[4], BINGO_CELL_MAX) || undefined,
    year,
  }
}

export type SharedRun = { marks: boolean[] | null; answers: (BingoCell | null)[] | null }

/** Compact, link-safe encoding of a board, optionally with one player's result. */
export function encodeShare(b: Bingo, run?: { marks?: boolean[]; answers?: (BingoCell | null)[] }, by?: string): string {
  const payload: Record<string, unknown> = {
    v: 2,
    k: b.kind === 'prompt' ? 'p' : 'l',
    n: [b.rows, b.cols],
    t: b.title,
    d: b.description,
    a: b.author,
    f: b.freeCenter ? 1 : 0,
    c: b.cells.map(packCell),
  }
  const total = b.rows * b.cols
  if (run) {
    if (b.kind === 'list' && run.marks?.some(Boolean)) payload.m = Array.from({ length: total }, (_, i) => (run.marks?.[i] ? 1 : 0)).join('')
    if (b.kind === 'prompt' && run.answers?.some(Boolean)) payload.r = Array.from({ length: total }, (_, i) => packCell(run.answers?.[i] ?? null))
    if ((payload.m || payload.r) && by) payload.s = by
  }
  return toBase64Url(JSON.stringify(payload))
}

/** Parses a share payload. Untrusted input: everything is clipped and covers must be http(s). */
export function decodeShare(raw: string, id: string): { board: Bingo; run: SharedRun | null; by: string } | null {
  try {
    const p = JSON.parse(fromBase64Url(raw)) as Record<string, unknown>
    if (p.v !== 2 || !Array.isArray(p.n) || !Array.isArray(p.c)) return null
    const rows = Number(p.n[0])
    const cols = Number(p.n[1])
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < BINGO_MIN || cols < BINGO_MIN || rows > BINGO_MAX || cols > BINGO_MAX) return null
    const total = rows * cols
    if (p.c.length !== total) return null
    const kind: BingoKind = p.k === 'p' ? 'prompt' : 'list'
    const board: Bingo = {
      id,
      kind,
      title: clip(p.t, BINGO_TITLE_MAX) || 'Bingo',
      description: clip(p.d, BINGO_DESC_MAX),
      author: clip(p.a, 40),
      freeCenter: p.f === 1 && canFreeCenter(rows, cols),
      rows,
      cols,
      cells: (p.c as unknown[]).map(unpackCell),
      revision: 1,
      createdAt: Date.now(),
    }
    const marks = kind === 'list' && typeof p.m === 'string' && p.m.length === total ? Array.from(p.m, (ch) => ch === '1') : null
    const answers = kind === 'prompt' && Array.isArray(p.r) && p.r.length === total ? (p.r as unknown[]).map(unpackCell) : null
    return { board, run: marks || answers ? { marks, answers } : null, by: marks || answers ? clip(p.s, 40) : '' }
  } catch {
    return null
  }
}

/** Longest `d` payload we will put in a link; bigger boards share by path only. */
export const MAX_EMBED = 8000

/**
 * The link people open. The path is the real address; `d` carries the board and
 * result so the mock works across browsers. Boards too big to embed get the bare
 * path, which only resolves where the board is stored until there is a server.
 */
export function bingoShareUrl(
  b: Bingo,
  opts?: { userId?: string; runId?: string; run?: { marks?: boolean[]; answers?: (BingoCell | null)[] }; by?: string },
): { url: string; embedded: boolean } {
  const url = new URL(bingoPath(b.id, opts?.userId, opts?.runId), window.location.origin)
  const payload = encodeShare(b, opts?.run, opts?.by)
  const embedded = payload.length <= MAX_EMBED
  if (embedded) url.searchParams.set('d', payload)
  return { url: url.toString(), embedded }
}

// ── mock community boards ──
const DAY = 86_400_000

const listBoard = (
  id: string,
  title: string,
  description: string,
  author: string,
  type: MediaType,
  rows: [string, string?][],
  daysAgo: number,
): Bingo => ({
  id,
  kind: 'list',
  title,
  description,
  author,
  freeCenter: true,
  rows: 5,
  cols: 5,
  cells: rows.map(([t, credit]) => ({ kind: 'media', title: t, type, credit })),
  revision: 1,
  createdAt: Date.now() - daysAgo * DAY,
})

const textBoard = (id: string, kind: BingoKind, title: string, description: string, author: string, rows: string[], daysAgo: number): Bingo => ({
  id,
  kind,
  title,
  description,
  author,
  freeCenter: true,
  rows: 5,
  cols: 5,
  cells: rows.map((t) => ({ kind: 'text', title: t })),
  revision: 1,
  createdAt: Date.now() - daysAgo * DAY,
})

export const COMMUNITY_BINGOS: Bingo[] = [
  textBoard(
    '5eed0001-0000-4000-8000-000000000001',
    'prompt',
    'My reading life',
    'Fill every square with your own pick: a book or a film. Compare boards with friends!',
    'mira',
    [
      'The book I cried on', 'A book that made me laugh out loud', 'My comfort re-read', 'The book I pretend I have read', 'The last book I did not finish',
      'A film that changed my mind', 'The movie I watch every year', 'My guilty-pleasure series', "The book I'd save from a fire", 'A book I read in one sitting',
      'The best opening line I know', 'A book that scared me', 'The film I fell asleep during', 'My most-lent book', 'A book that got me into reading',
      'The worst ending ever', 'A character I would marry', 'A story I wish I could read again for the first time', 'The book I bought for the cover', 'A film adaptation that beat the book',
      'The book on my nightstand', 'My favourite villain', 'A book everyone loved but me', 'The most beautiful cover I own', 'A book that taught me something',
    ],
    2,
  ),
  textBoard(
    '5eed0002-0000-4000-8000-000000000002',
    'prompt',
    'Movie night memories',
    'Your own answers for each square. Films or series only (or just write what you remember).',
    'cinephile_k',
    [
      'My first cinema trip', 'A film I quote constantly', 'The best soundtrack', 'A movie that made me cry', 'A series I binged in a weekend',
      'The scariest film I saw', 'A film I watch when I am sad', 'The best plot twist', 'A movie better the second time', 'My favourite actor performance',
      'A film that made me leave the cinema silent', 'The funniest film', 'A sequel better than the original', 'A foreign film I loved', 'A film I love that everyone hates',
      'The best opening scene', 'A movie I watched with my family', 'An animated film for adults', 'A film that made me read the book', 'A documentary that stuck with me',
      'My favourite ending', 'The most overrated film', 'A series I wish had not ended', 'A film I rewatch every winter', 'A movie I need to see',
    ],
    5,
  ),
  textBoard(
    '5eed0003-0000-4000-8000-000000000003',
    'list',
    'Reading bingo 2026',
    'A year of prompts: tick a square each time a book fits. Go for a full row!',
    'mira',
    [
      'A book with a blue cover', 'Read in one sitting', "Set in a country you've never visited", 'Author under 30', 'A book from your childhood',
      'A translated novel', 'A one-word title', 'A debut novel', 'Became a movie', 'Published before 1950',
      'A graphic novel', 'Recommended by a friend', 'A poetry collection', 'Has a map inside', 'A colour in the title',
      "A book you've been avoiding", 'Non-fiction about science', 'An unreliable narrator', 'A mystery or thriller', 'Over 500 pages',
      'Under 150 pages', 'A number in the title', 'An award winner', 'Set in winter', 'A twist ending',
    ],
    3,
  ),
  listBoard(
    '5eed0004-0000-4000-8000-000000000004',
    'Sci-fi canon bingo',
    'The big names of science fiction. How many have you read?',
    'dan_reads',
    'book',
    [
      ['Dune', 'Frank Herbert'], ['Neuromancer', 'William Gibson'], ['The Left Hand of Darkness', 'Ursula K. Le Guin'], ['Foundation', 'Isaac Asimov'], ['Snow Crash', 'Neal Stephenson'],
      ['Hyperion', 'Dan Simmons'], ['The Martian', 'Andy Weir'], ["Ender's Game", 'Orson Scott Card'], ['Fahrenheit 451', 'Ray Bradbury'], ['Brave New World', 'Aldous Huxley'],
      ['Nineteen Eighty-Four', 'George Orwell'], ['The Dispossessed', 'Ursula K. Le Guin'], ['Solaris', 'Stanisław Lem'], ['Do Androids Dream of Electric Sheep?', 'Philip K. Dick'], ['The Three-Body Problem', 'Liu Cixin'],
      ['Children of Time', 'Adrian Tchaikovsky'], ['Project Hail Mary', 'Andy Weir'], ['A Canticle for Leibowitz', 'Walter M. Miller Jr.'], ['Rendezvous with Rama', 'Arthur C. Clarke'], ["The Handmaid's Tale", 'Margaret Atwood'],
      ['Station Eleven', 'Emily St. John Mandel'], ['Kindred', 'Octavia E. Butler'], ['Annihilation', 'Jeff VanderMeer'], ['Red Mars', 'Kim Stanley Robinson'], ['The Time Machine', 'H. G. Wells'],
    ],
    7,
  ),
  listBoard(
    '5eed0005-0000-4000-8000-000000000005',
    'Film night classics',
    'Twenty-four films everyone should see once. Free square in the middle.',
    'cinephile_k',
    'movie',
    [
      ['The Godfather'], ['Casablanca'], ['Pulp Fiction'], ['Spirited Away'], ['Parasite'],
      ['Inception'], ['The Matrix'], ['Blade Runner'], ['Alien'], ['Jaws'],
      ['Psycho'], ['Vertigo'], ['Seven Samurai'], ['Amélie'], ['Whiplash'],
      ['Interstellar'], ['Mad Max: Fury Road'], ['Moonlight'], ['Get Out'], ['The Shining'],
      ['Goodfellas'], ['Fargo'], ['Back to the Future'], ['Titanic'], ['The Lion King'],
    ],
    12,
  ),
  listBoard(
    '5eed0006-0000-4000-8000-000000000006',
    'Studio Ghibli marathon',
    'Cozy, strange and beautiful. Tick them off one rainy evening at a time.',
    'bookish.lena',
    'movie',
    [
      ['Spirited Away'], ['My Neighbor Totoro'], ['Princess Mononoke'], ["Howl's Moving Castle"], ["Kiki's Delivery Service"],
      ['Ponyo'], ['Castle in the Sky'], ['Nausicaä of the Valley of the Wind'], ['The Wind Rises'], ['Grave of the Fireflies'],
      ['Whisper of the Heart'], ['The Cat Returns'], ['Porco Rosso'], ['Arrietty'], ['When Marnie Was There'],
      ['The Tale of the Princess Kaguya'], ['From Up on Poppy Hill'], ['Tales from Earthsea'], ['Pom Poko'], ['My Neighbors the Yamadas'],
      ['Only Yesterday'], ['Ocean Waves'], ['The Boy and the Heron'], ['Earwig and the Witch'], ['The Red Turtle'],
    ],
    20,
  ),
]

// ── mock persistence ──
type Saved = {
  /** The signed-in user's own boards. */
  mine: Bingo[]
  /** Every play-through, per board id (own, community and shared boards alike). */
  runs: Record<string, BingoRun[]>
  /** Earlier revisions of the user's boards that some run still points at. */
  revisions: Record<string, BingoRevision[]>
}

const STORAGE_KEY = 'nons-library:bingo:v1'
const EMPTY: Saved = { mine: [], runs: {}, revisions: {} }

let cachedRaw: string | null | undefined
let cachedSaved: Saved = EMPTY
const listeners = new Set<() => void>()

/** Fills in what older saves lacked (kind, size, uuid ids, runs). */
function normalise(p: Record<string, unknown>): Saved {
  // Boards saved with the old short ids get a UUID; their progress follows them.
  const renamed = new Map<string, string>()
  const mine = (Array.isArray(p.mine) ? (p.mine as Partial<Bingo>[]) : []).map((b): Bingo => {
    const rows = clampSize(b.rows ?? BINGO_DEFAULT)
    const cols = clampSize(b.cols ?? BINGO_DEFAULT)
    const cells = Array.isArray(b.cells) ? b.cells.slice(0, rows * cols) : []
    while (cells.length < rows * cols) cells.push(null)
    const id = b.id && /^[0-9a-f-]{36}$/i.test(b.id) ? b.id : newUuid()
    if (b.id && id !== b.id) renamed.set(b.id, id)
    return {
      id,
      kind: b.kind === 'prompt' ? 'prompt' : 'list',
      title: b.title ?? 'Bingo',
      description: b.description ?? '',
      author: b.author ?? '',
      freeCenter: !!b.freeCenter && canFreeCenter(rows, cols),
      rows,
      cols,
      cells,
      revision: b.revision ?? 1,
      createdAt: b.createdAt ?? Date.now(),
    }
  })
  const runs: Record<string, BingoRun[]> = {}
  if (p.runs && typeof p.runs === 'object') {
    for (const [id, list] of Object.entries(p.runs as Record<string, BingoRun[]>))
      if (Array.isArray(list)) runs[id] = list.map((r) => ({ ...r, revision: r.revision ?? 1 }))
  } else {
    // The first version kept one set of ticks / answers per board.
    const marks = (p.marks && typeof p.marks === 'object' ? p.marks : {}) as Record<string, boolean[]>
    const answers = (p.answers && typeof p.answers === 'object' ? p.answers : {}) as Record<string, (BingoCell | null)[]>
    for (const id of new Set([...Object.keys(marks), ...Object.keys(answers)]))
      runs[id] = [{ id: newRunId(), marks: marks[id] ?? [], answers: answers[id] ?? [], createdAt: Date.now(), revision: 1 }]
  }
  for (const [from, to] of renamed) {
    if (runs[from]) {
      runs[to] = runs[from]
      delete runs[from]
    }
  }
  const revisions = p.revisions && typeof p.revisions === 'object' ? (p.revisions as Record<string, BingoRevision[]>) : {}
  return { mine, runs, revisions }
}

function read(): Saved {
  if (typeof window === 'undefined') return EMPTY
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // storage blocked: keep whatever is in memory
    return cachedSaved
  }
  if (raw === cachedRaw) return cachedSaved
  cachedRaw = raw
  if (raw) {
    try {
      cachedSaved = normalise(JSON.parse(raw) as Record<string, unknown>)
      return cachedSaved
    } catch {
      // corrupted: start over
    }
  }
  cachedSaved = EMPTY
  return cachedSaved
}

function write(next: Saved) {
  cachedSaved = next
  try {
    const raw = JSON.stringify(next)
    window.localStorage.setItem(STORAGE_KEY, raw)
    cachedRaw = raw
  } catch {
    cachedRaw = undefined
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

const withoutKey = <T,>(rec: Record<string, T>, id: string) => {
  const next = { ...rec }
  delete next[id]
  return next
}

const newRun = (revision: number): BingoRun => ({ id: newRunId(), marks: [], answers: [], createdAt: Date.now(), revision })

// ── server sync ──
// Local first: every mutation writes localStorage, then (signed in) the changed
// board/run is pushed. Calls go through one serial queue so a run never reaches
// the server before its board. Tick/answer pushes are debounced per run.
// Community boards are client-side mocks, so their runs stay local.

const COMMUNITY_IDS = new Set(COMMUNITY_BINGOS.map((b) => b.id))
/** Which account this browser's store was last synced to — never upload one user's local boards into another's account. */
const OWNER_KEY = 'nons-library:bingo:owner'
const RUN_DEBOUNCE_MS = 700

/** The signed-in user we sync for; null = signed out, or this store belongs to someone else. */
let syncUser: number | null = null
/** Whose first sync already ran in this page load. */
let syncedFor: number | null = null
let queue: Promise<unknown> = Promise.resolve()
const runTimers = new Map<string, ReturnType<typeof setTimeout>>()
/** Boards the server is known to have that aren't ours (played / opened from a link), so our runs on them can sync. */
const serverBoards = new Set<string>()

function enqueue(label: string, fn: () => Promise<unknown>) {
  const user = syncUser
  queue = queue
    .then(() => (user !== null && syncUser === user ? fn() : undefined))
    .catch((e) => console.warn(`bingo sync: ${label}:`, e))
}

/** Lets the runs on a board fetched from the server sync too. */
export function markServerBoard(id: string) {
  serverBoards.add(id)
}

const runsSyncFor = (boardId: string) =>
  !COMMUNITY_IDS.has(boardId) && (serverBoards.has(boardId) || read().mine.some((b) => b.id === boardId))

function pushBoard(id: string) {
  if (syncUser === null) return
  enqueue('save board', async () => {
    const b = read().mine.find((m) => m.id === id)
    if (b) await bingoApi.saveBoard(b)
  })
}

function pushRun(boardId: string, runId: string, delay = 0, share = true) {
  if (syncUser === null || COMMUNITY_IDS.has(boardId)) return
  const key = `${boardId}/${runId}`
  clearTimeout(runTimers.get(key))
  runTimers.set(
    key,
    setTimeout(() => {
      runTimers.delete(key)
      enqueue('save run', async () => {
        const run = read().runs[boardId]?.find((r) => r.id === runId)
        if (run && runsSyncFor(boardId)) await bingoApi.saveRun(boardId, run, share)
      })
    }, delay),
  )
}

function pushDeleteRun(boardId: string, runId: string) {
  clearTimeout(runTimers.get(`${boardId}/${runId}`))
  runTimers.delete(`${boardId}/${runId}`)
  if (syncUser === null || !runsSyncFor(boardId)) return
  enqueue('delete run', () => bingoApi.deleteRun(boardId, runId))
}

function pushDeleteBoard(id: string) {
  for (const [key, timer] of runTimers) {
    if (key.startsWith(`${id}/`)) {
      clearTimeout(timer)
      runTimers.delete(key)
    }
  }
  if (syncUser === null) return
  enqueue('delete board', () => bingoApi.deleteBoard(id))
}

function storeOwner(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

/**
 * First sync after sign-in: pull boards/runs/revisions only the server has, then
 * push what only this browser has. Backfilled runs go up with share=false so
 * results finished long ago don't flood friends' feeds.
 */
async function initialSync(userId: number) {
  const owner = storeOwner()
  if (owner && owner !== String(userId)) {
    console.warn("bingo sync: this browser holds another account's boards; not syncing")
    syncUser = null
    return
  }
  let server
  try {
    server = await bingoApi.mine()
  } catch (e) {
    console.warn('bingo sync: load:', e)
    return
  }
  if (syncUser !== userId) return
  try {
    window.localStorage.setItem(OWNER_KEY, String(userId))
  } catch {
    // storage blocked: sync still works for this page load
  }
  for (const b of server.played) serverBoards.add(b.id)

  const cur = read()
  const haveBoard = new Set(cur.mine.map((b) => b.id))
  const pulled = server.boards.filter((b) => !haveBoard.has(b.id))
  let changed = pulled.length > 0
  const runs = { ...cur.runs }
  for (const [bid, list] of Object.entries(server.runs)) {
    const local = runs[bid] ?? []
    const ids = new Set(local.map((r) => r.id))
    const add = list.filter((r) => !ids.has(r.id))
    if (add.length) {
      runs[bid] = [...local, ...add].sort((x, y) => x.createdAt - y.createdAt)
      changed = true
    }
  }
  const revisions = { ...cur.revisions }
  for (const [bid, list] of Object.entries(server.revisions)) {
    const local = revisions[bid] ?? []
    const revs = new Set(local.map((r) => r.revision))
    const add = list.filter((r) => !revs.has(r.revision))
    if (add.length) {
      revisions[bid] = [...local, ...add]
      changed = true
    }
  }
  if (changed) write({ mine: [...cur.mine, ...pulled], runs, revisions })

  const boardsOnServer = new Set(server.boards.map((b) => b.id))
  for (const b of cur.mine) if (!boardsOnServer.has(b.id)) pushBoard(b.id)
  const runsOnServer = new Set(Object.entries(server.runs).flatMap(([bid, list]) => list.map((r) => `${bid}/${r.id}`)))
  for (const [bid, list] of Object.entries(cur.runs))
    for (const r of list) if (!runsOnServer.has(`${bid}/${r.id}`)) pushRun(bid, r.id, 0, false)
}

export function useBingos() {
  const saved = useSyncExternalStore(subscribe, read, () => EMPTY)
  const { user } = useAuth()
  const uid = user?.id ?? null

  // Turn sync on/off with the session; the first sync runs once per user per page load.
  useEffect(() => {
    syncUser = uid
    if (uid !== null && syncedFor !== uid) {
      syncedFor = uid
      void initialSync(uid)
    }
  }, [uid])

  /** Creates or replaces one of the user's boards. */
  const save = useCallback((b: Bingo) => {
    const cur = read()
    const prev = cur.mine.find((m) => m.id === b.id)
    if (!prev) {
      write({ ...cur, mine: [{ ...b, revision: 1 }, ...cur.mine] })
      pushBoard(b.id)
      return
    }
    // Content edits start a new revision, and the old one is kept while a run still uses it.
    if (!structureChanged(prev, b)) {
      write({ ...cur, mine: cur.mine.map((m) => (m.id === b.id ? { ...b, revision: prev.revision } : m)) })
      pushBoard(b.id)
      return
    }
    const used = (cur.runs[b.id] ?? []).some((r) => r.revision === prev.revision)
    const kept = (cur.revisions[b.id] ?? []).filter((r) => r.revision !== prev.revision)
    const snapshot: BingoRevision = { revision: prev.revision, rows: prev.rows, cols: prev.cols, freeCenter: prev.freeCenter, cells: prev.cells }
    write({
      ...cur,
      mine: cur.mine.map((m) => (m.id === b.id ? { ...b, revision: prev.revision + 1 } : m)),
      revisions: { ...cur.revisions, [b.id]: used ? [...kept, snapshot] : kept },
    })
    pushBoard(b.id)
  }, [])

  const remove = useCallback((id: string) => {
    const cur = read()
    write({ mine: cur.mine.filter((m) => m.id !== id), runs: withoutKey(cur.runs, id), revisions: withoutKey(cur.revisions, id) })
    pushDeleteBoard(id)
  }, [])

  /** Applies `fn` to a run (the given one, or the latest open one, or a fresh one) and returns its id. */
  const edit = useCallback((board: Bingo, runId: string | undefined, fn: (run: BingoRun) => BingoRun): string => {
    const cur = read()
    const list = [...(cur.runs[board.id] ?? [])]
    let idx = runId ? list.findIndex((r) => r.id === runId) : -1
    if (idx === -1) {
      const last = list[list.length - 1]
      if (!runId && last && !last.finishedAt) idx = list.length - 1
      else {
        list.push(newRun(board.revision))
        idx = list.length - 1
      }
    }
    let run = fn(list[idx])
    // A full card finishes the run by itself.
    if (!run.finishedAt && doneCount(progressMask(board, run.marks, run.answers)) === board.rows * board.cols) run = { ...run, finishedAt: Date.now() }
    list[idx] = run
    write({ ...cur, runs: { ...cur.runs, [board.id]: list } })
    pushRun(board.id, run.id, RUN_DEBOUNCE_MS)
    return run.id
  }, [])

  const startRun = useCallback((board: Bingo): string => {
    const cur = read()
    const run = newRun(board.revision)
    write({ ...cur, runs: { ...cur.runs, [board.id]: [...(cur.runs[board.id] ?? []), run] } })
    pushRun(board.id, run.id)
    return run.id
  }, [])

  /** Moves an unfinished run onto the board's latest revision; returns how many ticks / answers could not be kept. */
  const updateRun = useCallback((board: Bingo, runId: string): number => {
    const cur = read()
    const run = (cur.runs[board.id] ?? []).find((r) => r.id === runId)
    if (!run || run.finishedAt || run.revision === board.revision) return 0
    const from = boardAtRevision(board, cur.revisions[board.id], run.revision)
    const { run: moved, dropped } = migrateRun(from, board, run)
    const runs = (cur.runs[board.id] ?? []).map((r) => (r.id === runId ? moved : r))
    // Forget old revisions nothing points at any more.
    const still = new Set(runs.map((r) => r.revision))
    const revisions = (cur.revisions[board.id] ?? []).filter((r) => still.has(r.revision))
    write({ ...cur, runs: { ...cur.runs, [board.id]: runs }, revisions: { ...cur.revisions, [board.id]: revisions } })
    pushRun(board.id, runId)
    return dropped
  }, [])

  const toggle = useCallback(
    (board: Bingo, runId: string | undefined, i: number) =>
      edit(board, runId, (run) => {
        const marks = [...run.marks]
        marks[i] = !marks[i]
        return { ...run, marks }
      }),
    [edit],
  )

  const setAnswer = useCallback(
    (board: Bingo, runId: string | undefined, i: number, cell: BingoCell | null) =>
      edit(board, runId, (run) => {
        const answers = [...run.answers]
        answers[i] = cell
        return { ...run, answers }
      }),
    [edit],
  )

  const patchRun = useCallback((boardId: string, runId: string, patch: (r: BingoRun) => BingoRun) => {
    const cur = read()
    write({ ...cur, runs: { ...cur.runs, [boardId]: (cur.runs[boardId] ?? []).map((r) => (r.id === runId ? patch(r) : r)) } })
    pushRun(boardId, runId)
  }, [])

  const finishRun = useCallback((boardId: string, runId: string) => patchRun(boardId, runId, (r) => ({ ...r, finishedAt: Date.now() })), [patchRun])
  const reopenRun = useCallback(
    (boardId: string, runId: string) =>
      patchRun(boardId, runId, (r) => {
        const { finishedAt, ...rest } = r
        void finishedAt
        return rest
      }),
    [patchRun],
  )
  /** Wipes a run's ticks / answers and reopens it. */
  const resetRun = useCallback(
    (boardId: string, runId: string) => patchRun(boardId, runId, (r) => ({ id: r.id, marks: [], answers: [], createdAt: r.createdAt, revision: r.revision })),
    [patchRun],
  )

  const deleteRun = useCallback((boardId: string, runId: string) => {
    const cur = read()
    write({ ...cur, runs: { ...cur.runs, [boardId]: (cur.runs[boardId] ?? []).filter((r) => r.id !== runId) } })
    pushDeleteRun(boardId, runId)
  }, [])

  return {
    mine: saved.mine,
    runs: saved.runs,
    revisions: saved.revisions,
    save,
    remove,
    startRun,
    updateRun,
    toggle,
    setAnswer,
    finishRun,
    reopenRun,
    resetRun,
    deleteRun,
  }
}
