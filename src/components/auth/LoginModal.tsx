'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IoClose } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'
import { redirectToNonsLogin } from '@/lib/api'
import NonsLogo from '@/components/branding/NonsLogo'
import ShelfLogo from '@/components/branding/ShelfLogo'

// The single sign-in surface. There is no local login form: the library has no
// accounts of its own, so the only thing this can do is explain the shared nons
// account and hand off to the nons login page (which returns here afterwards).
//
// Portalled to <body> for the same reason as ConfirmModal: transformed ancestors
// (the feed/discover fade-up animations) would otherwise trap the fixed overlay.
export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up relative w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--container)] p-7 text-center shadow-2xl"
      >
        <button
          onClick={onClose}
          aria-label={t('close')}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
        >
          <IoClose className="h-5 w-5" />
        </button>

        {/* shelf ✕ nons — the two accounts being bridged */}
        <div className="mb-5 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface)]">
            <ShelfLogo className="h-6 w-6 text-[var(--text)]" />
          </span>
          <span className="text-[var(--text-muted)] opacity-40">·</span>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-black">
            <NonsLogo className="h-6 w-6" />
          </span>
        </div>

        <h2 className="text-lg font-semibold leading-snug text-[var(--text)]">{t('loginModalTitle')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{t('loginModalText')}</p>

        <button
          onClick={redirectToNonsLogin}
          className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30 transition-colors hover:bg-neutral-800"
        >
          <NonsLogo className="h-5 w-5" />
          {t('loginModalCta')}
        </button>
        <p className="mt-3 text-xs text-[var(--text-muted)]">{t('loginModalNote')}</p>
      </div>
    </div>,
    document.body,
  )
}
