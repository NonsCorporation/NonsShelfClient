'use client'

import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@/lib/router'
import {
  IoSparkles, IoSparklesOutline, IoClose, IoArrowForward, IoArrowBack, IoReloadOutline,
  IoDiceOutline, IoEyeOutline, IoOptionsOutline, IoStar, IoPlayForwardOutline,
  IoAppsOutline, IoBookOutline, IoFilmOutline, IoTvOutline,
  IoCafeOutline, IoFlashOutline, IoPlanetOutline, IoHeartOutline, IoMoonOutline,
  IoTrophyOutline, IoHappyOutline, IoInfiniteOutline, IoHourglassOutline, IoCalendarOutline,
} from 'react-icons/io5'
import type { CatalogItem } from '../services/catalogService'
import { discoverService } from '../services/discoverService'
import type { MediaType } from '../types'
import { mediaPath } from '../lib/paths'
import TypeBadge from './TypeBadge'

type Translate = (k: string, v?: Record<string, string | number>) => string
type IconType = typeof IoSparkles

// ── Vibes → genre keywords ─────────────────────────────────────────────────
// Catalog genres are free-form strings from OpenLibrary/TMDB, so each mood
// matches by case-insensitive substring against any of a title's genres.
type Mood = { key: string; label: string; icon: IconType; keywords: string[] }
const MOODS: Mood[] = [
  { key: 'cozy', label: 'Cozy', icon: IoCafeOutline, keywords: ['romance', 'comedy', 'slice of life', 'family', 'feel-good', 'friendship', 'contemporary'] },
  { key: 'thrilling', label: 'Thrilling', icon: IoFlashOutline, keywords: ['thriller', 'action', 'crime', 'suspense', 'mystery', 'adventure', 'spy'] },
  { key: 'mindbending', label: 'Mind-bending', icon: IoPlanetOutline, keywords: ['science fiction', 'sci-fi', 'psychological', 'dystopia', 'mystery', 'speculative'] },
  { key: 'heartfelt', label: 'Heart-wrenching', icon: IoHeartOutline, keywords: ['drama', 'tragedy', 'romance', 'historical', 'coming of age'] },
  { key: 'whimsical', label: 'Whimsical', icon: IoSparklesOutline, keywords: ['fantasy', 'animation', 'adventure', 'magic', 'fairy', 'myth'] },
  { key: 'dark', label: 'Dark', icon: IoMoonOutline, keywords: ['horror', 'thriller', 'crime', 'noir', 'gothic', 'dark', 'war'] },
  { key: 'epic', label: 'Epic', icon: IoTrophyOutline, keywords: ['fantasy', 'adventure', 'epic', 'historical', 'war', 'science fiction'] },
  { key: 'funny', label: 'Funny', icon: IoHappyOutline, keywords: ['comedy', 'humor', 'satire', 'parody'] },
]

// ── Eras (single-select) ────────────────────────────────────────────────────
type Era = { key: string; label: string; icon: IconType; test: (y: number) => boolean }
const ERAS: Era[] = [
  { key: 'any', label: 'Any era', icon: IoInfiniteOutline, test: () => true },
  { key: 'classic', label: 'Classic', icon: IoHourglassOutline, test: (y) => y > 0 && y < 1980 },
  { key: '80s', label: '80s', icon: IoCalendarOutline, test: (y) => y >= 1980 && y <= 1989 },
  { key: '90s', label: '90s', icon: IoCalendarOutline, test: (y) => y >= 1990 && y <= 1999 },
  { key: '00s', label: '2000s', icon: IoCalendarOutline, test: (y) => y >= 2000 && y <= 2009 },
  { key: '10s', label: '2010s', icon: IoCalendarOutline, test: (y) => y >= 2010 && y <= 2019 },
  { key: 'now', label: 'Right now', icon: IoFlashOutline, test: (y) => y >= 2020 },
]

