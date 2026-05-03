export type MediaItem = {
  id: string
  type: 'book' | 'movie'
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
}
