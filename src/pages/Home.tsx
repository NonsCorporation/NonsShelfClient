import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/layout/Navbar.tsx'
import { IoAdd, IoOptionsOutline } from 'react-icons/io5'
import BookCard from '../BookCard.tsx'
import MovieCard from '../MovieCard.tsx'
import MediaRatingWrapper from '../MediaRatingWrapper.tsx'
import MediaModal from '../components/MediaModal.tsx'
import { libraryService } from '../services/libraryService.ts'
import type { MediaItem } from '../types.ts'
import { useLanguage } from '../contexts/LanguageContext.tsx'

export default function Home() {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'book' | 'movie'>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  
  // Advanced filters
  const [genreFilter, setGenreFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [directorFilter, setDirectorFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  
  const [items, setItems] = useState<MediaItem[]>([])

  useEffect(() => {
    libraryService.getItems().then(setItems)
  }, [])

  const [showForm, setShowForm] = useState<null | 'book' | 'movie'>(null)
  const [formInitialData, setFormInitialData] = useState<any>(null)

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filter !== 'all' && it.type !== filter) return false
      
      const q = query.trim().toLowerCase()
      if (q && !(it.title.toLowerCase().includes(q) || it.author.toLowerCase().includes(q))) return false
      
      const yF = yearFilter.trim()
      if (yF && (!it.year || it.year.toString() !== yF)) return false
      
      const tF = tagFilter.trim().toLowerCase()
      if (tF) {
        if (!it.tags || !it.tags.some(t => t.toLowerCase().includes(tF))) return false
      }
      
      const gF = genreFilter.trim().toLowerCase()
      if (gF) {
        if (!it.genre) return false
        const iterGenre = Array.isArray(it.genre) ? it.genre.join(',').toLowerCase() : (it.genre as string).toLowerCase()
        if (!iterGenre.includes(gF)) return false
      }
      
      if (filter === 'movie') {
        const dF = directorFilter.trim().toLowerCase()
        if (dF && (!it.director || !it.director.toLowerCase().includes(dF))) return false
        
        const aF = actorFilter.trim().toLowerCase()
        if (aF && (!it.actors || !it.actors.some(a => a.toLowerCase().includes(aF)))) return false
      }

      return true
    })
  }, [items, filter, query, yearFilter, genreFilter, directorFilter, actorFilter, tagFilter])

  function openForm(type: 'book' | 'movie') {
    setFormInitialData(null)
    setShowForm(type)
  }

  async function handleSave(data: Partial<MediaItem>) {
    if (formInitialData?.id) {
      // Editing existing
      const updated = await libraryService.updateItem(formInitialData.id, data)
      setItems((prev) => prev.map(it => it.id === formInitialData.id ? updated : it))
      setShowForm(null)
      return
    }

    const newItem = await libraryService.addItem(data as any)
    setItems((s) => [newItem, ...s])
    setShowForm(null)
  }

  async function handleDelete(id: string) {
    await libraryService.deleteItem(id)
    setItems(prev => prev.filter(it => it.id !== id))
    setShowForm(null)
  }

  return (
    <div className="p-4 pt-24">
      <Navbar />

      <div className="mb-4 flex gap-2 items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="px-3 py-2 rounded bg-white/5 border border-white/5 text-gray-100 w-64"
        />

        <div className="relative">
          <button 
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            title="Filter details" 
            className={`h-10 w-10 rounded-lg border border-[var(--border-subtle)] hover:text-[var(--text)] flex flex-shrink-0 items-center justify-center transition-colors ${showFilterMenu || filter !== 'all' ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}`}
          >
            <IoOptionsOutline className="w-5 h-5 pointer-events-none" />
          </button>

          {showFilterMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowFilterMenu(false)} />
              <div className="absolute top-full lg:left-0 right-0 mt-2 w-64 rounded-xl border border-white/10 bg-[#111]/95 backdrop-blur-xl shadow-2xl z-40 p-3 flex flex-col gap-3">
                
                {(filter !== 'all' || query || yearFilter || directorFilter || actorFilter || genreFilter || tagFilter) && (
                  <button 
                    onClick={() => {
                      setFilter('all')
                      setQuery('')
                      setYearFilter('')
                      setGenreFilter('')
                      setTagFilter('')
                      setDirectorFilter('')
                      setActorFilter('')
                    }}
                    className="text-xs text-nonsprimary hover:text-white text-right self-end -mb-2"
                  >
                    {t('clearFilters')}
                  </button>
                )}

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] text-gray-400 px-1">{t('type')}</span>
                  <div className="flex rounded-lg bg-black/50 p-1 border border-white/5">
                    {(['all', 'book', 'movie'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`flex-1 py-1.5 text-xs text-center rounded-md transition-colors ${filter === f ? 'bg-white/10 text-white font-medium shadow-sm' : 'text-gray-400 hover:text-white'}`}
                      >
                        {f === 'all' && t('all')}
                        {f === 'book' && t('books')}
                        {f === 'movie' && t('movies')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 px-1">{t('commonFilters')}</span>
                  <input 
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    placeholder={t('tagStatusPlaceholder')}
                    className="h-8 px-3 rounded-md bg-black/50 border border-white/5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-white/20"
                  />
                  <input 
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    placeholder={t('year')}
                    className="h-8 px-3 rounded-md bg-black/50 border border-white/5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-white/20"
                  />
                  <input 
                    value={genreFilter}
                    onChange={(e) => setGenreFilter(e.target.value)}
                    placeholder={t('genre')}
                    className="h-8 px-3 rounded-md bg-black/50 border border-white/5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-white/20"
                  />
                </div>

                {filter === 'movie' && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 px-1">{t('directorActors')}</span>
                    <input 
                      value={directorFilter}
                      onChange={(e) => setDirectorFilter(e.target.value)}
                      placeholder={t('director')}
                      className="h-8 px-3 rounded-md bg-black/50 border border-white/5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-white/20"
                    />
                    <input 
                      value={actorFilter}
                      onChange={(e) => setActorFilter(e.target.value)}
                      placeholder={t('actor')}
                      className="h-8 px-3 rounded-md bg-black/50 border border-white/5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-white/20"
                    />
                  </div>
                )}
                
              </div>
            </>
          )}
        </div>

        <div className="ml-auto text-sm font-medium text-[var(--text-muted)]">
          {filtered.length !== items.length 
            ? `Showing: ${filtered.length} (Total: ${items.length})` 
            : `Total: ${items.length}`}
        </div>
      </div>

      <MediaModal
        isOpen={showForm !== null}
        initialType={showForm || 'book'}
        initialData={formInitialData}
        onClose={() => setShowForm(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <div className="flex gap-4 flex-wrap items-start">
        {filtered.map((it) => (
          <div key={it.id} className="w-48">
            <MediaRatingWrapper 
              rating={it.rating} 
              isEditable={true}
              onRatingChange={async (val) => {
                const updated = await libraryService.updateItem(it.id, { rating: val })
                setItems(prev => prev.map(item => item.id === it.id ? updated : item))
              }}
            >
                  <Link to={`/shelf/${it.id}`}>
                {it.type === 'book' ? (
                  <BookCard 
                    title={it.title} 
                    author={it.author} 
                    coverUrl={it.coverUrl} 
                    tags={it.tags} 
                    genre={Array.isArray(it.genre) ? it.genre : it.genre ? [it.genre] : undefined}
                    onEdit={() => {
                      setFormInitialData(it)
                      setShowForm('book')
                    }}
                  />
                ) : (
                  <MovieCard 
                    title={it.title} 
                    author={it.author} 
                    coverUrl={it.coverUrl} 
                    year={it.year} 
                    director={it.director} 
                    actors={it.actors} 
                    genre={Array.isArray(it.genre) ? it.genre : it.genre ? [it.genre] : undefined} 
                    tags={it.tags} 
                    onEdit={() => {
                      setFormInitialData(it)
                      setShowForm('movie')
                    }}
                  />
                )}
              </Link>
            </MediaRatingWrapper>
          </div>
        ))}

        <div className="w-48 h-[340px] flex items-center justify-center">
          <button onClick={() => openForm('book')} title="Add new" className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center">
            <IoAdd className="w-6 h-6 text-white/80" />
          </button>
        </div>
      </div>
    </div>
  )
}