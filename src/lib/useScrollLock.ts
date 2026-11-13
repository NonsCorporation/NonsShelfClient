import { useEffect } from 'react'

// Reference-counted so stacked modals (e.g. a confirm dialog opened from another
// modal) don't unlock the page until the last one closes, whatever the order.
let locks = 0
let prevOverflow = ''

/** Locks background page scrolling while `active` is true. Call it from any
 *  modal/sheet — before any early `return null`, as with every hook.
 *
 *  The lock goes on <html>, not <body>: globals.css gives <html> a non-visible
 *  overflow (`overflow-x: clip`), so the viewport takes its scrolling from
 *  <html> and `body { overflow: hidden }` has no effect on it. */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return
    const el = document.documentElement
    if (locks === 0) {
      prevOverflow = el.style.overflow
      el.style.overflow = 'hidden'
    }
    locks++
    return () => {
      locks--
      if (locks === 0) el.style.overflow = prevOverflow
    }
  }, [active])
}
