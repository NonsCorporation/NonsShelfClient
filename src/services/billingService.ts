import { authedFetch } from '../lib/api'

// nons-library-server /api/billing — Horizon, sold through Polar.

/** A user's Horizon state, as /api/me and /api/billing/me report it. */
export type HorizonStatus = {
  active: boolean
  /** When the current right runs out (Unix seconds); absent for lifetime or inactive. */
  until?: number
  lifetime?: boolean
  /** subscription | gift | staff | promo */
  source?: string
  plan?: string
  renews: boolean
  renews_at?: number
  cancel_at_period_end?: boolean
}

export type BillingPayment = {
  id: number
  provider_order_id: string
  status: string // paid | pending | refunded | partially_refunded
  reason: string // subscription_create, subscription_cycle, …
  amount: number // minor units, tax included
  tax_amount: number
  refunded_amount: number
  currency: string
  paid_at: number
}

export type BillingSubscription = {
  id: number
  plan: string
  status: string
  amount: number
  currency: string
  current_period_end?: number
  cancel_at_period_end: boolean
}

export type MyBilling = {
  horizon: HorizonStatus
  billing_enabled: boolean
  plans: string[]
  subscriptions: BillingSubscription[]
  payments: BillingPayment[]
}

export type BillingError = { ok: false; status: number; error: string }

async function failure(res: Response): Promise<BillingError> {
  let error = `Request failed (${res.status})`
  try {
    const body = await res.json()
    if (body?.error) error = body.error
  } catch {
    /* keep the status */
  }
  return { ok: false, status: res.status, error }
}

/** Your Horizon state, the plans on sale, your subscriptions and payments. Null when unreachable. */
export async function getMyBilling(): Promise<MyBilling | null> {
  try {
    const res = await authedFetch('/api/billing/me')
    return res.ok ? ((await res.json()) as MyBilling) : null
  } catch {
    return null
  }
}

/** Opens a Polar checkout for a plan; resolves to its URL (the caller navigates there). */
export async function startCheckout(plan: string): Promise<{ ok: true; url: string } | BillingError> {
  try {
    const res = await authedFetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    if (!res.ok) return failure(res)
    return { ok: true, url: (await res.json()).url }
  } catch {
    return { ok: false, status: 0, error: 'network' }
  }
}

/** Polar's customer portal (cancel, change the card, invoices); resolves to its URL. */
export async function openPortal(): Promise<{ ok: true; url: string } | BillingError> {
  try {
    const res = await authedFetch('/api/billing/portal', { method: 'POST' })
    if (!res.ok) return failure(res)
    return { ok: true, url: (await res.json()).url }
  } catch {
    return { ok: false, status: 0, error: 'network' }
  }
}
