import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from '@/lib/router';
import Layout from '../components/layout/Layout.tsx';
import {
    IoDownloadOutline,
    IoChevronBack,
    IoChevronForward,
    IoGridOutline,
    IoCalendarOutline,
    IoBookOutline
} from 'react-icons/io5';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { libraryService } from '../services/libraryService.ts';
import type { MediaItem, MediaType } from '../types.ts';
import type { ReadingSpan, PageEntry } from '../services/libraryService.ts';
import { mediaPath } from '../lib/paths.ts';
import { coverColor } from '../lib/coverColor.ts';
import Statistics from './Statistics.tsx';

const DAY_MS = 86_400_000;

// Highlighter-ish key colors, one per item read in the visible month. Tuned to
// stay legible on both themes; cycled if a month has more items than colors.
const BAR_COLORS = [
    '#e0a458', // amber
    '#f472b6', // pink
    '#7c8cff', // indigo
    '#4fd1c5', // teal
    '#fb7185', // rose
    '#a78bfa', // violet
    '#34d399', // emerald
    '#fbbf24', // yellow
];

// How many reads get a full, title-carrying bar. Kept low — both because a
// label needs height to stay legible, and because the row height is fixed at
// full capacity (see .reading-cal-row), so every lane reserved here is height
// every week pays on mobile whether or not it's used that month.
const MAX_LANES = 3;

// Reads beyond MAX_LANES are drawn as bare thin lines — no room for a title, but
// the stretch and its color still show, so a busy month degrades gracefully
// instead of collapsing into a "+N". Past this they're dropped entirely.
const MAX_THIN_LANES = 3;

// Black or white, whichever reads better on a given bar color — so a label
// stays legible whether the dominant color landed pale or deep.
function readableTextColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#1a1a1a' : '#ffffff';
}

