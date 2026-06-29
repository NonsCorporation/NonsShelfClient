import { HiOutlineLibrary } from 'react-icons/hi'

interface Props {
  className?: string
}

export default function LibrarianBadge({ className }: Props) {
  return (
    <HiOutlineLibrary
      title="Librarian"
      className={`flex-shrink-0 text-[#c23f6b] ${className ?? 'h-4 w-4'}`}
    />
  )
}
