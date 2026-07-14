'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IoCalendarOutline, IoChevronBack, IoChevronForward } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'
import { useFloatingPosition } from '@/hooks/useFloatingPosition'

interface Props {
  value: string          // YYYY-MM-DD or ""
  onChange: (v: string) => void
  min?: string
  max?: string
  placeholder?: string
  openUp?: boolean       // open panel above trigger (default: true)
  // Renders the panel centered over the viewport (with a backdrop) instead
  // of anchored to the trigger — use this when the trigger can sit near an
  // edge (e.g. the right column of a two-up date grid), where an
  // anchored-left panel would overflow past that edge.
  centered?: boolean
}

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const TOTAL_CELLS = 42  // always 6 rows so the panel height never changes

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

// Base year for the year-grid view: the nearest multiple of 12 below `year`
function yearGridBase(y: number): number {
  return Math.floor(y / 12) * 12
}

export default function DatePicker({ value, onChange, min, max, placeholder, openUp = true, centered = false }: Props) {
  const { language, t } = useLanguage()
  const locale = language === 'ru' ? 'ru-RU' : 'en-US'
  const selected = parseDate(value)

  const today = new Date()
  const todayYmd = ymd(today)
  // UTC-midnight form of "today", matching how cells and min/max are compared
  // (parseDate/ymd) — avoids the raw `today`'s time-of-day component tripping
  // the isDisabled() range check near midnight in non-UTC timezones.
  const todayAsUTC = parseDate(todayYmd)!
  const initYear = selected?.getUTCFullYear() ?? today.getFullYear()
  const initMonth = selected?.getUTCMonth() ?? today.getMonth()

  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'days' | 'years'>('days')
  const [year, setYear] = useState(initYear)
  const [month, setMonth] = useState(initMonth)
  // Base of the 12-year block shown in year-grid view
  const [yearBase, setYearBase] = useState(() => yearGridBase(initYear))
  // `ref` anchors the trigger (position + outside-click); `panelRef` is the
  // portalled calendar panel (also needed for outside-click, since it's no
  // longer a DOM descendant of `ref` once portalled).
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

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
      const t = e.target as Node
      if (ref.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
      setView('days')
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Fixed-viewport coordinates for the portalled panel, so an ancestor with
  // `overflow-hidden`/`overflow-auto` (e.g. a scrollable filter dropdown)
  // never crops the calendar. Skipped in centered mode, which doesn't anchor
  // to the trigger at all.
  const coords = useFloatingPosition(ref, open && !centered, openUp)

  // ── Month navigation (days view) ──────────────────────────────────────────
  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // ── Year-grid navigation ──────────────────────────────────────────────────
  function prevYearBlock() { setYearBase(b => b - 12) }
  function nextYearBlock() { setYearBase(b => b + 12) }

  function openYearView() {
    setYearBase(yearGridBase(year))
    setView('years')
  }

  function pickYear(y: number) {
    setYear(y)
    setView('days')
  }

  // ── Day selection ─────────────────────────────────────────────────────────
  function select(d: Date) {
    onChange(ymd(d))
    setOpen(false)
    setView('days')
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
  }

  // ── Calendar grid (always 42 cells = 6 rows) ──────────────────────────────
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
  while (cells.length < TOTAL_CELLS) cells.push(null)

  // ── Year grid (12 years per block) ────────────────────────────────────────
  const yearCells = Array.from({ length: 12 }, (_, i) => yearBase + i)

  // ── Labels ────────────────────────────────────────────────────────────────
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleString(locale, {
    month: 'short', timeZone: 'UTC',
  })

  const displayValue = selected
    ? selected.toLocaleDateString(locale, {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
      })
    : ''

  // Shared between the anchored and centered panel wrappers below.
  const panelBody = (
    <>
      {view === 'days' ? (
        <>
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
            >
              <IoChevronBack className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={openYearView}
              className="rounded-lg px-2 py-1 text-sm font-semibold capitalize text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors"
              title="Pick year"
            >
              {monthLabel} {year}
            </button>

            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
            >
              <IoChevronForward className="h-4 w-4" />
            </button>
          </div>

          {/* Day-of-week labels */}
          <div className="grid grid-cols-7 px-3 pb-1">
            {DAYS.map(d => (
              <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells — always 42 so height is constant */}
          <div className="grid grid-cols-7 gap-y-0.5 px-3 pb-3">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="h-8 w-8" />
              const isSelected = selected && ymd(d) === ymd(selected)
              const disabled = isDisabled(d)
              const isToday = ymd(d) === todayYmd
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => select(d)}
                  className={`mx-auto flex h-8 w-8 items-center justify-center rounded-xl text-sm font-medium transition-colors
                    ${isSelected
                      ? 'bg-nonsprimary/5 text-[var(--text)] ring-1 ring-nonsprimary/60'
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
        </>
      ) : (
        <>
          {/* Year-block nav */}
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={prevYearBlock}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
            >
              <IoChevronBack className="h-4 w-4" />
            </button>

            <span className="text-sm font-semibold text-[var(--text)]">
              {yearBase} – {yearBase + 11}
            </span>

            <button
              type="button"
              onClick={nextYearBlock}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
            >
              <IoChevronForward className="h-4 w-4" />
            </button>
          </div>

          {/* Year grid — 3 columns × 4 rows to roughly match panel height */}
          <div className="grid grid-cols-3 gap-1.5 px-3 pb-4 pt-1">
            {yearCells.map(y => {
              const isCurrent = y === year
              const isThisYear = y === today.getFullYear()
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => pickYear(y)}
                  className={`rounded-xl py-2 text-sm font-medium transition-colors ${
                    isCurrent
                      ? 'bg-nonsprimary/5 text-[var(--text)] ring-1 ring-nonsprimary/60'
                      : isThisYear
                        ? 'bg-[var(--surface-active)] text-[var(--text)] ring-1 ring-[var(--border)]'
                        : 'text-[var(--text)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {y}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Floating quick-jump to today, always visible regardless of view. */}
      <div className="flex justify-center border-t border-[var(--border-subtle)] px-3 py-2">
        <button
          type="button"
          onClick={() => select(todayAsUTC)}
          disabled={isDisabled(todayAsUTC)}
          className="rounded-full bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold text-nonsprimaryfocus transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:text-[var(--text-muted)] disabled:opacity-40"
        >
          {t('today') || 'Today'}
        </button>
      </div>
    </>
  )

  return (
    <div ref={ref} className="relative flex-1">

      {/* ── Trigger button ─────────────────────────────────────────────────── */}
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

      {/* ── Calendar panel — portalled to document.body. In centered mode it's
          a backdrop-covered overlay centered on the viewport (so a trigger
          near an edge, e.g. the right column of a two-up date grid, can
          never have its panel spill past that edge); otherwise it's anchored
          to the trigger with fixed viewport coordinates, so a
          scrollable/overflow-hidden ancestor never crops it ── */}
      {open && (centered || coords) && typeof document !== 'undefined' && createPortal(
        centered ? (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40" onMouseDown={() => setOpen(false)}>
            <div
              ref={panelRef}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-64 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--container)] shadow-xl"
            >
              {panelBody}
            </div>
          </div>
        ) : (
          <div
            ref={panelRef}
            style={{ position: 'fixed', left: coords!.left, top: coords!.top, bottom: coords!.bottom }}
            className="z-[110] w-64 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--container)] shadow-xl"
          >
            {panelBody}
          </div>
        ),
        document.body,
      )}
    </div>
  )
}
