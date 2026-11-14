import { HiOutlineLibrary } from 'react-icons/hi'
import HorizonBadge from './HorizonBadge'
import { HORIZON_ON } from '../../lib/horizon'

interface Props {
  className?: string
}

// The librarian mark, followed by Horizon. Every librarian gets Horizon for now;
// once Horizon is a real per-user flag, move it out to its own check.
export default function LibrarianBadge({ className }: Props) {
  const size = className ?? 'h-4 w-4'
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-1 align-middle">
      <HiOutlineLibrary title="Librarian" className={`flex-shrink-0 text-[#c23f6b] ${size}`} />
      {HORIZON_ON && <HorizonBadge className={size} />}
    </span>
  )
}
