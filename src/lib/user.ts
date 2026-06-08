export type User = {
  handle: string
  name: string
  /** Solid colour used for the initials avatar. */
  color: string
}

// Mock signed-in user. Stands in for real auth/users later — the UI only reads
// from this object, so wiring a real session in later is a drop-in swap.
export const currentUser: User = {
  handle: 'timur',
  name: 'Timur Cravtov',
  color: '#6768ab',
}

/** Initials for the avatar, e.g. "Timur Cravtov" -> "TC". */
export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
