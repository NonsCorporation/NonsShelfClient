import type { CSSProperties } from 'react'

// Renders an award trophy as two stacked layers: the award's own icon
// (public/assets/awards/<slug>.svg) on top, recolored to `color`, sitting on a
// shared gray stand (stand.svg) below. Each is drawn via a CSS mask — the
// line-art SVG's strokes become the mask, so one file paints any color without
// a second asset, and the icon files stay stand-less (the stand is composed
// here, always gray). The icon slug is derived from the body's key (1:1 to an
// asset, underscores → hyphens), so the artwork is a pure frontend concern.
const KNOWN = new Set([
  'academy', 'golden-globe', 'bafta', 'booker', 'pen-faulkner', 'pulitzer',
  'newbery', 'caldecott', 'national-book', 'womens-prize', 'costa', 'hugo',
  'nebula', 'locus', 'saturn', 'trophy',
])

const STAND_COLOR = '#9ca3af' // neutral gray, legible on both themes

function maskLayer(url: string, position: string): CSSProperties {
  return {
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskPosition: position,
    maskPosition: position,
  }
}

export default function AwardIcon({
  bodyKey, color, size = 28, className = '',
}: {
  /** The award body's key (e.g. "golden_globe") — mapped to an SVG asset. */
  bodyKey: string
  color: string
  size?: number
  className?: string
}) {
  const derived = bodyKey.replace(/_/g, '-')
  const slug = KNOWN.has(derived) ? derived : 'trophy'
  const iconUrl = `/assets/awards/${slug}.svg`

  return (
    <span
      aria-hidden
      className={className}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', width: size, height: size }}
    >
      {/* Icon — bottom-anchored so it sits right on the stand regardless of the
          figure's proportions. */}
      <span
        style={{ width: size, flex: 1, minHeight: 0, backgroundColor: color, ...maskLayer(iconUrl, 'bottom center') }}
      />
    </span>
  )
}
