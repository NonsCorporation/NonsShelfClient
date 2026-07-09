'use client'

import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@/lib/router'
import {
  IoSparkles, IoSparklesOutline, IoClose, IoArrowForward, IoArrowBack, IoReloadOutline,
  IoDiceOutline, IoEyeOutline, IoOptionsOutline, IoStar, IoPlayForwardOutline,
} from 'react-icons/io5'
import type { CatalogItem } from '../services/catalogService'
import { discoverService } from '../services/discoverService'
import type { MediaType } from '../types'
import { mediaPath } from '../lib/paths'
import TypeBadge from './TypeBadge'

type Translate = (k: string, v?: Record<string, string | number>) => string

// ── Vibes → genre keywords ─────────────────────────────────────────────────
// Catalog genres are free-form strings from OpenLibrary/TMDB, so each mood
// matches by case-insensitive substring against any of a title's genres.
type Mood = { key: string; label: string; emoji: string; keywords: string[] }
const MOODS: Mood[] = [
  { key: 'cozy', label: 'Cozy', emoji: '🧸', keywords: ['romance', 'comedy', 'slice of life', 'family', 'feel-good', 'friendship', 'contemporary'] },
  { key: 'thrilling', label: 'Thrilling', emoji: '⚡', keywords: ['thriller', 'action', 'crime', 'suspense', 'mystery', 'adventure', 'spy'] },
  { key: 'mindbending', label: 'Mind-bending', emoji: '🌀', keywords: ['science fiction', 'sci-fi', 'psychological', 'dystopia', 'mystery', 'speculative'] },
  { key: 'heartfelt', label: 'Heart-wrenching', emoji: '💔', keywords: ['drama', 'tragedy', 'romance', 'historical', 'coming of age'] },
  { key: 'whimsical', label: 'Whimsical', emoji: '✨', keywords: ['fantasy', 'animation', 'adventure', 'magic', 'fairy', 'myth'] },
  { key: 'dark', label: 'Dark', emoji: '🌑', keywords: ['horror', 'thriller', 'crime', 'noir', 'gothic', 'dark', 'war'] },
  { key: 'epic', label: 'Epic', emoji: '🐉', keywords: ['fantasy', 'adventure', 'epic', 'historical', 'war', 'science fiction'] },
  { key: 'funny', label: 'Funny', emoji: '😄', keywords: ['comedy', 'humor', 'satire', 'parody'] },
]

// ── Eras (single-select) ────────────────────────────────────────────────────
type Era = { key: string; label: string; emoji: string; test: (y: number) => boolean }
const ERAS: Era[] = [
  { key: 'any', label: 'Any era', emoji: '♾️', test: () => true },
  { key: 'classic', label: 'Classic', emoji: '🎞️', test: (y) => y > 0 && y < 1980 },
  { key: '80s', label: '80s', emoji: '📼', test: (y) => y >= 1980 && y <= 1989 },
  { key: '90s', label: '90s', emoji: '💿', test: (y) => y >= 1990 && y <= 1999 },
  { key: '00s', label: '2000s', emoji: '📀', test: (y) => y >= 2000 && y <= 2009 },
  { key: '10s', label: '2010s', emoji: '📱', test: (y) => y >= 2010 && y <= 2019 },
  { key: 'now', label: 'Right now', emoji: '🔥', test: (y) => y >= 2020 },
]

