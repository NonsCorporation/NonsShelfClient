import type { MediaItem, ShelfStatus } from '../types.ts'

// Bumped so the richer (status/favorite) seed replaces any cached v1 data.
const STORAGE_KEY = 'nons_library_items_v2'

const defaultItems: MediaItem[] = [
  {
    id: 'b1',
    type: 'book',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/I/81af+MCATTL.jpg',
    tags: ['Classic'],
    rating: 9,
    status: 'done',
    favorite: true,
    pages: 180,
    year: 1925,
    dateAdded: '2026-05-02T10:00:00Z',
    genre: ['Classic', 'Fiction'],
    description:
      'A portrait of the Jazz Age in all of its decadence and excess, Gatsby captured the spirit of the authors generation and earned itself a permanent place in American mythology.',
  },
  {
    id: 'm1',
    type: 'movie',
    title: 'Oppenheimer',
    author: 'Christopher Nolan',
    director: 'Christopher Nolan',
    coverUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTe1j9bbY0YVkv1PltjgDPl1T0pSYCoV9v-8A&s',
    year: 2023,
    actors: ['Cillian Murphy', 'Emily Blunt', 'Matt Damon'],
    tags: ['Biopic'],
    rating: 10,
    status: 'done',
    favorite: true,
    duration: '180 min',
    dateAdded: '2026-05-06T14:30:00Z',
    genre: ['Drama', 'History', 'Biography'],
    description:
      'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.',
  },
  {
    id: 'b2',
    type: 'book',
    title: '1984',
    author: 'George Orwell',
    coverUrl: 'https://covers.openlibrary.org/b/id/7222246-L.jpg',
    tags: ['Dystopia'],
    rating: 8,
    status: 'active',
    pages: 328,
    year: 1949,
    dateAdded: '2026-05-15T09:15:00Z',
    genre: ['Dystopian', 'Politics'],
    description:
      'Among the seminal texts of the 20th century, 1984 is a rare work that grows more haunting as its futuristic purgatory becomes more real.',
  },
  {
    id: 'm2',
    type: 'movie',
    title: 'The Matrix',
    author: 'The Wachowskis',
    director: 'The Wachowskis',
    coverUrl: 'https://m.media-amazon.com/images/I/51EG732BV3L.jpg',
    year: 1999,
    actors: ['Keanu Reeves', 'Laurence Fishburne', 'Carrie-Anne Moss'],
    tags: ['Cyberpunk'],
    rating: 9,
    status: 'wishlist',
    duration: '136 min',
    dateAdded: '2026-05-20T20:00:00Z',
    genre: ['Sci-Fi', 'Action'],
    description:
      'A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.',
  },
  {
    id: 'b3',
    type: 'book',
    title: 'Dune',
    author: 'Frank Herbert',
    coverUrl: 'https://covers.openlibrary.org/b/id/9254446-L.jpg',
    tags: ['Epic'],
    rating: 7,
    status: 'wishlist',
    pages: 412,
    year: 1965,
    dateAdded: '2026-05-25T11:45:00Z',
    genre: ['Sci-Fi', 'Epic'],
    description:
      'Set on the desert planet Arrakis, Dune is the story of Paul Atreides and a stunning blend of adventure and mysticism, environmentalism and politics.',
  },
  {
    id: 'm3',
    type: 'movie',
    title: 'Spirited Away',
    author: 'Hayao Miyazaki',
    director: 'Hayao Miyazaki',
    coverUrl: 'https://m.media-amazon.com/images/I/51M9C6d6k1L.jpg',
    year: 2001,
    actors: ['Rumi Hiiragi', 'Miyu Irino', 'Mari Natsuki'],
    tags: ['Studio Ghibli'],
    rating: 10,
    status: 'done',
    favorite: true,
    duration: '125 min',
    dateAdded: '2026-04-10T16:20:00Z',
    genre: ['Animation', 'Fantasy', 'Adventure'],
    description:
      'During her familys move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches and spirits.',
  },
  {
    id: 'b4',
    type: 'book',
    title: 'The Name of the Wind',
    author: 'Patrick Rothfuss',
    coverUrl: 'https://covers.openlibrary.org/b/id/8333929-L.jpg',
    tags: ['Fantasy'],
    rating: 9,
    status: 'done',
    pages: 662,
    year: 2007,
    dateAdded: '2026-05-28T18:00:00Z',
    genre: ['Fantasy', 'Adventure'],
    description:
      'The tale of Kvothe, from his childhood in a troupe of traveling players to years spent as a near-feral orphan, told in his own voice.',
  },
  {
    id: 'm4',
    type: 'movie',
    title: 'Blade Runner 2049',
    author: 'Denis Villeneuve',
    director: 'Denis Villeneuve',
    coverUrl: 'https://m.media-amazon.com/images/I/71fXkBLPYIL._AC_SY679_.jpg',
    year: 2017,
    actors: ['Ryan Gosling', 'Harrison Ford', 'Ana de Armas'],
    tags: ['Neo-noir'],
    rating: 9,
    status: 'active',
    duration: '164 min',
    dateAdded: '2026-06-01T21:10:00Z',
    genre: ['Sci-Fi', 'Drama'],
    description:
      'A young Blade Runner discovers a long-buried secret that has the potential to plunge what is left of society into chaos.',
  },
]

