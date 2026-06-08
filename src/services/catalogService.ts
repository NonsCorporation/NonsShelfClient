import type { MediaType } from '../types'

// A community catalog item — popular media with aggregate/social signals.
// This is separate from the user's own library; it stands in for a backend
// "discover" endpoint. Items can be added into the personal library.
export type CatalogItem = {
  id: string
  type: MediaType
  title: string
  author: string
  director?: string
  coverUrl?: string
  year?: number
  genre?: string[]
  description?: string
  /** Aggregate community rating, 0–10. */
  communityRating: number
  /** How many members have rated it. */
  ratingsCount: number
  /** How many members are reading/watching it right now. */
  activeNow: number
  /** Higher = more trending this week. */
  trendScore: number
  /** Short, social reason this is recommended to the user. */
  recommendedBecause?: string
}

const catalog: CatalogItem[] = [
  {
    id: 'c-fourthwing',
    type: 'book',
    title: 'Fourth Wing',
    author: 'Rebecca Yarros',
    coverUrl: 'https://covers.openlibrary.org/b/id/14346269-L.jpg',
    year: 2023,
    genre: ['Fantasy', 'Romance'],
    communityRating: 9.2,
    ratingsCount: 184200,
    activeNow: 5120,
    trendScore: 98,
    description: 'Enter a brutal war college for dragon riders where the only way out is to graduate… or die.',
    recommendedBecause: 'Loved by readers of The Name of the Wind',
  },
  {
    id: 'c-dune-movie',
    type: 'movie',
    title: 'Dune: Part Two',
    author: 'Denis Villeneuve',
    director: 'Denis Villeneuve',
    coverUrl: 'https://m.media-amazon.com/images/I/71O3w2Gj-PL._AC_SY679_.jpg',
    year: 2024,
    genre: ['Sci-Fi', 'Adventure'],
    communityRating: 8.8,
    ratingsCount: 412300,
    activeNow: 8800,
    trendScore: 96,
    description: 'Paul Atreides unites with the Fremen to wage war against the conspirators who destroyed his family.',
    recommendedBecause: 'Because you have Dune on your shelf',
  },
  {
    id: 'c-tomorrow',
    type: 'book',
    title: 'Tomorrow, and Tomorrow, and Tomorrow',
    author: 'Gabrielle Zevin',
    coverUrl: 'https://covers.openlibrary.org/b/id/12818862-L.jpg',
    year: 2022,
    genre: ['Fiction', 'Contemporary'],
    communityRating: 8.6,
    ratingsCount: 96400,
    activeNow: 2310,
    trendScore: 81,
    description: 'Two friends find their partnership tested over thirty years of designing video games together.',
  },
  {
    id: 'c-poorthings',
    type: 'movie',
    title: 'Poor Things',
    author: 'Yorgos Lanthimos',
    director: 'Yorgos Lanthimos',
    coverUrl: 'https://m.media-amazon.com/images/I/71eAj7lT7-L._AC_SY679_.jpg',
    year: 2023,
    genre: ['Drama', 'Comedy', 'Sci-Fi'],
    communityRating: 8.4,
    ratingsCount: 271800,
    activeNow: 3950,
    trendScore: 88,
    description: 'A young woman brought back to life by an unorthodox scientist runs off on an adventure across continents.',
    recommendedBecause: 'Trending with fans of Oppenheimer',
  },
  {
    id: 'c-babel',
    type: 'book',
    title: 'Babel',
    author: 'R. F. Kuang',
    coverUrl: 'https://covers.openlibrary.org/b/id/12643765-L.jpg',
    year: 2022,
    genre: ['Fantasy', 'Historical'],
    communityRating: 8.5,
    ratingsCount: 78900,
    activeNow: 1840,
    trendScore: 79,
    description: 'An orphan is trained in Oxford’s Royal Institute of Translation — and torn between empire and resistance.',
    recommendedBecause: 'Picked for readers of 1984',
  },
  {
    id: 'c-everything',
    type: 'movie',
    title: 'Everything Everywhere All at Once',
    author: 'Daniel Kwan, Daniel Scheinert',
    director: 'Daniel Kwan, Daniel Scheinert',
    coverUrl: 'https://m.media-amazon.com/images/I/71niXI3lxlL._AC_SY679_.jpg',
    year: 2022,
    genre: ['Sci-Fi', 'Comedy', 'Adventure'],
    communityRating: 8.9,
    ratingsCount: 534100,
    activeNow: 6200,
    trendScore: 92,
    description: 'A laundromat owner is swept into an adventure where she alone can save existence across the multiverse.',
  },
  {
    id: 'c-projecthail',
    type: 'book',
    title: 'Project Hail Mary',
    author: 'Andy Weir',
    coverUrl: 'https://covers.openlibrary.org/b/id/10520611-L.jpg',
    year: 2021,
    genre: ['Sci-Fi', 'Thriller'],
    communityRating: 9.0,
    ratingsCount: 142600,
    activeNow: 3070,
    trendScore: 85,
    description: 'A lone astronaut must save Earth from disaster in a story of discovery, friendship and grit.',
    recommendedBecause: 'Sci-fi fans rate this 9+',
  },
  {
    id: 'c-pastlives',
    type: 'movie',
    title: 'Past Lives',
    author: 'Celine Song',
    director: 'Celine Song',
    coverUrl: 'https://m.media-amazon.com/images/I/71y5sFnU8eL._AC_SY679_.jpg',
    year: 2023,
    genre: ['Drama', 'Romance'],
    communityRating: 8.2,
    ratingsCount: 119500,
    activeNow: 1620,
    trendScore: 74,
    description: 'Two childhood friends reunite for one week, confronting the choices that shape a life.',
  },
]

export interface ICatalogService {
  getCatalog(): Promise<CatalogItem[]>
}

class MockCatalogService implements ICatalogService {
  async getCatalog(): Promise<CatalogItem[]> {
    return new Promise((resolve) => setTimeout(() => resolve(catalog), 140))
  }
}

export const catalogService: ICatalogService = new MockCatalogService()

/** Compact count formatter: 184200 -> "184k", 1840 -> "1.8k". */
export function compactCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}
