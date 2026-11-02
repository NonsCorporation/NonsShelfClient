// Username rules for the profile editor (same constraints nons uses):
// starts with a letter, 3–30 characters, letters/digits with single underscores
// only between characters, and not a reserved or "id123"-style name.

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 30

const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9]*(_[a-zA-Z0-9]+)*$/

const RESERVED = new Set([
  'admin', 'administrator', 'moderator', 'mod', 'system', 'api', 'auth', 'login', 'logout',
  'register', 'signup', 'signin', 'settings', 'profile', 'user', 'users', 'feed', 'posts', 'post',
  'messages', 'message', 'notifications', 'notification', 'friends', 'friend', 'followers',
  'following', 'search', 'about', 'contact', 'help', 'support', 'terms', 'privacy', 'policy',
  'blog', 'news', 'home', 'index', 'root',
])

export type UsernameError = 'required' | 'short' | 'long' | 'start' | 'chars' | 'reserved' | 'idLike'

/** Returns why a username is invalid, or null when it's fine. */
export function usernameError(username: string): UsernameError | null {
  if (!username) return 'required'
  if (username.length < USERNAME_MIN_LENGTH) return 'short'
  if (username.length > USERNAME_MAX_LENGTH) return 'long'
  if (!/^[a-zA-Z]/.test(username)) return 'start'
  if (!USERNAME_REGEX.test(username)) return 'chars'
  if (RESERVED.has(username.toLowerCase())) return 'reserved'
  if (/^id\d+$/i.test(username)) return 'idLike'
  return null
}

/** Strips anything that can't be part of a username as the user types. A
 *  trailing underscore is kept (it's the first half of "my_name"); the
 *  validator rejects it if it's still dangling on save. */
export function sanitizeUsername(input: string): string {
  let s = input.replace(/[^a-zA-Z0-9_]/g, '')
  s = s.replace(/^[^a-zA-Z]+/, '')
  s = s.replace(/_{2,}/g, '_')
  return s.slice(0, USERNAME_MAX_LENGTH)
}
