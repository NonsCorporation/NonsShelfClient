import { authedFetch } from '../lib/api'
import type { AppliedTag, TagTaxonomyGroup } from '../types'

// Client for nons-library-server's tag module: a normalized, crowdsourced
// taxonomy (group -> facet -> tag) collected from users on the "already
// finished" flow (see FinishModal) and aggregated into "applied" tags once
// enough users agree (see the backend's tag_service.AppliedThreshold).

type TaxonomyResponse = { groups?: TagTaxonomyGroup[] }
type MyVotesResponse = { tag_ids?: number[] }

// The backend's AppliedTag JSON is snake_case; map it to the camelCase shape
// the rest of the frontend uses (matching mediaMap.ts's toMediaItem pattern).
type AppliedTagWire = {
  id: number
  key: string
  label: string
  facet_key: string
  facet_label: string
  color: string
  group_key: string
  group_label: string
  votes: number
}
type AppliedTagsResponse = { tags?: AppliedTagWire[] }

function toAppliedTag(w: AppliedTagWire): AppliedTag {
  return {
    id: w.id,
    key: w.key,
    label: w.label,
    facetKey: w.facet_key,
    facetLabel: w.facet_label,
    color: w.color,
    groupKey: w.group_key,
    groupLabel: w.group_label,
    votes: w.votes,
  }
}

// The taxonomy is static reference data — fetched once and reused for the
// lifetime of the tab instead of re-fetching it every time the finish modal opens.
let taxonomyCache: Promise<TagTaxonomyGroup[]> | null = null

/** The full tag tree (groups -> facets -> tags) the finish modal renders as its picker. */
async function getTaxonomy(): Promise<TagTaxonomyGroup[]> {
  if (!taxonomyCache) {
    taxonomyCache = authedFetch('/api/tags/taxonomy')
      .then((res) => (res.ok ? (res.json() as Promise<TaxonomyResponse>) : { groups: [] }))
      .then((data) => data.groups ?? [])
      .catch(() => [])
  }
  return taxonomyCache
}

/** The tags that have crossed the applied-tag threshold for a media item — public read.
 *  `mediaId` is either the numeric catalog id or the public uuid (from /b/<uuid>,
 *  /m/<uuid> page routes) — the backend resolves both, so it's passed through as-is. */
async function getAppliedTags(mediaId: string): Promise<AppliedTag[]> {
  const res = await authedFetch(`/api/media/${mediaId}/tags`)
  if (!res.ok) return []
  const data = (await res.json()) as AppliedTagsResponse
  return (data.tags ?? []).map(toAppliedTag)
}

/** The signed-in user's own tag picks for a media item, to pre-select the picker. */
async function getMyVotes(mediaId: string): Promise<number[]> {
  const res = await authedFetch(`/api/media/${mediaId}/tags/mine`)
  if (!res.ok) return []
  const data = (await res.json()) as MyVotesResponse
  return data.tag_ids ?? []
}

/** Replaces the signed-in user's tag picks for a media item. Returns the item's updated applied tags. */
async function setMyVotes(mediaId: string, tagIds: number[]): Promise<AppliedTag[]> {
  const res = await authedFetch(`/api/media/${mediaId}/tags`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_ids: tagIds }),
  })
  if (!res.ok) throw new Error('Failed to save tags')
  const data = (await res.json()) as AppliedTagsResponse
  return (data.tags ?? []).map(toAppliedTag)
}

export const tagService = {
  getTaxonomy,
  getAppliedTags,
  getMyVotes,
  setMyVotes,
}
