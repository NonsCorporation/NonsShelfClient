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
   *  under the bubble. Any CSS colour. */
  color?: string
  /** Optional custom background (any CSS `background`, e.g. a gradient) that
   *  replaces the soft cloud. */
  background?: string
  className?: string
}

// Light glints inside the pill: [position, size px, opacity, blur px].
const GLINTS: { pos: string; size: number; opacity: number; blur: number }[] = [
  { pos: 'left-11 top-1', size: 7, opacity: 0.35, blur: 0 },
  { pos: 'left-[38%] bottom-1.5', size: 4, opacity: 0.3, blur: 0 },
  { pos: 'left-[62%] top-1.5', size: 13, opacity: 0.12, blur: 2 },
  { pos: 'right-10 bottom-1', size: 9, opacity: 0.16, blur: 1 },
  { pos: 'right-3 top-1.5', size: 4, opacity: 0.3, blur: 0 },
]

// A tappable message bubble — the line under the feed's greeting. A colour, a
// text, a link, an icon and (optionally) a background; the cloud, glow and
// glints are all derived from the colour. Deliberately quiet — it sits beside
// the greeting, not above it. Fully controlled by props:
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
      'linear-gradient(135deg, color-mix(in srgb, var(--bubble) 15%, transparent), color-mix(in srgb, var(--bubble) 6%, transparent))',
    boxShadow:
      '0 4px 14px -6px color-mix(in srgb, var(--bubble) 45%, transparent), 0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
    border: '1px solid color-mix(in srgb, var(--bubble) 20%, transparent)',
  }

  const pillCls =
    'group relative inline-flex max-w-full items-center gap-2.5 overflow-hidden rounded-full py-1 pl-1 pr-3.5 text-sm transition-all duration-200 hover:brightness-110 '

  const content = (
    <>
      {/* Cloud: soft blurred blobs of the colour behind the text. */}
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute -left-4 -top-6 h-14 w-24 rounded-full opacity-25 blur-xl" style={{ background: 'var(--bubble)' }} />
        <span className="absolute left-1/3 -bottom-7 h-12 w-28 rounded-full opacity-15 blur-xl" style={{ background: 'var(--bubble)' }} />
        <span className="absolute -right-3 -top-4 h-12 w-20 rounded-full opacity-20 blur-xl" style={{ background: 'var(--bubble)' }} />
        {/* Sheen along the top edge. */}
        <span className="absolute inset-x-2 top-0 h-1/2 rounded-full bg-gradient-to-b from-white/10 to-transparent" />
        {/* Glints: small light spots inside the glass. */}
        {GLINTS.map((g, i) => (
          <span
            key={i}
            className={`absolute rounded-full ${g.pos}`}
            style={{
              width: g.size,
              height: g.size,
              opacity: g.opacity,
              filter: g.blur ? `blur(${g.blur}px)` : undefined,
              background: 'radial-gradient(circle at 35% 30%, #fff, rgba(255,255,255,0.15) 70%)',
            }}
          />
        ))}
      </span>

      {/* Glossy filled badge. */}
      <span
        className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white"
        style={{
          background: 'linear-gradient(145deg, color-mix(in srgb, var(--bubble) 80%, white), var(--bubble))',
          boxShadow: '0 2px 6px -1px color-mix(in srgb, var(--bubble) 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 2px rgba(0,0,0,0.15)',
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>

      <span className="relative min-w-0 truncate font-medium text-[var(--text)]">{text}</span>
      <IoArrowForward
        className="relative h-3.5 w-3.5 flex-shrink-0 opacity-80 transition-transform group-hover:translate-x-0.5"
        style={{ color: 'var(--bubble)' }}
      />
    </>
  )

  return (
    <div className={`relative inline-flex max-w-full ${className}`} style={vars}>
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
