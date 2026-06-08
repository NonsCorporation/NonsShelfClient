import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/layout/Layout.tsx';
import { IoOptionsOutline, IoDownloadOutline, IoChevronBack, IoChevronForward } from 'react-icons/io5';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { libraryService } from '../services/libraryService.ts';
import type { MediaItem } from '../types.ts';

export default function CalendarPage() {
    const { t } = useLanguage();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [items, setItems] = useState<MediaItem[]>([]);

    useEffect(() => {
        libraryService.getItems().then(setItems);
    }, []);

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Group items by day for the current month
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
                // Update average rating maybe? For now just take max or average, the mock had randomly 0-5
                grouped[day].rating = item.rating || grouped[day].rating;
            }
        });
        
        return grouped;
    }, [items, currentYear, currentMonth]);

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // getDay() gives 0 for Sunday, 1 for Monday... we want Monday=0, Sunday=6
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const displayMonth = `${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`;

    const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

    return (
        <Layout>
                {/* Header Actions & Title */}
                <div className="flex justify-between items-center mb-6 border-b border-[var(--border-subtle)] pb-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl md:text-3xl font-bold text-[var(--text)] tracking-tight">{t('mediaCalendar')}</h1>
                    </div>
                    <div className="flex gap-2">
                        <button className="w-10 h-10 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-full flex items-center justify-center transition-colors">
                            <IoOptionsOutline className="w-5 h-5 text-[var(--text)]" />
                        </button>
                        <button className="w-10 h-10 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-full flex items-center justify-center transition-colors">
                            <IoDownloadOutline className="w-5 h-5 text-[var(--text)]" />
                        </button>
                    </div>
                </div>

                {/* Subtitle & Month Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 px-1">
                    <p className="text-[15px] sm:text-base text-[var(--text-muted)]">{t('calendarSubtitle')}</p>
                    
                    <div className="flex items-center gap-2.5 bg-[var(--container)] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] w-fit self-start sm:self-auto">
                        <button onClick={prevMonth} className="hover:bg-[var(--surface-hover)] p-1 rounded-full transition-colors">
                            <IoChevronBack className="w-4 h-4 md:w-[18px] md:h-[18px] text-[var(--text-muted)] hover:text-[var(--text)]" />
                        </button>
                        <h2 className="text-base md:text-lg font-bold text-[var(--text)] min-w-[78px] text-center">{displayMonth}</h2>
                        <button onClick={nextMonth} className="hover:bg-[var(--surface-hover)] p-1 rounded-full transition-colors">
                            <IoChevronForward className="w-4 h-4 md:w-[18px] md:h-[18px] text-[var(--text-muted)] hover:text-[var(--text)]" />
                        </button>
                    </div>
                </div>

                {/* Calendar View */}
                <div className="bg-[var(--container)] border border-[var(--border-subtle)] rounded-2xl p-4 md:p-6 overflow-hidden">
                    <div className="grid grid-cols-7 mb-4 text-center text-sm md:text-base font-medium text-[var(--text-muted)]">
                        <div>{t('mon')}</div>
                        <div>{t('tue')}</div>
                        <div>{t('wed')}</div>
                        <div>{t('thu')}</div>
                        <div>{t('fri')}</div>
                        <div>{t('sat')}</div>
                        <div className="text-nonslightred">{t('sun')}</div>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-y-4 md:gap-y-6 gap-x-1 md:gap-x-2">
                        {[...Array(startOffset)].map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}
                        
                        {[...Array(daysInMonth)].map((_, i) => {
                            const day = i + 1;
                            const data = currentMonthItems[day];
                            const isSunday = (day + startOffset - 1) % 7 === 6;

                            return (
                                <div key={day} className="flex flex-col items-center min-h-[72px] md:min-h-[100px]">
                                    <span className={`text-sm md:text-base mb-1.5 md:mb-2 ${isSunday ? 'text-nonslightred font-semibold' : 'text-[var(--text)]'}`}>
                                        {day}
                                    </span>
                                    
                                    {data && (
                                        <div className="flex flex-col items-center w-full">
                                            <div className="flex flex-wrap justify-center gap-[2px] md:gap-[4px] w-full px-0.5">
                                                {data.covers.map((url, idx) => (
                                                    <img 
                                                        key={idx} 
                                                        src={url} 
                                                        className={`object-cover h-auto aspect-[2/3] ${data.covers.length > 2 ? 'w-[40%] md:w-[45%]' : 'w-[48%] md:w-[60%]'} max-w-[40px] md:max-w-[55px] rounded-xs border border-[var(--border-subtle)]`} 
                                                        alt="cover" 
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
        </Layout>
    );
}