// Central API configuration for the nons-library SPA.
//
// The library's own backend (nons-library-server) is the identity provider: it
// signs the `access_token` / `refresh_token` cookies on login, scoped to the
// parent domain (.nonsapp.com in prod). Every request just needs
// `credentials: 'include'`; when the session is missing the login modal opens.

// nons-library-server base URL — this app's backend. Empty = same origin.
export const LIBRARY_API_URL = process.env.NEXT_PUBLIC_LIBRARY_API_URL || ''

// nons-server base URL. No longer the identity provider — only the remaining
// nons-bound calls (cross-posting, cover uploads, admin) go there.
export const NONS_API_URL = process.env.NEXT_PUBLIC_NONS_API_URL || 'http://localhost:8080'

// nons-client (the main social app) base URL — used for links out to feed,
// friends, notifications, and as the profile-link fallback below.
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

// Invoked when a refresh ultimately fails — the session is gone for good.
// AuthContext registers this to drop the user so the app falls back to the
// login screen instead of silently failing requests.
let onSessionExpired: (() => void) | null = null

export function setOnSessionExpired(handler: (() => void) | null): void {
  onSessionExpired = handler
}

// refreshSession asks the library backend for a fresh access_token cookie using
// the refresh_token cookie. Concurrent callers share one request; resolves true
// on success.
function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${LIBRARY_API_URL}/api/auth/refresh`, {
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

// authApi calls the library's /api/auth endpoints (login, signup, reset, logout)
// with credentials but WITHOUT the refresh-and-retry of authedFetch — a 401 from
// a wrong password must surface as-is, not trigger a session refresh.
export function authApi(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${LIBRARY_API_URL}${path}`, { ...init, credentials: 'include' })
}

// nonsFetch calls nons-server with credentials, with the same transparent
// session renewal. Only for the remaining nons-bound features.
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
