import { useState } from 'react'
import Navbar from "../components/layout/Navbar"
import StarsSelector from '../StarsSelector'
import { IoFilm, IoBookSharp, IoTimeOutline, IoStar, IoBookmark, IoBookmarkOutline, IoShareOutline } from 'react-icons/io5'

type MediaType = 'book' | 'movie'

type MediaOneProps = {
    type?: MediaType
    title?: string
    coverUrl?: string
    author?: string
    director?: string
    actors?: string[]
    pages?: number
    genre?: string[]
    year?: number
    duration?: string
    rating?: number
    description?: string
    review?: string
}

export default function MediaOnePage({ 
    type = 'movie',
    title = 'Oppenheimer',
    coverUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTe1j9bbY0YVkv1PltjgDPl1T0pSYCoV9v-8A&s',
    author = 'Christopher Nolan',
    director = 'Christopher Nolan',
    actors = ['Cillian Murphy', 'Emily Blunt', 'Matt Damon'],
    pages,
    genre = ['Biography', 'Drama', 'History'],
    year = 2023,
    duration = '180 min',
    rating = 8.5,
    description = 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.',
    review = 'A landmark film that balances science, policy, and personal drama with powerful performances.'
}: MediaOneProps) {
    const [userRating, setUserRating] = useState<number | null>(null)
    const [userReview, setUserReview] = useState(review)
    const [isBookmarked, setIsBookmarked] = useState(false)
    
    const isBook = type === 'book'
    const Icon = isBook ? IoBookSharp : IoFilm
    const displayRating = userRating !== null ? `${userRating / 2}/5` : null

    return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans pb-16">
            <Navbar />

            {/* Blurred hero backdrop */}
            <div
                className="fixed inset-0 opacity-10 bg-cover bg-center blur-3xl scale-110 pointer-events-none"
                style={{ backgroundImage: `url(${coverUrl})`, zIndex: 0 }}
            />

            <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 pt-28 md:pt-32">
                <div className="flex flex-col md:flex-row gap-8 md:gap-10">

                    {/* ── Left Column: Cover ── */}
                    <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-3">

                        {/* Cover poster */}
                        <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-[0_20px_60px_-10px_rgba(0,0,0,0.45)] ring-1 ring-white/5">
                            <img
                                src={coverUrl}
                                alt={title}
                                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                            />
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsBookmarked(!isBookmarked)}
                                className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                                    isBookmarked
                                        ? 'bg-nonsprimary text-white shadow-md shadow-nonsprimary/20'
                                        : 'bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border)]'
                                }`}
                            >
                                {isBookmarked
                                    ? <IoBookmark className="w-4 h-4" />
                                    : <IoBookmarkOutline className="w-4 h-4" />
                                }
                                {isBookmarked ? 'Saved' : 'Save'}
                            </button>
                            <button
                                className="h-10 w-10 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border)] flex items-center justify-center transition-all duration-200"
                                aria-label="Share"
                            >
                                <IoShareOutline className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* ── Right Column: Info ── */}
                    <div className="flex-1 flex flex-col gap-6">

                        {/* Title block */}
                        <div>
                            <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs uppercase tracking-widest mb-2">
                                <Icon className="w-3.5 h-3.5" />
                                <span>{isBook ? 'Book' : 'Film'}</span>
                                <span className="text-[var(--border)]">·</span>
                                <span>{year}</span>
                                {!isBook && (
                                    <>
                                        <span className="text-[var(--border)]">·</span>
                                        <IoTimeOutline className="w-3.5 h-3.5" />
                                        <span>{duration}</span>
                                    </>
                                )}
                                {isBook && pages && (
                                    <>
                                        <span className="text-[var(--border)]">·</span>
                                        <span>{pages} pages</span>
                                    </>
                                )}
                            </div>

                            <h1 className="text-3xl md:text-[2.6rem] font-bold leading-tight tracking-tight text-[var(--text)] mb-2">
                                {title}
                            </h1>

                            <p className="text-sm text-[var(--text-muted)]">
                                {isBook ? 'Written by' : 'Directed by'}{' '}
                                <span className="text-[var(--text)] font-medium">
                                    {isBook ? author : director}
                                </span>
                            </p>
                        </div>

                        {/* Divider */}
                        <hr className="border-[var(--divider)]" />

                        {/* Description */}
                        <div>
                            <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">Synopsis</h3>
                            <p className="text-sm leading-7 text-[var(--text-muted)]">
                                {description}
                            </p>
                        </div>

                        {/* Genre tags */}
                        {genre && genre.length > 0 && (
                            <div>
                                <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2.5">Genre</h3>
                                <div className="flex flex-wrap gap-2">
                                    {genre.map((g) => (
                                        <span
                                            key={g}
                                            className="px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] text-xs text-[var(--text)] hover:border-[var(--border)] transition-colors cursor-default"
                                        >
                                            {g}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Cast */}
                        {!isBook && actors && actors.length > 0 && (
                            <div>
                                <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2.5">Cast</h3>
                                <div className="flex flex-wrap gap-2">
                                    {actors.map((actor) => (
                                        <span
                                            key={actor}
                                            className="px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] text-xs text-[var(--text)] hover:border-[var(--border)] transition-colors cursor-default"
                                        >
                                            {actor}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* User Rating & Review */}
                        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-xl p-5 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Your Review</h3>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <StarsSelector initialValue={userRating} onChange={setUserRating} isEditable />
                                <span className={`text-sm font-medium transition-opacity duration-200 ${userRating !== null ? 'opacity-100 text-[var(--text)]' : 'opacity-0'}`}>
                                    {displayRating}
                                </span>
                            </div>

                            <textarea
                                value={userReview}
                                onChange={(event) => setUserReview(event.target.value)}
                                rows={2}
                                placeholder={`What did you think of this ${isBook ? 'book' : 'film'}?`}
                                className="w-full resize-none rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)]/50 p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]/40 focus:border-[var(--border)] focus:outline-none transition-all"
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}