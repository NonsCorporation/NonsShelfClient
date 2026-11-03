// The search page's state lives in its URL so it survives reloads, shared links
// and back/forward: /search?q=dune&tab=book&sort=popular. Defaults are left out
// of the URL (tab "all" — or "users" for an @name query — and sort "relevance").

export type SearchTab = 'all' | 'book' | 'movie' | 'series' | 'people' | 'users'
export type SearchSort = 'relevance' | 'popular'

const TABS: readonly SearchTab[] = ['all', 'book', 'movie', 'series', 'people', 'users']

/** A query starting with "@" is a username, so it opens on the Users tab. */
export function defaultSearchTab(q: string): SearchTab {
  return q.trim().startsWith('@') ? 'users' : 'all'
}

/** The tab from ?tab=, falling back to the default for this query. */
export function parseSearchTab(value: string | null, q: string): SearchTab {
  return TABS.includes(value as SearchTab) ? (value as SearchTab) : defaultSearchTab(q)
}

/** The sort from ?sort= (only "popular" is non-default). */
export function parseSearchSort(value: string | null): SearchSort {
  return value === 'popular' ? 'popular' : 'relevance'
}

/** `current` with one key set — or removed when it equals its default. */
export function withSearchParam(current: URLSearchParams, key: 'tab' | 'sort', value: string, defaultValue: string): URLSearchParams {
  const next = new URLSearchParams(current)
  if (value === defaultValue) next.delete(key)
  else next.set(key, value)
  return next
}

/** Params for a (new) search for `q`. Pass the current params when already on
 *  /search to keep the chosen tab and sort — except that an @name query always
 *  lands on Users. */
export function searchParamsFor(q: string, keepFrom?: URLSearchParams | null): URLSearchParams {
  const next = new URLSearchParams()
  const query = q.trim()
  if (query) next.set('q', query)
  if (keepFrom) {
    for (const key of ['tab', 'sort'] as const) {
      const v = keepFrom.get(key)
      if (v) next.set(key, v)
    }
  }
  if (query.startsWith('@')) next.delete('tab')
  return next
}
