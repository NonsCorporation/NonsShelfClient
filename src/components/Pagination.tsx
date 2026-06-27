import { MdChevronLeft, MdChevronRight } from 'react-icons/md'

// Page navigator for the profile's "Ratings & reviews". Pages are 1-based.
// The active page is rendered as a tilted "sheet of paper" (matching
// nons-client's PaginatedArea), and the list is truncated to first / a window
// around the current page / last, with "…" gaps — so a long history stays a
// single tidy row instead of dozens of buttons.
interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  t: (key: string) => string
}

// Compact page list, e.g. 1 2 3 4 … 20  /  1 … 9 10 11 … 20  /  1 … 17 18 19 20.
function pageItems(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 3) return [1, 2, 3, 4, 'ellipsis', total]
  if (current >= total - 2) return [1, 'ellipsis', total - 3, total - 2, total - 1, total]
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}

export default function Pagination({ currentPage, totalPages, onPageChange, t }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-center gap-1.5 border-t border-[var(--border-subtle)] pt-3">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={t('previousPage')}
      >
        <MdChevronLeft className="h-5 w-5" />
      </button>

      {pageItems(currentPage, totalPages).map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`gap-${i}`} className="select-none px-0.5 text-sm text-[var(--text-muted)]">
            …
          </span>
        ) : p === currentPage ? (
          // The current page — a slightly tilted sheet of paper.
          <button
            key={p}
            aria-current="page"
            className="relative h-9 w-9 -rotate-1 rounded-br-lg rounded-tl-lg border border-[var(--border)] bg-[var(--container)] text-sm font-medium text-[var(--text)] shadow-md transition-all"
          >
            <span className="inline-block rotate-1">{p}</span>
          </button>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className="h-9 w-9 rounded-lg text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={t('nextPage')}
      >
        <MdChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}
