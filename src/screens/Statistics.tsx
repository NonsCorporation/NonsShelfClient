'use client'

import { useEffect, useMemo, useState } from 'react'
import { IoChevronBack, IoChevronForward, IoBookOutline, IoFilmOutline, IoTvOutline, IoStar, IoHeartOutline, IoChatbubbleOutline, IoCheckmarkDoneOutline, IoLibraryOutline, IoTimeOutline, IoAlbumsOutline, IoPersonOutline, IoBarChartOutline, IoPieChartOutline, IoStatsChartOutline } from 'react-icons/io5'
import type { IconType } from 'react-icons'
import { authedFetch } from '../lib/api'
import { libraryService } from '../services/libraryService'
import type { MediaItem, MediaType } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { buildRecap, fmtInt, fmtDuration } from '../lib/recap'
import RecapStories from '@/components/feed/RecapStories'
import DatePicker from '@/components/ui/DatePicker'
import TypeBadge from '@/components/badges/TypeBadge'

// Per-type accent, matching the rest of the app (book amber, film indigo, series teal).
const TYPE_COLOR: Record<MediaType, string> = { book: '#e0a458', movie: '#7c8cff', series: '#4fd1c5' }

type CalEvent = { type: string; at: number; media?: { type: MediaType } }
type Axis = 'all' | MediaType
// Recap period selection: single month, span of months, whole year, or any range.
type PMode = 'month' | 'months' | 'year' | 'custom'
type YM = { y: number; m: number }

