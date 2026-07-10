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

const PALETTE = ['#6768ab', '#c2557a', '#3e8e7e', '#b8843b', '#5b6cc0', '#8a5bc0', '#c05b5b', '#3e8ec0']

/** Deterministic avatar colour per handle, so a user keeps their colour. */
export function colorFor(handle: string): string {
  let h = 0
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}
