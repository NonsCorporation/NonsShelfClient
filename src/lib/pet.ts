'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Mock-only pet ("tamagotchi") state. Everything lives in this browser's
// localStorage — there is no server side yet, so the pet is per-device.

export type PetFoodKind = 'read' | 'watch'

export type PetFood = {
  id: string
  kind: PetFoodKind
  /** Locale key for the label shown on the feed button. */
  labelKey: string
  /** How much hunger it fills (0–100 scale). */
  fill: number
  xp: number
}

export const PET_FOODS: PetFood[] = [
  { id: 'read-pages', kind: 'read', labelKey: 'petFoodReadPages', fill: 8, xp: 4 },
  { id: 'read-chapter', kind: 'read', labelKey: 'petFoodReadChapter', fill: 16, xp: 10 },
  { id: 'read-book', kind: 'read', labelKey: 'petFoodReadBook', fill: 45, xp: 40 },
  { id: 'watch-episode', kind: 'watch', labelKey: 'petFoodWatchEpisode', fill: 14, xp: 8 },
  { id: 'watch-movie', kind: 'watch', labelKey: 'petFoodWatchMovie', fill: 30, xp: 25 },
  { id: 'watch-series', kind: 'watch', labelKey: 'petFoodWatchSeries', fill: 50, xp: 45 },
]

export const PET_BREEDS = ['cat', 'bunny', 'bear', 'dino', 'owl', 'frog', 'alien', 'fox', 'mouse', 'unicorn'] as const
export type PetBreed = (typeof PET_BREEDS)[number]
export const PET_COLOR_COUNT = 8

export type PetLook = { breed: PetBreed; color: number }

/** Deterministic 32-bit hash (FNV-1a + avalanche) so ids that are close together still look unrelated. */
function hash32(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** Every account always gets the same breed and colour, derived from its id. */
export function petLookFor(seed: string | number): PetLook {
  const h = hash32(`pet:${seed}`)
  return {
    breed: PET_BREEDS[h % PET_BREEDS.length],
    color: Math.floor(h / PET_BREEDS.length) % PET_COLOR_COUNT,
  }
}

export const PET_SCENES = ['meadow', 'night', 'battlefield', 'beach', 'space'] as const
export type PetScene = (typeof PET_SCENES)[number]

export type PetStage = 'egg' | 'hatchling' | 'bookworm' | 'sage'

export const PET_STAGES: { stage: PetStage; minXp: number }[] = [
  { stage: 'egg', minXp: 0 },
  { stage: 'hatchling', minXp: 30 },
  { stage: 'bookworm', minXp: 150 },
  { stage: 'sage', minXp: 500 },
]

export type PetMood = 'happy' | 'content' | 'hungry' | 'starving'

export const PET_NAME_MAX = 20

type PetSaved = {
  name: string
  scene: PetScene
  /** Fullness (0–100) as of `savedAt`; the live value decays from there. */
  fullness: number
  savedAt: number
  xp: number
  booksRead: number
  moviesWatched: number
  fed: number
  adoptedAt: number
}

const STORAGE_KEY = 'nons-library:pet:v1'
/** Fullness lost per hour — a full pet gets hungry in about half a day. */
const DECAY_PER_HOUR = 6

const SERVER_PET: PetSaved = {
  name: '',
  scene: 'meadow',
  fullness: 60,
  savedAt: 0,
  xp: 0,
  booksRead: 0,
  moviesWatched: 0,
  fed: 0,
  adoptedAt: 0,
}

function freshPet(): PetSaved {
  const now = Date.now()
  return { ...SERVER_PET, fullness: 60, savedAt: now, adoptedAt: now }
}

// ── tiny external store so the header and the page stay in sync ──
let cachedRaw: string | null | undefined
let cachedPet: PetSaved = SERVER_PET
const listeners = new Set<() => void>()

function read(): PetSaved {
  if (typeof window === 'undefined') return SERVER_PET
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // storage blocked: fall through to an in-memory pet
  }
  if (raw === cachedRaw) return cachedPet
  cachedRaw = raw
  if (raw) {
    try {
      cachedPet = { ...SERVER_PET, ...(JSON.parse(raw) as Partial<PetSaved>) }
      return cachedPet
    } catch {
      // corrupted: start over
    }
  }
  cachedPet = freshPet()
  return cachedPet
}

