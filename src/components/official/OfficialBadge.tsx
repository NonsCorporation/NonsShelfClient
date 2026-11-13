'use client'

import { IoRibbonOutline } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'

// The small "Official" pill — same look as the one challenges already wear.
export default function OfficialBadge({ className = '' }: { className?: string }) {
  const { t } = useLanguage()
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-nonsprimary ${className}`}
    >
      <IoRibbonOutline className="h-3 w-3" />
      {t('challengeOfficialBadge')}
    </span>
  )
}