const TYPE_OPTS: { key: 'any' | MediaType; label: string; icon: IconType }[] = [
  { key: 'any', label: 'Anything', icon: IoAppsOutline },
  { key: 'book', label: 'Books', icon: IoBookOutline },
  { key: 'movie', label: 'Films', icon: IoFilmOutline },
  { key: 'series', label: 'Series', icon: IoTvOutline },
]

// How many cards are dealt per draw.
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

// Draws a hand for the selection. Filters run in tiers from strictest to
// loosest (drop era → moods → genres → type → anything) so we (almost) always
// deal a full hand; `widened` flags that we had to loosen past the exact ask.
// `exclude` deprioritizes the previous draw so "Deal again" feels fresh.
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

// ─────────────────────────────────────────────────────────────────────────────

export default function FindSomething({ t }: { t: Translate }) {
  const [open, setOpen] = useState(false)
  const [pool, setPool] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const loadedRef = useRef(false)

  const [sel, setSel] = useState<Selection>(freshSelection)
  const [view, setView] = useState<'wizard' | 'cards'>('wizard')
  const [step, setStep] = useState(0)
  const [draw, setDraw] = useState<CatalogItem[]>([])
  const [widened, setWidened] = useState(false)
  const [flipped, setFlipped] = useState<Set<number>>(new Set())
  const lastDrawRef = useRef<Set<string>>(new Set())

  // Lazily pull a broad, multi-type, genre-tagged pool the first time the
  // experience opens — independent of the page's own type filter.
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

  const genreChips = useMemo(() => {
    const count = new Map<string, { label: string; n: number }>()
    for (const it of pool) {
      for (const g of it.genre ?? []) {
        const key = norm(g)
        if (!key) continue
        const cur = count.get(key)
        if (cur) cur.n++
        else count.set(key, { label: g, n: 1 })
      }
    }
    return [...count.values()].sort((a, b) => b.n - a.n).slice(0, 12).map((x) => x.label)
  }, [pool])

  const eraChips = useMemo(
    () => ERAS.filter((e) => e.key === 'any' || pool.some((it) => e.test(it.year ?? 0))),
    [pool],
  )

  // The stages that actually apply, in order. Genre/era only appear when the
  // pool can populate them.
  const stages = useMemo<StageKey[]>(() => {
    const s: StageKey[] = ['type', 'vibe']
    if (genreChips.length > 0) s.push('genre')
    if (eraChips.length > 1) s.push('era')
    return s
  }, [genreChips, eraChips])

  const openModal = () => { setOpen(true); setView('wizard'); setStep(0) }
  const close = () => setOpen(false)

  const deal = (selection: Selection) => {
    const { items, widened: w } = drawHand(pool, selection, lastDrawRef.current)
    lastDrawRef.current = new Set(items.map((i) => i.id))
    setDraw(items)
    setWidened(w)
    setFlipped(new Set())
    setView('cards')
  }

  // Advance to the next stage, or deal when we've passed the last one.
  const advance = (next: Selection) => {
    setSel(next)
    if (step >= stages.length - 1) deal(next)
    else setStep((s) => s + 1)
  }
  const back = () => setStep((s) => Math.max(0, s - 1))
  const skip = () => { if (step >= stages.length - 1) deal(sel); else setStep((s) => s + 1) }

  const surprise = () => { const f = freshSelection(); setSel(f); deal(f) }

  const flip = (i: number) => setFlipped((prev) => (prev.has(i) ? prev : new Set(prev).add(i)))
  const revealAll = () => setFlipped(new Set(draw.map((_, i) => i)))
  const allRevealed = draw.length > 0 && flipped.size >= draw.length

  const stageKey = stages[Math.min(step, stages.length - 1)]

  return (
    <>
      <FindBanner onOpen={openModal} />

      {open && createPortal(
        // Full-screen takeover — the draw is a scene, not a dialog box.
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
          <div className="animate-fade-up absolute inset-0 flex flex-col bg-[var(--find-bg)]">
            {/* Ambient staging: drifting glow, floor vignette, one light sweep on open. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="animate-aurora absolute -top-1/4 left-1/3 h-[55vh] w-[55vh] rounded-full bg-nonsprimary/12 blur-3xl" />
              <div className="animate-glow-pulse absolute -bottom-1/4 right-1/4 h-[45vh] w-[45vh] rounded-full bg-nonsprimaryfocus/8 blur-3xl" />
              <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 100% at 50% 0%, transparent 45%, rgba(0,0,0,0.5) 100%)' }} />
              <span className="animate-sheen-once absolute inset-y-0 -left-1/2 w-1/3 skew-x-12 bg-white/[0.06] blur-2xl" />
            </div>

            {/* Chrome: brand whisper + close. Nothing else. */}
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

            {/* Stage — everything centered, typography leads. */}
            <div className="relative flex-1 overflow-y-auto">
              <div className="flex min-h-full flex-col items-center justify-center px-6 py-10 text-center">
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
                        genreChips={genreChips}
                        eraChips={eraChips}
                        onType={(type) => advance({ ...sel, type })}
                        onMood={(k) => advance({ ...sel, moods: new Set([k]) })}
                        onGenre={(g) => advance({ ...sel, genres: new Set([g]) })}
                        onEra={(e) => advance({ ...sel, era: e })}
                      />
                    </div>
                  )
                ) : (
                  <CardsTable draw={draw} flipped={flipped} onFlip={flip} widened={widened} allRevealed={allRevealed} t={t} />
                )}
              </div>
            </div>

            {/* Quiet bottom bar: back · progress · skip (or the deal controls). */}
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

                    {/* Progress dots — the only persistent trace of the steps. */}
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

// ── Entry banner on the Discover page ────────────────────────────────────────
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

// ── One wizard stage ─────────────────────────────────────────────────────────
const STAGE_META: Record<StageKey, { kicker: string; title: string }> = {
  type: { kicker: 'The medium', title: 'What are you after tonight?' },
  vibe: { kicker: 'The vibe', title: 'How should it feel?' },
  genre: { kicker: 'The genre', title: 'Anything in particular?' },
  era: { kicker: 'The era', title: 'From when?' },
}

function Stage({
  stageKey, stepIndex, sel, genreChips, eraChips, onType, onMood, onGenre, onEra,
}: {
  stageKey: StageKey
  stepIndex: number
  sel: Selection
  genreChips: string[]
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

      <div className="mt-10 flex max-w-xl flex-wrap items-center justify-center gap-x-8 gap-y-5 sm:mt-12">
        {stageKey === 'type' && TYPE_OPTS.map((o) => (
          <Option key={o.key} icon={o.icon} label={o.label} active={sel.type === o.key} onClick={() => onType(o.key)} />
        ))}
        {stageKey === 'vibe' && MOODS.map((m) => (
          <Option key={m.key} icon={m.icon} label={m.label} active={sel.moods.has(m.key)} onClick={() => onMood(m.key)} />
        ))}
        {stageKey === 'genre' && genreChips.map((g) => (
          <Option key={g} label={g} capitalize active={sel.genres.has(g)} onClick={() => onGenre(g)} />
        ))}
        {stageKey === 'era' && eraChips.map((e) => (
          <Option key={e.key} icon={e.icon} label={e.label} active={sel.era === e.key} onClick={() => onEra(e.key)} />
        ))}
      </div>
    </div>
  )
}

// The single control language of the wizard: a bare, generously sized text
// option — muted by default, white on hover, primary with an underline stroke
// when chosen. No boxes, no borders, no backgrounds.
function Option({
  label, icon: Icon, active, capitalize, onClick,
}: {
  label: string
  icon?: IconType
  active: boolean
  capitalize?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative inline-flex items-center gap-2 pb-1.5 text-lg font-semibold transition-all duration-200 active:scale-95 sm:text-xl ${
        capitalize ? 'capitalize' : ''
      } ${active ? 'text-nonsprimaryfocus' : 'text-[var(--find-text-muted)] hover:text-[var(--find-text)]'}`}
    >
      {Icon && <Icon className="h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5" />}
      {label}
      <span
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-center rounded-full bg-nonsprimaryfocus transition-transform duration-300 ${
          active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-[0.35]'
        }`}
      />
    </button>
  )
}

