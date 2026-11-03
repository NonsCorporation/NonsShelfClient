import { useEffect, useState, type CSSProperties } from 'react'

// Keeps a full-screen mobile panel (an open chat) inside what's actually
// visible while the on-screen keyboard is open. This folds in nons' three
// separate "stick the user" fixes for iOS:
//  1. svh/dvh track the browser chrome, not the keyboard, so the panel stays
//     too tall and iOS pans it up — pin its height to visualViewport.height;
//  2. iOS still pans the *visual* viewport (offsetTop > 0) on refocus/content
//     changes, which window.scrollTo can't undo — translate the panel down by
//     the same offset;
//  3. the layout viewport can drift too — snap window scroll back to the top.
// Returns style for the panel; empty when not needed (desktop, keyboard closed).
export function useKeyboardViewport(active: boolean): CSSProperties {
  const [vp, setVp] = useState<{ height: number; offsetTop: number } | null>(null)

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!active || !vv) return

    const update = () => {
      const keyboardOpen = window.innerWidth < 1024 && window.innerHeight - vv.height > 80
      setVp(keyboardOpen ? { height: vv.height, offsetTop: vv.offsetTop } : null)
      if (keyboardOpen && (window.scrollX !== 0 || window.scrollY !== 0)) window.scrollTo(0, 0)
    }
    const snapBack = () => {
      if (window.innerWidth < 1024 && (window.scrollX !== 0 || window.scrollY !== 0)) window.scrollTo(0, 0)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('scroll', snapBack, { passive: true })
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('scroll', snapBack)
      setVp(null)
    }
  }, [active])

  return vp ? { height: `${vp.height}px`, transform: `translateY(${vp.offsetTop}px)` } : {}
}
