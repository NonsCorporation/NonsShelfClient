'use client'

import { useEffect, useRef, useState } from 'react'
import { IoInformationCircleOutline } from 'react-icons/io5'

export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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
      {open && (
        <div className="animate-fade-up absolute left-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--container)_96%,transparent)] p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-[var(--text-muted)] shadow-2xl backdrop-blur-xl">
          {text}
        </div>
      )}
    </div>
  )
}
