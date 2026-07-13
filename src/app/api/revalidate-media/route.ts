import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'

// The /b and /m pages server-render via serverApi.getPublicMedia, which caches
// the nons-library-server response for an hour (see serverApi.ts) so crawlers
// don't hammer the API. That cache is keyed by the exact page path and is
// otherwise untouched by a librarian's edit — a reload (even a hard one, since
// this is Next's server-side data cache, not the browser's HTTP cache) kept
// serving the pre-edit genres/synopsis/etc. for up to an hour. Called
// fire-and-forget after a direct catalog save so the editor's own reload picks
// up the change immediately.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { type?: string; id?: string; uuid?: string } | null
  const prefix = body?.type === 'book' ? 'b' : body?.type === 'movie' ? 'm' : null
  if (!prefix) {
    return NextResponse.json({ ok: false, error: 'type must be "book" or "movie"' }, { status: 400 })
  }
  for (const key of [body?.id, body?.uuid]) {
    if (key) revalidatePath(`/${prefix}/${key}`)
  }
  return NextResponse.json({ ok: true })
}