// ── The dealt hand — fanned like real cards held from below ──────────────────
function CardsTable({
  draw, flipped, onFlip, widened, allRevealed, t,
}: {
  draw: CatalogItem[]
  flipped: Set<number>
  onFlip: (i: number) => void
  widened: boolean
  allRevealed: boolean
  t: Translate
}) {
  if (draw.length === 0) return <EmptyState label="No matches for that combo. Try loosening it up." />
  const mid = (draw.length - 1) / 2
  return (
    <div className="flex w-full max-w-4xl flex-col items-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-nonsprimaryfocus">Your draw</p>
      <h3 className="mt-4 text-2xl font-black tracking-tight text-[var(--find-text)] sm:text-4xl">
        {allRevealed ? 'Your hand' : 'Tap a card to reveal it'}
      </h3>
      {widened && (
        <p className="mt-2 text-xs text-[var(--find-text-muted)]">Slim pickings for that exact combo — widened the search a touch.</p>
      )}

      <div className="mt-10 flex flex-wrap items-start justify-center gap-4 sm:mt-14 sm:gap-0">
        {draw.map((it, i) => {
          const off = i - mid
          return (
            <div
              key={it.id}
              className="relative sm:-mx-3"
              style={{ transform: `rotate(${off * 5}deg) translateY(${Math.abs(off) * Math.abs(off) * 11}px)`, zIndex: i }}
            >
              <MysteryCard item={it} index={i} isFlipped={flipped.has(i)} onFlip={() => onFlip(i)} t={t} />
            </div>
          )
        })}
      </div>

      <p className="mt-12 h-5 text-xs font-medium tracking-wide text-[var(--find-text-muted)] sm:mt-16">
        {allRevealed ? '✦ Tap a title to open it ✦' : `${flipped.size} / ${draw.length} revealed`}
      </p>
    </div>
  )
}

