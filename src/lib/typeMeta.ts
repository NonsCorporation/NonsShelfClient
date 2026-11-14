import type { IconType } from 'react-icons'
import { IoBookOutline, IoFilmOutline, IoTvOutline } from 'react-icons/io5'
import type { MediaType } from '@/types'

// Per-type identity used across the cards: an icon, a label key and an accent
// colour. Gives books, films and series a distinct, recognisable look instead of
// leaning on one generic poster treatment.
export const TYPE_META: Record<MediaType, { icon: IconType; labelKey: string; color: string }> = {
  book: { icon: IoBookOutline, labelKey: 'book', color: '#e0a458' },
  movie: { icon: IoFilmOutline, labelKey: 'film', color: '#7c8cff' },
  series: { icon: IoTvOutline, labelKey: 'series', color: '#4fd1c5' },
}
