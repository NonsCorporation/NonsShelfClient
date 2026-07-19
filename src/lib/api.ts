// Central API configuration for the nons-library SPA.
//
// nons-library has NO login of its own: it rides the shared nons SSO session —
// the `access_token` cookie nons-server sets on the parent domain
// (.nonsapp.com). Every request just needs `credentials: 'include'`; when the
// session is missing we send the browser to nons-platform-client (the id/
// account app) and it comes back here via ?redirect=.

// nons-library-server base URL — this app's backend. Empty = same origin.
export const LIBRARY_API_URL = process.env.NEXT_PUBLIC_LIBRARY_API_URL || ''

// nons-server base URL — the identity provider. Used to refresh the shared
// session cookie and to log out (both are domain-wide operations only the
// identity provider can do).
export const NONS_API_URL = process.env.NEXT_PUBLIC_NONS_API_URL || 'http://localhost:8080'

// nons-platform-client (account.nonsapp.com / id.nonsapp.com) — the dedicated
// sign-in app. We append ?redirect= so the user lands back in the library
// after signing in. Used only for the login bounce; do NOT use this for links
// into the main social app (feed, friends, notifications) — that's NONS_APP_URL.
export const NONS_LOGIN_URL = process.env.NEXT_PUBLIC_NONS_LOGIN_URL || 'http://localhost:5174'

// nons-client (the main social app) base URL — used for links out to feed,
// friends, notifications, and as the profile-link fallback below. Distinct
// from NONS_LOGIN_URL: that's where signed-out users go to authenticate,
// this is where signed-in users go to use the rest of Nons.
export const NONS_APP_URL = process.env.NEXT_PUBLIC_NONS_APP_URL || 'http://localhost:3000'

// ── Transparent session refresh ─────────────────────────────────────────────
// The access_token cookie is short-lived (15 min) and gets deleted by the
// browser when it expires, so mid-session requests start coming back 401. To
// avoid the "looks logged out until you reload the page" bug, every authed
// request that 401s renews the shared session once (via the identity provider's
// refresh endpoint) and retries — exactly the recovery fetchMe used to do on
// mount, but now on EVERY request so it works without a page reload.

// Single in-flight refresh shared by all callers: a burst of parallel 401s
// (e.g. the shelf/favorites/ratings fan-out) triggers exactly one refresh.
let refreshInFlight: Promise<boolean> | null = null

// Invoked when a refresh ultimately fails — the SSO session is gone for good.
// AuthContext registers this to drop the user so the app falls back to the
// login screen instead of silently failing requests.
let onSessionExpired: (() => void) | null = null

export function setOnSessionExpired(handler: (() => void) | null): void {
  onSessionExpired = handler
}

// refreshSession asks the identity provider (nons-server) for a fresh
// access_token cookie using the refresh_token cookie. Concurrent callers share
// one request; resolves true on success.
function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${NONS_API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

// withAuth runs a credentialed request and transparently recovers from an
// expired access token: on the first 401 it refreshes the shared session once
// and retries. A failed refresh (or a 401 that survives the retry) means the
// session is truly gone, so we notify onSessionExpired and surface the 401.
async function withAuth(url: string, init: RequestInit): Promise<Response> {
  const opts: RequestInit = { ...init, credentials: 'include' }

  const res = await fetch(url, opts)
  if (res.status !== 401) return res

  if (!(await refreshSession())) {
    onSessionExpired?.()
    return res
  }

  const retry = await fetch(url, opts)
  if (retry.status === 401) onSessionExpired?.()
  return retry
}

// authedFetch calls this app's backend (nons-library-server) with the shared
// session cookie, renewing the session on expiry.
export function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return withAuth(`${LIBRARY_API_URL}${input}`, init)
}

// nonsFetch calls the identity provider (nons-server) with credentials, with the
// same transparent session renewal.
export function nonsFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return withAuth(`${NONS_API_URL}${input}`, init)
}

// nonsProfileUrl builds a link to a user's profile on the main nons platform
// (the social app the shelf rides on). Defaults to <main-app>/u/<username>; set
// NEXT_PUBLIC_NONS_PROFILE_BASE if the platform serves profiles elsewhere.
export function nonsProfileUrl(username: string): string {
  const base = (process.env.NEXT_PUBLIC_NONS_PROFILE_BASE || `${NONS_APP_URL}/u`).replace(/\/+$/, '')
  return `${base}/${encodeURIComponent(username)}`
}

// redirectToNonsLogin sends the browser to nons-platform-client's sign-in
// page, returning to the current library URL after a successful sign-in.
export function redirectToNonsLogin(): void {
  const redirect = encodeURIComponent(window.location.href)
  window.location.href = `${NONS_LOGIN_URL}?redirect=${redirect}`
}

// downloadCoverToB2 sends a public image URL to nons-server, which downloads
// it and stores it in the B2 bucket under library/, returning the CDN URL.
export async function downloadCoverToB2(coverUrl: string): Promise<string> {
  const res = await nonsFetch('/api/upload/library-cover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: coverUrl }),
  })
  if (!res.ok) {
    let msg = 'Failed to download cover'
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch { /* keep default */ }
    throw new Error(msg)
  }
  const data = await res.json() as { url: string }
  return data.url
}
