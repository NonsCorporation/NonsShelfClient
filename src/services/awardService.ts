import { authedFetch } from '../lib/api'
import type { AppliedAward, AwardBody, AwardStatus } from '../types'

// Client for nons-library-server's award module: a librarian-curated catalog of
// recognitions (Oscars, Booker, Hugos…) applied to media and people. Reads are
// public; adds/deletes are librarian-only (the backend gates them).

// The taxonomy is static reference data — fetched once and reused for the tab's
// lifetime instead of re-fetching every time the add-award picker opens.
let taxonomyCache: Promise<AwardBody[]> | null = null

async function getTaxonomy(): Promise<AwardBody[]> {
  if (!taxonomyCache) {
    taxonomyCache = authedFetch('/api/awards/taxonomy')
      .then((res) => (res.ok ? (res.json() as Promise<{ bodies?: AwardBody[] }>) : { bodies: [] }))
      .then((data) => data.bodies ?? [])
      .catch(() => [])
  }
  return taxonomyCache
}

/** A media item's awards. `mediaId` is the numeric id or public uuid. */
async function getMediaAwards(mediaId: string): Promise<AppliedAward[]> {
  const res = await authedFetch(`/api/media/${mediaId}/awards`)
  if (!res.ok) return []
  const data = (await res.json()) as { awards?: AppliedAward[] }
  return data.awards ?? []
}

/** A person's awards, addressed by their public uuid. */
async function getPersonAwards(uuid: string): Promise<AppliedAward[]> {
  const res = await authedFetch(`/api/people/${uuid}/awards`)
  if (!res.ok) return []
  const data = (await res.json()) as { awards?: AppliedAward[] }
  return data.awards ?? []
}

type AddInput = { categoryId: number; year: number; status: AwardStatus }

function addBody(input: AddInput): string {
  return JSON.stringify({ category_id: input.categoryId, year: input.year, status: input.status })
}

async function addMediaAward(mediaId: string, input: AddInput): Promise<void> {
  const res = await authedFetch(`/api/media/${mediaId}/awards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: addBody(input),
  })
  if (!res.ok) throw new Error('Failed to add award')
}

async function addPersonAward(uuid: string, input: AddInput): Promise<void> {
  const res = await authedFetch(`/api/people/${uuid}/awards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: addBody(input),
  })
  if (!res.ok) throw new Error('Failed to add award')
}

async function deleteAward(id: number): Promise<void> {
  const res = await authedFetch(`/api/awards/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to remove award')
}

export const awardService = {
  getTaxonomy,
  getMediaAwards,
  getPersonAwards,
  addMediaAward,
  addPersonAward,
  deleteAward,
}
