import { useState } from 'react'
import Navbar from "../components/layout/Navbar"
import { IoFilm, IoBookSharp, IoTimeOutline, IoStarOutline, IoBookmarkOutline } from 'react-icons/io5'

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
    description = 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.'
}: MediaOneProps) {
    const [userRating, setUserRating] = useState<number | null>(null)
    const [isBookmarked, setIsBookmarked] = useState(false)
    
    const isBook = type === 'book'
    const Icon = isBook ? IoBookSharp : IoFilm

    return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans pb-12">
            <Navbar />
            <div className="max-w-4xl mx-auto p-4 md:p-6 pt-28 md:pt-32">
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="w-full md:w-80 flex-shrink-0">
                        <div className="aspect-[2/3] bg-nonscontainerbg rounded-lg overflow-hidden shadow-2xl">
                            <img 
                                src={coverUrl} 
                                alt={title} 
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="mt-4 flex gap-2">
                            <button 
                                onClick={() => setIsBookmarked(!isBookmarked)}
                                className={`flex-1 h-10 rounded-lg border transition-all duration-200 flex items-center justify-center gap-2 ${
                                    isBookmarked 
                                        ? 'bg-nonsprimary text-white border-nonsprimary' 
                                        : 'bg-[var(--surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                                }`}
                            >
                                <IoBookmarkOutline className="w-4 h-4" />
                                {isBookmarked ? 'Saved' : 'Save'}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                        <div className="mb-4">
                            <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm mb-2">
                                <Icon className="w-4 h-4" />
                                <span>{isBook ? 'Book' : 'Movie'}</span>
                                <span>•</span>
                                <span>{year}</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold text-[var(--text)] tracking-tight mb-3">
                                {title}
                            </h1>
                            {isBook ? (
                                <p className="text-[var(--text-muted)] text-sm mb-4">
                                    by <span className="text-[var(--text)]">{author}</span>
                                </p>
                            ) : (
                                <p className="text-[var(--text-muted)] text-sm mb-4">
                                    Directed by <span className="text-[var(--text)]">{director}</span>
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-4 mb-6">
                            {isBook ? (
                                pages && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-[var(--text)]">{pages} pages</span>
                                    </div>
                                )
                            ) : (
                                <div className="flex items-center gap-2">
                                    <IoTimeOutline className="w-4 h-4 text-[var(--text-muted)]" />
                                    <span className="text-sm text-[var(--text)]">{duration}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <IoStarOutline className="w-4 h-4 text-yellow-400" />
                                <span className="text-sm font-medium text-[var(--text)]">{rating}/10</span>
                            </div>
                        </div>

                        {genre && genre.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-[var(--text)] mb-2 uppercase tracking-wide">{isBook ? 'Genre' : 'Genre'}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {genre.map((g) => (
                                        <span key={g} className="px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] text-xs text-[var(--text)]">
                                            {g}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!isBook && actors && actors.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-[var(--text)] mb-2 uppercase tracking-wide">Cast</h3>
                                <div className="flex flex-wrap gap-2">
                                    {actors.map((actor) => (
                                        <span key={actor} className="px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] text-xs text-[var(--text)]">
                                            {actor}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mb-6 flex-1">
                            <h3 className="text-sm font-semibold text-[var(--text)] mb-2 uppercase tracking-wide">Description</h3>
                            <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                {description}
                            </p>
                        </div>

                        <div className="border-t border-[var(--divider)] pt-4">
                            <h3 className="text-sm font-semibold text-[var(--text)] mb-3 uppercase tracking-wide">Your Rating</h3>
                            <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setUserRating(star)}
                                        className="transition-transform hover:scale-110"
                                    >
                                        <IoStarOutline 
                                            className={`w-6 h-6 ${
                                                userRating && star <= userRating 
                                                    ? 'text-yellow-400 fill-yellow-400' 
                                                    : 'text-[var(--border)]'
                                            }`} 
                                        />
                                    </button>
                                ))}
                                {userRating && (
                                    <span className="text-sm text-[var(--text)] ml-2">{userRating}/5</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}