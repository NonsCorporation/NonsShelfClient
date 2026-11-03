import { LIBRARY_API_URL, authApi } from '../lib/api'

// Talks to nons-library-server's /api/auth endpoints. On success the server sets
// the HttpOnly session cookies itself; callers then re-read /api/me.

export type AuthResult = { ok: true } | { ok: false; error: string }

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function post(path: string, body?: unknown): Promise<AuthResult> {
  try {
    const res = await authApi(path, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.ok) return { ok: true }
    let error = 'Something went wrong. Please try again.'
    try {
      const data = await res.json()
      if (typeof data?.error === 'string') error = data.error
    } catch {
      /* non-JSON error body */
    }
    return { ok: false, error }
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }
}

/** Sign in with an email address or username. */
export const login = (emailOrUsername: string, password: string) =>
  post('/api/auth/login', { email_or_username: emailOrUsername, password })

/** Start signup: stores the pending account and emails a confirmation code. */
export const signup = (email: string, password: string, name: string, surname: string) =>
  post('/api/auth/signup', { email, password, name, surname })

/** Finish signup with the emailed code; also signs the new user in. */
export const confirmSignup = (code: string) => post('/api/auth/signup/confirm', { code })

export const resendConfirmation = (email: string) => post('/api/auth/signup/resend', { email })

/** Email a password-reset code (always succeeds for unknown emails). */
export const forgotPassword = (email: string) => post('/api/auth/password/forgot', { email })

export const resetPassword = (code: string, password: string) =>
  post('/api/auth/password/reset', { code, password })

export const logoutRequest = () => post('/api/auth/logout')

/** Where the "Continue with Google" button sends the browser. It's a full-page
 *  navigation (Google's consent screen can't run in a fetch); the server brings
 *  the person back to `returnTo` with the session cookies set, or with
 *  ?auth_error=<code> if it didn't work out. */
export const googleLoginUrl = (returnTo: string) =>
  `${LIBRARY_API_URL}/api/auth/google/login?redirect=${encodeURIComponent(returnTo)}`
