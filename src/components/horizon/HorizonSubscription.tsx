'use client'

import { useEffect, useState } from 'react'
import { IoCardOutline, IoCheckmarkCircle, IoOpenOutline } from 'react-icons/io5'
import { useSearchParams } from '@/lib/router'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useLoginModal } from '@/contexts/LoginModalContext'
import GlowingHorizon from '@/components/badges/GlowingHorizon'
import { getMyBilling, openPortal, startCheckout, type BillingPayment, type MyBilling } from '@/services/billingService'

// How long to wait for Polar's webhook after a purchase before telling the buyer
// it may take a little longer (Horizon is granted by the webhook, not the redirect).
const ACTIVATION_POLLS = 16
const ACTIVATION_EVERY_MS = 2500

const BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50'

// The buying side of /horizon: join (Polar checkout), your Horizon state, manage
// the subscription (Polar's customer portal) and the payment history.
export default function HorizonSubscription() {
  const { t, language } = useLanguage()
  const { user, refreshUser } = useAuth()
  const { openLogin } = useLoginModal()
  const [params] = useSearchParams()
  const returning = params.has('checkout')

  const [billing, setBilling] = useState<MyBilling | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activation, setActivation] = useState<'idle' | 'waiting' | 'done' | 'slow'>(returning ? 'waiting' : 'idle')

  // Load the billing state (signed in only); after a checkout, keep re-reading it
  // until the webhook has switched Horizon on.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    let tries = 0
    const load = async () => {
      const b = await getMyBilling()
      if (cancelled) return
      setBilling(b)
      if (!returning) return
      if (b?.horizon.active) {
        setActivation('done')
        void refreshUser() // so the header and badges update too
        return
      }
      if (++tries >= ACTIVATION_POLLS) {
        setActivation('slow')
        return
      }
      setTimeout(load, ACTIVATION_EVERY_MS)
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per user; refreshUser is stable
  }, [user?.id, returning])

  const date = (unix?: number) =>
    unix ? new Date(unix * 1000).toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' }) : ''

  const join = async () => {
    if (!user) {
      openLogin()
      return
    }
    setBusy(true)
    setError('')
    const r = await startCheckout('monthly')
    if (r.ok) {
      window.location.href = r.url
      return
    }
    setBusy(false)
    setError(r.status === 409 ? t('horizonAlreadySubscribed') : t('horizonCheckoutFailed'))
  }

  const manage = async () => {
    setBusy(true)
    setError('')
    const r = await openPortal()
    if (r.ok) {
      window.location.href = r.url
      return
    }
    setBusy(false)
    setError(t('horizonPortalFailed'))
  }

  const status = billing?.horizon
  const active = !!status?.active
  const hasSubscription = (billing?.subscriptions.length ?? 0) > 0

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
      {activation === 'waiting' && !active && (
        <p className="mb-3 flex items-center gap-2 text-sm text-[var(--text)]">
          <GlowingHorizon /> {t('horizonActivating')}
        </p>
      )}
      {activation === 'done' && (
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-500">
          <IoCheckmarkCircle className="h-5 w-5" /> {t('horizonActivated')}
        </p>
      )}
      {activation === 'slow' && !active && <p className="mb-3 text-sm text-[var(--text-muted)]">{t('horizonActivationSlow')}</p>}

      {!user ? (
        <button type="button" onClick={() => openLogin()} className={`${BUTTON} bg-nonsprimary text-white hover:bg-nonsprimaryfocus`}>
          {t('horizonSignInToJoin')}
        </button>
      ) : billing === undefined ? (
        <div className="h-10 w-48 animate-pulse rounded-xl bg-[var(--surface-hover)]" />
      ) : active && status ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
            <GlowingHorizon /> {t('horizonYou')}
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            {status.lifetime
              ? t('horizonLifetime')
              : status.renews && status.renews_at
                ? t('horizonRenewsOn', { date: date(status.renews_at) })
                : status.cancel_at_period_end
                  ? t('horizonCanceledNote', { date: date(status.until) })
                  : t('horizonActiveUntil', { date: date(status.until) })}
            {status.source && status.source !== 'subscription' && ` · ${t('horizonGranted')}`}
          </p>
          {hasSubscription && (
            <button type="button" onClick={manage} disabled={busy} className={`${BUTTON} self-start border border-[var(--border-subtle)] bg-[var(--container)] text-[var(--text)] hover:border-nonsprimary hover:text-nonsprimary`}>
              <IoOpenOutline className="h-4 w-4" />
              {t('horizonManage')}
            </button>
          )}
        </div>
      ) : billing?.billing_enabled && billing.plans.includes('monthly') ? (
        <div className="flex flex-col gap-3">
          <button type="button" onClick={join} disabled={busy} className={`${BUTTON} self-start bg-nonsprimary text-white hover:bg-nonsprimaryfocus`}>
            <GlowingHorizon />
            {busy ? '…' : t('horizonJoinPrice')}
          </button>
          <p className="text-xs text-[var(--text-muted)]">
            {/* "Polar" in the note is a link to polar.sh, so people can see who handles their payment */}
            {t('horizonCheckoutNote')
              .split('Polar')
              .map((part, i, parts) => (
                <span key={i}>
                  {part}
                  {i < parts.length - 1 && (
                    <a
                      href="https://polar.sh"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-nonsprimary underline-offset-2 hover:underline"
                    >
                      Polar
                    </a>
                  )}
                </span>
              ))}
          </p>
          {hasSubscription && (
            <button type="button" onClick={manage} disabled={busy} className="self-start text-xs font-medium text-nonsprimary hover:underline">
              {t('horizonManage')}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">{t('horizonSoon')}</p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {billing && billing.payments.length > 0 && (
        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <IoCardOutline className="h-3.5 w-3.5" /> {t('horizonPaymentHistory')}
          </p>
          <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {billing.payments.map((p) => (
              <PaymentRow key={p.id} payment={p} language={language} date={date(p.paid_at)} t={t} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PaymentRow({
  payment,
  language,
  date,
  t,
}: {
  payment: BillingPayment
  language: string
  date: string
  t: (k: string, v?: Record<string, string | number>) => string
}) {
  let amount = ''
  try {
    amount = new Intl.NumberFormat(language, { style: 'currency', currency: payment.currency.toUpperCase() }).format(payment.amount / 100)
  } catch {
    amount = `${(payment.amount / 100).toFixed(2)} ${payment.currency.toUpperCase()}`
  }
  const label =
    payment.status === 'refunded'
      ? t('horizonPaymentRefunded')
      : payment.status === 'partially_refunded'
        ? t('horizonPaymentPartlyRefunded')
        : t('horizonPaymentPaid')
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-[var(--text)]">{date}</span>
      <span className="flex items-center gap-3">
        <span className={`text-xs ${payment.status === 'paid' ? 'text-[var(--text-muted)]' : 'text-amber-500'}`}>{label}</span>
        <span className="font-medium tabular-nums text-[var(--text)]">{amount}</span>
      </span>
    </li>
  )
}