export default function CalendarPage() {
    const { t, language } = useLanguage();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [items, setItems] = useState<MediaItem[]>([]);
    const [spans, setSpans] = useState<ReadingSpan[]>([]);
    const [pageEntries, setPageEntries] = useState<PageEntry[]>([]);

    // Top-level page tab: the statistics dashboard (default), or the calendar view.
    const [tab, setTab] = useState<'calendar' | 'stats'>('stats');
    // tracks the active view style
    const [viewMode, setViewMode] = useState<'calendar' | 'github'>('calendar');
    // Filter the calendar by media type (books / films / series).
    const [typeFilter, setTypeFilter] = useState<'all' | MediaType>('all');
    // Overlay each day with how many book pages were read that day.
    const [showPages, setShowPages] = useState(false);
    // Hovering a bar or a key entry isolates that book across the whole month.
    const [hoveredBook, setHoveredBook] = useState<number | null>(null);

    useEffect(() => {
        libraryService.getItems().then(setItems);
    }, []);

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Reading/watching spans for the visible year, from the activity log. Fetched
    // a year at a time so month navigation within the year needs no refetch.
    useEffect(() => {
        const from = Math.floor(new Date(currentYear, 0, 1).getTime() / 1000);
        const to = Math.floor(new Date(currentYear, 11, 31, 23, 59, 59).getTime() / 1000);
        let cancelled = false;
        libraryService.getCalendar(from, to).then((d) => {
            if (!cancelled) setSpans(d.reading);
        });
        return () => { cancelled = true; };
    }, [currentYear]);

    // Every item read/watched during the visible month, with the set of days it
    // covers and a stable color — the bullet-journal "key" the bars are drawn
    // from. Colors are assigned in first-read order so they stay put as long as
    // the month does.
    const monthBooks = useMemo(() => {
        const monthStart = new Date(currentYear, currentMonth, 1).getTime();
        const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).getTime();
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 0);

        // A book can have several spans in one month (a re-read), so days from
        // every span of the same media collapse into one set.
        const byId = new Map<number, {
            id: number; title: string; to: string; cover?: string;
            days: Set<number>; endDay: number | null;
        }>();
        spans.forEach((s) => {
            if (!s.media) return;
            if (typeFilter !== 'all' && s.media.type !== typeFilter) return;
            const startMs = s.started_at * 1000;
            const endMs = s.finished_at ? s.finished_at * 1000 : todayEnd.getTime();
            // Clamp the span to the current month before walking its days.
            const from = Math.max(startMs, monthStart);
            const to = Math.min(endMs, monthEnd);
            if (from > to) return;
            let entry = byId.get(s.media.id);
            if (!entry) {
                entry = {
                    id: s.media.id,
                    title: s.media.title || '',
                    to: mediaPath({ type: s.media.type, uuid: s.media.uuid, id: String(s.media.id) }),
                    cover: s.media.cover_url || undefined,
                    days: new Set<number>(),
                    endDay: null,
                };
                byId.set(s.media.id, entry);
            }
            for (let t = new Date(from).setHours(0, 0, 0, 0); t <= to; t += DAY_MS) {
                entry.days.add(new Date(t).getDate());
            }
            // The day the read actually wrapped up, when that lands in view —
            // the calendar marks it with the cover.
            if (s.finished_at) {
                const fin = new Date(s.finished_at * 1000);
                if (fin.getFullYear() === currentYear && fin.getMonth() === currentMonth) {
                    entry.endDay = fin.getDate();
                }
            }
        });

        return [...byId.values()]
            .map((b) => ({ ...b, firstDay: Math.min(...b.days) }))
            .sort((a, b) => a.firstDay - b.firstDay || a.title.localeCompare(b.title));
    }, [spans, currentYear, currentMonth, typeFilter]);

    // Dominant cover colors, resolved lazily off the artwork itself. Books whose
    // cover can't be read (no image, or a host that blocks canvas reads) keep
    // their palette fallback, so the key is always fully colored either way.
    const [coverColors, setCoverColors] = useState<Record<string, string>>({});
    const coverKey = monthBooks.map((b) => b.cover ?? '').join('|');
    useEffect(() => {
        let cancelled = false;
        monthBooks.forEach((b) => {
            if (!b.cover) return;
            coverColor(b.cover).then((c) => {
                if (!c || cancelled) return;
                setCoverColors((prev) => (prev[b.cover!] === c ? prev : { ...prev, [b.cover!]: c }));
            });
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coverKey]);

    // The month's books with a resolved color and a lane each. Lanes are packed
    // greedily across the whole month (not per week): a book holds its lane for
    // as long as it's being read, so a long read draws one unbroken band down
    // the page instead of hopping rows every Monday. Reads that don't overlap in
    // time reuse the same lane, which keeps the grid short.
    const books = useMemo(() => {
        const laneLastDay: number[] = [];
        return monthBooks.map((b, i) => {
            const lastDay = Math.max(...b.days);
            let lane = laneLastDay.findIndex((end) => end < b.firstDay);
            if (lane === -1) lane = laneLastDay.length;
            laneLastDay[lane] = lastDay;
            return {
                ...b,
                lane,
                color: (b.cover && coverColors[b.cover]) || BAR_COLORS[i % BAR_COLORS.length],
            };
        });
    }, [monthBooks, coverColors]);

    // Vertical offset of a lane's bar, in CSS calc form — labelled lanes stack
    // from the top, thin overflow lanes continue underneath them.
    const laneTop = (lane: number) =>
        lane < MAX_LANES
            ? `calc(var(--cal-top) + ${lane} * (var(--cal-bar) + var(--cal-gap)))`
            : `calc(var(--cal-top) + ${MAX_LANES} * (var(--cal-bar) + var(--cal-gap)) + ${lane - MAX_LANES} * (var(--cal-thin) + var(--cal-thin-gap)))`;

    // Book page-progress deltas for the visible year, fetched a year at a time
    // like the reading spans — powers the "Reading calendar" tab.
    useEffect(() => {
        const from = Math.floor(new Date(currentYear, 0, 1).getTime() / 1000);
        const to = Math.floor(new Date(currentYear, 11, 31, 23, 59, 59).getTime() / 1000);
        let cancelled = false;
        libraryService.getPagesRead(from, to).then((d) => {
            if (!cancelled) setPageEntries(d);
        });
        return () => { cancelled = true; };
    }, [currentYear]);

    // Sum each day's page deltas into the current month, bucketed by local day
    // (each entry's `at` is a server timestamp, so the offset trick below keeps
    // it on the day the reader actually saw, same as yearlyActivity below).
    const currentMonthPages = useMemo(() => {
        const grouped: Record<number, number> = {};
        pageEntries.forEach((e) => {
            const date = new Date(e.at * 1000);
            if (date.getFullYear() !== currentYear || date.getMonth() !== currentMonth) return;
            const day = date.getDate();
            grouped[day] = (grouped[day] || 0) + e.pages;
        });
        return grouped;
    }, [pageEntries, currentYear, currentMonth]);

    // calculate daily totals for the entire year
    const yearlyActivity = useMemo(() => {
        const counts: Record<string, number> = {};
        items.forEach(item => {
            if (!item.dateAdded) return;
            const date = new Date(item.dateAdded);
            if (date.getFullYear() === currentYear) {
                // adjust for local timezone to get accurate yyyy-mm-dd
                const dateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                counts[dateString] = (counts[dateString] || 0) + 1;
            }
        });
        return counts;
    }, [items, currentYear]);

    // column index for the first day of each month, used to position month labels
    const githubMonthPositions = useMemo(() => {
        const startDate = new Date(currentYear, 0, 1);
        const startDay = startDate.getDay();
        const offset = startDay === 0 ? 6 : startDay - 1;
        const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let dayCount = 0;
        return shortMonths.map((month, m) => {
            const col = Math.floor((offset + dayCount) / 7);
            dayCount += new Date(currentYear, m + 1, 0).getDate();
            return { month, col };
        });
    }, [currentYear]);

    const GITHUB_GAP = 2;
    const GITHUB_NUM_COLS = 53;
    const GITHUB_LEFT = 28;

    const [githubCellSize, setGithubCellSize] = useState(14);
    const githubObsRef = useRef<ResizeObserver | null>(null);

    const githubContainerRef = useCallback((el: HTMLDivElement | null) => {
        githubObsRef.current?.disconnect();
        if (!el) return;
        const obs = new ResizeObserver(([entry]) => {
            const w = entry.contentRect.width;
            const available = w - GITHUB_LEFT - (GITHUB_NUM_COLS - 1) * GITHUB_GAP;
            const size = Math.min(14, Math.max(6, Math.floor(available / GITHUB_NUM_COLS)));
            setGithubCellSize(size);
        });
        obs.observe(el);
        githubObsRef.current = obs;
    }, []);

    // map out every day of the selected year plus empty offset days
    const githubGridDays = useMemo(() => {
        const days = [];
        const startDate = new Date(currentYear, 0, 1);
        const endDate = new Date(currentYear, 11, 31);
        
        // determine offset to start grid on monday
        const startDay = startDate.getDay();
        const offset = startDay === 0 ? 6 : startDay - 1;
        
        for (let i = 0; i < offset; i++) {
            days.push(null);
        }

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            days.push(new Date(d));
        }
        
        return days;
    }, [currentYear]);

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // find first day index, adjusting so monday=0
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    // The month split into week rows. Each row carries "runs" — one per unbroken
    // stretch of days a book was read within that week — rather than a bar
    // segment per cell. A run is drawn as a single element spanning its columns,
    // so the title is written once across the whole stretch instead of repeating
    // (and truncating) in all seven cells.
    const weeks = useMemo(() => {
        const cells: (number | null)[] = [];
        for (let i = 0; i < startOffset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);

        type Run = {
            book: typeof books[number];
            startCol: number;
            /** Column span, in days. Halved on the end to mark a finish. */
            length: number;
            /** The read wrapped up on this run's last day. */
            finishes: boolean;
            /** Past the labelled tier — drawn as a bare line, no title. */
            thin: boolean;
        };

        const rows: { days: (number | null)[]; runs: Run[] }[] = [];
        for (let i = 0; i < cells.length; i += 7) {
            const days = cells.slice(i, i + 7);
            const present = days.filter((d): d is number => d !== null);
            const active = books.filter((b) => present.some((d) => b.days.has(d)));
            const runs: Run[] = [];

            active.forEach((book) => {
                if (book.lane >= MAX_LANES + MAX_THIN_LANES) return;
                const thin = book.lane >= MAX_LANES;
                let start = -1;
                for (let col = 0; col <= 7; col++) {
                    const d = col < 7 ? days[col] : null;
                    const on = d !== null && book.days.has(d);
                    if (on && start === -1) start = col;
                    if (!on && start !== -1) {
                        const lastDay = days[col - 1] as number;
                        runs.push({ book, startCol: start, length: col - start, finishes: book.endDay === lastDay, thin });
                        start = -1;
                    }
                }
            });

            rows.push({ days, runs });
        }
        return rows;
    }, [startOffset, daysInMonth, books]);

    // Localized "June 2026" rather than a terse "06/2026".
    const displayMonth = currentDate.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'long', year: 'numeric' });
    const now = new Date();
    const isThisMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();

    const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    
    // determines color intensity class based on activity count
    const getActivityColor = (count: number) => {
        if (count === 0) return 'bg-[var(--surface-hover)]';
        if (count === 1) return 'bg-nonsprimary/30';
        if (count === 2) return 'bg-nonsprimary/50';
        if (count >= 3) return 'bg-nonsprimary';
        return 'bg-[var(--surface-hover)]';
    };

    return (
        <Layout>
                {/* Page tabs: Statistics | Calendar */}
                <div className="mb-6 flex gap-1 border-b border-[var(--border-subtle)]">
                    {([['stats', t('statistics')], ['calendar', t('calendar')]] as const).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                tab === key
                                    ? 'border-nonsprimary text-[var(--text)]'
                                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab === 'stats' ? <Statistics /> : (<>
                {/* header actions & title */}
                <div className="flex justify-between items-center mb-6 border-b border-[var(--border-subtle)] pb-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-[var(--text)] tracking-tight">{t('mediaCalendar')}</h1>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setViewMode(prev => prev === 'calendar' ? 'github' : 'calendar')}
                            className="w-10 h-10 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-full flex items-center justify-center transition-colors"
                            title={viewMode === 'calendar' ? 'switch to github view' : 'switch to calendar view'}
                        >
                            {viewMode === 'calendar' ? (
                                <IoGridOutline className="w-5 h-5 text-[var(--text)]" />
                            ) : (
                                <IoCalendarOutline className="w-5 h-5 text-[var(--text)]" />
                            )}
                        </button>
                        {/* Overlay each day with that day's page count (books only). */}
                        <button
                            onClick={() => setShowPages((v) => !v)}
                            title={t('showPagesRead')}
                            aria-pressed={showPages}
                            className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
                                showPages
                                    ? 'border-nonsprimary bg-nonsprimary text-white'
                                    : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
                            }`}
                        >
                            <IoBookOutline className="w-5 h-5" />
                        </button>
                        <button className="w-10 h-10 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-full flex items-center justify-center transition-colors">
                            <IoDownloadOutline className="w-5 h-5 text-[var(--text)]" />
                        </button>
                    </div>
                </div>

                {/* subtitle & month navigation — compact stepper, not a big pill */}
                <div className="mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[var(--text-muted)]">{t('calendarSubtitle')}</p>

                    <div className="flex items-center gap-1 self-start sm:self-auto">
                        {!isThisMonth && (
                            <button
                                onClick={() => setCurrentDate(new Date())}
                                className="mr-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-nonsprimary hover:text-nonsprimary"
                            >
                                {t('today')}
                            </button>
                        )}
                        <button
                            onClick={prevMonth}
                            aria-label={t('prev') || 'Previous'}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                        >
                            <IoChevronBack className="h-4 w-4" />
                        </button>
                        <h2 className="min-w-[8rem] text-center text-sm font-semibold text-[var(--text)]">
                            {viewMode === 'calendar' ? displayMonth : currentYear}
                        </h2>
                        <button
                            onClick={nextMonth}
                            aria-label={t('next') || 'Next'}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                        >
                            <IoChevronForward className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* media-type filter — scopes the calendar to one type. */}
                {viewMode === 'calendar' && (
                    <div className="mb-4 flex w-fit rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
                        {([
                            { key: 'all', label: t('all') },
                            { key: 'book', label: t('books') },
                            { key: 'movie', label: t('movies') },
                            { key: 'series', label: t('seriesPlural') },
                        ] as { key: 'all' | MediaType; label: string }[]).map((tg) => (
                            <button
                                key={tg.key}
                                onClick={() => setTypeFilter(tg.key)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                    typeFilter === tg.key
                                        ? 'bg-[var(--surface-active)] text-[var(--text)]'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                                }`}
                            >
                                {tg.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* view container */}
                <div className={`bg-[var(--container)] border border-[var(--border-subtle)] rounded-2xl p-4 md:p-6${viewMode === 'github' ? ' w-fit' : ''}`}>
                    {viewMode === 'calendar' ? (
                        <>
                            <div className="grid grid-cols-7 mb-2 text-center text-[10px] md:text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                                <div>{t('mon')}</div>
                                <div>{t('tue')}</div>
                                <div>{t('wed')}</div>
                                <div>{t('thu')}</div>
                                <div>{t('fri')}</div>
                                <div>{t('sat')}</div>
                                <div className="text-nonslightred">{t('sun')}</div>
                            </div>

                            {/* Each week is two layers: the day cells underneath (numbers, today
                                tint, finished covers), and one absolutely-positioned bar per
                                reading run on top. Spanning the run rather than tiling per cell
                                is what lets a title be written once across the whole stretch. */}
                            <div className="reading-cal flex flex-col gap-px overflow-hidden rounded-xl bg-[var(--border-subtle)]">
                                {weeks.map((week, wi) => (
                                    <div key={wi} className="reading-cal-row relative">
                                        {/* ── Layer 1: day cells ── */}
                                        <div className="absolute inset-0 grid grid-cols-7 gap-px">
                                            {week.days.map((day, di) => {
                                                if (day === null) return <div key={di} className="bg-[var(--container)]" />;
                                                const pages = currentMonthPages[day] || 0;
                                                const isSunday = di === 6;
                                                const isToday = isThisMonth && day === now.getDate();

                                                return (
                                                    <div
                                                        key={di}
                                                        className={`relative ${isToday ? 'bg-nonsprimary/10' : isSunday ? 'bg-[var(--surface)]/30' : 'bg-[var(--container)]'}`}
                                                    >
                                                        <span className={`absolute left-1.5 top-0.5 text-[10px] font-semibold leading-tight md:text-xs ${
                                                            isToday ? 'text-nonsprimary' : isSunday ? 'text-nonslightred' : 'text-[var(--text-muted)]'
                                                        }`}>
                                                            {day}
                                                        </span>

                                                        {showPages && pages > 0 && (
                                                            <span
                                                                title={t('pagesReadCount', { count: pages })}
                                                                className="absolute right-1.5 top-0.5 text-[9px] font-medium leading-tight text-[var(--text-muted)] md:text-[10px]"
                                                            >
                                                                {pages}p
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* ── Layer 2: reading runs ── */}
                                        <div className="pointer-events-none absolute inset-0">
                                            {week.runs.map((run, ri) => {
                                                // A finished read stops halfway through its last day, so the
                                                // line visibly trails off into the cover below it.
                                                const span = run.length - (run.finishes ? 0.5 : 0);
                                                const dim = hoveredBook !== null && hoveredBook !== run.book.id;
                                                const barHeight = run.thin ? 'var(--cal-thin)' : 'var(--cal-bar)';
                                                return (
                                                    <Fragment key={ri}>
                                                        <Link
                                                            to={run.book.to}
                                                            title={run.book.title}
                                                            onMouseEnter={() => setHoveredBook(run.book.id)}
                                                            onMouseLeave={() => setHoveredBook(null)}
                                                            className={`pointer-events-auto absolute flex items-center overflow-hidden rounded-full text-[7px] font-semibold leading-none transition-opacity duration-150 md:text-[10px] ${run.thin ? '' : 'px-1.5'} ${dim ? 'opacity-25' : 'hover:opacity-80'}`}
                                                            style={{
                                                                left: `calc(${(run.startCol / 7) * 100}% + var(--cal-inset))`,
                                                                width: `calc(${(span / 7) * 100}% - var(--cal-inset) * 2)`,
                                                                top: laneTop(run.book.lane),
                                                                height: barHeight,
                                                                backgroundColor: run.book.color,
                                                                color: readableTextColor(run.book.color),
                                                            }}
                                                        >
                                                            {/* Written once per run — a one-day sliver has no room,
                                                                and a thin overflow line has no height for it. */}
                                                            {!run.thin && span > 1 && <span className="truncate whitespace-nowrap">{run.book.title}</span>}
                                                        </Link>

                                                        {/* The finish itself: a cover badge centered in its day
                                                            cell (both axes), overlapping whatever lines pass
                                                            through that cell rather than sitting in dedicated
                                                            space of its own. Two books finishing the same day is
                                                            the one case where badges can land on top of each
                                                            other, since centering no longer keys off a lane. */}
                                                        {run.finishes && (
                                                            <Link
                                                                to={run.book.to}
                                                                title={run.book.title}
                                                                onMouseEnter={() => setHoveredBook(run.book.id)}
                                                                onMouseLeave={() => setHoveredBook(null)}
                                                                className={`pointer-events-auto absolute z-10 overflow-hidden rounded-[2px] shadow-md shadow-black/40 ring-1 ring-black/25 transition-transform hover:z-20 hover:scale-125 ${dim ? 'opacity-25' : ''}`}
                                                                style={{
                                                                    left: `calc(${((run.startCol + run.length - 0.5) / 7) * 100}% - var(--cal-cover-w) / 2)`,
                                                                    top: 'calc(50% - var(--cal-cover-h) / 2)',
                                                                    width: 'var(--cal-cover-w)',
                                                                    height: 'var(--cal-cover-h)',
                                                                }}
                                                            >
                                                                {run.book.cover ? (
                                                                    <img src={run.book.cover} alt={run.book.title} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <span className="block h-full w-full" style={{ backgroundColor: run.book.color }} />
                                                                )}
                                                            </Link>
                                                        )}
                                                    </Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Key — which color is which book, as on a bullet-journal spread.
                                Hovering an entry isolates that book's bars in the grid above. */}
                            {books.length > 0 ? (
                                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--border-subtle)] pt-4">
                                    {books.map((book) => (
                                        <Link
                                            key={book.id}
                                            to={book.to}
                                            onMouseEnter={() => setHoveredBook(book.id)}
                                            onMouseLeave={() => setHoveredBook(null)}
                                            className={`flex items-center gap-2 text-xs transition-colors ${
                                                hoveredBook !== null && hoveredBook !== book.id
                                                    ? 'text-[var(--placeholder)]'
                                                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                                            }`}
                                        >
                                            <span className="h-2 w-6 shrink-0 rounded-full md:h-2.5" style={{ backgroundColor: book.color }} />
                                            <span className="max-w-[13rem] truncate">{book.title}</span>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-4 border-t border-[var(--border-subtle)] pt-4 text-center text-sm text-[var(--placeholder)]">
                                    {t('nothingInProgress')}
                                </p>
                            )}
                        </>
                    ) : (
                        <div ref={githubContainerRef} className="w-full overflow-x-auto pb-2">
                            <div className="inline-flex flex-col gap-2">
                                {/* Month labels */}
                                <div className="relative h-4" style={{ marginLeft: `${GITHUB_LEFT}px` }}>
                                    {githubMonthPositions.map(({ month, col }) => (
                                        <span
                                            key={month}
                                            className="absolute text-[10px] font-medium leading-none text-[var(--text-muted)]"
                                            style={{ left: `${col * (githubCellSize + GITHUB_GAP)}px` }}
                                        >
                                            {month}
                                        </span>
                                    ))}
                                </div>
                                {/* Day labels + heat grid */}
                                <div className="flex" style={{ gap: `${GITHUB_GAP}px` }}>
                                    {/* Day of week labels */}
                                    <div className="flex w-6 shrink-0 flex-col" style={{ gap: `${GITHUB_GAP}px` }}>
                                        {['Mo', '', 'We', '', 'Fr', '', 'Su'].map((label, i) => (
                                            <div key={i} className="flex items-center justify-end pr-0.5" style={{ height: `${githubCellSize}px` }}>
                                                <span className="text-[9px] leading-none text-[var(--text-muted)]">{label}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Heat grid */}
                                    <div
                                        className="inline-grid grid-rows-7 grid-flow-col"
                                        style={{ gap: `${GITHUB_GAP}px` }}
                                    >
                                        {githubGridDays.map((date, i) => {
                                            if (!date) return <div key={`empty-git-${i}`} style={{ width: githubCellSize, height: githubCellSize }} />;
                                            const dateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                                            const count = yearlyActivity[dateString] || 0;
                                            return (
                                                <div
                                                    key={dateString}
                                                    title={`${dateString}: ${count} items`}
                                                    className={`rounded-sm transition-colors ${getActivityColor(count)}`}
                                                    style={{ width: githubCellSize, height: githubCellSize }}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                </>)}
        </Layout>
    );
}