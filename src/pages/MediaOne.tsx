import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Navbar from "../components/layout/Navbar"
import StarsSelector from '../StarsSelector'
import { libraryService } from '../services/libraryService'
import type { MediaItem } from '../types'
import { IoFilm, IoBookSharp, IoTimeOutline, IoBookmark, IoBookmarkOutline, IoShareOutline, IoCreateOutline, IoClose } from 'react-icons/io5'
import { useLanguage } from '../contexts/LanguageContext'

export default function MediaOnePage() {
    const { t } = useLanguage()
    const { id } = useParams<{ id: string }>()
    const [item, setItem] = useState<MediaItem | null>(null)
    const [loading, setLoading] = useState(true)

    const [userRating, setUserRating] = useState<number | null>(null)
    const [userReview, setUserReview] = useState('')
    const [isBookmarked, setIsBookmarked] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    
    // Store props in local state so they can be edited
    const [mediaData, setMediaData] = useState({
        title: '', 
        author: '', 
        director: '', 
        actors: '', 
        year: 2024, 
        duration: '', 
        description: '',
        coverUrl: '',
        pages: 0
    })

    useEffect(() => {
        if (id) {
            libraryService.getItem(id).then(found => {
                if (found) {
                    setItem(found)
                    setUserRating(found.rating ?? null)
                    setMediaData({
                        title: found.title,
                        author: found.author,
                        director: found.director || '',
                        actors: found.actors?.join(', ') || '',
                        year: found.year || 2024,
                        duration: found.duration || '',
                        description: found.description || '',
                        coverUrl: found.coverUrl || '',
                        pages: found.pages || 0
                    })
                }
                setLoading(false)
            })
        }
    }, [id])

    const handleRatingChange = async (val: number) => {
        if (!id) return
        setUserRating(val)
        await libraryService.updateItem(id, { rating: val })
    }

    if (loading) return <div className="pt-32 text-center text-gray-500">{t('loading')}</div>
    if (!item) return <div className="pt-32 text-center text-gray-500">{t('itemNotFound')}</div>

    const isBook = item.type === 'book'
    const Icon = isBook ? IoBookSharp : IoFilm
    const displayRating = userRating !== null ? `${userRating / 2}/5` : null

    const handleSave = async () => {
        if (!id) return
        const updated = await libraryService.updateItem(id, {
            title: mediaData.title,
            author: mediaData.author,
            director: isBook ? undefined : mediaData.director,
            actors: mediaData.actors.split(',').map(s => s.trim()).filter(Boolean),
            year: mediaData.year,
            coverUrl: mediaData.coverUrl,
            duration: mediaData.duration,
            description: mediaData.description,
            pages: mediaData.pages
        })
        setItem(updated)
        setIsEditing(false)
    }

    return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans pb-16">
            <Navbar />

            {/* Blurred hero backdrop */}
            <div
                className="fixed inset-0 opacity-10 bg-cover bg-center blur-3xl scale-110 pointer-events-none"
                style={{ backgroundImage: `url(${mediaData.coverUrl})`, zIndex: 0 }}
            />

            <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 pt-28 md:pt-32">
                <div className="flex flex-col md:flex-row gap-8 md:gap-10">

                    {/* ── Left Column: Cover ── */}
                    <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-3">

                        {/* Cover poster */}
                        <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-[0_20px_60px_-10px_rgba(0,0,0,0.45)] ring-1 ring-white/5">
                            <img
                                src={mediaData.coverUrl}
                                alt={mediaData.title}
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
                                {isBookmarked ? t('saved') : t('save')}
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
                                <span>{isBook ? t('book') : t('film')}</span>
                                <span className="text-[var(--border)]">·</span>
                                <span>{mediaData.year}</span>
                                {!isBook && mediaData.duration && (
                                    <>
                                        <span className="text-[var(--border)]">·</span>
                                        <IoTimeOutline className="w-3.5 h-3.5" />
                                        <span>{mediaData.duration}</span>
                                    </>
                                )}
                                {isBook && mediaData.pages > 0 && (
                                    <>
                                        <span className="text-[var(--border)]">·</span>
                                        <span>{t('pagesCount', { count: mediaData.pages })}</span>
                                    </>
                                )}
                            </div>

                            <div className="flex items-start justify-between gap-4 mb-2">
                                <h1 className="text-3xl md:text-[2.6rem] font-bold leading-tight tracking-tight text-[var(--text)]">
                                    {mediaData.title}
                                </h1>
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border)] transition-all flex-shrink-0"
                                    aria-label="Edit details"
                                >
                                    <IoCreateOutline className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-sm text-[var(--text-muted)]">
                                {isBook ? t('writtenBy') : t('directedBy')}{' '}
                                <span className="text-[var(--text)] font-medium">
                                    {isBook ? mediaData.author : mediaData.director}
                                </span>
                            </p>
                        </div>

                        {/* Divider */}
                        <hr className="border-[var(--divider)]" />

                        {/* Description */}
                        <div>
                            <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">{t('synopsis')}</h3>
                            <p className="text-sm leading-7 text-[var(--text-muted)]">
                                {mediaData.description || t('noDescription')}
                            </p>
                        </div>

                        {/* Genre tags */}
                        {item.genre && (Array.isArray(item.genre) ? item.genre.length > 0 : !!item.genre) && (
                            <div>
                                <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2.5">{t('genre')}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {(Array.isArray(item.genre) ? item.genre : [item.genre]).map((g) => (
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
                        {!isBook && mediaData.actors && (
                            <div>
                                <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2.5">{t('cast')}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {mediaData.actors.split(',').map(a => a.trim()).filter(Boolean).map((actor) => (
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
                                <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('yourReview')}</h3>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <StarsSelector initialValue={userRating} onChange={handleRatingChange} isEditable />
                                <span className={`text-sm font-medium transition-opacity duration-200 ${userRating !== null ? 'opacity-100 text-[var(--text)]' : 'opacity-0'}`}>
                                    {displayRating}
                                </span>
                            </div>

                            <textarea
                                value={userReview}
                                onChange={(event) => setUserReview(event.target.value)}
                                rows={2}
                                placeholder={t('reviewPlaceholder', { type: isBook ? t('book').toLowerCase() : t('film').toLowerCase() })}
                                className="w-full resize-none rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)]/50 p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]/40 focus:border-[var(--border)] focus:outline-none transition-all"
                            />
                        </div>

                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {isEditing && (
                <div onClick={() => setIsEditing(false)} className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-sm flex items-center justify-center p-4">
                    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--container)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-5 py-4 border-b border-[var(--divider)] bg-[var(--surface)] flex-shrink-0">
                            <div className="flex flex-row items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">{t('editDetails')}</h3>
                                    <p className="text-xs text-[var(--text-muted)] mt-1 tracking-wide">{t('updateInfo', { type: isBook ? t('book').toLowerCase() : t('film').toLowerCase() })}</p>
                                </div>
                                <button onClick={() => setIsEditing(false)} className="h-8 w-8 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] flex items-center justify-center" aria-label="Close modal">
                                    <IoClose className="w-4 h-4 text-[var(--text-muted)]" />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-3">
                            <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                                {t('title')}
                                <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder={t('title')} value={mediaData.title} onChange={(e) => setMediaData(s => ({...s, title: e.target.value}))} />
                            </label>
                            
                            <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                                {isBook ? t('book') : t('director')}
                                <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder={isBook ? t('book') : t('director')} value={isBook ? mediaData.author : mediaData.director} onChange={(e) => setMediaData(s => isBook ? ({...s, author: e.target.value}) : ({...s, director: e.target.value}))} />
                            </label>
                            
                            <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                                {t('coverUrl')}
                                <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder={t('coverUrl')} value={mediaData.coverUrl} onChange={(e) => setMediaData(s => ({...s, coverUrl: e.target.value}))} />
                            </label>
                            
                            <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                                {t('year')}
                                <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder={t('year')} value={mediaData.year} onChange={(e) => setMediaData(s => ({...s, year: Number(e.target.value) || e.target.value as any}))} />
                            </label>

                            {isBook ? (
                                <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                                    {t('pages')}
                                    <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder={t('pages')} value={mediaData.pages} onChange={(e) => setMediaData(s => ({...s, pages: Number(e.target.value) || 0}))} />
                                </label>
                            ) : (
                                <>
                                    <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                                        {t('duration')}
                                        <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder={t('durationPlaceholder')} value={mediaData.duration} onChange={(e) => setMediaData(s => ({...s, duration: e.target.value}))} />
                                    </label>
                                    
                                    <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                                        {t('actorsPlaceholder')}
                                        <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder={t('actorsPlaceholder')} value={mediaData.actors} onChange={(e) => setMediaData(s => ({...s, actors: e.target.value}))} />
                                    </label>
                                </>
                            )}

                            <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                                {t('synopsis')}
                                <textarea rows={4} className="p-3 resize-none rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder={t('synopsis')} value={mediaData.description} onChange={(e) => setMediaData(s => ({...s, description: e.target.value}))} />
                            </label>
                        </div>
                        
                        <div className="px-5 py-4 border-t border-[var(--divider)] bg-[var(--surface)] flex gap-2 flex-shrink-0">
                            <button onClick={handleSave} className="px-4 h-10 rounded-lg bg-nonsprimary text-[var(--text)] font-medium hover:bg-nonsprimaryfocus">{t('save')}</button>
                            <button onClick={() => setIsEditing(false)} className="px-4 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">{t('cancel')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
