import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/layout/Navbar.tsx'
import { IoAdd, IoBookOutline, IoFilmOutline, IoClose, IoOptionsOutline } from 'react-icons/io5'
import BookCard from '../BookCard.tsx'
import MovieCard from '../MovieCard.tsx'
import MediaRatingWrapper from '../MediaRatingWrapper.tsx'
import { libraryService } from '../services/libraryService.ts'
import type { MediaItem } from '../types.ts'

export default function Home() {
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
  const [form, setForm] = useState<any>({ title: '', author: '', coverUrl: '', year: '', actors: '', genre: '', tags: '' })

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
    setForm({ title: '', author: '', coverUrl: '', year: '', actors: '', genre: '', tags: '' })
    setShowForm(type)
  }

  async function addItem() {
    if (!form.title || !form.author) return

    const baseData = {
      type: showForm as 'book' | 'movie',
      title: form.title,
      author: form.author,
      coverUrl: form.coverUrl || undefined,
      year: form.year ? parseInt(form.year) : undefined,
      director: showForm === 'movie' ? form.author : undefined,
      actors: showForm === 'movie' && form.actors ? form.actors.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
      genre: form.genre ? form.genre.split(',').map((g: string) => g.trim()).filter(Boolean) : undefined,
      tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined,
    }

    if (form.id) {
      // Editing existing
      const updated = await libraryService.updateItem(form.id, baseData)
      setItems((prev) => prev.map(it => it.id === form.id ? updated : it))
      setShowForm(null)
      return
    }

    const newItem = await libraryService.addItem(baseData as any)
    setItems((s) => [newItem, ...s])
    setShowForm(null)
  }

  return (
    <div className="p-4 pt-24">
      <Navbar />

      <div className="mb-4 flex gap-2 items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or author"
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
                    Clear Filters
                  </button>
                )}

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] text-gray-400 px-1">Type</span>
                  <div className="flex rounded-lg bg-black/50 p-1 border border-white/5">
                    {(['all', 'book', 'movie'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`flex-1 py-1.5 text-xs text-center rounded-md transition-colors ${filter === f ? 'bg-white/10 text-white font-medium shadow-sm' : 'text-gray-400 hover:text-white'}`}
                      >
                        {f === 'all' && 'All'}
                        {f === 'book' && 'Books'}
                        {f === 'movie' && 'Movies'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 px-1">Common Filters</span>
                  <input 
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    placeholder="Tag / Status (e.g. Read, Watched)"
                    className="h-8 px-3 rounded-md bg-black/50 border border-white/5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-white/20"
                  />
                  <input 
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    placeholder="Year"
                    className="h-8 px-3 rounded-md bg-black/50 border border-white/5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-white/20"
                  />
                  <input 
                    value={genreFilter}
                    onChange={(e) => setGenreFilter(e.target.value)}
                    placeholder="Genre"
                    className="h-8 px-3 rounded-md bg-black/50 border border-white/5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-white/20"
                  />
                </div>

                {filter === 'movie' && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 px-1">Director & Actors</span>
                    <input 
                      value={directorFilter}
                      onChange={(e) => setDirectorFilter(e.target.value)}
                      placeholder="Director"
                      className="h-8 px-3 rounded-md bg-black/50 border border-white/5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-white/20"
                    />
                    <input 
                      value={actorFilter}
                      onChange={(e) => setActorFilter(e.target.value)}
                      placeholder="Actor"
                      className="h-8 px-3 rounded-md bg-black/50 border border-white/5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-white/20"
                    />
                  </div>
                )}
                
              </div>
            </>
          )}
        </div>

      </div>

      {showForm && (
        <div onClick={() => setShowForm(null)} className="fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-sm flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--container)] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--divider)] bg-[var(--surface)]">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">Add New Entry</h3>
                <button onClick={() => setShowForm(null)} className="ml-auto h-8 w-8 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] flex items-center justify-center" aria-label="Close modal">
                  <IoClose className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1 tracking-wide">Choose a type and fill in the details</p>
            </div>

            <div className="px-5 pt-4">
              <div className="inline-flex rounded-xl bg-[var(--surface)] p-1 border border-[var(--border-subtle)]">
                <button
                  onClick={() => setShowForm('book')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${showForm === 'book' ? 'bg-[var(--surface-active)] text-[var(--text)] border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}`}
                >
                  <IoBookOutline className="w-4 h-4" />
                  Book
                </button>
                <button
                  onClick={() => setShowForm('movie')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${showForm === 'movie' ? 'bg-[var(--surface-active)] text-[var(--text)] border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}`}
                >
                  <IoFilmOutline className="w-4 h-4" />
                  Movie
                </button>
              </div>
            </div>

            <div className="p-5 pt-4 flex flex-col gap-3">
              <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder="Title" value={form.title} onChange={(e) => setForm((s:any)=>({...s,title:e.target.value}))} />
              <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder="Author / Director" value={form.author} onChange={(e) => setForm((s:any)=>({...s,author:e.target.value}))} />
              <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder="Cover URL" value={form.coverUrl} onChange={(e) => setForm((s:any)=>({...s,coverUrl:e.target.value}))} />
              <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder="Genre (comma separated)" value={form.genre} onChange={(e) => setForm((s:any)=>({...s,genre:e.target.value}))} />
              <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder="Tags (comma separated, e.g. Read, Want to Watch)" value={form.tags} onChange={(e) => setForm((s:any)=>({...s,tags:e.target.value}))} />
              {showForm === 'movie' && (
                <>
                  <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder="Year" value={form.year} onChange={(e) => setForm((s:any)=>({...s,year:e.target.value}))} />
                  <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder="Actors (comma separated)" value={form.actors} onChange={(e) => setForm((s:any)=>({...s,actors:e.target.value}))} />
                </>
              )}
              <div className="flex justify-end gap-2 pt-1">
                {form.id && (
                  <button onClick={async () => {
                    await libraryService.deleteItem(form.id)
                    setItems(prev => prev.filter(it => it.id !== form.id))
                    setShowForm(null)
                  }} className="px-4 h-10 rounded-lg bg-red-500/20 text-red-500 font-medium hover:bg-red-500/30 transition-colors mr-auto">
                    Delete
                  </button>
                )}
                <button onClick={() => setShowForm(null)} className="px-4 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">Cancel</button>
                <button onClick={addItem} className="px-4 h-10 rounded-lg bg-nonsprimary text-[var(--text)] font-medium hover:bg-nonsprimaryfocus">
                  {form.id ? 'Save' : `Add ${showForm === 'book' ? 'Book' : 'Movie'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    onEdit={() => {
                      setForm({ ...it, actors: it.actors ? it.actors.join(', ') : '', genre: it.genre ? (Array.isArray(it.genre) ? it.genre.join(', ') : it.genre) : '', tags: it.tags ? it.tags.join(', ') : '' })
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
                      setForm({ ...it, actors: it.actors ? it.actors.join(', ') : '', genre: it.genre ? (Array.isArray(it.genre) ? it.genre.join(', ') : it.genre) : '', tags: it.tags ? it.tags.join(', ') : '' })
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