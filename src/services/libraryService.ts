import type { MediaItem } from '../types.ts'

const STORAGE_KEY = 'nons_library_items'

const defaultItems: MediaItem[] = [
  {
    id: 'b1',
    type: 'book',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/I/81af+MCATTL.jpg',
    tags: ['Read', 'Favorite'],
    rating: 9,
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
    tags: ['Watched'],
    rating: 10,
  },
  {
    id: 'b2',
    type: 'book',
    title: '1984',
    author: 'George Orwell',
    coverUrl: 'https://covers.openlibrary.org/b/id/7222246-L.jpg',
    tags: ['Currently Reading'],
    rating: 8,
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
    tags: ['Want to Watch'],
    rating: 9,
  },
  {
    id: 'b3',
    type: 'book',
    title: 'Dune',
    author: 'Frank Herbert',
    coverUrl: 'https://covers.openlibrary.org/b/id/9254446-L.jpg',
    tags: ['Want to Read'],
    rating: 7,
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
    tags: ['Watched', 'Masterpiece'],
    rating: 10,
  }
]

export interface ILibraryService {
  getItems(): Promise<MediaItem[]>
  getItem(id: string): Promise<MediaItem | undefined>
  addItem(item: Omit<MediaItem, 'id'>): Promise<MediaItem>
  updateItem(id: string, updates: Partial<MediaItem>): Promise<MediaItem>
  deleteItem(id: string): Promise<void>
}

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

  async getItems(): Promise<MediaItem[]> {
    return this._getItems()
  }

  async getItem(id: string): Promise<MediaItem | undefined> {
    const items = this._getItems()
    return items.find(it => it.id === id)
  }

  async addItem(item: Omit<MediaItem, 'id'>): Promise<MediaItem> {
    const items = this._getItems()
    const newItem: MediaItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9)
    }
    // Prepend to top of list
    const newItems = [newItem, ...items]
    this._saveItems(newItems)
    return newItem
  }

  async updateItem(id: string, updates: Partial<MediaItem>): Promise<MediaItem> {
    const items = this._getItems()
    const index = items.findIndex(it => it.id === id)
    if (index === -1) throw new Error('Not found')
    
    items[index] = { ...items[index], ...updates }
    this._saveItems(items)
    return items[index]
  }

  async deleteItem(id: string): Promise<void> {
    let items = this._getItems()
    items = items.filter(it => it.id !== id)
    this._saveItems(items)
  }
}

export const libraryService: ILibraryService = new LocalStorageLibraryService()
