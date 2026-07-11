import { IoBookOutline, IoFilmOutline, IoTvOutline } from 'react-icons/io5'
import type { MediaType } from '@/types'

const ICON: Record<MediaType, typeof IoBookOutline> = {
  book: IoBookOutline,
  series: IoTvOutline,
  movie: IoFilmOutline,
}

type TypeBadgeProps = {
  type: MediaType
  /** Positioning utilities for the absolute badge (default top-right). */
  position?: string
  /** Badge circle size. */
  size?: string
  /** Icon size inside the badge. */
  iconSize?: string
  className?: string
}

// The circular media-type badge shown on covers across the app (book / film /
// series), matching the Discover cards. Render inside a `relative` container.
export default function TypeBadge({
  type,
  position = 'top-2 right-2',
  size = 'h-7 w-7',
  iconSize = 'h-3.5 w-3.5',
  className = '',
}: TypeBadgeProps) {
  const Icon = ICON[type] ?? IoFilmOutline
  return (
    <span
      className={`absolute ${position} ${size} flex items-center justify-center rounded-full bg-black/45 text-white/80 ${className}`}
    >
      <Icon className={iconSize} />
    </span>
  )
}
