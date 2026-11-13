'use client'

import type { CSSProperties } from 'react'
import type { IconType } from 'react-icons'
import { IoArrowForward } from 'react-icons/io5'
import { Link } from '@/lib/router'

export type GreetingBubbleProps = {
  /** The message. Kept to a line or two; it truncates on narrow screens. */
  text: string
  /** Where it leads: an in-app path ("/bingo") or a full URL (opens a new tab). */
  href: string
  /** Icon shown in the coloured badge at the left. */
  icon: IconType
  /** Accent: the badge, the arrow and — unless `background` is given — a soft
   *  tint behind the whole bubble. Any CSS colour. */
  color?: string
  /** Optional custom background (any CSS `background`, e.g. a gradient) that
   *  replaces the tint. */
  background?: string
  className?: string
}

// A small tappable message bubble — the line under the feed's greeting. A
// colour, a text, a link, an icon and (optionally) a background; nothing else,
// so whatever should be said there (a new feature, an event, a nudge) is one
// object. Fully controlled by props: it knows nothing about where the message
// comes from.
export default function GreetingBubble({
  text,
  href,
  icon: Icon,
  color = 'var(--color-nonsprimary)',
  background,
  className = '',
}: GreetingBubbleProps) {
  const style = { '--bubble': color, ...(background ? { background } : {}) } as CSSProperties
  const cls =
    `group inline-flex max-w-full items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm transition-all ` +
    (background
      ? 'hover:brightness-110 '
      : 'bg-[color-mix(in_srgb,var(--bubble)_14%,transparent)] hover:bg-[color-mix(in_srgb,var(--bubble)_24%,transparent)] ') +
    className

  const content = (
    <>
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white" style={{ background: 'var(--bubble)' }}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 truncate font-medium text-[var(--text)]">{text}</span>
      <IoArrowForward
        className="h-3.5 w-3.5 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
        style={{ color: 'var(--bubble)' }}
      />
    </>
  )

  return /^https?:\/\//i.test(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
      {content}
    </a>
  ) : (
    <Link to={href} className={cls} style={style}>
      {content}
    </Link>
  )
}
