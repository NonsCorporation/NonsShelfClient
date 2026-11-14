import { hashHue } from '@/lib/hashHue'

// The banner picture itself — for now a generated placeholder: a gradient tinted
// from the user's handle with faint Horizon rings (later: the member's image,
// object-cover). Fills whatever box `className` gives it; layout is the caller's.
export default function BannerArt({ seed, className = '' }: { seed: string; className?: string }) {
  const hue = hashHue(seed)
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(120deg, hsl(${hue} 45% 30%), hsl(${(hue + 45) % 360} 50% 18%))` }}
    >
      <svg viewBox="0 0 160 90" preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 h-full w-full" fill="none">
        <circle cx="132" cy="45" r="56" stroke="#f5a623" strokeOpacity="0.16" strokeWidth="1.2" />
        <circle cx="132" cy="45" r="34" stroke="#f5a623" strokeOpacity="0.22" strokeWidth="1.2" />
        <circle cx="132" cy="45" r="14" fill="#f5a623" fillOpacity="0.12" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
    </div>
  )
}