function MysteryCard({
  item, index, isFlipped, onFlip, t,
}: {
  item: CatalogItem
  index: number
  isFlipped: boolean
  onFlip: () => void
  t: Translate
}) {
  const typeWord = item.type === 'book' ? t('book') : item.type === 'series' ? t('series') : t('film')
  const credit = item.type === 'book' ? item.author : item.director || item.author
  return (
    // The deal-in animation lives on this wrapper (its keyframes end at
    // identity, so the fan rotation on the parent survives); a soft glow sits
    // behind the card only while it's still face-down.
    <div className="animate-deal relative w-[38vw] max-w-[10.5rem] flex-shrink-0 sm:w-44" style={{ animationDelay: `${index * 110}ms` }}>
      {!isFlipped && (
        <div aria-hidden className="animate-glow-pulse pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-nonsprimary/25 blur-2xl" />
      )}
      <div className="flip-scene transition-transform duration-300 hover:-translate-y-2">
        <div className={`flip-inner aspect-[2/3] w-full ${isFlipped ? 'is-flipped' : ''}`}>
          {/* Mystery face (front, shown first) */}
          <button
            onClick={onFlip}
            aria-label="Reveal card"
            className="flip-face flip-face--front group flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-nonsprimary via-nonsprimarydeep to-[#100d20] shadow-2xl"
          >
            <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-12 bg-white/15 blur-md animate-sheen" />
            <span aria-hidden className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 30% 22%, rgba(255,255,255,0.45), transparent 45%)' }} />
            <IoSparkles className="relative h-10 w-10 text-white/85 drop-shadow" />
            <span className="absolute bottom-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">nons</span>
          </button>

          {/* Revealed face (back) */}
          <Link
            to={mediaPath(item)}
            className="flip-face flip-face--back block h-full w-full overflow-hidden rounded-2xl bg-[var(--find-surface-active)] shadow-2xl"
          >
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
          </Link>
        </div>
      </div>
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
