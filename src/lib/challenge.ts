import type { Challenge, ChallengeCondition, MediaType } from '../types'

// Shared formatting for challenge cards/detail pages — kept out of any one
// screen so Discover's list cards and the /challenge/<uuid> detail page
// render conditions identically instead of drifting apart.

type Translate = (k: string, v?: Record<string, string | number>) => string

export const typeWord = (t: Translate, type: MediaType) =>
  type === 'book' ? t('book') : type === 'series' ? t('series') : t('film')

/** "60" for a fixed target, or the "everything matching" copy for a null target_count. */
export const goalLabel = (t: Translate, challenge: Challenge): string =>
  challenge.target_count != null ? String(challenge.target_count) : t('everythingMatching')

// A challenge condition → its display text (server-resolved `label` for
// list/person conditions, the raw value for genre/year, a bare fallback for
// anything the client doesn't specially know about — e.g. tag_id).
export const conditionText = (t: Translate, cond: ChallengeCondition): string => {
  switch (cond.field) {
    case 'list_id':
      return t('fromList', { name: cond.label || cond.value })
    case 'person_uuid':
      return cond.label || cond.value
    case 'genre':
      return `${t('genre')}: ${cond.label || cond.value}`
    case 'year':
      if (cond.op === 'gte') return `${cond.value}+`
      if (cond.op === 'lte') return `${t('to')} ${cond.value}`
      return cond.label || cond.value
    default:
      return cond.label || cond.value
  }
}
