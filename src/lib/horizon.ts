/** Build-time switch (HORIZON_ON=1) for all Horizon UI. Off unless set — unset counts as 0. */
export const HORIZON_ON = ['1', 'true'].includes((process.env.HORIZON_ON ?? '0').trim().toLowerCase())

/**
 * Whether someone has Horizon, from what the server says: your own status from
 * /api/me (`user.horizon`, an object with `active`), or another user's `horizon`
 * flag from their public profile (a boolean). Always false while the Horizon UI
 * is switched off.
 */
export function isHorizon(horizon?: { active?: boolean } | boolean | null): boolean {
  if (!HORIZON_ON || !horizon) return false
  return typeof horizon === 'boolean' ? horizon : !!horizon.active
}
