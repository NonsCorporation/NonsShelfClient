import { authedFetch } from '../lib/api'
import type { Challenge, ChallengeCondition } from '../types'

// Client for nons-library-server's challenge module: community reading/
// watching goals ("read 60 books in 2026", "watch all Wes Anderson films")
// any signed-in user can join, with live per-participant progress.

async function jsonOrThrow(res: Response): Promise<unknown> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch { /* keep status */ }
    throw new Error(msg)
  }
  return res.json()
}

async function listChallenges(): Promise<Challenge[]> {
  const res = await authedFetch('/api/challenges')
  if (!res.ok) return []
  const data = await res.json()
  return (data.challenges ?? []) as Challenge[]
}

/** idOrUuid is either the numeric challenge id or its public uuid (the
 *  /challenge/<uuid> detail page) — the backend resolves both. */
async function getChallenge(idOrUuid: string | number): Promise<Challenge | null> {
  const res = await authedFetch(`/api/challenges/${idOrUuid}`)
  if (!res.ok) return null
  return (await res.json()) as Challenge
}

/** The challenges a user has joined, with progress always computed for that
 *  user — powers the profile page's "challenges" section. */
async function listUserChallenges(userId: number): Promise<Challenge[]> {
  const res = await authedFetch(`/api/users/${userId}/challenges`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.challenges ?? []) as Challenge[]
}

export type CreateChallengeInput = {
  title: string
  description?: string
  mediaType: '' | 'book' | 'movie' | 'series'
  /** null ⇒ "complete every item matching mediaType + conditions". */
  targetCount: number | null
  /** Unix seconds; 0 ⇒ unset. */
  startDate: number
  endDate: number
  conditions: ChallengeCondition[]
}

async function createChallenge(input: CreateChallengeInput): Promise<Challenge> {
  return jsonOrThrow(
    await authedFetch('/api/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        description: input.description || '',
        media_type: input.mediaType,
        target_count: input.targetCount,
        start_date: input.startDate,
        end_date: input.endDate,
        conditions: input.conditions,
      }),
    }),
  ) as Promise<Challenge>
}

async function updateChallenge(id: number, input: CreateChallengeInput): Promise<Challenge> {
  return jsonOrThrow(
    await authedFetch(`/api/challenges/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        description: input.description || '',
        media_type: input.mediaType,
        target_count: input.targetCount,
        start_date: input.startDate,
        end_date: input.endDate,
        conditions: input.conditions,
      }),
    }),
  ) as Promise<Challenge>
}

async function joinChallenge(id: number): Promise<Challenge> {
  return jsonOrThrow(await authedFetch(`/api/challenges/${id}/join`, { method: 'POST' })) as Promise<Challenge>
}

async function leaveChallenge(id: number): Promise<void> {
  await jsonOrThrow(await authedFetch(`/api/challenges/${id}/join`, { method: 'DELETE' }))
}

async function deleteChallenge(id: number): Promise<void> {
  await jsonOrThrow(await authedFetch(`/api/challenges/${id}`, { method: 'DELETE' }))
}

export const challengeService = {
  listChallenges,
  getChallenge,
  listUserChallenges,
  createChallenge,
  updateChallenge,
  joinChallenge,
  leaveChallenge,
  deleteChallenge,
}
