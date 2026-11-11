'use client'

import { IoAdd, IoChatbubbleEllipsesOutline, IoCheckboxOutline, IoRemove } from 'react-icons/io5'
import type { BingoKind } from '@/lib/bingo'
import { useLanguage } from '@/contexts/LanguageContext'

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">{children}</h3>
}

export function KindTag({ kind }: { kind: BingoKind }) {
  const { t } = useLanguage()
  const Icon = kind === 'prompt' ? IoChatbubbleEllipsesOutline : IoCheckboxOutline
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
      <Icon className="h-3 w-3" />
      {kind === 'prompt' ? t('bingoTagPrompt') : t('bingoTagList')}
    </span>
  )
}

export function ActionButton({
  children,
  onClick,
  icon: Icon,
  primary,
  danger,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  primary?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
        primary
          ? 'bg-nonsprimary text-white hover:bg-nonsprimaryfocus'
          : danger
            ? 'bg-[var(--surface)] text-nonslightred hover:bg-[var(--surface-hover)]'
            : 'bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  )
}

/** A slim rounded progress bar. */
export function ProgressBar({ value, total, label }: { value: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-active)]"
    >
      <div className="h-full rounded-full bg-nonsprimary transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Pill-style segmented control: one option is always selected. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { key: T; label: string; icon?: React.ComponentType<{ className?: string }> }[]
  value: T
  onChange: (key: T) => void
  className?: string
}) {
  return (
    <div role="tablist" className={`flex gap-1 rounded-xl bg-[var(--surface)] p-1 ${className}`}>
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              active ? 'bg-[var(--container)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {o.icon && <o.icon className="h-4 w-4" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** A number with − and + buttons; the number can also be typed. Commits on blur / Enter. */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  const { t } = useLanguage()
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)))
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
      <div className="flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--input)]">
        <button
          type="button"
          aria-label={t('bingoFewer')}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - 1))}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-l-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)] disabled:opacity-30"
        >
          <IoRemove className="h-4 w-4" />
        </button>
        <input
          key={value}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          defaultValue={value}
          aria-label={label}
          onBlur={(e) => onChange(clamp(Number(e.target.value)))}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="h-10 min-w-0 flex-1 bg-transparent text-center text-sm font-semibold text-[var(--text)] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={t('bingoMore')}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + 1))}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-r-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)] disabled:opacity-30"
        >
          <IoAdd className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/** A labelled on/off switch row. */
export function SwitchRow({
  checked,
  onChange,
  disabled,
  icon: Icon,
  title,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  icon?: React.ComponentType<{ className?: string }>
  title: string
  hint?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:hover:bg-[var(--surface)]"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-nonsprimary" />}
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[var(--text)]">{title}</span>
          {hint && <span className="block text-xs text-[var(--text-muted)]">{hint}</span>}
        </span>
      </span>
      <span className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-nonsprimary' : 'bg-[var(--surface-active)]'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}
