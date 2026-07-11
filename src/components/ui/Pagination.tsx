import { MdChevronLeft, MdChevronRight } from 'react-icons/md'

// Page navigator (ratings & reviews, friends feed). Pages are 1-based. The
// active page is rendered as a tilted "sheet of paper" (matching nons-client's
// PaginatedArea), and only a sliding window around the current page is shown —
// a couple behind, a few ahead — so a long history stays a single tidy row.
interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  t: (key: string) => string
}

// A sliding window around the current page — a couple of pages behind and a few
// ahead — without anchoring to the last page. e.g. on page 6: 4 5 [6] 7 8 9 10.
function pageItems(current: number, total: number): number[] {
  const before = 2
  const after = 4
  const start = Math.max(1, current - before)
  const end = Math.min(total, current + after)
  const pages: number[] = []
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
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

      {pageItems(currentPage, totalPages).map((p) =>
        p === currentPage ? (
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
