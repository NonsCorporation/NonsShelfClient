import { hashHue } from '@/lib/hashHue'

// The banner on a Horizon member's profile card. For now a generated
// placeholder — a gradient tinted from the user's handle, with faint Horizon
// rings — until members can upload their own image (then: object-cover).
//
// It is the card's first child and stays inside the card: the -mx/-mt cancel the
// card's padding so it runs edge to edge along the top, with the card's rounded
// top corners. On phones it is 3:1 (wide and short); from sm up it has a fixed
// 10rem height — a plain height, not a ratio plus max-height, because that would
// shrink the width too and leave the banner narrower than the card.
export default function ProfileBanner({ seed }: { seed: string }) {
  const hue = hashHue(seed)
  return (
    <div
      aria-hidden
      className="relative -mx-5 -mt-5 aspect-[3/1] overflow-hidden rounded-t-2xl sm:-mx-6 sm:-mt-6 sm:aspect-auto sm:h-40"
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
