export type MediaType = 'book' | 'movie'

// Shelf status — the Goodreads/IMDb "what am I doing with this" axis.
//   wishlist -> Want to Read / Want to Watch
//   active   -> Currently Reading / Watching
//   done     -> Read / Watched
export type ShelfStatus = 'wishlist' | 'active' | 'done'

export type MediaItem = {
  id: string
  type: MediaType
  title: string
  author: string
  coverUrl?: string
  year?: number
  genre?: string | string[]
  director?: string
  actors?: string[]
  tags?: string[]
  rating?: number
  pages?: number
  description?: string
  duration?: string
  dateAdded?: string
  status?: ShelfStatus
  favorite?: boolean
}
