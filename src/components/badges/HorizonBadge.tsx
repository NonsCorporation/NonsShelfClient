interface Props {
  className?: string
}

// The Horizon (premium) mark from nons: two concentric amber rings.
// Ported from nons-client's PremiumIcon (components/icons.tsx).
export default function HorizonBadge({ className }: Props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" role="img" aria-label="Horizon" className={`flex-shrink-0 ${className ?? 'h-4 w-4'}`}>
      <title>Horizon</title>
      <circle cx="8" cy="8" r="6.5" stroke="#f5a623" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="3.5" stroke="#f5a623" strokeWidth="1.5" />
    </svg>
  )
}
