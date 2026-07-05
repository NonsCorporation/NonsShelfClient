'use client'

import { useEffect, useMemo, useState } from 'react'
import { IoChevronBack, IoChevronForward, IoBookOutline, IoFilmOutline, IoTvOutline, IoStar, IoStarHalf, IoStarOutline, IoHeartOutline, IoChatbubbleOutline, IoCheckmarkDoneOutline, IoLibraryOutline, IoTimeOutline, IoSparklesOutline, IoPersonOutline } from 'react-icons/io5'
import type { IconType } from 'react-icons'
import { authedFetch } from '../lib/api'
import { libraryService } from '../services/libraryService'
import type { MediaItem, MediaType } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { buildRecap, fmtInt, fmtDuration } from '../lib/recap'
import RecapStories from '../components/RecapStories.tsx'

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
  const [includeAuthor, setIncludeAuthor] = useState(true)
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

  return (
    <div className="flex flex-col gap-6">
      {/* Recap — pick any period, see a detailed breakdown, generate story cards */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">{t('recapHeading')}</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{recapLabel}</p>
          </div>
          <button
            onClick={() => setRecapOpen(true)}
            disabled={recap.counts.total === 0}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-nonsprimary)] px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <IoSparklesOutline className="h-4 w-4" /> {t('recapCreateCards')}
          </button>
        </div>

        {/* Mode tabs */}
        <div className="mb-3 flex flex-wrap gap-1 rounded-xl bg-[var(--surface)] p-1">
          {modeTabs.map((o) => (
            <button
              key={o.key}
              onClick={() => setPmode(o.key)}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                pmode === o.key ? 'bg-[var(--container)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Period controls */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
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
              <input type="date" value={cFrom} max={cTo} onChange={(e) => setCFrom(e.target.value)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text)]" />
              <span className="text-[var(--text-muted)]">–</span>
              <input type="date" value={cTo} min={cFrom} onChange={(e) => setCTo(e.target.value)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text)]" />
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

        {recap.counts.total === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">{t('recapEmpty')}</p>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Headline period numbers — per-type tiles only when showing all types;
                pages only when books are in scope. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <PeriodStat icon={IoCheckmarkDoneOutline} value={recap.counts.total} label={t('statFinished')} color="var(--text)" />
              {recapType === 'all' && <PeriodStat icon={IoBookOutline} value={recap.counts.books} label={t('statBooks')} color={TYPE_COLOR.book} />}
              {recapType === 'all' && <PeriodStat icon={IoFilmOutline} value={recap.counts.movies} label={t('statMovies')} color={TYPE_COLOR.movie} />}
              {recapType === 'all' && <PeriodStat icon={IoTvOutline} value={recap.counts.series} label={t('seriesPlural')} color={TYPE_COLOR.series} />}
              {(recapType === 'all' || recapType === 'book') && <PeriodStat icon={IoLibraryOutline} value={fmtInt(recap.pages, locale)} label={t('statsPages')} color="#c2557a" />}
              <PeriodStat icon={IoTimeOutline} value={recap.minutes ? fmtDuration(recap.minutes) : '—'} label={t('recapTimeSpent')} color="#4fd1c5" />
            </div>

            {/* Most-read author (optional) */}
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <input type="checkbox" checked={includeAuthor} onChange={(e) => setIncludeAuthor(e.target.checked)} className="accent-[var(--color-nonsprimary)]" />
              {t('recapIncludeAuthor')}
            </label>
            {includeAuthor && recap.authors.length > 0 && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <IoPersonOutline className="h-3.5 w-3.5" /> {t('recapMostReadAuthor')}
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--container-2)]">
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

            {/* Detailed list of what was finished in the period */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t('recapWhatYouFinished')}</p>
              <ul className="flex flex-col divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl border border-[var(--border-subtle)]">
                {recap.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 bg-[var(--surface)] px-3 py-2">
                    <span className="h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
                      {i.coverUrl && <img src={i.coverUrl} alt="" className="h-full w-full object-cover" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{i.title}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">{i.author}</p>
                    </div>
                    {typeof i.rating === 'number' && i.rating > 0 && <MiniStars rating={i.rating} />}
                    <span className="w-16 flex-shrink-0 text-right text-[11px] text-[var(--text-muted)]">
                      {i.finishedAt ? new Date(i.finishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : ''}
                    </span>
                  </li>
                ))}
              </ul>
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
        />
      )}

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

// A compact stat tile for the recap period headline.
function PeriodStat({ icon: Icon, value, label, color }: { icon: IconType; value: string | number; label: string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <Icon className="h-4 w-4" style={{ color }} />
      <p className="mt-1.5 text-xl font-bold leading-none text-[var(--text)]">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
    </div>
  )
}

// Five-star (half-step) rating for the finished list rows.
function MiniStars({ rating }: { rating: number }) {
  return (
    <span className="flex flex-shrink-0 items-center gap-0.5" style={{ color: '#f5a623' }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const v = (i + 1) * 2
        if (rating >= v) return <IoStar key={i} className="h-3 w-3" />
        if (rating === v - 1) return <IoStarHalf key={i} className="h-3 w-3" />
        return <IoStarOutline key={i} className="h-3 w-3" style={{ color: 'var(--container-2)' }} />
      })}
    </span>
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
