import { isLibrarian } from '../services/librarianService'

/** Build-time switch (HORIZON_ON=1) for all Horizon UI. Off unless set — unset counts as 0. */
export const HORIZON_ON = ['1', 'true'].includes((process.env.HORIZON_ON ?? '0').trim().toLowerCase())

// Whether a user is a Horizon member. For now every librarian is one; once
// Horizon is its own per-user flag from the server, only this check changes.
export const isHorizon = (role?: string): boolean => HORIZON_ON && isLibrarian(role)
