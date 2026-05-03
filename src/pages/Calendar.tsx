import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IoArrowBack, IoOptionsOutline, IoDownloadOutline, IoChevronBack, IoChevronForward, IoStar, IoStarOutline } from 'react-icons/io5';

const mockDataJan2024: Record<number, { covers: string[]; rating: number }> = {
    1: { covers: ['https://covers.openlibrary.org/b/id/14421255-M.jpg'], rating: 4 },
    2: { covers: ['https://covers.openlibrary.org/b/id/10521270-M.jpg'], rating: 5 },
    3: { covers: ['https://covers.openlibrary.org/b/id/12818861-M.jpg'], rating: 5 },
    4: { covers: ['https://covers.openlibrary.org/b/id/10521270-M.jpg'], rating: 5 },
    5: { covers: ['https://covers.openlibrary.org/b/id/10521270-M.jpg'], rating: 4 },
    6: { covers: ['https://covers.openlibrary.org/b/id/14421255-M.jpg', 'https://covers.openlibrary.org/b/id/12818861-M.jpg'], rating: 5 },
    7: { covers: ['https://covers.openlibrary.org/b/id/14421255-M.jpg', 'https://covers.openlibrary.org/b/id/12818861-M.jpg'], rating: 0 },
    8: { covers: ['https://covers.openlibrary.org/b/id/12818861-M.jpg', 'https://covers.openlibrary.org/b/id/10521270-M.jpg', 'https://covers.openlibrary.org/b/id/14421255-M.jpg', 'https://covers.openlibrary.org/b/id/12818861-M.jpg'], rating: 4 },
    9: { covers: ['https://covers.openlibrary.org/b/id/14421255-M.jpg'], rating: 4 },
    10: { covers: ['https://covers.openlibrary.org/b/id/10521270-M.jpg'], rating: 5 },
    11: { covers: ['https://covers.openlibrary.org/b/id/12818861-M.jpg'], rating: 3 },
    15: { covers: ['https://covers.openlibrary.org/b/id/14421255-M.jpg', 'https://covers.openlibrary.org/b/id/12818861-M.jpg'], rating: 5 },
    16: { covers: ['https://covers.openlibrary.org/b/id/10521270-M.jpg'], rating: 4 },
    17: { covers: ['https://covers.openlibrary.org/b/id/12818861-M.jpg'], rating: 4 },
    18: { covers: ['https://covers.openlibrary.org/b/id/10521270-M.jpg', 'https://covers.openlibrary.org/b/id/14421255-M.jpg'], rating: 5 },
    19: { covers: ['https://covers.openlibrary.org/b/id/12818861-M.jpg', 'https://covers.openlibrary.org/b/id/10521270-M.jpg'], rating: 4 },
    20: { covers: ['https://covers.openlibrary.org/b/id/12818861-M.jpg'], rating: 3 },
    21: { covers: ['https://covers.openlibrary.org/b/id/14421255-M.jpg'], rating: 5 },
    22: { covers: ['https://covers.openlibrary.org/b/id/10521270-M.jpg', 'https://covers.openlibrary.org/b/id/14421255-M.jpg'], rating: 4 },
    23: { covers: ['https://covers.openlibrary.org/b/id/12818861-M.jpg'], rating: 4 },
    24: { covers: ['https://covers.openlibrary.org/b/id/10521270-M.jpg', 'https://covers.openlibrary.org/b/id/14421255-M.jpg'], rating: 0 },
    25: { covers: ['https://covers.openlibrary.org/b/id/12818861-M.jpg'], rating: 4 },
};

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date(2024, 0, 1)); // Default to Jan 2024 for mock matching

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // getDay() gives 0 for Sunday, 1 for Monday... we want Monday=0, Sunday=6
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const displayMonth = `${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`;

    const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

    return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans pb-12">
            <div className="max-w-md mx-auto p-6 md:p-10 pt-16">
                
                {/* Header Actions */}
                <div className="flex justify-between items-center mb-10">
                    <Link to="/">
                        <IoArrowBack className="w-8 h-8 text-[var(--text)] hover:text-nonsprimary transition-colors" />
                    </Link>
                    <div className="flex gap-4">
                        <button className="w-12 h-12 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-full flex items-center justify-center shadow-sm transition-colors">
                            <IoOptionsOutline className="w-6 h-6 text-[var(--text)]" />
                        </button>
                        <button className="w-12 h-12 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-full flex items-center justify-center shadow-sm transition-colors">
                            <IoDownloadOutline className="w-6 h-6 text-[var(--text)]" />
                        </button>
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-[2.75rem] font-bold text-[var(--text)] leading-tight mb-2 tracking-tight">Book Calendar</h1>
                <p className="text-lg text-[var(--text-muted)] mb-12">How much have you read this month?</p>

                {/* Month Navigation */}
                <div className="flex justify-between items-center mb-6 pl-1">
                    <h2 className="text-3xl font-bold text-[var(--text)]">{displayMonth}</h2>
                    <div className="flex gap-5 pr-2">
                        <button onClick={prevMonth} className="hover:bg-[var(--surface-hover)] p-1 rounded-full transition-colors">
                            <IoChevronBack className="w-6 h-6 text-[var(--text-muted)] hover:text-[var(--text)]" />
                        </button>
                        <button onClick={nextMonth} className="hover:bg-[var(--surface-hover)] p-1 rounded-full transition-colors">
                            <IoChevronForward className="w-6 h-6 text-[var(--text-muted)] hover:text-[var(--text)]" />
                        </button>
                    </div>
                </div>

                {/* Calendar View */}
                <div className="bg-[var(--container)] border border-[var(--border-subtle)] rounded-2xl shadow-sm p-4 overflow-hidden">
                    <div className="grid grid-cols-7 mb-3 text-center text-[15px] font-medium text-[var(--text-muted)]">
                        <div>Mon</div>
                        <div>Tue</div>
                        <div>Wed</div>
                        <div>Thu</div>
                        <div>Fri</div>
                        <div>Sat</div>
                        <div className="text-nonslightred">Sun</div>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-y-4 gap-x-1">
                        {[...Array(startOffset)].map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}
                        
                        {[...Array(daysInMonth)].map((_, i) => {
                            const day = i + 1;
                            const isJan2024 = currentMonth === 0 && currentYear === 2024;
                            const data = isJan2024 ? mockDataJan2024[day] : null;
                            const isSunday = (day + startOffset - 1) % 7 === 6;

                            return (
                                <div key={day} className="flex flex-col items-center min-h-[64px]">
                                    <span className={`text-[15px] mb-1.5 ${isSunday ? 'text-nonslightred font-semibold' : 'text-[var(--text)]'}`}>
                                        {day}
                                    </span>
                                    
                                    {data && (
                                        <div className="flex flex-col items-center w-full">
                                            <div className="flex flex-wrap justify-center gap-[2px] w-full px-0.5">
                                                {data.covers.map((url, idx) => (
                                                    <img 
                                                        key={idx} 
                                                        src={url} 
                                                        className={`object-cover h-auto aspect-[2/3] ${data.covers.length > 2 ? 'w-[40%]' : 'w-[48%]'} max-w-[28px] shadow-sm rounded-xs border border-[var(--border-subtle)]`} 
                                                        alt="cover" 
                                                    />
                                                ))}
                                            </div>
                                            {data.rating > 0 && (
                                                <div className="flex mt-[3px] gap-[1px]">
                                                    {[...Array(5)].map((_, s) => (
                                                        s < data.rating
                                                            ? <IoStar key={s} className="w-[6px] h-[6px] text-[#fbbf24]" />
                                                            : <IoStarOutline key={s} className="w-[6px] h-[6px] opacity-40 text-[#fbbf24]" />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}