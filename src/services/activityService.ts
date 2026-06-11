import type { MediaType } from '../types'

export type ActivityType = 'rated' | 'finished' | 'started' | 'added' | 'reviewed'

export type Activity = {
  id: string
  user: { name: string; handle: string; color: string }
  type: ActivityType
  mediaTitle: string
  mediaType: MediaType
  coverUrl?: string
  /** Rating out of 10, when the activity carries one. */
  rating?: number
  /** Short review snippet for `reviewed` activities. */
  text?: string
  /** Mock relative time, e.g. "2h", "1d". */
  timeAgo: string
}

const friends = {
  anna: { name: 'Anna Petrova', handle: 'anna', color: '#c2557a' },
  marco: { name: 'Marco Diaz', handle: 'marco', color: '#3e8e7e' },
  lena: { name: 'Lena Fischer', handle: 'lena', color: '#b8843b' },
  sofia: { name: 'Sofia Rossi', handle: 'sofia', color: '#5b6cc0' },
}

const activity: Activity[] = [
  {
    id: 'a1',
    user: friends.anna,
    type: 'rated',
    mediaTitle: 'Dune: Part Two',
    mediaType: 'movie',
    coverUrl: 'https://m.media-amazon.com/images/I/71O3w2Gj-PL._AC_SY679_.jpg',
    rating: 9,
    timeAgo: '2h',
  },
  {
    id: 'a2',
    user: friends.marco,
    type: 'finished',
    mediaTitle: 'Project Hail Mary',
    mediaType: 'book',
    coverUrl: 'https://covers.openlibrary.org/b/id/10520611-L.jpg',
    rating: 9.5,
    timeAgo: '5h',
  },
  {
    id: 'a3',
    user: friends.lena,
    type: 'started',
    mediaTitle: 'Babel',
    mediaType: 'book',
    coverUrl: 'https://covers.openlibrary.org/b/id/12643765-L.jpg',
    timeAgo: '8h',
  },
  {
    id: 'a4',
    user: friends.sofia,
    type: 'reviewed',
    mediaTitle: 'Poor Things',
    mediaType: 'movie',
    coverUrl: 'https://m.media-amazon.com/images/I/71eAj7lT7-L._AC_SY679_.jpg',
    rating: 8,
    text: 'Visually stunning and deeply strange — unlike anything else this year.',
    timeAgo: '1d',
  },
  {
    id: 'a5',
    user: friends.anna,
    type: 'added',
    mediaTitle: 'Tomorrow, and Tomorrow, and Tomorrow',
    mediaType: 'book',
    coverUrl: 'https://covers.openlibrary.org/b/id/12818862-L.jpg',
    timeAgo: '1d',
  },
  {
    id: 'a6',
    user: friends.marco,
    type: 'rated',
    mediaTitle: 'Everything Everywhere All at Once',
    mediaType: 'movie',
    coverUrl: 'https://m.media-amazon.com/images/I/71niXI3lxlL._AC_SY679_.jpg',
    rating: 9,
    timeAgo: '2d',
  },
  {
    id: 'a7',
    user: friends.lena,
    type: 'finished',
    mediaTitle: 'Fourth Wing',
    mediaType: 'book',
    coverUrl: 'https://covers.openlibrary.org/b/id/14346269-L.jpg',
    rating: 8.5,
    timeAgo: '3d',
  },
]

export interface IActivityService {
  getFriendsActivity(): Promise<Activity[]>
}

class MockActivityService implements IActivityService {
  async getFriendsActivity(): Promise<Activity[]> {
    return new Promise((resolve) => setTimeout(() => resolve(activity), 130))
  }
}

export const activityService: IActivityService = new MockActivityService()
