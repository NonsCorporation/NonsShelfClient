'use client'

import { hashHue } from '@/lib/hashHue'
import { useEffect, useMemo, useRef, useState } from 'react'
import { IoChevronBack, IoChevronForward, IoBookOutline, IoFilmOutline, IoTvOutline, IoStar, IoHeartOutline, IoChatbubbleOutline, IoCheckmarkDoneOutline, IoLibraryOutline, IoTimeOutline, IoAlbumsOutline, IoPersonOutline, IoPeopleOutline, IoBarChartOutline, IoPieChartOutline, IoStatsChartOutline } from 'react-icons/io5'
import type { IconType } from 'react-icons'
import { authedFetch } from '../lib/api'
import { libraryService } from '../services/libraryService'
import type { MediaItem, MediaType } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { Link, useSearchParams } from '@/lib/router'
import { mediaPath } from '@/lib/paths'
import { buildRecap, fmtInt, fmtDuration } from '../lib/recap'
import type { CreditPerson } from '../lib/mediaMap'
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
const PMODES: PMode[] = ['month', 'months', 'year', 'custom']

// "YYYY-MM" → { y, m } (0-indexed month), for reading the recap period back out of the URL.
function parseYM(v: string | null): YM | null {
  const m = v ? /^(\d{4})-(\d{2})$/.exec(v) : null
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1 } : null
}
const fmtYM = (ym: YM) => `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`

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
  // Kept in sync with the URL (?pmode=...) so a recap is shareable/bookmarkable;
  // with no params present it defaults to the current month.
  const [searchParams, setSearchParams] = useSearchParams()
  const now0 = new Date()
  const pmodeParam = searchParams.get('pmode') as PMode | null
  const [pmode, setPmode] = useState<PMode>(pmodeParam && PMODES.includes(pmodeParam) ? pmodeParam : 'month')
  const [pMonth, setPMonth] = useState<YM>(() => parseYM(searchParams.get('month')) || { y: now0.getFullYear(), m: now0.getMonth() })
  const [pFrom, setPFrom] = useState<YM>(() => parseYM(searchParams.get('mfrom')) || { y: now0.getFullYear(), m: 0 })
  const [pTo, setPTo] = useState<YM>(() => parseYM(searchParams.get('mto')) || { y: now0.getFullYear(), m: now0.getMonth() })
  const [pYear, setPYear] = useState(() => {
    const y = Number(searchParams.get('year'))
    return y ? y : now0.getFullYear()
  })
  const [cFrom, setCFrom] = useState(() => searchParams.get('dfrom') || new Date(now0.getFullYear(), 0, 1).toISOString().slice(0, 10))
  const [cTo, setCTo] = useState(() => searchParams.get('dto') || now0.toISOString().slice(0, 10))
  const [recapOpen, setRecapOpen] = useState(false)
  // Media-type filter for the recap: 'all' or a single type (books / films / series).
  const [recapType, setRecapType] = useState<Axis>('all')
  // Photo of the recap's top author (fetched by uuid), shown instead of a book cover.
  const [topAuthorPhoto, setTopAuthorPhoto] = useState<string | undefined>(undefined)

  // Mirror the selected period into the URL (replacing, not pushing, so paging
  // through months doesn't spam history) — only the keys the active mode uses.
  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    ;['month', 'mfrom', 'mto', 'year', 'dfrom', 'dto'].forEach((k) => next.delete(k))
    next.set('pmode', pmode)
    if (pmode === 'month') next.set('month', fmtYM(pMonth))
    else if (pmode === 'months') {
      next.set('mfrom', fmtYM(pFrom))
      next.set('mto', fmtYM(pTo))
    } else if (pmode === 'year') next.set('year', String(pYear))
    else if (pmode === 'custom') {
      next.set('dfrom', cFrom)
      next.set('dto', cTo)
    }
    setSearchParams(next, { replace: true, scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pmode, pMonth, pFrom, pTo, pYear, cFrom, cTo])

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

  // Cast of each finished film/series, fetched lazily from /credits and cached by
  // media id so paging through periods only fetches titles not seen yet. The
  // denormalized details.cast (item.actors) gives names immediately; credits add
  // the person uuid + photo, which is what lets the actors section show avatars.
  const [castByMedia, setCastByMedia] = useState<Record<string, CreditPerson[]>>({})
  const castInflight = useRef<Set<string>>(new Set())
  useEffect(() => {
    const ids = recap.items
      .filter((i) => i.type !== 'book')
      .map((i) => i.id)
      .filter((id) => castByMedia[id] === undefined && !castInflight.current.has(id))
    if (ids.length === 0) return
    let cancelled = false
    ids.forEach((id) => castInflight.current.add(id))
    ;(async () => {
      const CONCURRENCY = 6
      for (let k = 0; k < ids.length && !cancelled; k += CONCURRENCY) {
        const batch = ids.slice(k, k + CONCURRENCY)
        const results = await Promise.all(
          batch.map(async (id): Promise<[string, CreditPerson[]]> => {
            try {
              const r = await authedFetch(`/api/media/${id}/credits`)
              const d = r.ok ? await r.json() : null
              const cast = Array.isArray(d?.cast)
                ? (d.cast as { person?: CreditPerson }[]).map((c) => c.person).filter((p): p is CreditPerson => !!p)
                : []
              return [id, cast]
            } catch {
              return [id, []]
            } finally {
              castInflight.current.delete(id)
            }
          }),
        )
        if (!cancelled) setCastByMedia((prev) => ({ ...prev, ...Object.fromEntries(results) }))
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recap.items])

  // Most-watched actors across the period's finished films & series: one tally per
  // title an actor appears in. Keyed by person uuid once credits load (carrying
  // their photo), falling back to the denormalized cast name until then — so the
  // list shows immediately and gains avatars as credits stream in.
  const topActors = useMemo(() => {
    type Actor = { uuid?: string; name: string; photo?: string; count: number; works: MediaItem[] }
    const map = new Map<string, Actor>()
    for (const i of recap.items) {
      if (i.type === 'book') continue
      const people = castByMedia[i.id]
      if (people && people.length > 0) {
        for (const p of people) {
          const key = p.uuid || `n:${p.name.toLowerCase()}`
          const a = map.get(key) || { uuid: p.uuid, name: p.name, photo: p.photo_url, count: 0, works: [] }
          a.count++
          a.works.push(i)
          if (!a.photo && p.photo_url) a.photo = p.photo_url
          map.set(key, a)
        }
      } else if (i.actors) {
        for (const raw of i.actors) {
          const name = raw.trim()
          if (!name) continue
          const key = `n:${name.toLowerCase()}`
          const a = map.get(key) || { name, count: 0, works: [] }
          a.count++
          a.works.push(i)
          map.set(key, a)
        }
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [recap.items, castByMedia])

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
    ...(recap.ratedCount
      ? [{ icon: IoStar, value: recap.avgRating.toFixed(1), label: t('recapAvg'), color: '#f5a623' }]
      : []),
    ...(recap.reviewCount
      ? [{ icon: IoChatbubbleOutline, value: recap.reviewCount, label: t('reviewsTitle'), color: '#c9c7d6' }]
      : []),
  ]

  // The hero's fanned hand of covers: the period's highest rated first, topped
  // up with the most recent finishes, five at most. Each gets a slot in the fan
  // assigned centre-out, so the best title sits front and middle. The first
  // one's cover also tints the hero's backdrop.
  const heroCovers = useMemo(() => {
    const seen = new Set<string>()
    const picked: MediaItem[] = []
    for (const i of [...recap.topRated, ...[...recap.items].reverse()]) {
      if (!i.coverUrl || seen.has(i.id)) continue
      seen.add(i.id)
      picked.push(i)
      if (picked.length === 5) break
    }
    const mid = (picked.length - 1) / 2
    const slots = picked.map((_, k) => k).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))
    return picked.map((item, k) => ({ item, slot: slots[k], off: slots[k] - mid }))
  }, [recap.topRated, recap.items])

  // The period drawn as a strip of cells — one per day for periods up to about
  // two months, one per month beyond that — each holding what was finished in
  // it. It's the hero's footer: the shape of the month at a glance.
  const rhythm = useMemo(() => {
    if (recap.items.length === 0) return null
    const start = new Date(period.from * 1000)
    const end = new Date(period.to * 1000 - 1000)
    const dayIndex = (d: Date) =>
      Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / 86_400_000)
    const days = dayIndex(end) + 1
    const byDay = days <= 62
    const count = byDay ? days : (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1
    if (count <= 0 || count > 240) return null
    const cells = Array.from({ length: count }, (_, k) => {
      const d = byDay
        ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + k)
        : new Date(start.getFullYear(), start.getMonth() + k, 1)
      const label = byDay
        ? d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
        : d.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
      return { label, items: [] as MediaItem[] }
    })
    for (const i of recap.items) {
      if (!i.finishedAt) continue
      const d = new Date(i.finishedAt)
      const k = byDay ? dayIndex(d) : (d.getFullYear() - start.getFullYear()) * 12 + d.getMonth() - start.getMonth()
      if (cells[k]) cells[k].items.push(i)
    }
    return { cells, byDay, max: Math.max(1, ...cells.map((c) => c.items.length)) }
  }, [recap.items, period, locale])

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
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">{t('recapHeading')}</h2>

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
              <DatePicker value={cFrom} onChange={setCFrom} max={cTo || undefined} placeholder="—" openUp={false} />
              <span className="text-[var(--text-muted)]">–</span>
              <DatePicker value={cTo} onChange={setCTo} min={cFrom || undefined} placeholder="—" openUp={false} />
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

        {/* Hero — the period as a poster: its best cover blurred into a colour
            wash behind the headline count, the top titles fanned out like a
            hand of cards, and the period's day-by-day rhythm along the bottom.
            Always dark, so it reads (and screenshots) the same in either theme. */}
        <div className="relative mb-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0f0e15]">
          {heroCovers[0] && (
            <img
              key={heroCovers[0].item.id}
              src={heroCovers[0].item.coverUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover opacity-60 blur-3xl saturate-150"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f0e15]/90 via-[#0f0e15]/60 to-[#0f0e15]/30" />
          <div className="relative z-10">
            {recap.counts.total === 0 ? (
              <div className="p-5 sm:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">{recapLabel}</p>
                <p className="mt-2 text-sm text-white/70">{t('recapEmpty')}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-7 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">{recapLabel}</p>
                    <div className="mt-2 flex items-baseline gap-3">
                      <p className="text-6xl font-bold leading-none tracking-tight text-white">{recap.counts.total}</p>
                      <p className="text-sm text-white/60">{t('recapFinishedTotal')}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                      {recapChips.map((c) => (
                        <span
                          key={c.label}
                          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] py-1 pl-2 pr-2.5 text-xs backdrop-blur-sm"
                        >
                          <c.icon className="h-3.5 w-3.5" style={{ color: c.color }} />
                          <span className="font-bold text-white">{c.value}</span>
                          <span className="text-white/60">{c.label}</span>
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => setRecapOpen(true)}
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90"
                    >
                      <IoAlbumsOutline className="h-4 w-4" />
                      {t('recapCreateCards')}
                    </button>
                  </div>

                  {heroCovers.length > 0 && (
                    <div
                      className="relative mx-auto h-[166px] flex-shrink-0 lg:mx-0 lg:mr-4"
                      style={{ width: 96 + (heroCovers.length - 1) * 40 }}
                    >
                      {heroCovers.map(({ item, slot, off }) => (
                        <span
                          key={item.id}
                          className="absolute top-1 block w-24 hover:z-20!"
                          style={{
                            left: slot * 40,
                            transform: `translateY(${Math.abs(off) * 7}px) rotate(${off * 6}deg)`,
                            zIndex: 10 - Math.round(Math.abs(off) * 2),
                          }}
                        >
                          <Link
                            to={mediaPath({ type: item.type, uuid: item.uuid, id: item.id })}
                            title={item.title}
                            className="relative block aspect-[2/3] overflow-hidden rounded-lg shadow-[0_12px_28px_-8px_rgba(0,0,0,0.85)] ring-1 ring-white/15 transition-transform duration-200 ease-out hover:-translate-y-2"
                          >
                            <FinishedCover url={item.coverUrl} title={item.title} author={item.author} type={item.type} badge={false} />
                          </Link>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {rhythm && (
                  <div className="border-t border-white/10 px-5 pb-4 pt-3.5 sm:px-7">
                    <div className="flex h-7 items-stretch gap-[3px]">
                      {rhythm.cells.map((c, k) => (
                        <span
                          key={k}
                          title={c.items.length ? `${c.label} · ${c.items.map((i) => i.title).join(', ')}` : c.label}
                          className="flex min-w-0 flex-1 flex-col-reverse gap-px overflow-hidden rounded-[3px] bg-white/[0.07]"
                        >
                          {rhythm.byDay
                            ? c.items.slice(0, 4).map((i) => (
                                <span key={i.id} className="flex-1" style={{ backgroundColor: TYPE_COLOR[i.type] }} />
                              ))
                            : c.items.length > 0 && (
                                <span
                                  className="w-full rounded-[3px] bg-[#8f90e0]"
                                  style={{ height: `${Math.max(18, (c.items.length / rhythm.max) * 100)}%` }}
                                />
                              )}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10px] text-white/40">
                      <span>{rhythm.cells[0].label}</span>
                      <span>{rhythm.cells[rhythm.cells.length - 1].label}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {recap.counts.total > 0 && (
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {/* Highest rated — a ranked row, the numeral doing the talking. */}
            {recap.topRated.length > 0 && (
              <div className="pb-4">
                <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <IoStar className="h-3.5 w-3.5" /> {t('recapTopRated')}
                </p>
                <ol className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
                  {recap.topRated.map((i, k) => (
                    <li key={i.id}>
                      <Link to={mediaPath({ type: i.type, uuid: i.uuid, id: i.id })} className="group/top flex items-center gap-2.5">
                        <span className="w-5 flex-shrink-0 text-center text-2xl font-bold leading-none text-[var(--border-strong)] transition-colors group-hover/top:text-[var(--text-muted)]">
                          {k + 1}
                        </span>
                        <span className="relative block aspect-[2/3] w-10 flex-shrink-0 overflow-hidden rounded-md ring-1 ring-black/5">
                          <FinishedCover url={i.coverUrl} title={i.title} author={i.author} type={i.type} badge={false} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-[var(--text)] group-hover/top:text-nonsprimary" title={i.title}>{i.title}</span>
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                            <IoStar className="h-3 w-3" style={{ color: '#f5a623' }} />
                            {((i.rating || 0) / 2).toFixed(1)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Most-read author */}
            {recap.authors.length > 0 && (
              <div className="py-4">
                <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <IoPersonOutline className="h-3.5 w-3.5" /> {t('recapMostReadAuthor')}
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  {topAuthorUuid ? (
                    <Link to={`/p/${topAuthorUuid}`} className="group/author flex items-center gap-3">
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--container-2)] ring-2 ring-[color-mix(in_srgb,var(--color-nonsprimary)_35%,transparent)] ring-offset-2 ring-offset-[var(--container)]">
                        {topAuthorPhoto ? (
                          <img src={topAuthorPhoto} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <IoPersonOutline className="h-5 w-5 text-[var(--placeholder)]" />
                        )}
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-[var(--text)] group-hover/author:text-nonsprimary">{recap.authors[0].name}</span>
                        <span className="text-sm text-[var(--text-muted)]">{t('recapAuthorCount', { n: recap.authors[0].count })}</span>
                      </div>
                    </Link>
                  ) : (
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
                  )}
                  {recap.authors.slice(1, 4).map((a) =>
                    a.makerUuid ? (
                      <Link key={a.name} to={`/p/${a.makerUuid}`} className="text-xs text-[var(--text-muted)] hover:text-nonsprimary hover:underline">
                        {a.name} · {a.count}
                      </Link>
                    ) : (
                      <span key={a.name} className="text-xs text-[var(--text-muted)]">{a.name} · {a.count}</span>
                    ),
                  )}
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
                        <Link
                          key={i.id}
                          to={mediaPath({ type: i.type, uuid: i.uuid, id: i.id })}
                          className="group/cover flex flex-col gap-1.5"
                        >
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
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Most-watched actors — cast tallied across the films & series finished in
          the recap period above, so it follows the same period selector. Hidden
          when the recap is narrowed to books (which have no cast). */}
      {recapType !== 'book' && (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text)]">
              <IoPeopleOutline className="h-4.5 w-4.5 text-[var(--text-muted)]" />
              {t('statsMostWatchedActors')}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{recapLabel}</p>
          </div>
          {topActors.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t('statsNoActors')}</p>
          ) : (
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {topActors.slice(0, 12).map((a) => {
                const shown = a.works.slice(0, 5)
                const extra = a.works.length - shown.length
                const nameBlock = (
                  <>
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--container-2)]">
                      {a.photo ? (
                        <img src={a.photo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <IoPersonOutline className="h-5 w-5 text-[var(--placeholder)]" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text)] group-hover/actor:text-nonsprimary" title={a.name}>
                        {a.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t('statsActorCount', { n: a.count })}</p>
                    </div>
                  </>
                )
                return (
                  <li
                    key={a.uuid || a.name}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] py-2.5 pl-2.5 pr-3"
                  >
                    {a.uuid ? (
                      <Link to={`/p/${a.uuid}`} className="group/actor flex min-w-0 flex-1 items-center gap-2.5 transition-colors">{nameBlock}</Link>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">{nameBlock}</div>
                    )}
                    {/* Works this actor appeared in, this period — a fanned deck of up to 5 covers,
                        with a "+m" badge over the last one when there are more. */}
                    {shown.length > 0 && (
                      <span className="flex flex-shrink-0 -space-x-3" title={a.works.map((w) => w.title).join(', ')}>
                        {shown.map((w, i) => (
                          <span
                            key={w.id}
                            className="relative h-7 w-5 overflow-hidden rounded-sm shadow-sm ring-2 ring-[var(--surface)]"
                            style={{ transform: `rotate(${(i - (shown.length - 1) / 2) * 8}deg)`, zIndex: i }}
                          >
                            {w.coverUrl ? (
                              <img src={w.coverUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span
                                className="flex h-full w-full items-center justify-center"
                                style={{ backgroundColor: `hsl(${hashHue(w.title)}, 22%, 20%)` }}
                              />
                            )}
                            {i === shown.length - 1 && extra > 0 && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[9px] font-bold text-white">
                                +{extra}
                              </span>
                            )}
                          </span>
                        ))}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      )}

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
          userAvatarUrl={user?.avatar_url}
          userHandle={user?.username}
        />
      )}

      {/* Summary cards */}
      {/* One panel split by hairlines rather than eight separate boxes: the
          1px gaps over the border-coloured grid background draw the dividers. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--border-subtle)] shadow-sm sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-[var(--container)] px-4 py-3.5 transition-colors hover:bg-[var(--container-2)]">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
              <c.icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: c.color }} />
              <span className="truncate">{c.label}</span>
            </p>
            <p className="mt-2 text-2xl font-bold leading-none tracking-tight text-[var(--text)]">{c.value}</p>
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

// One amber ramp for a 1..10 rating: a dim burnt orange at the bottom warming
// up to bright gold at the top, so the breakdown reads as a single scale.
function starColor(r: number): string {
  const k = (r - 1) / 9
  return `hsl(${Math.round(18 + k * 26)}, ${Math.round(55 + k * 35)}%, ${Math.round(34 + k * 26)}%)`
}

// Same generated no-cover placeholder colour as the recap story cards (see
// lib/hashHue). Re-exported so the reading calendar can draw it too.
export { hashHue }

// OpenLibrary (and some other hosts) return 200 OK with a 1x1 placeholder gif
// for isbns with no real cover, instead of a 404 — so treat any tiny decoded
// image as "no cover" too. Same check the recap story cards use.
const MIN_COVER_DIM = 4

// A finished item's cover for the grid: falls back to a generated color field
// (from title+author) when there's no image or it fails to load, so the shelf
// never shows an empty box — and carries the same TypeBadge overlay used on
// covers everywhere else in the app.
function FinishedCover({ url, title, author, type, badge = true }: { url?: string; title?: string; author?: string; type: MediaType; badge?: boolean }) {
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
      {badge && <TypeBadge type={type} position="top-1 right-1" size="h-5 w-5" iconSize="h-2.5 w-2.5" />}
    </>
  )
}

// Simple vertical bar chart (12 months). Bars scale to the series max and
// stand on a shared baseline, each with its count above it; the best month is
// drawn at full strength and the rest slightly held back, so the peak reads
// first. Empty months keep a short stub so the year still reads as 12 slots.
function BarChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const max = Math.max(1, ...values)
  return (
    <div className="flex h-44 items-stretch gap-1.5 sm:gap-3">
      {values.map((v, i) => {
        const peak = v > 0 && v === max
        return (
          <div key={i} className="group flex flex-1 flex-col items-center" title={`${labels[i]}: ${v}`}>
            {/* Heights come from flex-grow shares (spacer vs bar) rather than a
                percentage height, which needs no definite parent height. */}
            <div className="flex w-full flex-1 flex-col items-center border-b border-[var(--border)]">
              <span style={{ flex: `${1 - (v / max) * 0.85} 1 0%` }} />
              <span className={`mb-1 text-[10px] font-semibold tabular-nums ${peak ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
                {v || ''}
              </span>
              <div
                className="w-full max-w-9 rounded-t-md transition-all duration-300 group-hover:opacity-100"
                style={{
                  flex: v ? `${(v / max) * 0.85} 1 0%` : '0 0 3px',
                  minHeight: v ? 6 : undefined,
                  opacity: v ? (peak ? 1 : 0.7) : 1,
                  backgroundImage: v ? `linear-gradient(to top, color-mix(in srgb, ${color} 35%, transparent), ${color})` : undefined,
                  backgroundColor: v ? undefined : 'var(--container-2)',
                }}
              />
            </div>
            <span className={`mt-1.5 text-[9px] uppercase sm:text-[10px] ${peak ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
              {labels[i]}
            </span>
          </div>
        )
      })}
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
