'use client'

import { useMemo } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BoringAvatar from '@/components/ui/BoringAvatar'
import { useDominantColor } from './useDominantColor'

// The generated (Boring Avatar) picture for `name`, as an image URL, so its colour
// can be read the same way as a real photo's.
function generatedAvatarUrl(name: string): string {
  let svg = renderToStaticMarkup(<BoringAvatar name={name} size={64} />)
  if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * The dominant colour (#rrggbb) of someone's profile picture: their photo when
 * they have one, else the generated avatar they'd be shown (seeded by `name`,
 * e.g. `user-12`). Null while it loads or when the image can't be read.
 */
export function useAvatarColor(avatarUrl: string | null | undefined, name: string): string | null {
  const generated = useMemo(() => (avatarUrl ? undefined : generatedAvatarUrl(name)), [avatarUrl, name])
  return useDominantColor(avatarUrl || generated)
}
