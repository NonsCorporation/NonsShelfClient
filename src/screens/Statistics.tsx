'use client'

import { useEffect, useMemo, useState } from 'react'
import { IoChevronBack, IoChevronForward, IoBookOutline, IoFilmOutline, IoTvOutline, IoStar, IoHeartOutline, IoChatbubbleOutline, IoCheckmarkDoneOutline, IoLibraryOutline } from 'react-icons/io5'
import type { IconType } from 'react-icons'
import { authedFetch } from '../lib/api'
import { libraryService } from '../services/libraryService'
import type { MediaItem, MediaType } from '../types'
import { useLanguage } from '../contexts/LanguageContext'

// Per-type accent, matching the rest of the app (book amber, film indigo, series teal).
const TYPE_COLOR: Record<MediaType, string> = { book: '#e0a458', movie: '#7c8cff', series: '#4fd1c5' }

type CalEvent = { type: string; at: number; media?: { type: MediaType } }
type Axis = 'all' | MediaType

export default function Statistics() {
  const { t, language } = useLanguage()
  const locale = language === 'ru' ? 'ru-RU' : 'en-US'

  const [items, setItems] = useState<MediaItem[]>([])
  const [events, setEvents] = useState<CalEvent[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [axis, setAxis] = useState<Axis>('all')
  // Which media types feed the ratings breakdown (multi-select: books, films, series).
  const [ratingTypes, setRatingTypes] = useState<MediaType[]>(['book', 'movie', 'series'])

  useEffect(() => {
    libraryService.getItems().then(setItems)
    const now = new Date()
    const from = Math.floor(new Date(now.getFullYear() - 5, 0, 1).getTime() / 1000)
    const to = Math.floor(new Date(now.getFullYear() + 1, 0, 1).getTime() / 1000)
    authedFetch(`/api/calendar?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => setEvents(d.events ?? []))
      .catch(() => setEvents([]))
  }, [])

  const finished = useMemo(() => events.filter((e) => e.type === 'finished' && e.media), [events])

  // Library-wide totals (distinct items), independent of the year selector.
  const totals = useMemo(() => {
    const rated = items.filter((i) => typeof i.rating === 'number' && i.rating > 0)
    const done = (type?: MediaType) => items.filter((i) => i.status === 'done' && (!type || i.type === type)).length
    return {
      finished: done(),
      books: done('book'),
      films: done('movie'),
      series: done('series'),
      reading: items.filter((i) => i.status === 'active').length,
      wishlist: items.filter((i) => i.status === 'wishlist').length,
      favorites: items.filter((i) => i.favorite).length,
      reviews: items.filter((i) => i.review && i.review.trim()).length,
      ratedCount: rated.length,
      total: items.length,
      avg: rated.length ? rated.reduce((s, i) => s + (i.rating || 0), 0) / rated.length / 2 : 0,
      pages: items
        .filter((i) => i.type === 'book' && i.status === 'done')
        .reduce((s, i) => s + (i.pages || 0), 0),
    }
  }, [items])

  // Rating distribution (1..10 → half-stars), for the donut + legend — limited to
  // the selected media types so you can see ratings for e.g. books and series only.
  const ratingStats = useMemo(() => {
    const sel = items.filter(
      (i) => ratingTypes.includes(i.type) && typeof i.rating === 'number' && i.rating > 0,
    )
    const counts = Array(11).fill(0) as number[]
    sel.forEach((i) => counts[i.rating!]++)
    const avg = sel.length ? sel.reduce((s, i) => s + (i.rating || 0), 0) / sel.length / 2 : 0
    return { counts, ratedCount: sel.length, avg }
  }, [items, ratingTypes])

  const toggleRatingType = (k: MediaType) =>
    setRatingTypes((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))

  // Finished per month for the selected year, split by media type.
  const monthly = useMemo(() => {
    const books = Array(12).fill(0) as number[]
    const films = Array(12).fill(0) as number[]
    const series = Array(12).fill(0) as number[]
    finished.forEach((e) => {
      const d = new Date(e.at * 1000)
      if (d.getFullYear() !== year) return
      const m = d.getMonth()
      if (e.media!.type === 'book') books[m]++
      else if (e.media!.type === 'series') series[m]++
      else films[m]++
    })
    return { books, films, series }
  }, [finished, year])

  // The single series currently plotted (per the axis toggle).
  const plotted = useMemo(() => {
    if (axis === 'book') return monthly.books
    if (axis === 'movie') return monthly.films
    if (axis === 'series') return monthly.series
    return monthly.books.map((b, i) => b + monthly.films[i] + monthly.series[i])
  }, [axis, monthly])

  const yearFinished = plotted.reduce((s, v) => s + v, 0)

  // Years that have any finished events, plus the current year, for navigation bounds.
  const { minYear, maxYear, perYearAvg } = useMemo(() => {
    const years = finished.map((e) => new Date(e.at * 1000).getFullYear())
    const cur = new Date().getFullYear()
    const min = years.length ? Math.min(...years, cur) : cur
    const max = cur
    const span = Math.max(1, max - min + 1)
    return { minYear: min, maxYear: max, perYearAvg: finished.length / span }
  }, [finished])

  const monthLabel = (m: number) => new Date(2020, m, 1).toLocaleString(locale, { month: 'short' })

  const cards: { icon: IconType; label: string; value: string | number; color?: string }[] = [
    { icon: IoCheckmarkDoneOutline, label: t('statFinished'), value: totals.finished, color: 'var(--text)' },
    { icon: IoBookOutline, label: t('statBooks'), value: totals.books, color: TYPE_COLOR.book },
    { icon: IoFilmOutline, label: t('statMovies'), value: totals.films, color: TYPE_COLOR.movie },
    { icon: IoTvOutline, label: t('seriesPlural'), value: totals.series, color: TYPE_COLOR.series },
    { icon: IoStar, label: t('statAvg'), value: totals.avg ? totals.avg.toFixed(2) : '—', color: '#f5a623' },
    { icon: IoLibraryOutline, label: t('statsPages'), value: totals.pages.toLocaleString(locale), color: 'var(--text)' },
    { icon: IoHeartOutline, label: t('favorites'), value: totals.favorites, color: '#c2557a' },
    { icon: IoChatbubbleOutline, label: t('reviewsTitle'), value: totals.reviews, color: 'var(--text)' },
  ]

  const axisOptions: { key: Axis; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'book', label: t('books') },
    { key: 'movie', label: t('movies') },
    { key: 'series', label: t('seriesPlural') },
  ]
  const axisColor = axis === 'all' ? 'var(--color-nonsprimary)' : TYPE_COLOR[axis]

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4">
            <c.icon className="h-5 w-5" style={{ color: c.color }} />
            <p className="mt-2 text-2xl font-bold leading-none text-[var(--text)]">{c.value}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Finished by month */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">{t('statsFinishedByMonth')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* axis (what to count) */}
            <div className="flex gap-1 rounded-xl bg-[var(--surface)] p-1">
              {axisOptions.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setAxis(o.key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    axis === o.key ? 'bg-[var(--container)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {/* year selector */}
            <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-1.5 py-1">
              <button onClick={() => setYear((y) => Math.max(minYear, y - 1))} disabled={year <= minYear} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30">
                <IoChevronBack className="h-4 w-4" />
              </button>
              <span className="min-w-[3rem] text-center text-sm font-bold text-[var(--text)]">{year}</span>
              <button onClick={() => setYear((y) => Math.min(maxYear, y + 1))} disabled={year >= maxYear} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30">
                <IoChevronForward className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <BarChart values={plotted} labels={[...Array(12)].map((_, m) => monthLabel(m))} color={axisColor} />
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          {t('statsYearTotal', { n: yearFinished, year })} · {t('statsPerMonthAvg', { n: (yearFinished / 12).toFixed(1) })}
        </p>
      </section>

      {/* Ratings breakdown + averages */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-[var(--text)]">{t('statsRatings')}</h2>
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: 'book', label: t('books'), icon: IoBookOutline },
                { key: 'movie', label: t('movies'), icon: IoFilmOutline },
                { key: 'series', label: t('seriesPlural'), icon: IoTvOutline },
              ] as const).map(({ key, label, icon: Icon }) => {
                const on = ratingTypes.includes(key)
                return (
                  <button
                    key={key}
                    onClick={() => toggleRatingType(key)}
                    style={on ? { backgroundColor: TYPE_COLOR[key], borderColor: 'transparent' } : undefined}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      on ? 'text-white' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          {ratingStats.ratedCount === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">{t('statsNoData')}</p>
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
              <RatingDonut buckets={ratingStats.counts} centerValue={ratingStats.avg.toFixed(2)} centerLabel={t('statAvg')} />
              <ul className="flex w-full flex-col gap-1.5">
                {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => {
                  const count = ratingStats.counts[r]
                  if (!count) return null
                  const pct = Math.round((count / ratingStats.ratedCount) * 100)
                  return (
                    <li key={r} className="flex items-center gap-2 text-xs">
                      <span className="flex w-12 flex-shrink-0 items-center gap-0.5 font-semibold text-[var(--text)]">
                        <IoStar className="h-3 w-3" style={{ color: starColor(r) }} />
                        {(r / 2).toFixed(1)}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--container-2)]">
                        <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: starColor(r) }} />
                      </span>
                      <span className="w-20 flex-shrink-0 text-right text-[var(--text-muted)]">
                        {t('statsOutOf', { n: count, total: ratingStats.ratedCount })}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-[var(--text)]">{t('statsAverages')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Average value={(yearFinished / 12).toFixed(1)} label={t('statsAvgPerMonthYear', { year })} />
            <Average value={perYearAvg.toFixed(1)} label={t('statsAvgPerYear')} />
            <Average value={totals.avg ? totals.avg.toFixed(2) : '—'} label={t('statsAvgRatingAll')} />
            <Average value={totals.ratedCount ? `${Math.round((totals.ratedCount / Math.max(1, totals.total)) * 100)}%` : '—'} label={t('statsRatedShare')} />
          </div>
          {/* Shelf composition */}
          <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t('shelves')}</p>
            <ShelfBar wishlist={totals.wishlist} reading={totals.reading} done={totals.finished} t={t} />
          </div>
        </section>
      </div>
    </div>
  )
}

// A smooth red→green hue for a 1..10 rating.
function starColor(r: number): string {
  return `hsl(${Math.round(((r - 1) / 9) * 120)}, 62%, 52%)`
}

// Simple vertical bar chart (12 months). Bars scale to the series max.
function BarChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const max = Math.max(1, ...values)
  return (
    <div className="flex h-40 items-end gap-1 sm:gap-2">
      {values.map((v, i) => (
        <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100">{v || ''}</span>
          <div
            title={`${labels[i]}: ${v}`}
            className="w-full rounded-t-md transition-all"
            style={{ height: `${v ? Math.max((v / max) * 100, 4) : 0}%`, backgroundColor: v ? color : 'var(--container-2)', minHeight: v ? undefined : 2 }}
          />
          <span className="text-[9px] uppercase text-[var(--text-muted)] sm:text-[10px]">{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

// Donut of the rating distribution (segments by half-star), with a center label.
function RatingDonut({ buckets, centerValue, centerLabel }: { buckets: number[]; centerValue: string; centerLabel: string }) {
  const segments = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    .map((r) => ({ r, value: buckets[r] }))
    .filter((s) => s.value > 0)
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = 42
  const C = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="relative h-40 w-40 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--container-2)" strokeWidth="12" />
        {total > 0 &&
          segments.map((seg) => {
            const len = (seg.value / total) * C
            const el = (
              <circle
                key={seg.r}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={starColor(seg.r)}
                strokeWidth="12"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            )
            offset += len
            return el
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[var(--text)]">{centerValue}</span>
        <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{centerLabel}</span>
      </div>
    </div>
  )
}

function Average({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <p className="text-xl font-bold leading-none text-[var(--text)]">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">{label}</p>
    </div>
  )
}

// A single stacked bar showing wishlist / reading / finished proportions.
function ShelfBar({ wishlist, reading, done, t }: { wishlist: number; reading: number; done: number; t: (k: string) => string }) {
  const total = Math.max(1, wishlist + reading + done)
  const segs = [
    { v: done, c: '#3ec98a', label: t('shelfDone') },
    { v: reading, c: '#f5a623', label: t('shelfActive') },
    { v: wishlist, c: '#6768ab', label: t('shelfWishlist') },
  ].filter((s) => s.v > 0)
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--container-2)]">
        {segs.map((s) => (
          <span key={s.label} style={{ width: `${(s.v / total) * 100}%`, backgroundColor: s.c }} title={`${s.label}: ${s.v}`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segs.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.c }} />
            {s.label} <span className="font-semibold text-[var(--text)]">{s.v}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
