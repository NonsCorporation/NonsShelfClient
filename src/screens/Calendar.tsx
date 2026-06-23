import { useState, useEffect, useMemo } from 'react';
import { Link } from '@/lib/router';
import Layout from '../components/layout/Layout.tsx';
import {
    IoOptionsOutline,
    IoDownloadOutline,
    IoChevronBack,
    IoChevronForward,
    IoGridOutline,
    IoCalendarOutline
} from 'react-icons/io5';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { libraryService } from '../services/libraryService.ts';
import type { MediaItem, MediaType } from '../types.ts';
import type { ReadingSpan } from '../services/libraryService.ts';
import { mediaPath } from '../lib/paths.ts';
import Statistics from './Statistics.tsx';

const DAY_MS = 86_400_000;

export default function CalendarPage() {
    const { t, language } = useLanguage();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [items, setItems] = useState<MediaItem[]>([]);
    const [spans, setSpans] = useState<ReadingSpan[]>([]);

    // Top-level page tab: the existing calendar, or the statistics dashboard.
    const [tab, setTab] = useState<'calendar' | 'stats'>('calendar');
    // tracks the active view style
    const [viewMode, setViewMode] = useState<'calendar' | 'github'>('calendar');
    // Filter the calendar by media type (books / films / series).
    const [typeFilter, setTypeFilter] = useState<'all' | MediaType>('all');

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

    // Place each reading span on every day it covers within the current month, so
    // a book read over several days shows across those days (ongoing → to today).
    const currentMonthItems = useMemo(() => {
        const grouped: Record<number, { to: string; cover?: string; title: string }[]> = {};
        // A book can have overlapping spans (e.g. a re-read), so track which media
        // ids are already placed on a given day and show each at most once per day.
        const seenPerDay: Record<number, Set<number>> = {};
        const monthStart = new Date(currentYear, currentMonth, 1).getTime();
        const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).getTime();
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 0);

        spans.forEach((s) => {
            if (!s.media) return;
            if (typeFilter !== 'all' && s.media.type !== typeFilter) return;
            const id = s.media.id;
            const book = {
                to: mediaPath({ type: s.media.type, uuid: s.media.uuid, id: String(s.media.id) }),
                cover: s.media.cover_url || undefined,
                title: s.media.title || '',
            };
            const startMs = s.started_at * 1000;
            const endMs = (s.finished_at ? s.finished_at * 1000 : todayEnd.getTime());
            // Clamp the span to the current month before walking its days.
            const from = Math.max(startMs, monthStart);
            const to = Math.min(endMs, monthEnd);
            if (from > to) return;
            for (let t = new Date(from).setHours(0, 0, 0, 0); t <= to; t += DAY_MS) {
                const day = new Date(t).getDate();
                const seen = (seenPerDay[day] ??= new Set());
                if (seen.has(id)) continue;
                seen.add(id);
                (grouped[day] ??= []).push(book);
            }
        });

        return grouped;
    }, [spans, currentYear, currentMonth, typeFilter]);

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
                {/* Page tabs: Calendar | Statistics */}
                <div className="mb-6 flex gap-1 border-b border-[var(--border-subtle)]">
                    {([['calendar', t('calendar')], ['stats', t('statistics')]] as const).map(([key, label]) => (
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
                        <button className="w-10 h-10 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-full flex items-center justify-center transition-colors">
                            <IoOptionsOutline className="w-5 h-5 text-[var(--text)]" />
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
                <div className="bg-[var(--container)] border border-[var(--border-subtle)] rounded-2xl p-4 md:p-6">
                    {viewMode === 'calendar' ? (
                        <>
                            <div className="grid grid-cols-7 mb-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                                <div>{t('mon')}</div>
                                <div>{t('tue')}</div>
                                <div>{t('wed')}</div>
                                <div>{t('thu')}</div>
                                <div>{t('fri')}</div>
                                <div>{t('sat')}</div>
                                <div className="text-nonslightred">{t('sun')}</div>
                            </div>

                            <div className="grid grid-cols-7 gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden">
                                {[...Array(startOffset)].map((_, i) => (
                                    <div key={`empty-${i}`} className="bg-[var(--container)] min-h-[90px] md:min-h-[120px]" />
                                ))}

                                {[...Array(daysInMonth)].map((_, i) => {
                                    const day = i + 1;
                                    const data = currentMonthItems[day];
                                    const isSunday = (day + startOffset - 1) % 7 === 6;

                                    return (
                                        <div key={day} className="bg-[var(--container)] min-h-[90px] md:min-h-[120px] p-1.5 md:p-2 flex flex-col items-center gap-1.5">
                                            <span className={`text-xs md:text-sm font-medium ${isSunday ? 'text-nonslightred' : 'text-[var(--text-muted)]'}`}>
                                                {day}
                                            </span>

                                            {data && (
                                                <div className="flex flex-wrap justify-center gap-[3px] w-full">
                                                    {data.map((book, idx) => {
                                                        const width = data.length > 2 ? '42%' : '58%';
                                                        return (
                                                            <Link
                                                                key={idx}
                                                                to={book.to}
                                                                title={book.title}
                                                                className="block transition-transform hover:scale-105"
                                                                style={{ width }}
                                                            >
                                                                {book.cover ? (
                                                                    <img
                                                                        src={book.cover}
                                                                        className="aspect-[2/3] w-full rounded-sm border border-[var(--border-subtle)] object-cover"
                                                                        alt={book.title}
                                                                    />
                                                                ) : (
                                                                    <div className="flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-sm border border-[var(--border-subtle)] bg-[var(--container-2)] p-0.5 text-center text-[7px] leading-tight text-[var(--text-muted)] md:text-[8px]">
                                                                        <span className="line-clamp-3">{book.title}</span>
                                                                    </div>
                                                                )}
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="w-full overflow-x-auto pb-2 flex justify-center">
                            <div className="inline-grid grid-rows-7 grid-flow-col gap-1 md:gap-1.5">
                                {githubGridDays.map((date, i) => {
                                    if (!date) return <div key={`empty-git-${i}`} className="w-3 h-3 md:w-3.5 md:h-3.5" />;
                                    
                                    const dateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                                    const count = yearlyActivity[dateString] || 0;
                                    
                                    return (
                                        <div 
                                            key={dateString}
                                            title={`${dateString}: ${count} items`}
                                            className={`w-3 h-3 md:w-3.5 md:h-3.5 rounded-sm transition-colors ${getActivityColor(count)}`}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                </>)}
        </Layout>
    );
}