/** Static, presentational metadata for each shelf status. */
export const SHELF_META: Record<ShelfStatus, { key: string; dot: string }> = {
  wishlist: { key: 'shelfWishlist', dot: '#6768ab' },
  active: { key: 'shelfActive', dot: '#f5a623' },
  done: { key: 'shelfDone', dot: '#3ec98a' },
}

export interface ILibraryService {
  getItems(): Promise<MediaItem[]>
  getItem(id: string): Promise<MediaItem | undefined>
  addItem(item: Omit<MediaItem, 'id'>): Promise<MediaItem>
  updateItem(id: string, updates: Partial<MediaItem>): Promise<MediaItem>
  deleteItem(id: string): Promise<void>
}

// NOTE: this stands in for the backend. The component layer only ever talks to
// the ILibraryService interface, so swapping this for a fetch-based client
// later requires no UI changes.
class LocalStorageLibraryService implements ILibraryService {
  private _getItems(): MediaItem[] {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultItems))
      return defaultItems
    }
    try {
      return JSON.parse(stored)
    } catch {
      return defaultItems
    }
  }

  private _saveItems(items: MediaItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }

  // Simulate network latency so loading states are real.
  private _delay<T>(value: T, ms = 120): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms))
  }

  async getItems(): Promise<MediaItem[]> {
    return this._delay(this._getItems())
  }

  async getItem(id: string): Promise<MediaItem | undefined> {
    const items = this._getItems()
    return this._delay(items.find((it) => it.id === id))
  }

  async addItem(item: Omit<MediaItem, 'id'>): Promise<MediaItem> {
    const items = this._getItems()
    const newItem: MediaItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      status: item.status || 'wishlist',
      dateAdded: item.dateAdded || new Date().toISOString(),
    }
    const newItems = [newItem, ...items]
    this._saveItems(newItems)
    return this._delay(newItem)
  }

  async updateItem(id: string, updates: Partial<MediaItem>): Promise<MediaItem> {
    const items = this._getItems()
    const index = items.findIndex((it) => it.id === id)
    if (index === -1) throw new Error('Not found')

    items[index] = { ...items[index], ...updates }
    this._saveItems(items)
    return this._delay(items[index])
  }

  async deleteItem(id: string): Promise<void> {
    let items = this._getItems()
    items = items.filter((it) => it.id !== id)
    this._saveItems(items)
    return this._delay(undefined)
  }
}

export const libraryService: ILibraryService = new LocalStorageLibraryService()
