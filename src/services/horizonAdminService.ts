import { authedFetch } from '../lib/api'
import type { HorizonStatus } from './billingService'

// nons-library-server /api/admin/… — admins only.

export type AdminEntitlement = {
  id: number
  user_id: number
  feature: string
  source: string // subscription | gift | staff | promo
  source_ref?: string
  starts_at: number
  ends_at: number | null
  revoked_at?: number | null
  granted_by?: number
  note?: string
  created_at: number
}

export type AdminSubscription = {
  id: number
  provider_subscription_id: string
  plan: string
  status: string
  amount: number
  currency: string
  current_period_end?: number | null
  cancel_at_period_end: boolean
  ended_at?: number | null
}

export type AdminPayment = {
  id: number
  provider_order_id: string
  status: string
  reason: string
  amount: number
  tax_amount: number
  refunded_amount: number
  currency: string
  paid_at: number
}

export type AdminEvent = {
  id: number
  type: string
  received_at: number
  processed_at?: number | null
  error?: string
}

/** Everything billing knows about one user. */
export type BillingTimeline = {
  horizon: HorizonStatus
  entitlements: AdminEntitlement[]
  subscriptions: AdminSubscription[]
  payments: AdminPayment[]
  events: AdminEvent[]
}

export type GrantInput = {
  /** A username, or a numeric id. */
  user: string
  source: 'gift' | 'staff' | 'promo'
  days?: number
  lifetime?: boolean
  note?: string
}

type Failure = { ok: false; status: number; error: string }

async function failure(res: Response): Promise<Failure> {
  let error = `Request failed (${res.status})`
  try {
    const body = await res.json()
    if (body?.error) error = body.error
  } catch {
    /* keep the status */
  }
  return { ok: false, status: res.status, error }
}

/** A user's billing timeline, by username or numeric id. */
export async function getBillingTimeline(user: string): Promise<({ ok: true } & BillingTimeline) | Failure> {
  try {
    const res = await authedFetch(`/api/admin/billing/users/${encodeURIComponent(user.trim())}`)
    if (!res.ok) return failure(res)
    return { ok: true, ...((await res.json()) as BillingTimeline) }
  } catch {
    return { ok: false, status: 0, error: 'Network error' }
  }
}

/** Gives a user Horizon by hand: for some days, or for life. */
export async function grantHorizon(input: GrantInput): Promise<{ ok: true } | Failure> {
  const ref = input.user.trim()
  const body: Record<string, unknown> = { source: input.source, note: input.note ?? '' }
  if (/^\d+$/.test(ref)) body.user_id = Number(ref)
  else body.username = ref
  if (input.lifetime) body.lifetime = true
  else body.days = input.days
  try {
    const res = await authedFetch('/api/admin/horizon/grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok ? { ok: true } : failure(res)
  } catch {
    return { ok: false, status: 0, error: 'Network error' }
  }
}

/** Ends an entitlement now. */
export async function revokeEntitlement(id: number): Promise<{ ok: true } | Failure> {
  try {
    const res = await authedFetch(`/api/admin/horizon/entitlements/${id}/revoke`, { method: 'POST' })
    return res.ok ? { ok: true } : failure(res)
  } catch {
    return { ok: false, status: 0, error: 'Network error' }
  }
}
