import LibrarianBadge from './LibrarianBadge'
import HorizonBadge from './HorizonBadge'
import { isLibrarian } from '@/services/librarianService'

const SIZE = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' } as const

// The marks next to a person's name, always in the same order: librarian first,
// then Horizon. Every place that shows a name (profile, feed posts, comments,
// the hover card) uses this, so the order can't drift between them. Pass only
// what is known at the call site — e.g. comments carry no role.
export default function UserBadges({
  role,
  horizon,
  size = 'md',
  className = '',
}: {
  role?: string
  horizon?: boolean
  size?: keyof typeof SIZE
  /** Extra classes on each icon (e.g. alignment inside running text). */
  className?: string
}) {
  const cls = `${SIZE[size]} flex-shrink-0 ${className}`.trim()
  return (
    <>
      {isLibrarian(role) && <LibrarianBadge className={cls} />}
      {horizon && <HorizonBadge className={cls} />}
    </>
  )
}
