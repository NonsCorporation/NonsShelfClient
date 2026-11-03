'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { IoClose } from 'react-icons/io5'
import { FcGoogle } from 'react-icons/fc'
import { useLanguage } from '@/contexts/LanguageContext'
import { useAuth } from '@/contexts/AuthContext'
import type { LoginReason } from '@/contexts/LoginModalContext'
import {
  login,
  signup,
  confirmSignup,
  resendConfirmation,
  forgotPassword,
  resetPassword,
  googleLoginUrl,
  type AuthResult,
} from '@/services/authService'
import ShelfLogo from '@/components/branding/ShelfLogo'

// Headline/body translation keys per reason — only what the visitor is being
// told they're missing changes; the form below is always the same.
const COPY: Record<LoginReason, { title: string; text: string }> = {
  shelf: { title: 'loginModalTitleShelf', text: 'loginModalTextShelf' },
  challenge: { title: 'loginModalTitleChallenge', text: 'loginModalTextChallenge' },
  profile: { title: 'loginModalTitleProfile', text: 'loginModalTextProfile' },
  library: { title: 'loginModalTitleLibrary', text: 'loginModalTextLibrary' },
  notifications: { title: 'loginModalTitleNotifications', text: 'loginModalTextNotifications' },
  statistics: { title: 'loginModalTitleStatistics', text: 'loginModalTextStatistics' },
  messages: { title: 'loginModalTitleMessages', text: 'loginModalTextMessages' },
}

type Mode = 'login' | 'signup' | 'confirm' | 'forgot' | 'reset'

const INPUT =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-nonsprimary'
const PRIMARY_BTN =
  'inline-flex w-full items-center justify-center rounded-xl bg-nonsprimary px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50'
const LINK_BTN = 'font-medium text-nonsprimary hover:underline'

