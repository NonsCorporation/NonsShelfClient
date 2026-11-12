import { authedFetch } from '../lib/api'
import type { MediaType } from '../types'
import type { Bingo, BingoCell, BingoKind, BingoRevision, BingoRun } from '../lib/bingo'

// nons-library-server /api/bingo. Wire shapes are snake_case and timestamps are
// Unix seconds; the client store keeps camelCase and milliseconds, so every call
// maps at this boundary. Board ids (uuid) and run ids are the client's own, so
// nothing is remapped.

export type WireCell = { kind: 'media' | 'text'; title: string; type?: MediaType; cover_url?: string; credit?: string; year?: number }

type WirePerson = { uuid: string; username: string; name: string; avatar_url?: string }

type WireBoard = {
  id: string
  kind: BingoKind
  title: string
  description: string
  free_center: boolean
  rows: number
  cols: number
  cells: (WireCell | null)[]
  revision: number
  created_at: number
  owner?: WirePerson
}

type WireRun = {
  id: string
  board_id: string
  revision: number
  marks: boolean[]
  answers: (WireCell | null)[]
  finished_at?: number
  created_at: number
}

type WireRevision = { board_id: string; revision: number; rows: number; cols: number; free_center: boolean; cells: (WireCell | null)[] }

const toWireCell = (c: BingoCell | null | undefined): WireCell | null =>
  c ? { kind: c.kind, title: c.title, type: c.type, cover_url: c.coverUrl, credit: c.credit, year: c.year } : null

export const fromWireCell = (c: WireCell | null): BingoCell | null =>
  c ? { kind: c.kind, title: c.title, type: c.type, coverUrl: c.cover_url || undefined, credit: c.credit || undefined, year: c.year || undefined } : null

const personName = (p?: WirePerson) => p?.name || p?.username || ''

function fromWireBoard(b: WireBoard): Bingo {
  return {
    id: b.id,
    kind: b.kind,
    title: b.title,
    description: b.description,
    author: personName(b.owner),
    freeCenter: b.free_center,
    rows: b.rows,
    cols: b.cols,
    cells: b.cells.map(fromWireCell),
    revision: b.revision,
    createdAt: b.created_at * 1000,
  }
}

function fromWireRun(r: WireRun): BingoRun {
  return {
    id: r.id,
    marks: r.marks ?? [],
    answers: (r.answers ?? []).map(fromWireCell),
    createdAt: r.created_at * 1000,
    revision: r.revision,
    ...(r.finished_at ? { finishedAt: r.finished_at * 1000 } : {}),
  }
}

const fromWireRevision = (r: WireRevision): BingoRevision => ({
  revision: r.revision,
  rows: r.rows,
  cols: r.cols,
  freeCenter: r.free_center,
  cells: r.cells.map(fromWireCell),
})

async function ok(res: Response): Promise<Response> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch { /* keep status */ }
    throw new Error(msg)
  }
  return res
}

const json = (body: unknown): RequestInit => ({
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const path = (...parts: string[]) => '/api/bingo/' + parts.map(encodeURIComponent).join('/')

/** Everything the signed-in user has on the server, in the client store's shape. */
export type ServerBingos = {
  boards: Bingo[]
  /** Other people's boards the user has runs on. */
  played: Bingo[]
  runs: Record<string, BingoRun[]>
  revisions: Record<string, BingoRevision[]>
}

/** One player's run, with the board as that run saw it. */
export type ServerPlayerRun = { board: Bingo; latestRevision: number; run: BingoRun; by: string }

export const bingoApi = {
  async mine(): Promise<ServerBingos> {
    const res = await ok(await authedFetch(path('mine')))
    const body = (await res.json()) as { boards: WireBoard[]; played: WireBoard[]; runs: WireRun[]; revisions: WireRevision[] }
    const runs: Record<string, BingoRun[]> = {}
    for (const r of body.runs ?? []) (runs[r.board_id] ??= []).push(fromWireRun(r))
    const revisions: Record<string, BingoRevision[]> = {}
    for (const r of body.revisions ?? []) (revisions[r.board_id] ??= []).push(fromWireRevision(r))
    return {
      boards: (body.boards ?? []).map(fromWireBoard),
      played: (body.played ?? []).map(fromWireBoard),
      runs,
      revisions,
    }
  },

  /** Creates or updates one of the user's boards. `revision` only counts on create. */
  async saveBoard(b: Bingo): Promise<void> {
    await ok(
      await authedFetch(
        path('boards', b.id),
        json({
          kind: b.kind,
          title: b.title,
          description: b.description,
          free_center: b.freeCenter,
          rows: b.rows,
          cols: b.cols,
          cells: b.cells.map(toWireCell),
          revision: b.revision,
        }),
      ),
    )
  },

  async deleteBoard(id: string): Promise<void> {
    await ok(await authedFetch(path('boards', id), { method: 'DELETE' }))
  },

  /** Saves the user's run. Finishing it posts to the feed unless `share` is false. */
  async saveRun(boardId: string, run: BingoRun, share = true): Promise<void> {
    await ok(
      await authedFetch(
        path('boards', boardId, 'runs', run.id),
        json({
          revision: run.revision,
          // Sparse arrays (JS holes) serialize as null; the server reads null as false / empty.
          marks: Array.from(run.marks ?? [], (m) => !!m),
          answers: Array.from(run.answers ?? [], (a) => toWireCell(a)),
          finished: !!run.finishedAt,
          share,
        }),
      ),
    )
  },

  async deleteRun(boardId: string, runId: string): Promise<void> {
    await ok(await authedFetch(path('boards', boardId, 'runs', runId), { method: 'DELETE' }))
  },

  /** A public board, or null when the server doesn't have it. */
  async board(id: string): Promise<Bingo | null> {
    const res = await authedFetch(path('boards', id))
    if (res.status === 404) return null
    return fromWireBoard((await (await ok(res)).json()) as WireBoard)
  },

  /** A player's run (their latest when runId is omitted), or null. `user` is a uuid or username. */
  async playerRun(boardId: string, user: string, runId?: string): Promise<ServerPlayerRun | null> {
    const res = await authedFetch(runId ? path('boards', boardId, 'runs', user, runId) : path('boards', boardId, 'runs', user))
    if (res.status === 404) return null
    const body = (await (await ok(res)).json()) as { board: WireBoard; latest_revision: number; run: WireRun; player?: WirePerson }
    return {
      board: fromWireBoard(body.board),
      latestRevision: body.latest_revision,
      run: fromWireRun(body.run),
      by: personName(body.player),
    }
  },
}
