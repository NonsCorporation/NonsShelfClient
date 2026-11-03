import { useSyncExternalStore } from 'react'

// Live `window.matchMedia(query).matches`. Used where CSS-only hiding isn't
// enough — e.g. the chat thread must mount once (desktop pane OR mobile
// overlay), not twice with one hidden.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
