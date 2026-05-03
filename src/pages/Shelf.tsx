import { Link, useParams } from 'react-router-dom'
import Navbar from '../components/layout/Navbar.tsx'
import { IoStarOutline, IoBook, IoFilm } from 'react-icons/io5'

type ShelfItem = {
  id: string
  type: 'movie' | 'book'
  title: string
  coverUrl: string
  year: number
  rating: number
  description: string
  author?: string
  director?: string
  actors?: string[]
  genre?: string[]
  duration?: string
  pages?: number
}

const oppenheimer: ShelfItem = {
  id: 'oppenheimer',
  type: 'movie',
  title: 'Oppenheimer',
  coverUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTe1j9bbY0YVkv1PltjgDPl1T0pSYCoV9v-8A&s',
  year: 2023,
  rating: 8.5,
  director: 'Christopher Nolan',
  actors: ['Cillian Murphy', 'Emily Blunt', 'Matt Damon'],
  duration: '180 min',
  description:
    'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.',
}

const atonement: ShelfItem = {
  id: 'atonement',
  type: 'book',
  title: 'Atonement',
  coverUrl: 'https://images-na.ssl-images-amazon.com/images/I/81YEz7N2HBL.jpg',
  year: 2001,
  rating: 8.1,
  author: 'Ian McEwan',
  genre: ['Historical Fiction', 'Romance', 'Drama'],
  pages: 368,
  description:
    'A sweeping novel about love, guilt, and the consequences of a single misunderstanding during World War II.',
}

function getShelfItem(id?: string): ShelfItem | undefined {
  if (!id) return undefined
  const numeric = Number(id)
  if (!Number.isNaN(numeric) && numeric >= 0 && numeric <= 5) return oppenheimer
  if (!Number.isNaN(numeric) && numeric >= 6 && numeric <= 9999) return atonement
  return undefined
}

export default function ShelfPage() {
  const { id } = useParams<{ id: string }>()
  const item = getShelfItem(id)

  if (!item) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
        <Navbar />
        <div className="max-w-4xl mx-auto p-4 md:p-6 pt-28 md:pt-32">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--container)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">Shelf</p>
            <h1 className="mt-4 text-3xl font-semibold text-[var(--text)]">Item not found</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Use a shelf id between 0 and 9999.</p>
            <Link
              to="/"
              className="inline-flex mt-6 rounded-full bg-nonsprimary px-5 py-3 text-sm font-semibold text-white hover:bg-nonsprimaryfocus"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <Navbar />
      <div className="max-w-6xl mx-auto p-4 md:p-6 pt-28 md:pt-32">
        <div className="grid gap-10 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[2rem] bg-nonscontainerbg shadow-2xl">
              <img src={item.coverUrl} alt={item.title} className="w-full h-[560px] object-cover" />
            </div>
            <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--container)] p-6">
              <div className="flex flex-wrap gap-3 text-sm text-[var(--text-muted)]">
                <span>{item.year}</span>
                <span>•</span>
                <span>{item.type === 'movie' ? 'Movie' : 'Book'}</span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <IoStarOutline className="h-4 w-4 text-yellow-400" />
                <span>{item.rating}/10</span>
              </div>
              <div className="mt-6 grid gap-3">
                {item.type === 'movie' ? (
                  <>
                    <div className="rounded-2xl bg-[var(--surface)] p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">Director</p>
                      <p className="mt-2 text-sm text-[var(--text)]">{item.director}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--surface)] p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">Duration</p>
                      <p className="mt-2 text-sm text-[var(--text)]">{item.duration}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--surface)] p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">Cast</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.actors?.map((actor) => (
                          <span key={actor} className="rounded-full bg-[var(--bg)] px-3 py-1 text-xs text-[var(--text)]">
                            {actor}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-2xl bg-[var(--surface)] p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">Author</p>
                      <p className="mt-2 text-sm text-[var(--text)]">{item.author}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--surface)] p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">Pages</p>
                      <p className="mt-2 text-sm text-[var(--text)]">{item.pages}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--surface)] p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">Genre</p>
                      <p className="mt-2 text-sm text-[var(--text)]">{item.genre?.join(', ')}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--container)] p-10 shadow-sm">
              <div className="flex items-center gap-3 text-sm text-[var(--text-muted)] uppercase tracking-[0.24em]">
                {item.type === 'movie' ? <IoFilm className="h-4 w-4" /> : <IoBook className="h-4 w-4" />}
                <span>{item.type === 'movie' ? 'Movie Details' : 'Book Details'}</span>
              </div>
              <h1 className="mt-4 text-4xl font-semibold text-[var(--text)]">{item.title}</h1>
              <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">{item.description}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)]"
                >
                  Back to Shelf
                </Link>
                <span className="inline-flex items-center rounded-full bg-nonsprimary px-5 py-3 text-sm font-semibold text-white">
                  Shelf ID {id}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
