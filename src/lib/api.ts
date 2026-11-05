// Central API configuration for the SPA.
//
// The app's own backend is the identity provider: it
// signs the `access_token` / `refresh_token` cookies on login, scoped to the
// parent domain in prod (COOKIE_DOMAIN on the server). Every request just needs
// `credentials: 'include'`; when the session is missing the login modal opens.

// This app's backend (accounts, catalog, shelves, social). Empty = same origin.
export const LIBRARY_API_URL = process.env.NEXT_PUBLIC_LIBRARY_API_URL || ''

// Optional external platform API — only admin roles (and relative activity
// links) still go there.
export const PLATFORM_API_URL = process.env.NEXT_PUBLIC_PLATFORM_API_URL || 'http://localhost:8080'

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

// authedFetch calls this app's backend with the
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

// platformFetch calls the external platform API with credentials. Deliberately
// NOT routed through withAuth: the session belongs to this app's backend, and
// the platform can't verify its tokens, so a platform 401 must never refresh or
// expire our session (that logged users out right after login). Callers handle
// a non-OK response themselves.
export function platformFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${PLATFORM_API_URL}${input}`, { ...init, credentials: 'include' })
}

// downloadCoverToB2 sends a public image URL to this app's own backend (librarian
// only), which downloads it and stores it in the B2 bucket under library/,
// returning the CDN URL (cdn.someshelf.com).
export async function downloadCoverToB2(coverUrl: string): Promise<string> {
  const res = await authedFetch('/api/upload/library-cover', {
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