const TYPE_OPTS: { key: 'any' | MediaType; label: string; emoji: string }[] = [
  { key: 'any', label: 'Anything', emoji: '🎲' },
  { key: 'book', label: 'Books', emoji: '📚' },
  { key: 'movie', label: 'Films', emoji: '🎬' },
  { key: 'series', label: 'Series', emoji: '📺' },
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
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm" onClick={close} />

          <div className="animate-slide-up sm:animate-fade-up relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--container)] shadow-2xl sm:max-h-[88vh] sm:rounded-3xl">
            {/* Ambient drifting glow */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="animate-aurora absolute -top-1/3 left-1/4 h-[420px] w-[420px] rounded-full bg-nonsprimary/20 blur-3xl" />
              <div className="animate-glow-pulse absolute -bottom-1/4 right-0 h-[320px] w-[320px] rounded-full bg-nonsprimaryfocus/10 blur-3xl" />
            </div>

            {/* Header */}
            <div className="relative flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-nonsprimaryfocus">
                  <IoSparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-[var(--text)]">Find something</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {view === 'wizard' ? 'Answer a few, draw four' : 'Tap a card to reveal it'}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                aria-label={t('cancel') || 'Close'}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                <IoClose className="h-5 w-5" />
              </button>
            </div>

            {/* Progress bar (wizard only) */}
            {view === 'wizard' && !loading && pool.length > 0 && (
              <div className="relative flex gap-1.5 px-5 pt-4">
                {stages.map((sk, i) => (
                  <span
                    key={sk}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-nonsprimary' : 'bg-[var(--surface-active)]'}`}
                  />
                ))}
              </div>
            )}

            {/* Body */}
            <div className="relative flex-1 overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              {loading ? (
                <LoadingDeck />
              ) : view === 'wizard' ? (
                pool.length === 0 ? (
                  <EmptyState label="Nothing to draw from yet — check back once the catalog fills up." />
                ) : (
                  <div key={step} className="animate-stage-in">
                    <Stage
                      stageKey={stageKey}
                      stepIndex={step}
                      total={stages.length}
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

            {/* Footer */}
            {!loading && pool.length > 0 && (
              <div className="relative flex items-center gap-2 border-t border-[var(--border-subtle)] px-5 py-3.5">
                {view === 'wizard' ? (
                  <>
                    {step > 0 ? (
                      <button onClick={back} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]">
                        <IoArrowBack className="h-4 w-4" /> Back
                      </button>
                    ) : (
                      <button onClick={surprise} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]">
                        <IoDiceOutline className="h-4 w-4" /> Surprise me
                      </button>
                    )}
                    {/* Type is required (has an "Anything" option); the rest are skippable. */}
                    {stageKey !== 'type' && (
                      <button onClick={skip} className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
                        {step >= stages.length - 1 ? 'Skip & deal' : 'Skip'}
                        <IoPlayForwardOutline className="h-4 w-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={() => { setView('wizard'); setStep(0) }} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]">
                      <IoOptionsOutline className="h-4 w-4" /> Adjust
                    </button>
                    {!allRevealed && (
                      <button onClick={revealAll} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]">
                        <IoEyeOutline className="h-4 w-4" /> Reveal all
                      </button>
                    )}
                    <button onClick={() => deal(sel)} className="ml-auto inline-flex h-11 items-center gap-2 rounded-xl bg-nonsprimary px-6 text-sm font-semibold text-white shadow-lg shadow-nonsprimary/25 transition-colors hover:bg-nonsprimaryfocus">
                      <IoReloadOutline className="h-4 w-4" /> Deal again
                    </button>
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
        className="group relative flex w-full items-center gap-4 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--primary-soft)] via-[var(--container)] to-[var(--container-2)] p-5 text-left transition-transform hover:-translate-y-0.5 sm:gap-6 sm:p-7"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-aurora absolute -left-16 -top-20 h-64 w-64 rounded-full bg-nonsprimary/25 blur-3xl" />
          <div className="animate-glow-pulse absolute -bottom-24 right-10 h-56 w-56 rounded-full bg-nonsprimaryfocus/20 blur-3xl" />
          {SPARKS.map((s, i) => (
            <IoSparkles key={i} className="animate-twinkle absolute text-nonsprimaryfocus/70" style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: s.delay }} />
          ))}
        </div>

        <div className="relative hidden h-20 w-24 flex-shrink-0 items-center justify-center sm:flex">
          {[-1, 0, 1].map((n) => (
            <span key={n} style={{ transform: `rotate(${n * 12}deg) translateX(${n * 16}px) translateY(${Math.abs(n) * 4}px)` }} className="absolute flex h-20 w-14 items-center justify-center rounded-xl border border-white/15 bg-gradient-to-br from-nonsprimary/80 to-nonsprimarydeep shadow-xl">
              <IoSparklesOutline className="h-5 w-5 text-white/70" />
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-nonsprimaryfocus">
            <IoSparkles className="h-3 w-3" /> Discovery draw
          </span>
          <h2 className="mt-2 text-2xl font-black leading-tight tracking-tight text-[var(--text)] sm:text-3xl">Find something to fall for</h2>
          <p className="mt-1 max-w-md text-sm text-[var(--text-muted)]">Pick a mood, a genre, an era — then draw four mystery cards and flip them over.</p>
        </div>

        <span className="relative hidden flex-shrink-0 items-center gap-2 rounded-xl bg-nonsprimary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-nonsprimary/25 transition-colors group-hover:bg-nonsprimaryfocus sm:inline-flex">
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
const STAGE_META: Record<StageKey, { title: string; subtitle: string }> = {
  type: { title: 'What are you after?', subtitle: "Scope the draw, or leave it wide open." },
  vibe: { title: "What's the vibe?", subtitle: 'Pick a feeling — we match it to genres.' },
  genre: { title: 'Any genre in mind?', subtitle: 'Narrow it down, or skip.' },
  era: { title: 'From which era?', subtitle: 'Old classics or fresh releases.' },
}

function Stage({
  stageKey, stepIndex, total, sel, genreChips, eraChips, onType, onMood, onGenre, onEra,
}: {
  stageKey: StageKey
  stepIndex: number
  total: number
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
    <div className="flex flex-col">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-nonsprimaryfocus">Step {stepIndex + 1} of {total}</p>
      <h3 className="mt-1 text-xl font-bold tracking-tight text-[var(--text)]">{meta.title}</h3>
      <p className="mb-5 mt-0.5 text-sm text-[var(--text-muted)]">{meta.subtitle}</p>

      {stageKey === 'type' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TYPE_OPTS.map((o) => (
            <Tile key={o.key} emoji={o.emoji} label={o.label} active={sel.type === o.key} onClick={() => onType(o.key)} />
          ))}
        </div>
      )}

      {stageKey === 'vibe' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MOODS.map((m) => (
            <Tile key={m.key} emoji={m.emoji} label={m.label} active={sel.moods.has(m.key)} onClick={() => onMood(m.key)} />
          ))}
        </div>
      )}

      {stageKey === 'genre' && (
        <div className="flex flex-wrap gap-2.5">
          {genreChips.map((g) => (
            <button
              key={g}
              onClick={() => onGenre(g)}
              className={`rounded-full border px-4 py-2.5 text-sm font-medium capitalize transition-all active:scale-95 ${
                sel.genres.has(g)
                  ? 'border-transparent bg-nonsprimary text-white shadow-md shadow-nonsprimary/30'
                  : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text)]'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {stageKey === 'era' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {eraChips.map((e) => (
            <Tile key={e.key} emoji={e.emoji} label={e.label} active={sel.era === e.key} onClick={() => onEra(e.key)} />
          ))}
        </div>
      )}
    </div>
  )
}

function Tile({ emoji, label, active, onClick }: { emoji: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all active:scale-95 ${
        active
          ? 'border-transparent bg-nonsprimary text-white shadow-lg shadow-nonsprimary/30'
          : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text)] hover:-translate-y-0.5 hover:border-[var(--border)]'
      }`}
    >
      <span className="text-2xl leading-none transition-transform group-hover:scale-110">{emoji}</span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  )
}

// ── The dealt hand ───────────────────────────────────────────────────────────
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
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-5">
      {widened && <p className="text-xs text-[var(--text-muted)]">Slim pickings for that exact combo — widened the search a touch.</p>}
      <div className="flex flex-wrap items-stretch justify-center gap-3 sm:gap-4">
        {draw.map((it, i) => (
          <MysteryCard key={it.id} item={it} index={i} isFlipped={flipped.has(i)} onFlip={() => onFlip(i)} t={t} />
        ))}
      </div>
      <p className="h-5 text-center text-xs font-medium text-[var(--text-muted)]">
        {allRevealed ? '✦ Your hand — tap a title to open it ✦' : `Tap to reveal · ${flipped.size}/${draw.length}`}
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
    // Outer wrapper owns the deal-in animation; the inner .flip-scene keeps a
    // clean perspective so the 3D flip renders correctly.
    <div className="animate-deal w-[30vw] max-w-[9rem] flex-shrink-0 sm:w-36" style={{ animationDelay: `${index * 95}ms` }}>
      <div className="flip-scene">
        <div className={`flip-inner aspect-[2/3] w-full ${isFlipped ? 'is-flipped' : ''}`}>
          {/* Mystery face (front, shown first) */}
          <button
            onClick={onFlip}
            aria-label="Reveal card"
            className="flip-face flip-face--front group flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-nonsprimary via-nonsprimarydeep to-[#241f42] shadow-xl transition-transform hover:scale-[1.03]"
          >
            <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-12 bg-white/15 blur-md animate-sheen" />
            <span aria-hidden className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 30% 22%, rgba(255,255,255,0.45), transparent 45%)' }} />
            <IoSparkles className="relative h-9 w-9 text-white/85 drop-shadow" />
            <span className="absolute bottom-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">nons</span>
          </button>

          {/* Revealed face (back) */}
          <Link
            to={mediaPath(item)}
            className="flip-face flip-face--back block h-full w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--container-2)] shadow-xl"
          >
            <div className="relative h-full w-full">
              {item.coverUrl ? (
                <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-3 text-center">
                  <span className="line-clamp-5 text-sm font-semibold text-[var(--text)]">{item.title}</span>
                </div>
              )}
              <TypeBadge type={item.type} position="right-2 top-2" size="h-6 w-6" iconSize="h-3 w-3" />
              {item.communityRating > 0 && (
                <span className="absolute left-2 top-2 flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  <IoStar className="h-2.5 w-2.5 text-nonsprimaryfocus" />
                  {item.communityRating.toFixed(1)}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-2.5 pt-7">
                <p className="truncate text-xs font-bold text-white">{item.title}</p>
                <p className="truncate text-[10px] text-white/70">
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
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <IoSparklesOutline className="h-10 w-10 text-[var(--text-muted)]" />
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  )
}

function LoadingDeck() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-5">
      <div className="relative h-28 w-20">
        {[0, 1, 2, 3].map((n) => (
          <span
            key={n}
            className="absolute inset-0 rounded-2xl border border-white/15 bg-gradient-to-br from-nonsprimary to-nonsprimarydeep shadow-lg animate-glow-pulse"
            style={{ transform: `rotate(${(n - 1.5) * 6}deg) translateY(${n * -2}px)`, animationDelay: `${n * 0.15}s` }}
          />
        ))}
      </div>
      <p className="text-sm text-[var(--text-muted)]">Shuffling the deck…</p>
    </div>
  )
}
