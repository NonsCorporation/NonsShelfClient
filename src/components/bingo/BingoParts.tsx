'use client'

import { IoChatbubbleEllipsesOutline, IoCheckboxOutline } from 'react-icons/io5'
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
