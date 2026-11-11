'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { MediaType } from '@/types'
import type { CatalogItem } from '@/services/catalogService'

// Mock-only bingo boards. Everything lives in this browser's localStorage —
// there is no server side yet. "Sharing" encodes the whole board into a link
// (?tab=bingo&share=…), so a shared board opens in any browser and can be saved
// as a copy there.
//
// Two kinds of board:
//   list   – a fixed set of books/films (or prompts) that players tick off.
//   prompt – squares are descriptions like "The book I cried on"; every player
//            fills in their own pick for each one.

export const BINGO_SIZE = 5
export const BINGO_CELLS = BINGO_SIZE * BINGO_SIZE
export const BINGO_CENTER = 12
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
  id: string
  kind: BingoKind
  title: string
  description: string
  author: string
  freeCenter: boolean
  /** For `list` boards the items to tick; for `prompt` boards the prompts to answer. */
  cells: (BingoCell | null)[]
  createdAt: number
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

export const emptyCells = (): (BingoCell | null)[] => Array<BingoCell | null>(BINGO_CELLS).fill(null)

// ── lines ──
export const BINGO_LINES: number[][] = (() => {
  const lines: number[][] = []
  for (let r = 0; r < BINGO_SIZE; r++) lines.push(Array.from({ length: BINGO_SIZE }, (_, c) => r * BINGO_SIZE + c))
  for (let c = 0; c < BINGO_SIZE; c++) lines.push(Array.from({ length: BINGO_SIZE }, (_, r) => r * BINGO_SIZE + c))
  lines.push(Array.from({ length: BINGO_SIZE }, (_, i) => i * BINGO_SIZE + i))
  lines.push(Array.from({ length: BINGO_SIZE }, (_, i) => i * BINGO_SIZE + (BINGO_SIZE - 1 - i)))
  return lines
})()

/**
 * Which squares count as done: ticked ones on a list board, answered ones on a
 * prompt board. The free centre is always done.
 */
export function progressMask(
  b: Pick<Bingo, 'kind' | 'freeCenter'>,
  marks?: boolean[],
  answers?: (BingoCell | null)[],
): boolean[] {
  return Array.from(
    { length: BINGO_CELLS },
    (_, i) => (b.freeCenter && i === BINGO_CENTER) || (b.kind === 'prompt' ? !!answers?.[i] : !!marks?.[i]),
  )
}

export const completedLines = (mask: boolean[]): number[][] => BINGO_LINES.filter((line) => line.every((i) => mask[i]))
export const doneCount = (mask: boolean[]): number => mask.filter(Boolean).length

export function filledCount(cells: (BingoCell | null)[], freeCenter: boolean): number {
  return cells.reduce<number>((n, c, i) => n + (c || (freeCenter && i === BINGO_CENTER) ? 1 : 0), 0)
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

/** Compact, link-safe encoding of a board; pass `answers` to include the sharer's own picks on a prompt board. */
export function encodeShare(b: Bingo, answers?: (BingoCell | null)[], by?: string): string {
  const payload: Record<string, unknown> = {
    v: 1,
    k: b.kind === 'prompt' ? 'p' : 'l',
    t: b.title,
    d: b.description,
    a: b.author,
    f: b.freeCenter ? 1 : 0,
    c: b.cells.map(packCell),
  }
  if (answers && b.kind === 'prompt' && answers.some(Boolean)) {
    payload.r = answers.map(packCell)
    if (by) payload.s = by
  }
  return toBase64Url(JSON.stringify(payload))
}

/** Parses a share link payload. Untrusted input: everything is clipped and covers must be http(s). */
export function decodeShare(raw: string): { board: Bingo; answers: (BingoCell | null)[] | null; by: string } | null {
  try {
    const p = JSON.parse(fromBase64Url(raw)) as Record<string, unknown>
    if (p.v !== 1 || !Array.isArray(p.c) || p.c.length !== BINGO_CELLS) return null
    const kind: BingoKind = p.k === 'p' ? 'prompt' : 'list'
    const board: Bingo = {
      id: 'shared',
      kind,
      title: clip(p.t, BINGO_TITLE_MAX) || 'Bingo',
      description: clip(p.d, BINGO_DESC_MAX),
      author: clip(p.a, 40),
      freeCenter: p.f === 1,
      cells: (p.c as unknown[]).map(unpackCell),
      createdAt: Date.now(),
    }
    const answers =
      kind === 'prompt' && Array.isArray(p.r) && p.r.length === BINGO_CELLS ? (p.r as unknown[]).map(unpackCell) : null
    return { board, answers, by: answers ? clip(p.s, 40) : '' }
  } catch {
    return null
  }
}

export function shareUrl(b: Bingo, answers?: (BingoCell | null)[], by?: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('tab', 'bingo')
  url.searchParams.set('share', encodeShare(b, answers, by))
  return url.toString()
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
  cells: rows.map(([t, credit]) => ({ kind: 'media', title: t, type, credit })),
  createdAt: Date.now() - daysAgo * DAY,
})

