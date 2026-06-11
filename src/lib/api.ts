// Central API configuration for the nons-library SPA.
//
// nons-library has NO login of its own: it rides the shared nons SSO session —
// the `access_token` cookie nons-server sets on the parent domain
// (.nonsapp.com). Every request just needs `credentials: 'include'`; when the
// session is missing we send the browser to the nons login page and it comes
// back here via ?redirect=.

// nons-library-server base URL — this app's backend. Empty = same origin.
export const LIBRARY_API_URL = import.meta.env.VITE_LIBRARY_API_URL || ''

// nons-server base URL — the identity provider. Used to refresh the shared
// session cookie and to log out (both are domain-wide operations only the
// identity provider can do).
export const NONS_API_URL = import.meta.env.VITE_NONS_API_URL || 'http://localhost:8080'

// The nons login page (the main app's intro page). We append ?redirect= so the
// user lands back in the library after signing in.
export const NONS_LOGIN_URL = import.meta.env.VITE_NONS_LOGIN_URL || 'http://localhost:3000'

// authedFetch always sends the shared session cookie.
export function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${LIBRARY_API_URL}${input}`, { ...init, credentials: 'include' })
}

// nonsFetch calls the identity provider (nons-server) with credentials.
export function nonsFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${NONS_API_URL}${input}`, { ...init, credentials: 'include' })
}

// redirectToNonsLogin sends the browser to the nons login page, returning to
// the current library URL after a successful sign-in.
export function redirectToNonsLogin(): void {
  const redirect = encodeURIComponent(window.location.href)
  window.location.href = `${NONS_LOGIN_URL}?redirect=${redirect}`
}
