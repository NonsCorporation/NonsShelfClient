import { authedFetch } from '../lib/api'
import type {
  AdaptationSuggestions,
  AutoConnectSummary,
  Connections,
  Franchise,
  FranchisePageData,
  RelationKind,
  Series,
  SeriesPageData,
} from '../types'

// Client for nons-library-server's connection module: the series / franchise /
// adaptation graph that links catalog works. Reads are public; writes are
// writer/admin-guarded (a visitor calling them gets a 403).

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

// ── Reads ──────────────────────────────────────────────────────────────────────

/** The unified connections panel for a work (by numeric id or uuid). */
async function getConnections(mediaId: string): Promise<Connections> {
  const res = await authedFetch(`/api/media/${mediaId}/connections`)
  if (!res.ok) return { series: [], franchises: [], relations: [] }
  const data = (await res.json()) as Connections
  return {
    series: data.series ?? [],
    franchises: data.franchises ?? [],
    relations: data.relations ?? [],
  }
}

async function getSeries(uuid: string): Promise<SeriesPageData | null> {
  const res = await authedFetch(`/api/series/${uuid}`)
  if (!res.ok) return null
  return (await res.json()) as SeriesPageData
}

async function getFranchise(uuid: string): Promise<FranchisePageData | null> {
  const res = await authedFetch(`/api/franchises/${uuid}`)
  if (!res.ok) return null
  return (await res.json()) as FranchisePageData
}

/** Search series by name (for the librarian picker). */
async function searchSeries(q: string): Promise<Series[]> {
  const res = await authedFetch(`/api/series?q=${encodeURIComponent(q)}`)
  if (!res.ok) return []
  const data = (await res.json()) as { series?: Series[] }
  return data.series ?? []
}

async function searchFranchises(q: string): Promise<Franchise[]> {
  const res = await authedFetch(`/api/franchises?q=${encodeURIComponent(q)}`)
  if (!res.ok) return []
  const data = (await res.json()) as { franchises?: Franchise[] }
  return data.franchises ?? []
}

// ── Series writes ────────────────────────────────────────────────────────────

type SeriesInput = {
  name: string
  type: Series['type']
  description?: string
  franchise_id?: number | null
  parent_series_id?: number | null
  role?: string
}

async function createSeries(input: SeriesInput): Promise<Series> {
  const data = (await jsonOrThrow(
    await authedFetch('/api/series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )) as { series: Series }
  return data.series
}

async function updateSeries(uuid: string, input: SeriesInput): Promise<void> {
  await jsonOrThrow(
    await authedFetch(`/api/series/${uuid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

async function deleteSeries(uuid: string): Promise<void> {
  await jsonOrThrow(await authedFetch(`/api/series/${uuid}`, { method: 'DELETE' }))
}

/** Add or move a work within a series (idempotent on series+media). */
async function setSeriesItem(
  uuid: string,
  item: { media_id: number; position: number; label?: string },
): Promise<void> {
  await jsonOrThrow(
    await authedFetch(`/api/series/${uuid}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }),
  )
}

async function removeSeriesItem(uuid: string, mediaId: number): Promise<void> {
  await jsonOrThrow(
    await authedFetch(`/api/series/${uuid}/items/${mediaId}`, { method: 'DELETE' }),
  )
}

// ── Franchise writes ───────────────────────────────────────────────────────────

async function createFranchise(input: { name: string; description?: string }): Promise<Franchise> {
  const data = (await jsonOrThrow(
    await authedFetch('/api/franchises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )) as { franchise: Franchise }
  return data.franchise
}

async function updateFranchise(uuid: string, input: { name: string; description?: string }): Promise<void> {
  await jsonOrThrow(
    await authedFetch(`/api/franchises/${uuid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

async function deleteFranchise(uuid: string): Promise<void> {
  await jsonOrThrow(await authedFetch(`/api/franchises/${uuid}`, { method: 'DELETE' }))
}

/** Add or move a work within a franchise (idempotent on franchise+media). */
async function setFranchiseMember(
  uuid: string,
  member: { media_id: number; order: number; saga?: string; role?: string },
): Promise<void> {
  await jsonOrThrow(
    await authedFetch(`/api/franchises/${uuid}/members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member),
    }),
  )
}

async function removeFranchiseMember(uuid: string, mediaId: number): Promise<void> {
  await jsonOrThrow(
    await authedFetch(`/api/franchises/${uuid}/members/${mediaId}`, { method: 'DELETE' }),
  )
}

// ── Relation writes ─────────────────────────────────────────────────────────────

async function createRelation(input: {
  from_media_id: number
  to_media_id: number
  kind: RelationKind
  part?: number
  note?: string
}): Promise<void> {
  await jsonOrThrow(
    await authedFetch('/api/work-relations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

async function deleteRelation(id: number): Promise<void> {
  await jsonOrThrow(await authedFetch(`/api/work-relations/${id}`, { method: 'DELETE' }))
}

// ── Auto-find (TMDB) ─────────────────────────────────────────────────────────────

/** Build a movie's film series from its TMDB collection (writer/admin). */
async function autoConnect(mediaId: string): Promise<AutoConnectSummary> {
  return jsonOrThrow(
    await authedFetch(`/api/media/${mediaId}/connections/auto`, { method: 'POST' }),
  ) as Promise<AutoConnectSummary>
}

// ── Auto-find (AI) ───────────────────────────────────────────────────────────────

/** Ask the AI whether this work has a known book<->movie/series adaptation
 *  counterpart, with catalog matches for each candidate (writer/admin).
 *  Nothing is written — pair a result with createRelation to confirm. */
async function suggestAdaptations(mediaId: string): Promise<AdaptationSuggestions> {
  return jsonOrThrow(
    await authedFetch(`/api/media/${mediaId}/connections/ai-suggest`, { method: 'POST' }),
  ) as Promise<AdaptationSuggestions>
}

export const connectionService = {
  getConnections,
  getSeries,
  getFranchise,
  searchSeries,
  searchFranchises,
  createSeries,
  updateSeries,
  deleteSeries,
  setSeriesItem,
  removeSeriesItem,
  createFranchise,
  updateFranchise,
  deleteFranchise,
  setFranchiseMember,
  removeFranchiseMember,
  createRelation,
  deleteRelation,
  autoConnect,
  suggestAdaptations,
}
