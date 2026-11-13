'use client'

import { IoRibbonOutline } from 'react-icons/io5'
import { useIsAdmin } from '@/lib/useIsAdmin'
import { useLanguage } from '@/contexts/LanguageContext'

type Props = {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  className?: string
}

// The admin-only "Official" switch shared by the challenge, bingo and list
// editors. Renders nothing for everyone else — the server ignores the flag
// from non-admins too, so this is only about not showing a dead control.
export default function OfficialToggle({ checked, onChange, disabled, className = '' }: Props) {
  const isAdmin = useIsAdmin()
  const { t } = useLanguage()
  if (!isAdmin) return null

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-left disabled:opacity-60 ${className}`}
    >
      <span className="flex items-start gap-2.5">
        <IoRibbonOutline className="mt-0.5 h-4 w-4 flex-shrink-0 text-nonsprimary" />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-[var(--text)]">{t('officialToggle')}</span>
          <span className="text-xs text-[var(--text-muted)]">{t('officialToggleHint')}</span>
        </span>
      </span>
      <span className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-nonsprimary' : 'bg-[var(--container-2)]'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}
