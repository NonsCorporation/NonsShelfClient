// Facts the legal pages state about who runs SomeShelf. Change them here — the
// pages read everything from this file.

export const LEGAL = {
  /** The service's name as the terms refer to it. */
  service: 'SomeShelf',
  /** Who the contract is with. Replace with the registered name once there is one. */
  operator: 'the operators of SomeShelf',
  /** Law the terms are governed by (consumers keep the mandatory rights of their own country). */
  governingLaw: 'the Republic of Moldova',
  /** The day the terms last changed (ISO date). */
  updated: '2026-11-14',
  /** Where users write about the terms, billing and refunds. Optional: set NEXT_PUBLIC_LEGAL_EMAIL. */
  contactEmail: (process.env.NEXT_PUBLIC_LEGAL_EMAIL ?? '').trim(),
  /** Horizon's price, as the terms state it. */
  horizonPrice: '$3 per month',
  /** How many days Horizon stays on after a paid period ends while a renewal payment is retried. */
  graceDays: 3,
} as const
