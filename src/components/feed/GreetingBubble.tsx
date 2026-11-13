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
  /** Icon in the glossy badge at the left — pass a filled one (IoGrid, IoStar …). */
  icon: IconType
  /** Accent for everything: the badge, the cloud behind the text, the glow
   *  under the bubble, the floating bubbles. Any CSS colour. */
  color?: string
  /** Optional custom background (any CSS `background`, e.g. a gradient) that
   *  replaces the soft cloud. */
  background?: string
  className?: string
}

// The floating "bubbles" around the pill: [position, size, delay]. Some sit
// half outside the pill on purpose.
const FLOATERS: { pos: string; size: number; delay: string; opacity: number }[] = [
  { pos: '-left-1.5 -top-2.5', size: 14, delay: '0s', opacity: 0.95 },
  { pos: 'left-9 -bottom-2', size: 8, delay: '-1.2s', opacity: 0.75 },
  { pos: '-right-1 -top-1.5', size: 9, delay: '-2.1s', opacity: 0.85 },
  { pos: 'right-7 -bottom-1.5', size: 6, delay: '-0.6s', opacity: 0.6 },
]

// A tappable message bubble — the line under the feed's greeting. A colour, a
// text, a link, an icon and (optionally) a background; the cloud, glow and
// floating bubbles are all derived from the colour. Fully controlled by props:
// it knows nothing about where the message comes from.
export default function GreetingBubble({
  text,
  href,
  icon: Icon,
  color = 'var(--color-nonsprimary)',
  background,
  className = '',
}: GreetingBubbleProps) {
  // `--bubble` is the one colour everything below is mixed from.
  const vars = { '--bubble': color } as CSSProperties

  const pillStyle: CSSProperties = {
    background:
      background ??
      'linear-gradient(135deg, color-mix(in srgb, var(--bubble) 30%, transparent), color-mix(in srgb, var(--bubble) 12%, transparent))',
    boxShadow:
      '0 10px 26px -10px color-mix(in srgb, var(--bubble) 70%, transparent), 0 3px 8px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.18)',
    border: '1px solid color-mix(in srgb, var(--bubble) 38%, transparent)',
  }

  const pillCls =
    'group relative inline-flex max-w-full items-center gap-2.5 overflow-hidden rounded-full py-1.5 pl-1.5 pr-4 text-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 '

  const content = (
    <>
      {/* Cloud: soft blurred blobs of the colour behind the text. */}
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute -left-4 -top-6 h-14 w-24 rounded-full opacity-60 blur-xl" style={{ background: 'var(--bubble)' }} />
        <span className="absolute left-1/3 -bottom-7 h-12 w-28 rounded-full opacity-40 blur-xl" style={{ background: 'var(--bubble)' }} />
        <span className="absolute -right-3 -top-4 h-12 w-20 rounded-full opacity-45 blur-xl" style={{ background: 'var(--bubble)' }} />
      </span>

      {/* Glossy filled badge. */}
      <span
        className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white"
        style={{
          background: 'linear-gradient(145deg, color-mix(in srgb, var(--bubble) 70%, white), var(--bubble))',
          boxShadow: '0 4px 10px -2px color-mix(in srgb, var(--bubble) 80%, transparent), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 3px rgba(0,0,0,0.2)',
        }}
      >
        <Icon className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" />
      </span>

      <span className="relative min-w-0 truncate font-semibold text-[var(--text)]">{text}</span>
      <IoArrowForward
        className="relative h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
        style={{ color: 'var(--bubble)' }}
      />
    </>
  )

  return (
    <div className={`relative inline-flex max-w-full ${className}`} style={vars}>
      {/* Floating bubbles — outside the pill's clipped area so they poke out. */}
      {FLOATERS.map((f, i) => (
        <span
          key={i}
          aria-hidden
          className={`bubble-float pointer-events-none absolute z-10 rounded-full ${f.pos}`}
          style={{
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animationDelay: f.delay,
            background: 'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.85), color-mix(in srgb, var(--bubble) 85%, white) 38%, var(--bubble))',
            boxShadow: '0 2px 6px color-mix(in srgb, var(--bubble) 60%, transparent), inset 0 -1px 2px rgba(0,0,0,0.2)',
          }}
        />
      ))}

      {/^https?:\/\//i.test(href) ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={pillCls} style={pillStyle}>
          {content}
        </a>
      ) : (
        <Link to={href} className={pillCls} style={pillStyle}>
          {content}
        </Link>
      )}
    </div>
  )
}
