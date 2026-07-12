'use client'

import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@/lib/router'
import {
  IoSparkles, IoSparklesOutline, IoClose, IoArrowForward, IoArrowBack, IoReloadOutline,
  IoDiceOutline, IoEyeOutline, IoOptionsOutline, IoStar, IoPlayForwardOutline,
  IoAppsOutline, IoBookOutline, IoFilmOutline, IoTvOutline,
  IoCafeOutline, IoFlashOutline, IoPlanetOutline, IoHeartOutline, IoMoonOutline,
  IoTrophyOutline, IoHappyOutline,
} from 'react-icons/io5'
import type { CatalogItem } from '@/services/catalogService'
import { discoverService } from '@/services/discoverService'
import type { MediaType } from '@/types'
import { mediaPath } from '@/lib/paths'
import TypeBadge from '@/components/badges/TypeBadge'

type Translate = (k: string, v?: Record<string, string | number>) => string
type IconType = typeof IoSparkles

// matches genres by substring and assigns an accent color for the wizard stage
type Mood = { key: string; label: string; icon: IconType; color: string; keywords: string[] }
const MOODS: Mood[] = [
  { key: 'cozy', label: 'Cozy', icon: IoCafeOutline, color: '#e5a86b', keywords: ['romance', 'comedy', 'slice of life', 'family', 'feel-good', 'friendship', 'contemporary'] },
  { key: 'thrilling', label: 'Thrilling', icon: IoFlashOutline, color: '#e57373', keywords: ['thriller', 'action', 'crime', 'suspense', 'mystery', 'adventure', 'spy'] },
  { key: 'mindbending', label: 'Mind-bending', icon: IoPlanetOutline, color: '#64b5f6', keywords: ['science fiction', 'sci-fi', 'psychological', 'dystopia', 'mystery', 'speculative'] },
  { key: 'heartfelt', label: 'Heart-wrenching', icon: IoHeartOutline, color: '#f06292', keywords: ['drama', 'tragedy', 'romance', 'historical', 'coming of age'] },
  { key: 'whimsical', label: 'Whimsical', icon: IoSparklesOutline, color: '#ba8bf0', keywords: ['fantasy', 'animation', 'adventure', 'magic', 'fairy', 'myth'] },
  { key: 'dark', label: 'Dark', icon: IoMoonOutline, color: '#8fa3c7', keywords: ['horror', 'thriller', 'crime', 'noir', 'gothic', 'dark', 'war'] },
  { key: 'epic', label: 'Epic', icon: IoTrophyOutline, color: '#4dd0a1', keywords: ['fantasy', 'adventure', 'epic', 'historical', 'war', 'science fiction'] },
  { key: 'funny', label: 'Funny', icon: IoHappyOutline, color: '#ffd54f', keywords: ['comedy', 'humor', 'satire', 'parody'] },
]

// defines timeline stops for era selection
type Era = { key: string; label: string; sub: string; test: (y: number) => boolean }
const ERAS: Era[] = [
  { key: 'any', label: 'Any era', sub: '∞', test: () => true },
  { key: 'classic', label: 'Classic', sub: 'before 1980', test: (y) => y > 0 && y < 1980 },
  { key: '80s', label: '80s', sub: '1980–89', test: (y) => y >= 1980 && y <= 1989 },
  { key: '90s', label: '90s', sub: '1990–99', test: (y) => y >= 1990 && y <= 1999 },
  { key: '00s', label: '2000s', sub: '2000–09', test: (y) => y >= 2000 && y <= 2009 },
  { key: '10s', label: '2010s', sub: '2010–19', test: (y) => y >= 2010 && y <= 2019 },
  { key: 'now', label: 'Right now', sub: '2020+', test: (y) => y >= 2020 },
]

const TYPE_OPTS: { key: 'any' | MediaType; label: string; icon: IconType }[] = [
  { key: 'any', label: 'Anything', icon: IoAppsOutline },
  { key: 'book', label: 'Books', icon: IoBookOutline },
  { key: 'movie', label: 'Films', icon: IoFilmOutline },
  { key: 'series', label: 'Series', icon: IoTvOutline },
]

// sets number of cards per draw
const HAND_SIZE = 4

type Selection = {
  type: 'any' | MediaType
  moods: Set<string>
  genres: Set<string>
  era: string
}
type StageKey = 'type' | 'vibe' | 'genre' | 'era'

