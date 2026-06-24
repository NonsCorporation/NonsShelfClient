'use client'

// Infinity-curve loader: three dots trail along a lemniscate (∞) path.
// The path is drawn as a subtle guide; the leading dot has a soft glow.
// Pure SVG SMIL — zero JS runtime overhead.

const PATH =
  'M 0,0 C -10,-42 -50,-42 -50,0 C -50,42 -10,42 0,0 C 10,-42 50,-42 50,0 C 50,42 10,42 0,0 Z'

interface Props {
  size?: number   // SVG display size in px (default 140)
  hint?: string   // optional label shown beneath the animation
}

export default function InfinityLoader({ size = 140, hint }: Props) {
  const id = 'inf-path'

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="-65 -55 130 110"
        width={size}
        height={size * (110 / 130)}
        aria-hidden
      >
        <defs>
          <path id={id} d={PATH} />

          {/* Soft glow for the lead dot */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradient stroke on the guide path */}
          <linearGradient id="guide-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--primary, #6768ab)" stopOpacity="0.12" />
            <stop offset="50%" stopColor="var(--primary, #6768ab)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--primary, #6768ab)" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {/* Guide path — barely visible */}
        <path
          d={PATH}
          fill="none"
          stroke="url(#guide-grad)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Tail dot 2 — furthest behind */}
        <circle r="2" fill="var(--primary, #6768ab)" opacity="0.28">
          <animateMotion dur="2.8s" repeatCount="indefinite" begin="-1.86s">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>

        {/* Tail dot 1 — mid trail */}
        <circle r="3.5" fill="var(--primary, #6768ab)" opacity="0.55">
          <animateMotion dur="2.8s" repeatCount="indefinite" begin="-0.93s">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>

        {/* Lead dot — largest, glowing */}
        <circle r="5.5" fill="var(--primary, #6768ab)" filter="url(#glow)">
          <animateMotion dur="2.8s" repeatCount="indefinite" begin="0s">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>

        {/* Subtle pulse at the crossing point (origin) */}
        <circle cx="0" cy="0" r="3" fill="var(--primary, #6768ab)" opacity="0">
          <animate
            attributeName="r"
            values="2;10;2"
            dur="2.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.4;0;0.4"
            dur="2.8s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      {hint && (
        <p className="text-xs text-[var(--text-muted)]">
          {hint}
          <Ellipsis />
        </p>
      )}
    </div>
  )
}

// Animated "..." that cycles through 1–3 dots.
function Ellipsis() {
  return (
    <>
      <style>{`
        @keyframes ellipsis {
          0%,100% { content: '.'; }
          33%      { content: '..'; }
          66%      { content: '...'; }
        }
        .anim-ellipsis::after {
          content: '.';
          animation: ellipsis 1.4s steps(1) infinite;
        }
      `}</style>
      <span className="anim-ellipsis" />
    </>
  )
}