// The single sign-in surface: email/username + password, account creation with
// an emailed confirmation code, and password reset — all served by the library
// backend (it is its own identity provider; there is no hand-off to another app).
//
// Portalled to <body> for the same reason as ConfirmModal: transformed ancestors
// (the feed/discover fade-up animations) would otherwise trap the fixed overlay.
export default function LoginModal({
  reason,
  onClose,
  initialError = '',
}: {
  reason?: LoginReason
  onClose: () => void
  /** Shown on open — e.g. why a Google sign-in that just redirected back failed. */
  initialError?: string
}) {
  const { t } = useLanguage()
  const { refreshUser } = useAuth()
  const copy = reason ? COPY[reason] : null

  const [mode, setMode] = useState<Mode>('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)
  const [notice, setNotice] = useState('')

  const [identifier, setIdentifier] = useState('') // email or username (login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [code, setCode] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  const go = (m: Mode, msg = '') => {
    setMode(m)
    setError('')
    setNotice(msg)
    setPassword('')
    setCode('')
  }

  // Runs one auth call with shared busy/error handling; `next` fires on success.
  const run = async (call: () => Promise<AuthResult>, next: () => void | Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    const res = await call()
    if (res.ok) await next()
    else setError(res.error)
    setBusy(false)
  }

  // Login and signup-confirm both end with the server having set the session
  // cookies: re-read /api/me, then close.
  const finishSignedIn = async () => {
    await refreshUser()
    onClose()
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    switch (mode) {
      case 'login':
        return run(() => login(identifier.trim(), password), finishSignedIn)
      case 'signup':
        return run(() => signup(email.trim(), password, name.trim(), surname.trim()), () => go('confirm'))
      case 'confirm':
        return run(() => confirmSignup(code.trim()), finishSignedIn)
      case 'forgot':
        return run(() => forgotPassword(email.trim()), () => go('reset'))
      case 'reset':
        return run(() => resetPassword(code.trim(), password), () => go('login', t('authResetDone')))
    }
  }

  const resend = () =>
    run(() => resendConfirmation(email.trim()), () => setNotice(t('authResent')))

  const title =
    mode === 'login' ? t(copy?.title ?? 'loginModalTitle')
    : mode === 'signup' ? t('authSignUp')
    : mode === 'confirm' ? t('authConfirmTitle')
    : mode === 'forgot' ? t('authForgotTitle')
    : t('authResetTitle')

  const subtitle =
    mode === 'login' ? t(copy?.text ?? 'loginModalText')
    : mode === 'confirm' ? t('authConfirmText')
    : mode === 'forgot' ? t('authForgotText')
    : mode === 'reset' ? t('authResetText')
    : ''

  const submitLabel =
    mode === 'login' ? t('authSignIn')
    : mode === 'signup' ? t('authSignUp')
    : mode === 'confirm' ? t('authConfirm')
    : mode === 'forgot' ? t('authSendCode')
    : t('authConfirm')

  return createPortal(
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up relative w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--container)] p-7 shadow-2xl"
      >
        <button
          onClick={onClose}
          aria-label={t('close')}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
        >
          <IoClose className="h-5 w-5" />
        </button>

        <div className="mb-4 flex justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface)]">
            <ShelfLogo className="h-6 w-6 text-[var(--text)]" />
          </span>
        </div>

        <h2 className="text-center text-lg font-semibold leading-snug text-[var(--text)]">{title}</h2>
        {subtitle && (
          <p className="mt-2 text-center text-sm leading-relaxed text-[var(--text-muted)]">{subtitle}</p>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          {mode === 'login' && (
            <>
              <input
                className={INPUT}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t('authEmailOrUsername')}
                autoComplete="username"
                autoFocus
                required
              />
              <input
                className={INPUT}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('authPassword')}
                autoComplete="current-password"
                required
              />
            </>
          )}

          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('authFirstName')} autoComplete="given-name" autoFocus />
                <input className={INPUT} value={surname} onChange={(e) => setSurname(e.target.value)} placeholder={t('authLastName')} autoComplete="family-name" />
              </div>
              <input className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('authEmail')} autoComplete="email" required />
              <input
                className={INPUT}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('authPassword')}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <p className="text-xs text-[var(--text-muted)]">{t('authPasswordHint')}</p>
            </>
          )}

          {(mode === 'confirm' || mode === 'reset') && (
            <input
              className={`${INPUT} text-center font-mono tracking-[0.3em]`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('authCode')}
              autoComplete="one-time-code"
              autoFocus
              required
            />
          )}

          {mode === 'reset' && (
            <>
              <input
                className={INPUT}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('authNewPassword')}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <p className="text-xs text-[var(--text-muted)]">{t('authPasswordHint')}</p>
            </>
          )}

          {mode === 'forgot' && (
            <input className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('authEmail')} autoComplete="email" autoFocus required />
          )}

          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {notice && <p className="text-sm text-emerald-400">{notice}</p>}

          <button type="submit" disabled={busy} className={PRIMARY_BTN}>
            {busy ? t('authWorking') : submitLabel}
          </button>
        </form>

        {(mode === 'login' || mode === 'signup') && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="h-px flex-1 bg-[var(--border-subtle)]" />
              {t('authOr')}
              <span className="h-px flex-1 bg-[var(--border-subtle)]" />
            </div>
            <button
              type="button"
              onClick={() => {
                // Come back to this page, minus any previous sign-in error.
                const back = new URL(window.location.href)
                back.searchParams.delete('auth_error')
                back.hash = ''
                window.location.assign(googleLoginUrl(back.toString()))
              }}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-active)]"
            >
              <FcGoogle className="h-[18px] w-[18px]" />
              {t('authContinueGoogle')}
            </button>
          </>
        )}

        <div className="mt-4 space-y-1.5 text-center text-xs text-[var(--text-muted)]">
          {mode === 'login' && (
            <>
              <p>
                <button type="button" className={LINK_BTN} onClick={() => go('forgot')}>{t('authForgot')}</button>
              </p>
              <p>
                {t('authNoAccount')}{' '}
                <button type="button" className={LINK_BTN} onClick={() => go('signup')}>{t('authSignUp')}</button>
              </p>
            </>
          )}
          {mode === 'signup' && (
            <p>
              {t('authHaveAccount')}{' '}
              <button type="button" className={LINK_BTN} onClick={() => go('login')}>{t('authSignIn')}</button>
            </p>
          )}
          {mode === 'confirm' && (
            <p>
              <button type="button" className={LINK_BTN} disabled={busy} onClick={resend}>{t('authResend')}</button>
            </p>
          )}
          {(mode === 'forgot' || mode === 'reset' || mode === 'confirm') && (
            <p>
              <button type="button" className={LINK_BTN} onClick={() => go('login')}>{t('authBack')}</button>
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
