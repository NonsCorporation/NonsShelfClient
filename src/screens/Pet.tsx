'use client'

import { useEffect, useRef, useState } from 'react'
import { IoBookOutline, IoFilmOutline, IoPencilOutline, IoCheckmark, IoPawOutline, IoRefresh } from 'react-icons/io5'
import Layout from '../components/layout/Layout'
import PetSprite from '../components/pet/PetSprite'
import PetScene from '../components/pet/PetScene'
import ConfirmModal from '../components/ui/ConfirmModal'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { isLibrarian } from '../services/librarianService'
import { PET_BREEDS, PET_COLOR_COUNT, PET_FOODS, PET_NAME_MAX, PET_SCENES, petLookFor, stageProgress, usePet, type PetFood, type PetFoodKind } from '../lib/pet'

const PIXEL = { fontFamily: "'Press Start 2P', ui-monospace, monospace" } as const
const FRAME = 'border-2 border-[var(--border-strong)] shadow-[4px_4px_0_0_var(--border)]'

const STAGE_KEY = {
  egg: 'petStageEgg',
  hatchling: 'petStageHatchling',
  bookworm: 'petStageBookworm',
  sage: 'petStageSage',
} as const

const MOOD_KEY = {
  happy: 'petMoodHappy',
  content: 'petMoodContent',
  hungry: 'petMoodHungry',
  starving: 'petMoodStarving',
} as const

