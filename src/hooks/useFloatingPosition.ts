'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'

export type FloatingCoords = { left: number; top?: number; bottom?: number; width: number }

/**
 * Fixed-viewport coordinates for a floating panel anchored to a trigger
 * element. Recomputed while open on scroll (capture phase, so scrolling any
 * ancestor — not just the window — counts) and resize, so the panel stays
 * glued to the trigger.
 *
 * Panels built on this are meant to render through a portal to
 * document.body: a `fixed`-positioned child still gets clipped by an
 * `overflow-hidden`/`overflow-auto` ancestor if it stays in that ancestor's
 * DOM subtree, so escaping the subtree via portal is what actually fixes
 * cropping — this hook only supplies the coordinates to put it back in the
 * right visual spot.
 */
export function useFloatingPosition(
  triggerRef: RefObject<HTMLElement | null>,
  open: boolean,
  openUp: boolean,
  gap = 6,
): FloatingCoords | null {
  const [coords, setCoords] = useState<FloatingCoords | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCoords(null)
      return
    }
    const update = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setCoords(
        openUp
          ? { left: r.left, bottom: window.innerHeight - r.top + gap, width: r.width }
          : { left: r.left, top: r.bottom + gap, width: r.width },
      )
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, openUp, triggerRef, gap])

  return coords
}
