'use client'

import type { IconType } from 'react-icons'
import { useLanguage } from '@/contexts/LanguageContext'

// Building blocks shared by the settings tabs (privacy, preferences, account):
// a card row with an icon tile, a toggle switch, and a segmented control.

export type Option<K extends string> = { key: K; labelKey: string; hintKey: string; icon: IconType }

// One setting: an icon tile, title + hint, and either a control below (children)
// or a compact one beside the text (aside).
export function Row({
  icon: Icon,
  title,
  hint,
  aside,
  children,
}: {
  icon: IconType
  title: string
  hint: string
  aside?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-nonsprimary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{hint}</p>
        </div>
        {aside}
      </div>
      {children && <div className="sm:w-[26rem] sm:flex-shrink-0">{children}</div>}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative mt-1 h-6 w-11 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-nonsprimary' : 'bg-[var(--border-strong)]'}`}
    >
      <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

export function SegmentedSelect<K extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<K>[]
  value: K
  onChange: (v: K) => void
}) {
  const { t } = useLanguage()
  return (
    <div className="flex gap-1 rounded-xl bg-[var(--surface)] p-1" role="radiogroup">
      {options.map((opt) => {
        const Icon = opt.icon
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.key)}
            title={t(opt.hintKey)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
              active
                ? 'bg-[var(--container)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${active ? 'text-nonsprimary' : ''} ${options.length > 3 ? 'hidden sm:block' : ''}`} />
            {t(opt.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
