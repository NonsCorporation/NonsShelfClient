// Nons Shelf wordmark glyph — the two nons-client pillars flanking a centre "!"
// (a tall bar with the brand circle as its dot). Drawn with fill="currentColor"
// so the color follows the `text-*` class passed in (an <img> can't inherit
// that). The dark-disc favicon version lives in /shelf.svg.
export default function ShelfLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="86 89 340 340" fill="currentColor" role="img" aria-label="Nons Shelf" className={className}>
      <g transform="translate(89.6, 89.6) scale(0.65)">
        <path d="m 281.77771,168.55891 a 58.151039,58.151039 47.226629 0 1 55.84784,60.36644 v 137.13181 h -55.84784 z" transform="matrix(2.446384,0,0,2.4904064,-337.33813,-404.93892)" />
        <path d="m 281.77771,168.55891 a 58.151039,58.151039 47.226629 0 1 55.84784,60.36644 v 137.13181 h -55.84784 z" transform="matrix(-2.446384,0,0,2.4904064,837.74641,-411.14917)" />
      </g>
      <rect x="211" y="112" width="90" height="200" rx="16" />
      <circle cx="256" cy="376" r="42" />
    </svg>
  )
}