const freshSelection = (): Selection => ({ type: 'any', moods: new Set(), genres: new Set(), era: 'any' })

const norm = (s: string) => s.trim().toLowerCase()

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function moodMatch(item: CatalogItem, moods: Set<string>): boolean {
  if (moods.size === 0) return true
  const genres = (item.genre ?? []).map(norm)
  for (const key of moods) {
    const m = MOODS.find((x) => x.key === key)
    if (m && m.keywords.some((kw) => genres.some((g) => g.includes(kw)))) return true
  }
  return false
}

function genreMatch(item: CatalogItem, genres: Set<string>): boolean {
  if (genres.size === 0) return true
  const g = (item.genre ?? []).map(norm)
  for (const sel of genres) if (g.includes(norm(sel))) return true
  return false
}

// draws a hand by filtering items in tiers of strictness
function drawHand(
  pool: CatalogItem[],
  sel: Selection,
  exclude: Set<string>,
): { items: CatalogItem[]; widened: boolean } {
  const eraDef = ERAS.find((e) => e.key === sel.era) ?? ERAS[0]
  const byType = (it: CatalogItem) => sel.type === 'any' || it.type === sel.type

  const tiers: CatalogItem[][] = [
    pool.filter((it) => byType(it) && genreMatch(it, sel.genres) && moodMatch(it, sel.moods) && eraDef.test(it.year ?? 0)),
    pool.filter((it) => byType(it) && genreMatch(it, sel.genres) && moodMatch(it, sel.moods)),
    pool.filter((it) => byType(it) && genreMatch(it, sel.genres)),
    pool.filter((it) => byType(it)),
    pool,
  ]

  const ordered = (arr: CatalogItem[]) => {
    const cov = (a: CatalogItem[]) => [
      ...shuffle(a.filter((i) => i.coverUrl)),
      ...shuffle(a.filter((i) => !i.coverUrl)),
    ]
    return [...cov(arr.filter((i) => !exclude.has(i.id))), ...cov(arr.filter((i) => exclude.has(i.id)))]
  }

  const strict = new Set(tiers[0].map((i) => i.id))
  const chosen: CatalogItem[] = []
  const seen = new Set<string>()
  for (const tier of tiers) {
    if (chosen.length >= HAND_SIZE) break
    for (const it of ordered(tier)) {
      if (chosen.length >= HAND_SIZE) break
      if (seen.has(it.id)) continue
      seen.add(it.id)
      chosen.push(it)
    }
  }
  return { items: chosen.slice(0, HAND_SIZE), widened: chosen.some((i) => !strict.has(i.id)) }
}

// Session persistence for the draw — see the comment in FindSomething for why
// this is sessionStorage rather than search params.
const FIND_STORAGE_KEY = 'nons:find-something'

type PersistedFind = {
  sel: Selection
  view: 'wizard' | 'cards'
  step: number
  draw: CatalogItem[]
  widened: boolean
  flipped: number[]
  revealOrder: number[]
}

function loadPersisted(): PersistedFind | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(FIND_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return { ...data, sel: { ...data.sel, moods: new Set(data.sel.moods), genres: new Set(data.sel.genres) } }
  } catch {
    return null
  }
}

function savePersisted(data: PersistedFind) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(FIND_STORAGE_KEY, JSON.stringify({ ...data, sel: { ...data.sel, moods: [...data.sel.moods], genres: [...data.sel.genres] } }))
  } catch {
    // storage full or disabled — the draw just won't survive navigation
  }
}

function clearPersisted() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(FIND_STORAGE_KEY)
}

