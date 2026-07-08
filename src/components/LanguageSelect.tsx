import { useEffect, useRef, useState } from 'react'
import { IoCheckmark, IoChevronDown } from 'react-icons/io5'
import type { Language } from '../contexts/LanguageContext'

const LANGUAGE_OPTIONS: { key: Language; flag: string; label: string }[] = [
  { key: 'en', flag: '🇺🇸', label: 'English' },
  { key: 'ru', flag: '🇷🇺', label: 'Русский' },
  { key: 'ro', flag: '🇷🇴', label: 'Română' },
]

// Custom dropdown for the UI language — replaces the native <select> so the
// menu matches the app's own styling instead of the OS/browser chrome.
export default function LanguageSelect({ value, onChange }: { value: Language; onChange: (v: Language) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGUAGE_OPTIONS.find((opt) => opt.key === value) ?? LANGUAGE_OPTIONS[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--border-subtle)] p-2 text-sm text-[var(--text)] transition-colors focus:outline-none focus:ring-2 focus:ring-nonsprimary focus:border-transparent"
      >
        <span className="flex items-center gap-2">
          <span>{current.flag}</span>
          {current.label}
        </span>
        <IoChevronDown className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="animate-fade-up absolute top-full z-50 mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--container)] py-1 shadow-xl">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => { onChange(opt.key); setIsOpen(false) }}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--border-subtle)] hover:text-[var(--text)]"
            >
              <span className="flex items-center gap-2">
                <span>{opt.flag}</span>
                {opt.label}
              </span>
              {opt.key === value && <IoCheckmark className="h-4 w-4 text-nonsprimary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