const textBoard = (id: string, kind: BingoKind, title: string, description: string, author: string, rows: string[], daysAgo: number): Bingo => ({
  id,
  kind,
  title,
  description,
  author,
  freeCenter: true,
  cells: rows.map((t) => ({ kind: 'text', title: t })),
  createdAt: Date.now() - daysAgo * DAY,
})

export const COMMUNITY_BINGOS: Bingo[] = [
  textBoard(
    'seed-feelings',
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
    'seed-movie-nights',
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
    'seed-reading',
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
    'seed-scifi',
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
    'seed-films',
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
    'seed-ghibli',
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
  /** Ticked squares per list board id (works for community and shared boards too). */
  marks: Record<string, boolean[]>
  /** The player's own picks per prompt board id. */
  answers: Record<string, (BingoCell | null)[]>
}

const STORAGE_KEY = 'nons-library:bingo:v1'
const EMPTY: Saved = { mine: [], marks: {}, answers: {} }

let cachedRaw: string | null | undefined
let cachedSaved: Saved = EMPTY
const listeners = new Set<() => void>()

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
      const p = JSON.parse(raw) as Partial<Saved>
      cachedSaved = {
        // Boards saved before the two kinds existed are checklists.
        mine: Array.isArray(p.mine) ? p.mine.map((b) => ({ ...b, kind: b.kind === 'prompt' ? 'prompt' : 'list' })) : [],
        marks: p.marks && typeof p.marks === 'object' ? p.marks : {},
        answers: p.answers && typeof p.answers === 'object' ? p.answers : {},
      }
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

export function newBingoId(): string {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

const without = <T,>(rec: Record<string, T>, id: string) => {
  const next = { ...rec }
  delete next[id]
  return next
}

export function useBingos() {
  const saved = useSyncExternalStore(subscribe, read, () => EMPTY)

  /** Creates or replaces one of the user's boards. */
  const save = useCallback((b: Bingo) => {
    const cur = read()
    const exists = cur.mine.some((m) => m.id === b.id)
    write({ ...cur, mine: exists ? cur.mine.map((m) => (m.id === b.id ? b : m)) : [b, ...cur.mine] })
  }, [])

  const remove = useCallback((id: string) => {
    const cur = read()
    write({ mine: cur.mine.filter((m) => m.id !== id), marks: without(cur.marks, id), answers: without(cur.answers, id) })
  }, [])

  const toggle = useCallback((id: string, i: number) => {
    const cur = read()
    const row = [...(cur.marks[id] ?? Array<boolean>(BINGO_CELLS).fill(false))]
    row[i] = !row[i]
    write({ ...cur, marks: { ...cur.marks, [id]: row } })
  }, [])

  const setAnswer = useCallback((id: string, i: number, cell: BingoCell | null) => {
    const cur = read()
    const row = [...(cur.answers[id] ?? emptyCells())]
    row[i] = cell
    write({ ...cur, answers: { ...cur.answers, [id]: row } })
  }, [])

  /** Clears ticks (list boards) and answers (prompt boards). */
  const clearProgress = useCallback((id: string) => {
    const cur = read()
    write({ ...cur, marks: without(cur.marks, id), answers: without(cur.answers, id) })
  }, [])

  return { mine: saved.mine, marks: saved.marks, answers: saved.answers, save, remove, toggle, setAnswer, clearProgress }
}
