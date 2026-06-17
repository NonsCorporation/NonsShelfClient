import { useState, useEffect, useMemo } from 'react';
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
import type { MediaItem } from '../types.ts';

export default function CalendarPage() {
    const { t } = useLanguage();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [items, setItems] = useState<MediaItem[]>([]);
    
    // tracks the active view style
    const [viewMode, setViewMode] = useState<'calendar' | 'github'>('calendar');

    useEffect(() => {
        libraryService.getItems().then(setItems);
    }, []);

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // group items by day for the current month
    const currentMonthItems = useMemo(() => {
        const grouped: Record<number, { covers: string[]; rating: number }> = {};
        
        items.forEach(item => {
            if (!item.dateAdded) return;
            const date = new Date(item.dateAdded);
            if (date.getFullYear() === currentYear && date.getMonth() === currentMonth) {
                const day = date.getDate();
                if (!grouped[day]) {
                    grouped[day] = { covers: [], rating: 0 };
                }
                if (item.coverUrl) {
                    grouped[day].covers.push(item.coverUrl);
                }
                grouped[day].rating = item.rating || grouped[day].rating;
            }
        });
        
        return grouped;
    }, [items, currentYear, currentMonth]);

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

    const displayMonth = `${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`;

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

                {/* subtitle & month navigation */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 px-1">
                    <p className="text-[15px] sm:text-base text-[var(--text-muted)]">{t('calendarSubtitle')}</p>
                    
                    <div className="flex items-center gap-2.5 bg-[var(--container)] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] w-fit self-start sm:self-auto">
                        <button onClick={prevMonth} className="hover:bg-[var(--surface-hover)] p-1 rounded-full transition-colors">
                            <IoChevronBack className="w-4 h-4 md:w-[18px] md:h-[18px] text-[var(--text-muted)] hover:text-[var(--text)]" />
                        </button>
                        <h2 className="text-base md:text-lg font-bold text-[var(--text)] min-w-[78px] text-center">
                            {viewMode === 'calendar' ? displayMonth : currentYear}
                        </h2>
                        <button onClick={nextMonth} className="hover:bg-[var(--surface-hover)] p-1 rounded-full transition-colors">
                            <IoChevronForward className="w-4 h-4 md:w-[18px] md:h-[18px] text-[var(--text-muted)] hover:text-[var(--text)]" />
                        </button>
                    </div>
                </div>

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
                                                    {data.covers.map((url, idx) => (
                                                        <img
                                                            key={idx}
                                                            src={url}
                                                            className="object-cover aspect-[2/3] rounded-sm border border-[var(--border-subtle)]"
                                                            style={{ width: data.covers.length > 2 ? '42%' : '58%' }}
                                                            alt="cover"
                                                        />
                                                    ))}
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
        </Layout>
    );
}