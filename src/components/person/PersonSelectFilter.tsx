'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoSearch, IoPersonOutline, IoClose } from 'react-icons/io5'
import { useFloatingPosition } from '@/hooks/useFloatingPosition'

export type PersonOption = { name: string; makerUuid?: string; photoUrl?: string }

type Props = {
  value: string
  onChange: (v: string) => void
  /** Candidate people to suggest — typically the distinct authors/directors
   *  already present in the library being filtered. */
  options: PersonOption[]
  placeholder: string
  className?: string
}

// Searchable single-person filter field, styled like the PersonPicker used in
// the media edit modal (avatar + name rows), but backed by the library's own
// people (no server search) since this only needs to offer names already
// present in the list being filtered.
export default function PersonSelectFilter({ value, onChange, options, placeholder, className }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const coords = useFloatingPosition(wrapRef, open, false)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const q = value.trim().toLowerCase()
  const matches = (q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options).slice(0, 8)

  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <IoSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`${className ?? ''} pl-9 pr-8`}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            aria-label="Clear"
          >
            <IoClose className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Suggestion dropdown — portalled to document.body with fixed viewport
          coordinates so a scrollable/overflow-hidden ancestor never crops it. */}
      {open && coords && matches.length > 0 && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', left: coords.left, top: coords.top, width: coords.width }}
          className="z-[110] max-h-56 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--container)] p-1.5 shadow-xl"
        >
          {matches.map((o) => (
            <button
              key={o.makerUuid ?? o.name}
              type="button"
              onClick={() => pick(o.name)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              {o.photoUrl ? (
                <img src={o.photoUrl} alt="" className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--container-2)]">
                  <IoPersonOutline className="h-3.5 w-3.5 text-[var(--placeholder)]" />
                </span>
              )}
              <span className="truncate">{o.name}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
