import HorizonBadge from './HorizonBadge'

// Each dot starts at (x, y) — % of the icon's box, so outside 0–100 is outside the
// icon — and wanders through three more points (px offsets) before coming back.
type Dot = { x: number; y: number; p: [number, number][]; size: number; dur: number; delay: number }

const DOTS: Dot[] = [
  { x: 50, y: -6, p: [[4, 1], [6, 5], [2, 3]], size: 2.5, dur: 5.2, delay: 0 },
  { x: 106, y: 24, p: [[-2, 4], [-5, 7], [1, 3]], size: 2, dur: 6.1, delay: -1.4 },
  { x: 102, y: 84, p: [[-4, -4], [-6, 1], [-2, 4]], size: 2.5, dur: 5.6, delay: -2.6 },
  { x: 44, y: 106, p: [[-4, -3], [-2, -6], [4, -2]], size: 2, dur: 6.4, delay: -0.8 },
  { x: -8, y: 74, p: [[4, -4], [6, 1], [3, 5]], size: 2.5, dur: 5.8, delay: -3.2 },
  { x: -4, y: 12, p: [[3, 5], [5, 2], [1, -3]], size: 2, dur: 6.8, delay: -4.4 },
]

// The Horizon mark with small glowing amber circles floating around it — like the
// particles on nons' Horizon button. The glow and motion live in globals.css
// (.horizon-glow, .horizon-dot); with reduced motion the dots hold still.
export default function GlowingHorizon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <span className={`horizon-glow relative inline-flex flex-shrink-0 items-center justify-center ${className}`}>
      <HorizonBadge className="relative h-full w-full" />
      {DOTS.map((d, i) => (
        <span
          key={i}
          aria-hidden
          className="horizon-dot"
          style={
            {
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: d.size,
              height: d.size,
              '--x1': `${d.p[0][0]}px`, '--y1': `${d.p[0][1]}px`,
              '--x2': `${d.p[1][0]}px`, '--y2': `${d.p[1][1]}px`,
              '--x3': `${d.p[2][0]}px`, '--y3': `${d.p[2][1]}px`,
              animationDuration: `${d.dur}s`,
              animationDelay: `${d.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  )
}
