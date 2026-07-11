import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'
import { IoInformationCircleOutline } from 'react-icons/io5'

type HintProps = {
  /** The message to display. */
  children: ReactNode
  /** Optional leading icon (defaults to an info circle). */
  icon?: IconType
  /** Extra classes to customize the style per usage. */
  className?: string
}

/**
 * A small, unobtrusive inline note — e.g. explaining how to undo an action.
 * Styling can be tweaked per use via `className`.
 */
export default function Hint({ children, icon, className = '' }: HintProps) {
  const Icon = icon ?? IoInformationCircleOutline
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--text-muted)] ${className}`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span>{children}</span>
    </div>
  )
}
