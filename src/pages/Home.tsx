import { useMemo, useState } from 'react'
import { IoAddCircleOutline, IoAdd, IoBookOutline, IoFilmOutline, IoClose } from 'react-icons/io5'
import BookCard from '../BookCard.tsx'
import MovieCard from '../MovieCard.tsx'
import MediaRatingWrapper from '../MediaRatingWrapper.tsx'

type MediaItem = {
  id: string
  type: 'book' | 'movie'
  title: string
  author: string
  coverUrl?: string
  year?: number
  director?: string
  actors?: string[]
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'book' | 'movie'>('all')
  const [items, setItems] = useState<MediaItem[]>([
    {
      id: 'b1',
      type: 'book',
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      coverUrl: 'https://images-na.ssl-images-amazon.com/images/I/81af+MCATTL.jpg',
    },
    {
      id: 'm1',
      type: 'movie',
      title: 'Oppenheimer',
        author: 'Christopher Nolan',
        director: 'Christopher Nolan',
      coverUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTe1j9bbY0YVkv1PltjgDPl1T0pSYCoV9v-8A&s',
      year: 2023,
      actors: ["Cillian Murphy", "Emily Blunt", "Matt Damon"],
    },
      {
        id: 'b2',
        type: 'book',
        title: '1984',
        author: 'George Orwell',
        coverUrl: 'https://covers.openlibrary.org/b/id/7222246-L.jpg',
      },
      {
        id: 'm2',
        type: 'movie',
        title: 'The Matrix',
        author: 'The Wachowskis',
        director: 'The Wachowskis',
        coverUrl: 'https://m.media-amazon.com/images/I/51EG732BV3L.jpg',
        year: 1999,
        actors: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"],
      },
      {
        id: 'b3',
        type: 'book',
        title: 'Dune',
        author: 'Frank Herbert',
        coverUrl: 'https://covers.openlibrary.org/b/id/9254446-L.jpg',
      },
      {
        id: 'm3',
        type: 'movie',
        title: 'Spirited Away',
        author: 'Hayao Miyazaki',
        director: 'Hayao Miyazaki',
        coverUrl: 'https://m.media-amazon.com/images/I/51M9C6d6k1L.jpg',
        year: 2001,
        actors: ["Rumi Hiiragi", "Miyu Irino", "Mari Natsuki"],
      },
  ])

  const [showForm, setShowForm] = useState<null | 'book' | 'movie'>(null)
  const [form, setForm] = useState<any>({ title: '', author: '', coverUrl: '', year: '', actors: '' })

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filter !== 'all' && it.type !== filter) return false
      const q = query.trim().toLowerCase()
      if (!q) return true
      return it.title.toLowerCase().includes(q) || it.author.toLowerCase().includes(q)
    })
  }, [items, filter, query])

  function openForm(type: 'book' | 'movie') {
    setForm({ title: '', author: '', coverUrl: '', year: '', actors: '' })
    setShowForm(type)
  }

  function addItem() {
    if (!form.title || !form.author) return
    const id = (form.title + Date.now()).replace(/\s+/g, '_')
    const newItem: MediaItem = {
      id,
      type: showForm as 'book' | 'movie',
      title: form.title,
      author: form.author,
      coverUrl: form.coverUrl || undefined,
      year: form.year ? Number(form.year) : undefined,
      director: showForm === 'movie' ? form.author : undefined,
      actors: showForm === 'movie' && form.actors ? form.actors.split(',').map((s:string)=>s.trim()).filter(Boolean) : undefined,
    }
    setItems((s) => [newItem, ...s])
    setShowForm(null)
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2 items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or author"
          className="px-3 py-2 rounded bg-white/5 border border-white/5 text-gray-100 w-64"
        />

        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="px-2 py-2 rounded bg-white/5 border border-white/5 text-gray-100">
          <option value="all">All</option>
          <option value="book">Books</option>
          <option value="movie">Movies</option>
        </select>

        <div className="ml-auto flex gap-2 items-center">
          <button title="Add Book" onClick={() => openForm('book')} className="p-2 rounded bg-white/3 hover:bg-white/5">
            <IoAddCircleOutline className="w-5 h-5 text-blue-400" />
          </button>
          <button title="Add Movie" onClick={() => openForm('movie')} className="p-2 rounded bg-white/3 hover:bg-white/5">
            <IoAdd className="w-5 h-5 text-green-400" />
          </button>
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
              {showForm === 'movie' && (
                <>
                  <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder="Year" value={form.year} onChange={(e) => setForm((s:any)=>({...s,year:e.target.value}))} />
                  <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)]" placeholder="Actors (comma separated)" value={form.actors} onChange={(e) => setForm((s:any)=>({...s,actors:e.target.value}))} />
                </>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={addItem} className="px-4 h-10 rounded-lg bg-nonsprimary text-[var(--text)] font-medium hover:bg-nonsprimaryfocus">Add {showForm === 'book' ? 'Book' : 'Movie'}</button>
                <button onClick={() => setShowForm(null)} className="px-4 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 flex-wrap items-start">
        {filtered.map((it) => (
          <div key={it.id} className="w-48">
            <MediaRatingWrapper rating={null} isEditable={true}>
              {it.type === 'book' ? (
                <BookCard title={it.title} author={it.author} coverUrl={it.coverUrl} />
              ) : (
                <MovieCard title={it.title} author={it.author} coverUrl={it.coverUrl} year={it.year} director={it.director} actors={it.actors} />
              )}
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