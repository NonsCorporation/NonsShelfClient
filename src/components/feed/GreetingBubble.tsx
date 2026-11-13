'use client'

import type { CSSProperties } from 'react'
import type { IconType } from 'react-icons'
import { IoArrowForward } from 'react-icons/io5'
import { Link } from '@/lib/router'

export type GreetingBubbleProps = {
  /** The message. Kept to a line; it truncates on narrow screens. */
  text: string
  /** Where it leads: an in-app path ("/bingo") or a full URL (opens a new tab). */
  href: string
  /** Icon at the left, drawn bare in the accent colour — any react-icons icon
   *  (a filled one reads best: IoTrophy, IoStar …). */
  icon: IconType
  /** The colour of the icon and of the water on the right. Any CSS colour. */
  color?: string
  /** Optional custom background for the pill (any CSS `background`); the
   *  default is the near-black of the bingo boards. */
  background?: string
  className?: string
}

// One wave layer: [fill opacity, seconds per loop, vertical offset in %, reverse].
const WAVES: { opacity: number; seconds: number; y: number; reverse?: boolean }[] = [
  { opacity: 0.22, seconds: 11, y: 0 },
  { opacity: 0.32, seconds: 7.5, y: 14, reverse: true },
  { opacity: 0.5, seconds: 5, y: 30 },
]

// A tappable message pill — the line next to the feed's greeting. Near-black like
// the bingo boards: icon on the left, the text in the middle, and on the right a
// patch of water in the pill's colour that drifts slowly. Everything is driven
// by props; it knows nothing about where the message comes from.
export default function GreetingBubble({
  text,
  href,
  icon: Icon,
  color = 'var(--color-nonsprimary)',
  background,
  className = '',
}: GreetingBubbleProps) {
  // --tone is the accent pulled toward grey, so the colours sit back a little.
  const pillStyle = {
    '--bubble': color,
    '--tone': 'color-mix(in oklab, var(--bubble) 72%, #707070)',
    background: background ?? '#0d0d0e',
  } as CSSProperties

  const cls =
    `group relative inline-flex max-w-full items-center gap-2.5 overflow-hidden rounded-full border border-white/[0.07] py-1.5 pl-1.5 pr-14 text-[13px] ` +
    `shadow-[0_2px_10px_-4px_rgba(0,0,0,0.6)] transition-all duration-200 hover:border-white/15 hover:brightness-110 ${className}`

  const content = (
    <>
      {/* Water: wavy layers drifting sideways, fading out toward the text. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-[34%]"
        style={{
          WebkitMaskImage: 'linear-gradient(to right, transparent, #000 70%)',
          maskImage: 'linear-gradient(to right, transparent, #000 70%)',
        }}
      >
        {/* A soft glow where the water is deepest. */}
        <span
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 90% 120% at 100% 60%, color-mix(in srgb, var(--tone) 30%, transparent), transparent 70%)' }}
        />
        {WAVES.map((w, i) => (
          <svg
            key={i}
            viewBox="0 0 200 40"
            preserveAspectRatio="none"
            className="bubble-wave absolute left-0 h-full w-[200%]"
            style={{
              top: `${w.y}%`,
              opacity: w.opacity,
              animationDuration: `${w.seconds}s`,
              animationDirection: w.reverse ? 'reverse' : 'normal',
            }}
          >
            {/* Two identical periods, so shifting by half the width loops seamlessly. */}
            <path
              d="M0 18 Q25 6 50 18 T100 18 T150 18 T200 18 V40 H0 Z"
              style={{ fill: 'var(--tone)' }}
            />
          </svg>
        ))}
        {/* Light catching the top of the water. */}
        <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-white/25" />
      </span>

      <Icon className="relative ml-2 h-[18px] w-[18px] flex-shrink-0" style={{ color: 'var(--tone)' }} />

      <span className="relative min-w-0 truncate font-medium text-white/85">{text}</span>

      <IoArrowForward className="absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/80 transition-transform group-hover:translate-x-0.5" />
    </>
  )

  return /^https?:\/\//i.test(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={pillStyle}>
      {content}
    </a>
  ) : (
    <Link to={href} className={cls} style={pillStyle}>
      {content}
    </Link>
  )
}
