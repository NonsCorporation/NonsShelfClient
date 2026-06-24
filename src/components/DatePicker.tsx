'use client'

import { useState, useRef, useEffect } from 'react'
import { IoCalendarOutline, IoChevronBack, IoChevronForward } from 'react-icons/io5'
import { useLanguage } from '../contexts/LanguageContext'

interface Props {
  value: string          // YYYY-MM-DD or ""
  onChange: (v: string) => void
  min?: string
  max?: string
  placeholder?: string
}

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function parseDate(s: string): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00Z')
  return isNaN(d.getTime()) ? null : d
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function monthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1))
}

// Monday-first day-of-week (0=Mon … 6=Sun)
function dow(d: Date): number {
  return (d.getUTCDay() + 6) % 7
}

export default function DatePicker({ value, onChange, min, max, placeholder }: Props) {
  const { language } = useLanguage()
  const selected = parseDate(value)

  const today = new Date()
  const initYear = selected?.getUTCFullYear() ?? today.getFullYear()
  const initMonth = selected?.getUTCMonth() ?? today.getMonth()

  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(initYear)
  const [month, setMonth] = useState(initMonth)
  const ref = useRef<HTMLDivElement>(null)

  // Sync viewport when value changes externally
  useEffect(() => {
    if (selected) {
      setYear(selected.getUTCFullYear())
      setMonth(selected.getUTCMonth())
    }
  }, [value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function select(d: Date) {
    const s = ymd(d)
    onChange(s)
    setOpen(false)
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
  }

  // Build calendar grid
  const firstDay = monthStart(year, month)
  const offset = dow(firstDay)
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  const minDate = parseDate(min ?? '')
  const maxDate = parseDate(max ?? '')

  function isDisabled(d: Date) {
    const t = d.getTime()
    if (minDate && t < minDate.getTime()) return true
    if (maxDate && t > maxDate.getTime()) return true
    return false
  }

  const cells: (Date | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(Date.UTC(year, month, i + 1))),
  ]
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleString(
    language === 'ru' ? 'ru-RU' : 'en-US',
    { month: 'long', timeZone: 'UTC' }
  )

  const displayValue = selected
    ? selected.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
      })
    : ''

  return (
    <div ref={ref} className="relative flex-1">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex h-10 w-full items-center gap-2 rounded-xl border px-3 text-sm transition-colors ${
          open
            ? 'border-[var(--primary-ring)] bg-[var(--input)] ring-2 ring-[var(--primary-ring)]'
            : 'border-[var(--border-subtle)] bg-[var(--input)] hover:border-[var(--border)]'
        }`}
      >
        <IoCalendarOutline className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
        <span className={`flex-1 text-left ${displayValue ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
          {displayValue || placeholder || '—'}
        </span>
        {value && (
          <span
            onClick={clear}
            className="flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            aria-label="Clear"
          >
            ×
          </span>
        )}
      </button>

      {/* Calendar panel */}
      {open && (
        <div className="absolute bottom-[calc(100%+6px)] left-0 z-50 w-64 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--container)] shadow-xl">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
            >
              <IoChevronBack className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize text-[var(--text)]">
              {monthLabel} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
            >
              <IoChevronForward className="h-4 w-4" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 px-3 pb-1">
            {DAYS.map(d => (
              <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5 px-3 pb-3">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />
              const isSelected = selected && ymd(d) === ymd(selected)
              const disabled = isDisabled(d)
              const isToday = ymd(d) === ymd(today)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => select(d)}
                  className={`mx-auto flex h-8 w-8 items-center justify-center rounded-xl text-sm font-medium transition-colors
                    ${isSelected
                      ? 'bg-nonsprimary text-white shadow-sm'
                      : isToday
                        ? 'bg-[var(--surface-active)] text-[var(--text)] ring-1 ring-[var(--border)]'
                        : disabled
                          ? 'cursor-not-allowed text-[var(--text-muted)] opacity-30'
                          : 'text-[var(--text)] hover:bg-[var(--surface-hover)]'
                    }`}
                >
                  {d.getUTCDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