export default function Statistics() {
  const { t, language } = useLanguage()
  const locale = language === 'ru' ? 'ru-RU' : 'en-US'
  const { user } = useAuth()
  const userName = user?.name || user?.username || ''

  const [items, setItems] = useState<MediaItem[]>([])
  const [events, setEvents] = useState<CalEvent[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [axis, setAxis] = useState<Axis>('all')
  // Which media types feed the ratings breakdown (multi-select: books, films, series).
  const [ratingTypes, setRatingTypes] = useState<MediaType[]>(['book', 'movie', 'series'])

  // Recap period: a single month, a span of months, a whole year, or any custom
  // date range. Each resolves to a [from, to) unix window fed to buildRecap.
  const now0 = new Date()
  const [pmode, setPmode] = useState<PMode>('month')
  const [pMonth, setPMonth] = useState<YM>({ y: now0.getFullYear(), m: now0.getMonth() })
  const [pFrom, setPFrom] = useState<YM>({ y: now0.getFullYear(), m: 0 })
  const [pTo, setPTo] = useState<YM>({ y: now0.getFullYear(), m: now0.getMonth() })
  const [pYear, setPYear] = useState(now0.getFullYear())
  const [cFrom, setCFrom] = useState(() => new Date(now0.getFullYear(), 0, 1).toISOString().slice(0, 10))
  const [cTo, setCTo] = useState(() => now0.toISOString().slice(0, 10))
  const [recapOpen, setRecapOpen] = useState(false)
  // Media-type filter for the recap: 'all' or a single type (books / films / series).
  const [recapType, setRecapType] = useState<Axis>('all')
  // Photo of the recap's top author (fetched by uuid), shown instead of a book cover.
  const [topAuthorPhoto, setTopAuthorPhoto] = useState<string | undefined>(undefined)

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

  // Resolve the selected period to a { from, to (unix seconds), label } window.
  const period = useMemo(() => {
    const startOf = (y: number, m: number) => Math.floor(new Date(y, m, 1).getTime() / 1000)
    const mLabel = (y: number, m: number, opts: Intl.DateTimeFormatOptions) => new Date(y, m, 1).toLocaleString(locale, opts)
    if (pmode === 'months') {
      let [a, b] = [pFrom, pTo]
      if (a.y * 12 + a.m > b.y * 12 + b.m) [a, b] = [b, a]
      return {
        from: startOf(a.y, a.m),
        to: startOf(b.y, b.m + 1),
        label: `${mLabel(a.y, a.m, { month: 'short', year: 'numeric' })} – ${mLabel(b.y, b.m, { month: 'short', year: 'numeric' })}`,
      }
    }
    if (pmode === 'year') return { from: startOf(pYear, 0), to: startOf(pYear + 1, 0), label: String(pYear) }
    if (pmode === 'custom') {
      const fromD = new Date(cFrom + 'T00:00:00')
      const toD = new Date(cTo + 'T00:00:00')
      const df: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
      return {
        from: Math.floor(fromD.getTime() / 1000),
        to: Math.floor(toD.getTime() / 1000) + 86400, // include the whole end day
        label: `${fromD.toLocaleDateString(locale, df)} – ${toD.toLocaleDateString(locale, df)}`,
      }
    }
    return { from: startOf(pMonth.y, pMonth.m), to: startOf(pMonth.y, pMonth.m + 1), label: mLabel(pMonth.y, pMonth.m, { month: 'long', year: 'numeric' }) }
  }, [pmode, pMonth, pFrom, pTo, pYear, cFrom, cTo, locale])

  // Recap runs over items narrowed to the selected media type (or all types).
  const recapItems = useMemo(
    () => (recapType === 'all' ? items : items.filter((i) => i.type === recapType)),
    [items, recapType],
  )
  const recap = useMemo(() => buildRecap(recapItems, period), [recapItems, period])

  const typeName = (a: Axis) =>
    a === 'book' ? t('books') : a === 'movie' ? t('movies') : a === 'series' ? t('seriesPlural') : t('filterAll')
  // Period label, suffixed with the media type when filtered (shown in the header
  // and carried onto the story cards).
  const recapLabel = recapType === 'all' ? period.label : `${period.label} · ${typeName(recapType)}`

  // Fetch the top author's photo (person record) whenever the recap's leading
  // author changes. Cleared immediately so a stale photo never lingers under a
  // new name while the fetch is in flight.
  const topAuthorUuid = recap.authors[0]?.makerUuid
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTopAuthorPhoto(undefined)
    if (!topAuthorUuid) return
    let cancelled = false
    authedFetch(`/api/people/${topAuthorUuid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setTopAuthorPhoto(d?.person?.photo_url || undefined) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [topAuthorUuid])

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

  const yearsRange = useMemo(() => {
    const ys = items.map((i) => (i.finishedAt ? new Date(i.finishedAt).getFullYear() : NaN)).filter((y) => !Number.isNaN(y))
    const cur = new Date().getFullYear()
    return { min: ys.length ? Math.min(...ys, cur) : cur - 5, max: cur }
  }, [items])

  const modeTabs: { key: PMode; label: string }[] = [
    { key: 'month', label: t('recapModeMonth') },
    { key: 'months', label: t('recapModeMonths') },
    { key: 'year', label: t('recapModeYear') },
    { key: 'custom', label: t('recapModeCustom') },
  ]

  // Secondary recap numbers, shown as compact chips beside the hero count.
  // Per-type counts only when all types are in scope; pages only when books are.
  const recapChips: { icon: IconType; value: string | number; label: string; color: string }[] = [
    ...(recapType === 'all'
      ? [
          { icon: IoBookOutline, value: recap.counts.books, label: t('statBooks'), color: TYPE_COLOR.book },
          { icon: IoFilmOutline, value: recap.counts.movies, label: t('statMovies'), color: TYPE_COLOR.movie },
          { icon: IoTvOutline, value: recap.counts.series, label: t('seriesPlural'), color: TYPE_COLOR.series },
        ]
      : []),
    ...(recapType === 'all' || recapType === 'book'
      ? [{ icon: IoLibraryOutline, value: fmtInt(recap.pages, locale), label: t('statsPages'), color: '#c2557a' }]
      : []),
    ...(recap.minutes
      ? [{ icon: IoTimeOutline, value: fmtDuration(recap.minutes), label: t('recapTimeSpent'), color: '#4fd1c5' }]
      : []),
  ]

  // Covers of what was finished in the period, tiled to fill a 12-tile backdrop
  // grid for the hero band (Wrapped/Year-in-Review style) — repeats if there
  // are fewer than 12 so a light month still reads as a full mosaic.
  const coverTiles = useMemo(() => {
    const urls = recap.items.map((i) => i.coverUrl).filter((u): u is string => !!u)
    if (urls.length === 0) return []
    return Array.from({ length: 12 }, (_, i) => urls[i % urls.length])
  }, [recap.items])

  // "What you finished" grouped by month when the period spans more than one
  // calendar month (year / custom range) — a single-month recap stays flat,
  // a longer one reads like a reading log instead of one undifferentiated list.
  const finishedGroups = useMemo(() => {
    const groups: { key: string; label: string; items: typeof recap.items }[] = []
    for (const i of recap.items) {
      const d = i.finishedAt ? new Date(i.finishedAt) : null
      const key = d ? `${d.getFullYear()}-${d.getMonth()}` : 'unknown'
      let group = groups.find((g) => g.key === key)
      if (!group) {
        group = { key, label: d ? d.toLocaleString(locale, { month: 'long', year: 'numeric' }) : '', items: [] }
        groups.push(group)
      }
      group.items.push(i)
    }
    return groups
  }, [recap.items, locale])

  return (
    <div className="flex flex-col gap-6">
      {/* Recap — pick any period, see a detailed breakdown, generate story cards */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">{t('recapHeading')}</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{recapLabel}</p>
          </div>
          <button
            onClick={() => setRecapOpen(true)}
            disabled={recap.counts.total === 0}
            className="flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-40"
            style={{ backgroundImage: 'linear-gradient(135deg, var(--color-nonsprimaryfocus), var(--color-nonsprimary))' }}
          >
            <IoAlbumsOutline className="h-4 w-4" /> {t('recapCreateCards')}
          </button>
        </div>

        {/* Period controls — mode, pickers and the type filter in one wrapping row */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--surface)] p-1">
            {modeTabs.map((o) => (
              <button
                key={o.key}
                onClick={() => setPmode(o.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  pmode === o.key ? 'bg-[var(--container)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {pmode === 'month' && <MonthPicker value={pMonth} onChange={setPMonth} min={yearsRange.min} max={yearsRange.max} locale={locale} />}
          {pmode === 'months' && (
            <>
              <MonthPicker value={pFrom} onChange={setPFrom} min={yearsRange.min} max={yearsRange.max} locale={locale} />
              <span className="text-[var(--text-muted)]">–</span>
              <MonthPicker value={pTo} onChange={setPTo} min={yearsRange.min} max={yearsRange.max} locale={locale} />
            </>
          )}
          {pmode === 'year' && (
            <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-1.5 py-1">
              <button onClick={() => setPYear((y) => Math.max(yearsRange.min, y - 1))} disabled={pYear <= yearsRange.min} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30"><IoChevronBack className="h-4 w-4" /></button>
              <span className="min-w-[3rem] text-center text-sm font-bold text-[var(--text)]">{pYear}</span>
              <button onClick={() => setPYear((y) => Math.min(yearsRange.max, y + 1))} disabled={pYear >= yearsRange.max} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30"><IoChevronForward className="h-4 w-4" /></button>
            </div>
          )}
          {pmode === 'custom' && (
            <>
              <DatePicker value={cFrom} onChange={setCFrom} max={cTo || undefined} placeholder="—" />
              <span className="text-[var(--text-muted)]">–</span>
              <DatePicker value={cTo} onChange={setCTo} min={cFrom || undefined} placeholder="—" />
            </>
          )}

          {/* Media-type filter — narrows the whole recap to one type. */}
          <div className="flex gap-1 rounded-xl bg-[var(--surface)] p-1 sm:ml-auto">
            {axisOptions.map((o) => (
              <button
                key={o.key}
                onClick={() => setRecapType(o.key)}
                style={recapType === o.key && o.key !== 'all' ? { backgroundColor: TYPE_COLOR[o.key], color: '#fff' } : undefined}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  recapType === o.key ? (o.key === 'all' ? 'bg-[var(--container)] text-[var(--text)] shadow-sm' : 'shadow-sm') : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hero band — Wrapped/Year-in-Review style: a mosaic of the period's own
            covers behind the headline count, always dark so it reads the same
            regardless of the app's light/dark theme. */}
        <div className="relative mb-5 overflow-hidden rounded-2xl bg-[#15131f]">
          {coverTiles.length > 0 && (
            <div className="absolute inset-0 grid grid-cols-6 gap-px opacity-45 sm:grid-cols-8">
              {coverTiles.map((src, i) => (
                <div key={i} className="aspect-square overflow-hidden">
                  <img src={src} alt="" className="h-full w-full scale-110 object-cover blur-[1px] saturate-[1.3]" />
                </div>
              ))}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#15131f] via-[#15131fcc] to-[#15131f66]" />
          <div className="relative z-10 flex flex-col gap-4 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
            {recap.counts.total === 0 ? (
              <p className="text-sm text-white/70">{t('recapEmpty')}</p>
            ) : (
              <>
                <div className="flex items-baseline gap-3">
                  <p className="text-6xl font-bold leading-none tracking-tight text-white">{recap.counts.total}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{t('statFinished')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {recapChips.map((c) => (
                    <span
                      key={c.label}
                      className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 py-1.5 pl-2.5 pr-3 text-xs backdrop-blur-sm"
                    >
                      <c.icon className="h-3.5 w-3.5" style={{ color: c.color }} />
                      <span className="font-bold text-white">{c.value}</span>
                      <span className="text-white/70">{c.label}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {recap.counts.total > 0 && (
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {/* Most-read author */}
            {recap.authors.length > 0 && (
              <div className="py-4">
                <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <IoPersonOutline className="h-3.5 w-3.5" /> {t('recapMostReadAuthor')}
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--container-2)] ring-2 ring-[color-mix(in_srgb,var(--color-nonsprimary)_35%,transparent)] ring-offset-2 ring-offset-[var(--container)]">
                      {topAuthorPhoto ? (
                        <img src={topAuthorPhoto} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <IoPersonOutline className="h-5 w-5 text-[var(--placeholder)]" />
                      )}
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-[var(--text)]">{recap.authors[0].name}</span>
                      <span className="text-sm text-[var(--text-muted)]">{t('recapAuthorCount', { n: recap.authors[0].count })}</span>
                    </div>
                  </div>
                  {recap.authors.slice(1, 4).map((a) => (
                    <span key={a.name} className="text-xs text-[var(--text-muted)]">{a.name} · {a.count}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Cover grid of what was finished, grouped by month when the period
                covers more than one — a shelf, not a spreadsheet row. */}
            <div className="pt-4">
              <p className="mb-3 flex items-baseline gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t('recapWhatYouFinished')}
                <span className="text-[var(--placeholder)]">· {recap.items.length}</span>
              </p>
              <div className="flex max-h-[36rem] flex-col gap-5 overflow-y-auto pr-1">
                {finishedGroups.map((group) => (
                  <div key={group.key}>
                    {finishedGroups.length > 1 && (
                      <p className="mb-2 px-0.5 text-[11px] font-semibold text-[var(--text-muted)]">{group.label}</p>
                    )}
                    <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7">
                      {group.items.map((i) => (
                        <div key={i.id} className="group/cover flex flex-col gap-1.5">
                          <span className="relative block aspect-[2/3] overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5 transition-transform duration-200 group-hover/cover:-translate-y-1 group-hover/cover:shadow-md">
                            <FinishedCover url={i.coverUrl} title={i.title} author={i.author} type={i.type} />
                            {typeof i.rating === 'number' && i.rating > 0 && (
                              <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                                <IoStar className="h-2.5 w-2.5" style={{ color: '#f5a623' }} />
                                {(i.rating / 2).toFixed(1)}
                              </span>
                            )}
                          </span>
                          <p className="truncate text-xs font-medium text-[var(--text)]" title={i.title}>{i.title}</p>
                          <p className="truncate text-[10px] text-[var(--text-muted)]">
                            {i.finishedAt ? new Date(i.finishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : i.author}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {recapOpen && (
        <RecapStories
          open={recapOpen}
          onClose={() => setRecapOpen(false)}
          recap={recap}
          label={recapLabel}
          locale={locale}
          t={t}
          authorPhotoUrl={topAuthorPhoto}
          userName={userName}
        />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 transition-all hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--text-muted)_35%,transparent)] hover:shadow-sm"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
              style={{ backgroundColor: `color-mix(in srgb, ${c.color} 15%, transparent)` }}
            >
              <c.icon className="h-4.5 w-4.5" style={{ color: c.color }} />
            </span>
            <p className="mt-3 text-2xl font-bold leading-none text-[var(--text)]">{c.value}</p>
            <p className="mt-1.5 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Finished by month */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text)]">
            <IoBarChartOutline className="h-4.5 w-4.5 text-[var(--text-muted)]" />
            {t('statsFinishedByMonth')}
          </h2>
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        <section className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text)]">
              <IoPieChartOutline className="h-4.5 w-4.5 text-[var(--text-muted)]" />
              {t('statsRatings')}
            </h2>
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
            <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-[var(--text-muted)]">{t('statsNoData')}</p>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 sm:flex-row sm:items-center sm:gap-6">
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

        <section className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--text)]">
            <IoStatsChartOutline className="h-4.5 w-4.5 text-[var(--text-muted)]" />
            {t('statsAverages')}
          </h2>
          <div className="grid flex-1 grid-cols-2 content-center gap-3">
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

// Deterministic hue from a string, so an item with no cover always gets the
// same generated placeholder color — same idea the recap story cards use for
// their cover-wall slide.
function hashHue(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % 360
}

// OpenLibrary (and some other hosts) return 200 OK with a 1x1 placeholder gif
// for isbns with no real cover, instead of a 404 — so treat any tiny decoded
// image as "no cover" too. Same check the recap story cards use.
const MIN_COVER_DIM = 4

// A finished item's cover for the grid: falls back to a generated color field
// (from title+author) when there's no image or it fails to load, so the shelf
// never shows an empty box — and carries the same TypeBadge overlay used on
// covers everywhere else in the app.
function FinishedCover({ url, title, author, type }: { url?: string; title?: string; author?: string; type: MediaType }) {
  const [broken, setBroken] = useState(!url)
  useEffect(() => setBroken(!url), [url])
  return (
    <>
      {broken ? (
        <span
          className="flex h-full w-full flex-col justify-between p-2"
          style={{ backgroundColor: `hsl(${hashHue(`${title || ''}${author || ''}`)}, 22%, 15%)` }}
        >
          {author && <span className="line-clamp-1 text-[9px] text-white/75">{author}</span>}
          <span className="line-clamp-4 text-center text-[10px] font-extrabold leading-tight text-white">{title}</span>
          <span />
        </span>
      ) : (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
          onLoad={(e) => {
            const img = e.currentTarget
            if (img.naturalWidth < MIN_COVER_DIM || img.naturalHeight < MIN_COVER_DIM) setBroken(true)
          }}
        />
      )}
      <TypeBadge type={type} position="top-1 right-1" size="h-5 w-5" iconSize="h-2.5 w-2.5" />
    </>
  )
}

// Simple vertical bar chart (12 months). Bars scale to the series max, drawn
// over a faint full-height track so empty months still read as part of the grid.
function BarChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const max = Math.max(1, ...values)
  return (
    <div className="flex h-40 items-end gap-1 sm:gap-2">
      {values.map((v, i) => (
        <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] font-semibold text-[var(--text)] opacity-0 transition-opacity group-hover:opacity-100">{v || ''}</span>
          <div className="relative w-full flex-1 overflow-hidden rounded-md bg-[color-mix(in_srgb,var(--container-2)_60%,transparent)]">
            <div
              title={`${labels[i]}: ${v}`}
              className="absolute bottom-0 w-full rounded-md transition-all duration-300 group-hover:brightness-110"
              style={{
                height: `${v ? Math.max((v / max) * 100, 6) : 0}%`,
                backgroundImage: v ? `linear-gradient(to top, color-mix(in srgb, ${color} 55%, transparent), ${color})` : undefined,
                backgroundColor: v ? undefined : 'transparent',
              }}
            />
          </div>
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
                strokeLinecap="butt"
                strokeDasharray={`${Math.max(len - 1.5, 0)} ${C - len + 1.5}`}
                strokeDashoffset={-offset}
                className="transition-all duration-300"
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
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 transition-colors hover:bg-[var(--surface-hover)]">
      <p className="text-xl font-bold leading-none text-[var(--text)]">{value}</p>
      <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">{label}</p>
    </div>
  )
}

// Month + year dropdowns for picking a single month within the finished range.
function MonthPicker({ value, onChange, min, max, locale }: { value: YM; onChange: (v: YM) => void; min: number; max: number; locale: string }) {
  const years = Array.from({ length: Math.max(1, max - min + 1) }, (_, i) => max - i)
  const monthName = (m: number) => new Date(2020, m, 1).toLocaleString(locale, { month: 'long' })
  return (
    <div className="flex items-center gap-1.5">
      <select value={value.m} onChange={(e) => onChange({ ...value, m: Number(e.target.value) })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)]">
        {Array.from({ length: 12 }, (_, m) => <option key={m} value={m}>{monthName(m)}</option>)}
      </select>
      <select value={value.y} onChange={(e) => onChange({ ...value, y: Number(e.target.value) })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)]">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
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
