'use client'

import { hashHue } from '@/lib/hashHue'
import { bannerCss, defaultBannerColor } from '@/lib/bannerColor'
import { useAvatarColor } from '@/lib/useAvatarColor'

// The banner: a plain flat colour — the one the user picked (`color`, as stored:
// "F12312"), else (automatic) the dominant colour of their profile picture — their
// photo, or the generated avatar when they have none — else one tinted from the
// avatar seed (later: the Horizon member's own image, object-cover). Fills
// whatever box `className` gives it; layout is the caller's. `children` render on
// top (e.g. the edit button) and may hang outside it, so the box itself does not
// clip: round it through `className` (the background follows the corners).
export default function BannerArt({
  color,
  avatarUrl,
  avatarSeed,
  className = '',
  children,
}: {
  /** The chosen colour as stored ("F12312"); empty/undefined = automatic. */
  color?: string | null
  avatarUrl?: string | null
  /** Seed of the generated avatar (`user-<id>`), used when there is no photo. */
  avatarSeed: string
  className?: string
  children?: React.ReactNode
}) {
  const auto = useAvatarColor(avatarUrl, avatarSeed)
  const shown = bannerCss(color) ?? auto ?? defaultBannerColor(hashHue(avatarSeed))
  return (
    <div className={`relative ${className}`} style={{ background: shown }}>
      {children}
    </div>
  )
}
