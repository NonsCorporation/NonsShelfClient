'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoClose, IoPersonOutline, IoSearch } from 'react-icons/io5'
import DatePicker from './DatePicker'
import { challengeService } from '../services/challengeService'
import { catalogService, type PersonHit } from '../services/catalogService'
import type { Challenge, ChallengeCondition, MediaType } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useLists } from '../contexts/ListContext'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSaved: (c: Challenge) => void
  /** When set, the modal edits this challenge in place instead of creating a
   *  new one — every field is prefilled from it. */
  challenge?: Challenge | null
}

const toUnix = (ymd: string): number => (ymd ? Math.floor(new Date(`${ymd}T00:00:00Z`).getTime() / 1000) : 0)
const fromUnix = (unix?: number): string => (unix ? new Date(unix * 1000).toISOString().slice(0, 10) : '')

// Create/edit-challenge form: title/description, a media-type scope, a goal
// (a specific number, or "complete everything matching"), an optional date
// window, an optional source (one of the user's curated lists or
// collections), and a handful of optional filters (genre, a person via
// search, a year range). Everything but title/type/goal maps onto the same
// normalized {field,op,value} conditions the backend evaluates — the form is
// just a guided way to build them. Passing `challenge` switches the form into
// edit mode: same fields, prefilled, PUT instead of POST on submit.
export default function CreateChallengeModal({ isOpen, onClose, onSaved, challenge }: Props) {
  const { t } = useLanguage()
  const { lists } = useLists()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mediaType, setMediaType] = useState<'' | MediaType>('')
  const [goalMode, setGoalMode] = useState<'number' | 'all'>('number')
  const [targetCount, setTargetCount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Source: scope the challenge to one of the user's curated lists ("read
  // everything in my '2026 backlog'"). List id as a string, '' for none.
  // Collections aren't offered here — they're private per-user, so scoping a
  // shared challenge to one wouldn't mean anything to other participants.
  const [source, setSource] = useState('')

  const [genre, setGenre] = useState('')
  const [yearMin, setYearMin] = useState('')
  const [yearMax, setYearMax] = useState('')
  const [person, setPerson] = useState<PersonHit | null>(null)
  const [personQuery, setPersonQuery] = useState('')
  const [personResults, setPersonResults] = useState<PersonHit[]>([])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    if (challenge) {
      setTitle(challenge.title)
      setDescription(challenge.description)
      setMediaType(challenge.media_type)
      setGoalMode(challenge.target_count == null ? 'all' : 'number')
      setTargetCount(challenge.target_count != null ? String(challenge.target_count) : '')
      setStartDate(fromUnix(challenge.start_date))
      setEndDate(fromUnix(challenge.end_date))
      const listCond = challenge.conditions.find((c) => c.field === 'list_id')
      setSource(listCond?.value ?? '')
      const genreCond = challenge.conditions.find((c) => c.field === 'genre')
      setGenre(genreCond?.value ?? '')
      const yearMinCond = challenge.conditions.find((c) => c.field === 'year' && c.op === 'gte')
      setYearMin(yearMinCond?.value ?? '')
      const yearMaxCond = challenge.conditions.find((c) => c.field === 'year' && c.op === 'lte')
      setYearMax(yearMaxCond?.value ?? '')
      const personCond = challenge.conditions.find((c) => c.field === 'person_uuid')
      setPerson(personCond ? { uuid: personCond.value, name: personCond.label || personCond.value, creditCount: 0 } : null)
    } else {
      setTitle('')
      setDescription('')
      setMediaType('')
      setGoalMode('number')
      setTargetCount('')
      setStartDate('')
      setEndDate('')
      setSource('')
      setGenre('')
      setYearMin('')
      setYearMax('')
      setPerson(null)
    }
    setPersonQuery('')
    setPersonResults([])
    setError(null)
  }, [isOpen, challenge])

  useEffect(() => {
    if (!personQuery.trim()) {
      setPersonResults([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      catalogService.searchPeople(personQuery).then((r) => { if (!cancelled) setPersonResults(r) })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [personQuery])

  if (!isOpen) return null

  const handleSave = async () => {
    if (!title.trim()) {
      setError(t('challengeTitleRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const conditions: ChallengeCondition[] = []
      if (source) conditions.push({ field: 'list_id', op: 'eq', value: source })
      if (genre.trim()) conditions.push({ field: 'genre', op: 'contains', value: genre.trim() })
      if (person) conditions.push({ field: 'person_uuid', op: 'eq', value: person.uuid })
      if (yearMin.trim()) conditions.push({ field: 'year', op: 'gte', value: yearMin.trim() })
      if (yearMax.trim()) conditions.push({ field: 'year', op: 'lte', value: yearMax.trim() })

      const input = {
        title: title.trim(),
        description: description.trim(),
        mediaType,
        targetCount: goalMode === 'all' ? null : (Number(targetCount) || null),
        startDate: toUnix(startDate),
        endDate: toUnix(endDate),
        conditions,
      }
      const saved = challenge
        ? await challengeService.updateChallenge(challenge.id, input)
        : await challengeService.createChallenge(input)
      onSaved(saved)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save challenge')
    } finally {
      setBusy(false)
    }
  }

  const typeChips: { key: '' | MediaType; label: string }[] = [
    { key: '', label: t('all') },
    { key: 'book', label: t('books') },
    { key: 'movie', label: t('movies') },
    { key: 'series', label: t('seriesPlural') },
  ]

  const inputCls =
    'h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text)]">{challenge ? t('editChallenge') : t('newChallenge')}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
          {t('title')}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('challengeTitlePlaceholder')}
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
          {t('description')}
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
          />
        </label>

        {/* Scope: media type */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--text)]">{t('type')}</span>
          <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
            {typeChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setMediaType(c.key)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  mediaType === c.key ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Source: one of the user's curated lists (public/shared — unlike
            collections, which are private and so aren't offered here). */}
        {lists.length > 0 && (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('challengeSource')}
            <select value={source} onChange={(e) => setSource(e.target.value)} className={inputCls}>
              <option value="">{t('challengeSourceAny')}</option>
              {lists.map((l) => (
                <option key={l.id} value={String(l.id)}>{l.title}</option>
              ))}
            </select>
          </label>
        )}

        {/* Goal */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--text)]">{t('goal')}</span>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
              <button
                type="button"
                onClick={() => setGoalMode('number')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  goalMode === 'number' ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {t('specificNumber')}
              </button>
              <button
                type="button"
                onClick={() => setGoalMode('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  goalMode === 'all' ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {t('everythingMatching')}
              </button>
            </div>
            {goalMode === 'number' && (
              <input
                type="number"
                min={1}
                value={targetCount}
                onChange={(e) => setTargetCount(e.target.value)}
                placeholder="60"
                className="h-9 w-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
            )}
          </div>
        </div>

        {/* Date window */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {t('startDate')}
            </p>
            <DatePicker value={startDate} onChange={setStartDate} max={endDate || undefined} placeholder="—" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {t('endDate')}
            </p>
            <DatePicker value={endDate} onChange={setEndDate} min={startDate || undefined} placeholder="—" />
          </div>
        </div>

        {/* Optional filters */}
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            {t('optionalFilters')}
          </p>

          <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
            {t('genre')}
            <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder={t('genre')} className={inputCls} />
          </label>

          <div className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
            {t('person')}
            {person ? (
              <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <IoPersonOutline className="h-4 w-4 text-nonsprimary" />
                  {person.name}
                </span>
                <button type="button" onClick={() => setPerson(null)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                  <IoClose className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <IoSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  placeholder={t('searchAuthorsPlaceholder')}
                  className={`${inputCls} pl-9`}
                />
                {personResults.length > 0 && (
                  <div className="absolute z-10 mt-1 flex w-full flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--container-2)] p-1 shadow-xl">
                    {personResults.map((p) => (
                      <button
                        key={p.uuid}
                        type="button"
                        onClick={() => { setPerson(p); setPersonQuery(''); setPersonResults([]) }}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
                      >
                        <IoPersonOutline className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            {t('yearRange')}
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={yearMin}
                onChange={(e) => setYearMin(e.target.value)}
                placeholder={t('from')}
                className="h-9 w-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
              <input
                type="number"
                value={yearMax}
                onChange={(e) => setYearMax(e.target.value)}
                placeholder={t('to')}
                className="h-9 w-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="h-10 rounded-lg bg-nonsprimary px-6 text-sm font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
          >
            {busy ? t('saving') : challenge ? t('save') : t('create')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
