'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoInformationCircleOutline } from 'react-icons/io5'
import { useFloatingPosition } from '../hooks/useFloatingPosition'

// Click-to-toggle info bubble. Portalled to document.body (like DatePicker's
// panel) — rendered inline it used to get silently clipped by any scrollable
// or overflow-hidden ancestor (e.g. a modal body), which also made it
// unreliable on small/mobile viewports where more of the UI scrolls.
export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const coords = useFloatingPosition(ref, open, false)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        aria-label="More info"
        className="flex h-4 w-4 items-center justify-center text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        <IoInformationCircleOutline className="h-3.5 w-3.5" />
      </button>
      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', left: Math.min(coords.left, window.innerWidth - 240), top: coords.top, bottom: coords.bottom }}
          className="animate-fade-up z-[110] w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--container)_96%,transparent)] p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-[var(--text-muted)] shadow-2xl backdrop-blur-xl"
        >
          {text}
        </div>,
        document.body,
      )}
    </div>
  )
}