export default function Pet() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const { pet, now, ready, rename, feed, reset, addXp, evolve, setFullness, setScene } = usePet()

  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [eating, setEating] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const eatTimer = useRef<number | undefined>(undefined)

  // Breed and colour come from the account id; `lookShift` is a mock-only preview that isn't saved.
  const [lookShift, setLookShift] = useState(0)
  const baseLook = petLookFor(user?.uuid || user?.id || 'guest')
  const look = {
    breed: PET_BREEDS[(PET_BREEDS.indexOf(baseLook.breed) + lookShift) % PET_BREEDS.length],
    color: (baseLook.color + Math.floor(lookShift / PET_BREEDS.length) * 3 + lookShift) % PET_COLOR_COUNT,
  }

  useEffect(() => () => window.clearTimeout(eatTimer.current), [])

  // Librarians only for now (the pet is still a client-side mock).
  if (!isLibrarian(user?.role)) {
    return (
      <Layout>
        <p className="py-24 text-center text-sm text-[var(--text-muted)]">{t('notAuthorized')}</p>
      </Layout>
    )
  }

  if (!ready) {
    return (
      <Layout>
        <div className="mx-auto max-w-xl" />
      </Layout>
    )
  }

  const name = pet.hasName ? pet.name : t('pet')
  const progress = stageProgress(pet.xp)
  const days = Math.max(1, Math.ceil((now - pet.adoptedAt) / 86_400_000))

  const submitName = () => {
    const v = draft.trim()
    if (!v) return
    rename(v)
    setEditing(false)
  }

  const onFeed = (food: PetFood) => {
    const ok = feed(food)
    setMessage(ok ? { text: t('petYum', { name }), ok: true } : { text: t('petFull', { name }), ok: false })
    if (ok) {
      setEating(true)
      window.clearTimeout(eatTimer.current)
      eatTimer.current = window.setTimeout(() => setEating(false), 1100)
    }
  }

  return (
    <Layout>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');`}</style>
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <h1 style={PIXEL} className="text-base leading-snug text-[var(--text)]">{t('petTitle')}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{t('petSubtitle')}</p>
        </div>

        {/* Pet stage */}
        <section className={`relative overflow-hidden bg-[var(--surface)] p-5 ${FRAME}`}>
          <div className="relative -mx-5 -mt-5 mb-4 h-80 overflow-hidden border-b-2 border-[var(--border-strong)]">
            <PetScene scene={pet.scene} className="absolute inset-0 h-full w-full" />
            <PetSprite
              stage={pet.stage}
              mood={pet.mood}
              look={look}
              eating={eating}
              className="absolute bottom-[5%] left-1/2 h-64 w-64 -translate-x-1/2 text-black"
            />
          </div>
          <div className="relative flex flex-col items-center">

            {!pet.hasName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  submitName()
                }}
                className="mt-2 w-full max-w-xs text-center"
              >
                <h2 style={PIXEL} className="text-xs leading-relaxed text-[var(--text)]">{t('petAdoptTitle')}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{t('petAdoptText')}</p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={PET_NAME_MAX}
                    placeholder={t('petNamePlaceholder')}
                    aria-label={t('petNamePlaceholder')}
                    className="h-10 min-w-0 flex-1 border-2 border-[var(--border-strong)] bg-[var(--input)] px-4 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="bg-nonsprimary px-4 text-sm font-medium text-white shadow-[2px_2px_0_0_var(--color-nonsprimarydeep)] transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {t('petAdopt')}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="mt-1 flex items-center gap-2">
                  {editing ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        submitName()
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
                        maxLength={PET_NAME_MAX}
                        aria-label={t('petNamePlaceholder')}
                        className="h-9 w-44 border-2 border-[var(--border-strong)] bg-[var(--input)] px-4 text-center text-sm text-[var(--text)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                      />
                      <button
                        type="submit"
                        aria-label={t('petSave')}
                        disabled={!draft.trim()}
                        className="flex h-9 w-9 items-center justify-center bg-nonsprimary text-white shadow-[2px_2px_0_0_var(--color-nonsprimarydeep)] transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        <IoCheckmark className="h-[18px] w-[18px]" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <h2 style={PIXEL} className="text-base text-[var(--text)]">{pet.name}</h2>
                      <button
                        onClick={() => {
                          setDraft(pet.name)
                          setEditing(true)
                        }}
                        aria-label={t('petRename')}
                        className="flex h-8 w-8 items-center justify-center text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                      >
                        <IoPencilOutline className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                <span style={PIXEL} className="mt-2 border-2 border-[var(--primary-ring)] bg-[var(--primary-soft)] px-2 py-1 text-[9px] uppercase text-[var(--text)]">
                  {t(STAGE_KEY[pet.stage])}
                </span>
                <span className="mt-2 text-xs text-[var(--text-muted)]">{t(`petBreed${look.breed[0].toUpperCase()}${look.breed.slice(1)}`)}</span>
                <p className="mt-2 text-center text-sm text-[var(--text-muted)]">{t(MOOD_KEY[pet.mood], { name })}</p>
              </>
            )}
          </div>

          {pet.hasName && (
            <div className="relative mt-5 space-y-3">
              <Meter
                label={t('petHunger')}
                value={pet.fullness}
                valueLabel={`${Math.round(pet.fullness)}%`}
                tone={pet.mood === 'happy' ? 'good' : pet.mood === 'content' ? 'ok' : 'bad'}
              />
              <Meter
                label={t('petGrowth')}
                value={progress ? progress.pct : 100}
                valueLabel={progress ? t('petGrowthNext', { count: Math.ceil(progress.toNext) }) : t('petGrowthMax')}
                tone="primary"
              />
            </div>
          )}
        </section>

        {pet.hasName && (
          <>
            {/* Background */}
            <h3 style={PIXEL} className="mb-3 mt-8 px-1 text-[10px] uppercase leading-relaxed text-[var(--text-muted)]">
              {t('petSceneTitle')}
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {PET_SCENES.map((sc) => {
                const active = pet.scene === sc
                return (
                  <button
                    key={sc}
                    onClick={() => setScene(sc)}
                    aria-pressed={active}
                    aria-label={t(`petScene${sc[0].toUpperCase()}${sc.slice(1)}`)}
                    title={t(`petScene${sc[0].toUpperCase()}${sc.slice(1)}`)}
                    className={`group min-w-0 border-2 p-0.5 transition-colors ${
                      active ? 'border-nonsprimary bg-[var(--primary-soft)]' : 'border-[var(--border-strong)] hover:border-[var(--text-muted)]'
                    }`}
                  >
                    <PetScene scene={sc} className="block aspect-[2/1] w-full" />
                    <span
                      style={PIXEL}
                      className={`mt-1 block truncate px-0.5 pb-0.5 text-center text-[7px] uppercase ${active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}
                    >
                      {t(`petScene${sc[0].toUpperCase()}${sc.slice(1)}`)}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Feeding */}
            <h3 style={PIXEL} className="mb-3 mt-8 px-1 text-[10px] uppercase leading-relaxed text-[var(--text-muted)]">
              {t('petFeedTitle', { name })}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FoodGroup kind="read" onFeed={onFeed} />
              <FoodGroup kind="watch" onFeed={onFeed} />
            </div>
            <p
              role="status"
              className={`mt-3 min-h-5 px-1 text-sm ${message?.ok === false ? 'text-nonslightred' : 'text-[var(--text-muted)]'}`}
            >
              {message?.text}
            </p>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t('petStatBooks')} value={pet.booksRead} />
              <Stat label={t('petStatMovies')} value={pet.moviesWatched} />
              <Stat label={t('petStatFed')} value={pet.fed} />
              <Stat label={t('petStatDays')} value={days} />
            </div>

            {/* Mock tools: lets you push the pet through its levels and moods */}
            <h3 style={PIXEL} className="mb-3 mt-8 px-1 text-[10px] uppercase leading-relaxed text-[var(--text-muted)]">
              {t('petMockTools')}
            </h3>
            <div className="flex flex-wrap gap-2">
              <MockButton onClick={() => addXp(25)}>{t('petMockAddXp', { count: 25 })}</MockButton>
              <MockButton onClick={() => addXp(100)}>{t('petMockAddXp', { count: 100 })}</MockButton>
              <MockButton onClick={evolve} disabled={!progress}>{t('petMockEvolve')}</MockButton>
              <MockButton onClick={() => setLookShift((v) => v + 1)}>{t('petMockLook')}</MockButton>
              <MockButton onClick={() => setFullness(0)}>{t('petMockStarve')}</MockButton>
              <MockButton onClick={() => setFullness(100)}>{t('petMockFill')}</MockButton>
            </div>

            <div className="mt-8 flex items-center justify-between gap-3 px-1">
              <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <IoPawOutline className="h-4 w-4 flex-shrink-0" />
                {t('petMockNote')}
              </p>
              <button
                onClick={() => setConfirmReset(true)}
                className="flex flex-shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                <IoRefresh className="h-3.5 w-3.5" />
                {t('petStartOver')}
              </button>
            </div>
          </>
        )}
      </div>

      {confirmReset && (
        <ConfirmModal
          title={t('petStartOverTitle')}
          message={t('petStartOverText')}
          confirmText={t('petStartOver')}
          cancelText={t('cancel')}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            reset()
            setDraft('')
            setEditing(false)
            setMessage(null)
            setLookShift(0)
            setConfirmReset(false)
          }}
        />
      )}
    </Layout>
  )
}

function MockButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="border-2 border-dashed border-[var(--border-strong)] px-3 py-2 text-xs text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)] active:translate-y-px disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

function FoodGroup({ kind, onFeed }: { kind: PetFoodKind; onFeed: (f: PetFood) => void }) {
  const { t } = useLanguage()
  const Icon = kind === 'read' ? IoBookOutline : IoFilmOutline
  return (
    <div className={`bg-[var(--surface)] p-2 ${FRAME}`}>
      <p style={PIXEL} className="flex items-center gap-2 px-2 pb-2 pt-1 text-[9px] uppercase text-[var(--text-muted)]">
        <Icon className="h-4 w-4" />
        {t(kind === 'read' ? 'petFeedRead' : 'petFeedWatch')}
      </p>
      {PET_FOODS.filter((f) => f.kind === kind).map((food) => (
        <button
          key={food.id}
          onClick={() => onFeed(food)}
          className="flex w-full items-center justify-between gap-3 px-2.5 py-2.5 text-left text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)] active:scale-[0.99]"
        >
          <span>{t(food.labelKey)}</span>
          <span style={PIXEL} className="flex-shrink-0 text-[9px] text-nonsprimaryfocus">+{food.xp} XP</span>
        </button>
      ))}
    </div>
  )
}

function Meter({
  label,
  value,
  valueLabel,
  tone,
}: {
  label: string
  value: number
  valueLabel: string
  tone: 'good' | 'ok' | 'bad' | 'primary'
}) {
  const color = { good: '#3ecf8e', ok: '#f5a623', bad: '#ff7a85', primary: 'var(--color-nonsprimaryfocus)' }[tone]
  const SEGMENTS = 20
  const lit = Math.round((Math.max(0, Math.min(100, value)) / 100) * SEGMENTS)
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span style={PIXEL} className="text-[9px] uppercase text-[var(--text)]">{label}</span>
        <span className="text-right text-xs text-[var(--text-muted)]">{valueLabel}</span>
      </div>
      <div
        className="flex h-4 gap-[2px] border-2 border-[var(--border-strong)] bg-[var(--container)] p-[2px]"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div
            key={i}
            className="h-full flex-1"
            style={{ background: i < lit ? color : 'var(--surface-active)' }}
          />
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={`bg-[var(--surface)] px-3 py-3 text-center ${FRAME}`}>
      <div style={PIXEL} className="text-lg text-[var(--text)]">{value}</div>
      <div className="mt-1.5 text-[11px] text-[var(--text-muted)]">{label}</div>
    </div>
  )
}