function write(next: PetSaved) {
  cachedPet = next
  try {
    const raw = JSON.stringify(next)
    window.localStorage.setItem(STORAGE_KEY, raw)
    cachedRaw = raw
  } catch {
    // storage blocked: keep it in memory only
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

// ── derived values ──
export function fullnessAt(p: PetSaved, now: number): number {
  const hours = Math.max(0, now - p.savedAt) / 3_600_000
  return Math.max(0, Math.min(100, p.fullness - hours * DECAY_PER_HOUR))
}

export function moodFor(fullness: number): PetMood {
  if (fullness >= 65) return 'happy'
  if (fullness >= 35) return 'content'
  if (fullness >= 10) return 'hungry'
  return 'starving'
}

export function stageFor(xp: number): PetStage {
  let current: PetStage = 'egg'
  for (const s of PET_STAGES) if (xp >= s.minXp) current = s.stage
  return current
}

/** Progress toward the next stage, or null once fully grown. */
export function stageProgress(xp: number): { pct: number; toNext: number } | null {
  const idx = PET_STAGES.findIndex((s, i) => xp >= s.minXp && (PET_STAGES[i + 1] === undefined || xp < PET_STAGES[i + 1].minXp))
  const next = PET_STAGES[idx + 1]
  if (!next) return null
  const cur = PET_STAGES[idx]
  return { pct: ((xp - cur.minXp) / (next.minXp - cur.minXp)) * 100, toNext: next.minXp - xp }
}

export type PetView = {
  name: string
  scene: PetScene
  hasName: boolean
  fullness: number
  mood: PetMood
  stage: PetStage
  xp: number
  booksRead: number
  moviesWatched: number
  fed: number
  adoptedAt: number
}

function toView(p: PetSaved, now: number): PetView {
  const fullness = fullnessAt(p, now)
  return {
    name: p.name,
    scene: PET_SCENES.includes(p.scene) ? p.scene : 'meadow',
    hasName: p.name.trim().length > 0,
    fullness,
    mood: moodFor(fullness),
    stage: stageFor(p.xp),
    xp: p.xp,
    booksRead: p.booksRead,
    moviesWatched: p.moviesWatched,
    fed: p.fed,
    adoptedAt: p.adoptedAt,
  }
}

const getServerSnapshot = () => SERVER_PET

export function usePet() {
  const saved = useSyncExternalStore(subscribe, read, getServerSnapshot)

  // Re-render once a minute so the hunger bar and mood drift in real time.
  const tick = useTick(60_000)
  const now = Math.max(tick, saved.savedAt)

  const pet = toView(saved, now)

  const rename = useCallback((name: string) => {
    write({ ...read(), name: name.slice(0, PET_NAME_MAX) })
  }, [])

  /** Returns false if the pet is too full to eat. */
  const feed = useCallback((food: PetFood): boolean => {
    const cur = read()
    const now = Date.now()
    const full = fullnessAt(cur, now)
    if (full >= 98) return false
    write({
      ...cur,
      fullness: Math.min(100, full + food.fill),
      savedAt: now,
      xp: cur.xp + food.xp,
      fed: cur.fed + 1,
      booksRead: cur.booksRead + (food.id === 'read-book' ? 1 : 0),
      moviesWatched: cur.moviesWatched + (food.id === 'watch-movie' || food.id === 'watch-series' ? 1 : 0),
    })
    return true
  }, [])

  const reset = useCallback(() => write({ ...freshPet(), scene: read().scene }), [])

  const setScene = useCallback((scene: PetScene) => write({ ...read(), scene }), [])

  // Mock-only helpers so the growth stages and moods can be tried out.
  const addXp = useCallback((amount: number) => {
    const cur = read()
    write({ ...cur, xp: Math.max(0, cur.xp + amount) })
  }, [])

  /** Jump straight to the start of the next stage (no-op when fully grown). */
  const evolve = useCallback(() => {
    const cur = read()
    const next = PET_STAGES.find((s) => s.minXp > cur.xp)
    if (next) write({ ...cur, xp: next.minXp })
  }, [])

  const setFullness = useCallback((value: number) => {
    write({ ...read(), fullness: Math.max(0, Math.min(100, value)), savedAt: Date.now() })
  }, [])

  return { pet, now, ready: saved.savedAt !== 0, rename, feed, reset, addXp, evolve, setFullness, setScene }
}

/** Re-renders the caller every `ms` so time-derived values stay fresh. */
function useTick(ms: number) {
  const sub = useCallback(
    (cb: () => void) => {
      const id = window.setInterval(cb, ms)
      return () => window.clearInterval(id)
    },
    [ms],
  )
  return useSyncExternalStore(
    sub,
    () => Math.floor(Date.now() / ms) * ms,
    () => 0,
  )
}
