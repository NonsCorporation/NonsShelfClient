import { authedFetch } from '../lib/api'
import type { Recommendations } from '../types'

// Client for nons-library-server's "you might also like" endpoint. Public
// read; generation happens transparently server-side on first request.

/** This work's recommendations (by numeric id or uuid). Degrades to empty
 *  lists on any failure — the panel just renders nothing rather than erroring
 *  the page. */
async function getRecommendations(mediaId: string): Promise<Recommendations> {
  const res = await authedFetch(`/api/media/${mediaId}/recommendations`)
  if (!res.ok) return { ai: [], system: [] }
  const data = (await res.json()) as Recommendations
  return { ai: data.ai ?? [], system: data.system ?? [] }
}

export const recommendationService = {
  getRecommendations,
}