export default function FindSomething({ t }: { t: Translate }) {
  // Restores the last draw session (if any) so navigating into a card and
  // back doesn't dump the user back at a blank wizard — Next's App Router
  // fully unmounts this page on that round trip, so state has to survive
  // outside React. sessionStorage (not the URL) because a dealt hand carries
  // full CatalogItem payloads that would make an ugly, unstable query string.
  const persisted = useMemo(loadPersisted, [])

  const [open, setOpen] = useState(!!persisted)
  const [pool, setPool] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const loadedRef = useRef(false)

  const [sel, setSel] = useState<Selection>(persisted?.sel ?? freshSelection)
  const [view, setView] = useState<'wizard' | 'cards'>(persisted?.view ?? 'wizard')
  const [step, setStep] = useState(persisted?.step ?? 0)
  const [draw, setDraw] = useState<CatalogItem[]>(persisted?.draw ?? [])
  const [widened, setWidened] = useState(persisted?.widened ?? false)
  const [flipped, setFlipped] = useState<Set<number>>(new Set(persisted?.flipped ?? []))

  // tracks picked cards and reveal order
  const [revealOrder, setRevealOrder] = useState<number[]>(persisted?.revealOrder ?? [])
  const lastDrawRef = useRef<Set<string>>(new Set(persisted?.draw?.map((i) => i.id) ?? []))

  // Persists the live session while the modal is open; dropped the moment it's
  // explicitly closed, so a fresh "Find something" always starts clean.
  useEffect(() => {
    if (!open) {
      clearPersisted()
      return
    }
    savePersisted({ sel, view, step, draw, widened, flipped: [...flipped], revealOrder })
  }, [open, sel, view, step, draw, widened, flipped, revealOrder])

  // fetches a broad pool of catalog items on first open
  useEffect(() => {
    if (!open || loadedRef.current) return
    loadedRef.current = true
    setLoading(true)
    Promise.all([
      discoverService.genres(),
      discoverService.spotlights(),
      discoverService.trending(),
      discoverService.newest('book'),
      discoverService.newest('movie'),
      discoverService.newest('series'),
    ])
      .then(([genres, spots, trend, nb, nm, ns]) => {
        const all: CatalogItem[] = [
          ...genres.flatMap((g) => g.items),
          ...spots.book, ...spots.movie, ...spots.series,
          ...trend, ...nb, ...nm, ...ns,
        ]
        const byId = new Map<string, CatalogItem>()
        for (const it of all) if (!byId.has(it.id)) byId.set(it.id, it)
        setPool([...byId.values()])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // gets top genres and assigns up to three covers for the spread
  const genreOptions = useMemo(() => {
    const count = new Map<string, { label: string; n: number; covers: string[] }>()
    for (const it of pool) {
      for (const g of it.genre ?? []) {
        const key = norm(g)
        if (!key) continue
        let cur = count.get(key)
        if (!cur) { cur = { label: g, n: 0, covers: [] }; count.set(key, cur) }
        cur.n++
        if (it.coverUrl && cur.covers.length < 3 && !cur.covers.includes(it.coverUrl)) cur.covers.push(it.coverUrl)
      }
    }
    return [...count.values()].sort((a, b) => b.n - a.n).slice(0, 12).map(({ label, covers }) => ({ label, covers }))
  }, [pool])

  const eraChips = useMemo(
    () => ERAS.filter((e) => e.key === 'any' || pool.some((it) => e.test(it.year ?? 0))),
    [pool],
  )

  // determines which wizard stages have enough data to appear
  const stages = useMemo<StageKey[]>(() => {
    const s: StageKey[] = ['type', 'vibe']
    if (genreOptions.length > 0) s.push('genre')
    if (eraChips.length > 1) s.push('era')
    return s
  }, [genreOptions, eraChips])

  const openModal = () => { setOpen(true); setView('wizard'); setStep(0) }
  const close = () => setOpen(false)

  const deal = (selection: Selection) => {
    const { items, widened: w } = drawHand(pool, selection, lastDrawRef.current)
    lastDrawRef.current = new Set(items.map((i) => i.id))
    setDraw(items)
    setWidened(w)
    setFlipped(new Set())
    setRevealOrder([])
    setView('cards')
  }

  // moves to the next stage or deals the hand if finished
  const advance = (next: Selection) => {
    setSel(next)
    if (step >= stages.length - 1) deal(next)
    else setStep((s) => s + 1)
  }
  const back = () => setStep((s) => Math.max(0, s - 1))
  const skip = () => { if (step >= stages.length - 1) deal(sel); else setStep((s) => s + 1) }

  const surprise = () => { const f = freshSelection(); setSel(f); deal(f) }

  // moves picked card to center spread and tracks flip status
  const select = (i: number) => {
    setRevealOrder((prev) => (prev.includes(i) ? prev : [...prev, i]))
    setFlipped((prev) => (prev.has(i) ? prev : new Set(prev).add(i)))
  }
  const revealAll = () => setFlipped(new Set(draw.map((_, i) => i)))
  const allRevealed = draw.length > 0 && flipped.size >= draw.length

  const stageKey = stages[Math.min(step, stages.length - 1)]

  return (
    <>
      <FindBanner onOpen={openModal} />

      {open && createPortal(
        // renders full-screen draw scene
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
          <div className="animate-fade-up absolute inset-0 flex flex-col bg-[var(--find-bg)]">
            {/* renders ambient background effects */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="animate-aurora absolute -top-1/4 left-1/3 h-[55vh] w-[55vh] rounded-full bg-nonsprimary/12 blur-3xl" />
              <div className="animate-glow-pulse absolute -bottom-1/4 right-1/4 h-[45vh] w-[45vh] rounded-full bg-nonsprimaryfocus/8 blur-3xl" />
              <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 100% at 50% 0%, transparent 45%, rgba(0,0,0,0.5) 100%)' }} />
              <span className="animate-sheen-once absolute inset-y-0 -left-1/2 w-1/3 skew-x-12 bg-white/[0.06] blur-2xl" />
            </div>

            {/* renders header and close button */}
            <div className="relative flex items-center justify-between px-5 pt-5 sm:px-8">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--find-text-muted)]">
                <IoSparkles className="h-3 w-3 text-nonsprimaryfocus" />
                Discovery draw
              </span>
              <button
                onClick={close}
                aria-label={t('cancel') || 'Close'}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[var(--find-text-muted)] transition-all hover:rotate-90 hover:bg-[var(--find-surface)] hover:text-[var(--find-text)]"
              >
                <IoClose className="h-5 w-5" />
              </button>
            </div>

            {/* renders central interactive stage */}
            <div className="relative flex-1 overflow-y-auto">
              <div className="flex min-h-full flex-col items-center justify-center px-6 py-4 text-center sm:py-10">
                {loading ? (
                  <LoadingDeck />
                ) : view === 'wizard' ? (
                  pool.length === 0 ? (
                    <EmptyState label="Nothing to draw from yet — check back once the catalog fills up." />
                  ) : (
                    <div key={step} className="animate-stage-in w-full max-w-2xl">
                      <Stage
                        stageKey={stageKey}
                        stepIndex={step}
                        sel={sel}
                        genreOptions={genreOptions}
                        eraChips={eraChips}
                        onType={(type) => advance({ ...sel, type })}
                        onMood={(k) => advance({ ...sel, moods: new Set([k]) })}
                        onGenre={(g) => advance({ ...sel, genres: new Set([g]) })}
                        onEra={(e) => advance({ ...sel, era: e })}
                      />
                    </div>
                  )
                ) : (
                  <CardsTable draw={draw} flipped={flipped} revealOrder={revealOrder} onSelect={select} widened={widened} t={t} />
                )}
              </div>
            </div>

            {/* renders navigation and action bar at bottom */}
            {!loading && pool.length > 0 && (
              <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 sm:px-8">
                {view === 'wizard' ? (
                  <>
                    <div className="justify-self-start">
                      {step > 0 && (
                        <button
                          onClick={back}
                          aria-label="Back"
                          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--find-text-muted)] transition-colors hover:bg-[var(--find-surface)] hover:text-[var(--find-text)]"
                        >
                          <IoArrowBack className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    {/* renders wizard step indicators */}
                    <div className="flex items-center gap-2 justify-self-center">
                      {stages.map((sk, i) => (
                        <span
                          key={sk}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            i === step ? 'w-6 bg-nonsprimary' : i < step ? 'w-1.5 bg-nonsprimary/50' : 'w-1.5 bg-white/15'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="justify-self-end">
                      {stageKey === 'type' ? (
                        <button onClick={surprise} className="inline-flex h-11 items-center gap-1.5 px-2 text-sm font-medium text-[var(--find-text-muted)] transition-colors hover:text-[var(--find-text)]">
                          <IoDiceOutline className="h-4 w-4" /> Surprise me
                        </button>
                      ) : (
                        <button onClick={skip} className="inline-flex h-11 items-center gap-1.5 px-2 text-sm font-medium text-[var(--find-text-muted)] transition-colors hover:text-[var(--find-text)]">
                          {step >= stages.length - 1 ? 'Skip & deal' : 'Skip'}
                          <IoPlayForwardOutline className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="justify-self-start">
                      <button onClick={() => { setView('wizard'); setStep(0) }} className="inline-flex h-11 items-center gap-1.5 px-2 text-sm font-medium text-[var(--find-text-muted)] transition-colors hover:text-[var(--find-text)]">
                        <IoOptionsOutline className="h-4 w-4" />
                        <span className="hidden sm:inline">Adjust</span>
                      </button>
                    </div>

                    <div className="justify-self-center">
                      {!allRevealed && (
                        <button onClick={revealAll} className="inline-flex h-11 items-center gap-1.5 px-2 text-sm font-medium text-[var(--find-text-muted)] transition-colors hover:text-[var(--find-text)]">
                          <IoEyeOutline className="h-4 w-4" /> Reveal all
                        </button>
                      )}
                    </div>

                    <div className="justify-self-end">
                      <button onClick={() => deal(sel)} className="inline-flex h-11 items-center gap-2 rounded-full bg-nonsprimary px-6 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(103,104,171,0.7)] transition-colors hover:bg-nonsprimaryfocus">
                        <IoReloadOutline className="h-4 w-4" /> Deal again
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// renders entry banner for discover page
function FindBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="mb-8">
      <button
        onClick={onOpen}
        className="group relative flex w-full items-center gap-4 overflow-hidden rounded-3xl bg-[var(--find-bg)] p-5 text-left transition-transform hover:-translate-y-0.5 sm:gap-6 sm:p-7"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-glow-pulse absolute -bottom-24 right-10 h-56 w-56 rounded-full bg-nonsprimaryfocus/15 blur-3xl" />
          {SPARKS.map((s, i) => (
            <IoSparkles key={i} className="animate-twinkle absolute text-nonsprimaryfocus/70" style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: s.delay }} />
          ))}
        </div>

        <div className="relative hidden h-20 w-24 flex-shrink-0 items-center justify-center sm:flex">
          {[-1, 0, 1].map((n) => (
            <span key={n} style={{ transform: `rotate(${n * 12}deg) translateX(${n * 16}px) translateY(${Math.abs(n) * 4}px)` }} className="absolute flex h-20 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-nonsprimary/80 to-nonsprimarydeep">
              <IoSparklesOutline className="h-5 w-5 text-white/70" />
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--find-surface)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-nonsprimaryfocus">
            <IoSparkles className="h-3 w-3" /> Discovery draw
          </span>
          <h2 className="mt-2 text-2xl font-black leading-tight tracking-tight text-[var(--find-text)] sm:text-3xl">Find something to fall for</h2>
          <p className="mt-1 max-w-md text-sm text-[var(--find-text-muted)]">Pick a mood, a genre, an era — then draw four mystery cards and flip them over.</p>
        </div>

        <span className="relative hidden flex-shrink-0 items-center gap-2 rounded-xl bg-nonsprimary px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(103,104,171,0.65)] transition-colors group-hover:bg-nonsprimaryfocus sm:inline-flex">
          Find something
          <IoArrowForward className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    </section>
  )
}

const SPARKS = [
  { top: '18%', left: '30%', size: 10, delay: '0s' },
  { top: '62%', left: '18%', size: 8, delay: '0.6s' },
  { top: '30%', left: '54%', size: 7, delay: '1.1s' },
  { top: '72%', left: '46%', size: 9, delay: '0.3s' },
  { top: '22%', left: '78%', size: 8, delay: '0.9s' },
]

const STAGE_META: Record<StageKey, { kicker: string; title: string }> = {
  type: { kicker: 'The medium', title: 'What are you after tonight?' },
  vibe: { kicker: 'The vibe', title: 'How should it feel?' },
  genre: { kicker: 'The genre', title: 'Anything in particular?' },
  era: { kicker: 'The era', title: 'From when?' },
}

// renders individual wizard stage content
function Stage({
  stageKey, stepIndex, sel, genreOptions, eraChips, onType, onMood, onGenre, onEra,
}: {
  stageKey: StageKey
  stepIndex: number
  sel: Selection
  genreOptions: { label: string; covers: string[] }[]
  eraChips: Era[]
  onType: (t: 'any' | MediaType) => void
  onMood: (k: string) => void
  onGenre: (g: string) => void
  onEra: (e: string) => void
}) {
  const meta = STAGE_META[stageKey]
  return (
    <div className="flex flex-col items-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-nonsprimaryfocus">
        {String(stepIndex + 1).padStart(2, '0')} · {meta.kicker}
      </p>
      <h3 className="mt-4 text-3xl font-black leading-tight tracking-tight text-[var(--find-text)] sm:text-5xl">
        {meta.title}
      </h3>

      {/* renders media type selection cards */}
      {stageKey === 'type' && (
        <div className="mt-10 flex flex-wrap items-start justify-center gap-x-7 gap-y-8 sm:mt-14 sm:gap-x-10">
          {TYPE_OPTS.map((o, i) => (
            <TypeCardOption key={o.key} icon={o.icon} label={o.label} tilt={(i - 1.5) * 5} active={sel.type === o.key} onClick={() => onType(o.key)} />
          ))}
        </div>
      )}

      {/* renders mood selection options */}
      {stageKey === 'vibe' && (
        <div className="mt-10 flex max-w-xl flex-wrap items-center justify-center gap-x-9 gap-y-6 sm:mt-12">
          {MOODS.map((m) => (
            <MoodOption key={m.key} mood={m} active={sel.moods.has(m.key)} onClick={() => onMood(m.key)} />
          ))}
        </div>
      )}

      {/* renders genre selection with fanned covers */}
      {stageKey === 'genre' && (
        <div className="mt-10 flex w-full flex-wrap items-start justify-center gap-x-4 gap-y-9 sm:mt-12 sm:gap-x-6">
          {genreOptions.map((g) => (
            <GenreOption key={g.label} label={g.label} covers={g.covers} active={sel.genres.has(g.label)} onClick={() => onGenre(g.label)} />
          ))}
        </div>
      )}

      {/* renders era selection timeline */}
      {stageKey === 'era' && (
        <div className="relative mt-12 w-full sm:mt-16">
          <span aria-hidden className="absolute inset-x-8 top-[5px] hidden h-px bg-gradient-to-r from-transparent via-white/20 to-transparent sm:block" />
          <div className="flex flex-wrap items-start justify-center gap-x-7 gap-y-8 sm:gap-x-9">
            {eraChips.map((e) => (
              <EraOption key={e.key} era={e} active={sel.era === e.key} onClick={() => onEra(e.key)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// renders miniature card option for type selection
function TypeCardOption({
  icon: Icon, label, tilt, active, onClick,
}: {
  icon: IconType
  label: string
  tilt: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className={`group flex flex-col items-center gap-3 active:scale-95 ${active ? 'is-active' : ''}`}>
      <span
        style={{ '--tilt': `${tilt}deg` } as React.CSSProperties}
        className={`tilt-card relative flex h-24 w-[4.25rem] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-nonsprimary via-nonsprimarydeep to-[#100d20] shadow-xl ${
          active ? 'ring-2 ring-nonsprimaryfocus shadow-[0_10px_30px_-8px_rgba(124,125,202,0.6)]' : ''
        }`}
      >
        <span aria-hidden className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 30% 22%, rgba(255,255,255,0.4), transparent 50%)' }} />
        <Icon className="relative h-6 w-6 text-white/85" />
      </span>
      <span className={`text-sm font-semibold transition-colors ${active ? 'text-nonsprimaryfocus' : 'text-[var(--find-text-muted)] group-hover:text-[var(--find-text)]'}`}>
        {label}
      </span>
    </button>
  )
}

// renders mood option with accent color bloom
function MoodOption({ mood, active, onClick }: { mood: Mood; active: boolean; onClick: () => void }) {
  const Icon = mood.icon
  return (
    <button
      onClick={onClick}
      className="group relative inline-flex items-center gap-2 pb-1.5 text-lg font-semibold transition-all duration-200 active:scale-95 sm:text-xl"
      style={active ? { color: mood.color } : undefined}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute -inset-x-5 -inset-y-3 rounded-full blur-xl transition-opacity duration-300 ${active ? 'opacity-25' : 'opacity-0 group-hover:opacity-20'}`}
        style={{ backgroundColor: mood.color }}
      />
      <Icon
        className="relative h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5"
        style={{ color: mood.color }}
      />
      <span className={`relative transition-colors ${active ? '' : 'text-[var(--find-text-muted)] group-hover:text-[var(--find-text)]'}`}>
        {mood.label}
      </span>
      <span
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-center rounded-full transition-transform duration-300 ${active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-[0.35]'}`}
        style={{ backgroundColor: mood.color }}
      />
    </button>
  )
}

// renders genre option with fanned covers or initial fallback
function GenreOption({
  label, covers, active, onClick,
}: {
  label: string
  covers: string[]
  active: boolean
  onClick: () => void
}) {
  const mid = (Math.max(covers.length, 1) - 1) / 2
  return (
    <button onClick={onClick} className={`group flex w-[5.5rem] flex-col items-center gap-2.5 active:scale-95 sm:w-24 ${active ? 'is-active' : ''}`}>
      <span className="relative flex h-16 w-full items-end justify-center">
        {covers.length > 0 ? (
          covers.map((c, i) => (
            <span
              key={c}
              style={{ '--rot': `${(i - mid) * 10}deg`, '--tx': `${(i - mid) * 16}px`, zIndex: i } as React.CSSProperties}
              className={`cover-fan-item absolute bottom-0 h-14 w-10 overflow-hidden rounded-md shadow-lg transition-opacity ${
                active ? 'opacity-100' : 'opacity-75 group-hover:opacity-100'
              }`}
            >
              <img src={c} alt="" loading="lazy" className="h-full w-full object-cover" />
            </span>
          ))
        ) : (
          <span className="flex h-14 w-10 items-center justify-center rounded-md bg-gradient-to-br from-nonsprimary to-nonsprimarydeep text-sm font-bold uppercase text-white/80 shadow-lg">
            {label.charAt(0)}
          </span>
        )}
      </span>
      <span className={`relative w-full truncate pb-1 text-sm font-semibold capitalize transition-colors ${active ? 'text-nonsprimaryfocus' : 'text-[var(--find-text-muted)] group-hover:text-[var(--find-text)]'}`}>
        {label}
        <span
          className={`pointer-events-none absolute inset-x-4 bottom-0 h-[2px] origin-center rounded-full bg-nonsprimaryfocus transition-transform duration-300 ${active ? 'scale-x-100' : 'scale-x-0'}`}
        />
      </span>
    </button>
  )
}

// renders era option dot on timeline
function EraOption({ era, active, onClick }: { era: Era; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex flex-col items-center gap-2.5 active:scale-95">
      <span
        className={`relative h-2.5 w-2.5 rounded-full transition-all duration-300 ${
          active
            ? 'scale-125 bg-nonsprimaryfocus shadow-[0_0_14px_3px_rgba(124,125,202,0.55)]'
            : 'bg-white/25 group-hover:scale-110 group-hover:bg-white/60'
        }`}
      />
      <span className="flex flex-col items-center">
        <span className={`text-base font-semibold transition-colors sm:text-lg ${active ? 'text-nonsprimaryfocus' : 'text-[var(--find-text-muted)] group-hover:text-[var(--find-text)]'}`}>
          {era.label}
        </span>
        <span className="mt-0.5 text-[10px] font-medium tracking-wide text-[var(--find-text-muted)]/60">{era.sub}</span>
      </span>
    </button>
  )
}

// renders dealt hand and manages transitions between hand and spread
function CardsTable({
  draw, flipped, revealOrder, onSelect, widened, t,
}: {
  draw: CatalogItem[]
  flipped: Set<number>
  revealOrder: number[]
  onSelect: (i: number) => void
  widened: boolean
  t: Translate
}) {
  if (draw.length === 0) return <EmptyState label="No matches for that combo. Try loosening it up." />

  // tracks cards waiting in hand
  const hand = draw.map((_, j) => j).filter((j) => !revealOrder.includes(j))
  const handMid = (hand.length - 1) / 2
  const count = revealOrder.length
  const centerMid = (count - 1) / 2
  
  // calculates scale based on spread size
  const centerScale = [1.08, 0.9, 0.76, 0.65][Math.min(count, 4) - 1] ?? 0.65
  
  // calculates responsive slot width for center cards
  const slot = `min(${(centerScale * 11 + 0.9).toFixed(2)}rem, 23vw)`
  const allCentered = count >= draw.length

  return (
    <div className="flex w-full max-w-3xl flex-col items-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-nonsprimaryfocus">Your draw</p>
      <h3 className="mt-3 text-2xl font-black tracking-tight text-[var(--find-text)] sm:text-3xl">
        {allCentered ? 'Your hand' : 'Pick a card'}
      </h3>
      <p className="mt-1.5 text-xs font-medium tracking-wide text-[var(--find-text-muted)]">
        {allCentered ? '✦ Tap a card to open it ✦' : `${flipped.size} / ${draw.length} revealed`}
      </p>
      {widened && (
        <p className="mt-1 text-xs text-[var(--find-text-muted)]/70">Slim pickings for that exact combo — widened the search a touch.</p>
      )}

      {/* renders growing spread and hand layout */}
      <div className="relative h-[22rem] w-full sm:h-[30rem]">
        {/* renders hint for first pick */}
        {count === 0 && (
          <div aria-hidden className="animate-glow-pulse absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[62%]">
            <IoSparklesOutline className="h-8 w-8 text-[var(--find-text-muted)]/40" />
          </div>
        )}

        {draw.map((it, i) => {
          const r = revealOrder.indexOf(i)
          const inCenter = r !== -1
          const h = hand.indexOf(i)
          
          // calculates position transform for hand or spread slot
          const transform = inCenter
            ? `translate(calc(-50% + (${r} - ${centerMid}) * ${slot}), -62%) rotate(${(r - centerMid) * 3}deg) scale(${centerScale})`
            : `translate(calc(-50% + ${(h - handMid) * 60}px), clamp(70px, 15vh, 135px)) rotate(${(h - handMid) * 6}deg) scale(0.55)`
          
          return (
            <div
              key={it.id}
              className="absolute left-1/2 top-1/2 w-40 transition-transform duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] sm:w-44"
              style={{ transform, zIndex: inCenter ? 20 + r : 10 + i }}
            >
              {/* wraps card in deal-in animation layer */}
              <div className="animate-deal" style={{ animationDelay: `${i * 110}ms` }}>
                <HandCard item={it} flipped={flipped.has(i)} active={inCenter} onSelect={() => onSelect(i)} t={t} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HandCard({
  item, flipped, active, onSelect, t,
}: {
  item: CatalogItem
  flipped: boolean
  active: boolean
  onSelect: () => void
  t: Translate
}) {
  const typeWord = item.type === 'book' ? t('book') : item.type === 'series' ? t('series') : t('film')
  const credit = item.type === 'book' ? item.author : item.director || item.author
  return (
    <div className="relative transition-transform duration-300 hover:-translate-y-1.5">
      {!flipped && (
        <div aria-hidden className="animate-glow-pulse pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-nonsprimary/25 blur-2xl" />
      )}
      <div className="flip-scene">
        <div className={`flip-inner aspect-[2/3] w-full ${flipped ? 'is-flipped' : ''}`}>
          {/* renders mystery front face */}
          <div className="flip-face flip-face--front flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-nonsprimary via-nonsprimarydeep to-[#100d20] shadow-2xl">
            <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-12 bg-white/15 blur-md animate-sheen" />
            <span aria-hidden className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 30% 22%, rgba(255,255,255,0.45), transparent 45%)' }} />
            <IoSparkles className="relative h-10 w-10 text-white/85 drop-shadow" />
            <span className="absolute bottom-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">nons</span>
          </div>

          {/* renders revealed back face */}
          <div className="flip-face flip-face--back overflow-hidden rounded-2xl bg-[var(--find-surface-active)] shadow-2xl">
            <div className="relative h-full w-full">
              {item.coverUrl ? (
                <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-3 text-center">
                  <span className="line-clamp-5 text-sm font-semibold text-[var(--find-text)]">{item.title}</span>
                </div>
              )}
              <TypeBadge type={item.type} position="right-2 top-2" size="h-6 w-6" iconSize="h-3 w-3" />
              {item.communityRating > 0 && (
                <span className="absolute left-2 top-2 flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  <IoStar className="h-2.5 w-2.5 text-nonsprimaryfocus" />
                  {item.communityRating.toFixed(1)}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-8 text-left">
                <p className="truncate text-sm font-bold text-white">{item.title}</p>
                <p className="truncate text-[11px] text-white/70">
                  {typeWord}{item.year ? ` · ${item.year}` : ''}{credit ? ` · ${credit}` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* renders interaction overlay based on card state */}
      {!active ? (
        <button onClick={onSelect} aria-label={`Pick card`} className="absolute inset-0 z-20 rounded-2xl" />
      ) : flipped ? (
        <Link to={mediaPath(item)} aria-label={`Open ${item.title}`} className="absolute inset-0 z-20 rounded-2xl" />
      ) : null}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center">
      <IoSparklesOutline className="h-10 w-10 text-[var(--find-text-muted)]" />
      <p className="text-sm text-[var(--find-text-muted)]">{label}</p>
    </div>
  )
}

function LoadingDeck() {
  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <div className="relative h-32 w-24">
        {[0, 1, 2, 3].map((n) => (
          <span
            key={n}
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-nonsprimary to-nonsprimarydeep shadow-lg animate-glow-pulse"
            style={{ transform: `rotate(${(n - 1.5) * 6}deg) translateY(${n * -2}px)`, animationDelay: `${n * 0.15}s` }}
          />
        ))}
      </div>
      <p className="text-sm text-[var(--find-text-muted)]">Shuffling the deck…</p>
    </div>
  )
}