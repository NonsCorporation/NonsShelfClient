'use client'

import NextLink from 'next/link'
import {
  useRouter,
  usePathname,
  useParams as useNextParams,
  useSearchParams as useNextSearchParams,
} from 'next/navigation'
import { useCallback, useMemo, type ComponentProps } from 'react'

// Compatibility layer preserving the react-router-dom API surface this app used,
// backed by Next.js App Router navigation. Routing itself is now real
// file-based routing under src/app/ — this only spares the screens a risky
// hand-rewrite of ~28 <Link> props and ~10 hook call sites. Inline it later if
// you want zero abstraction.

type LinkProps = Omit<ComponentProps<typeof NextLink>, 'href'> & { to: string }

// <Link to="..."> → next/link's <Link href="...">.
export function Link({ to, ...rest }: LinkProps) {
  return <NextLink href={to} {...rest} />
}

type To = string | { pathname: string; search?: string }

// useNavigate() → navigate(to, { replace }) | navigate(delta) over useRouter().
export function useNavigate() {
  const router = useRouter()
  return useCallback(
    (to: To | number, options?: { replace?: boolean }) => {
      if (typeof to === 'number') {
        if (to < 0) router.back()
        else router.forward()
        return
      }
      const href = typeof to === 'string' ? to : `${to.pathname}${to.search ?? ''}`
      if (options?.replace) router.replace(href)
      else router.push(href)
    },
    [router],
  )
}

// useLocation() → the subset the app reads ({ pathname }).
export function useLocation() {
  const pathname = usePathname()
  return { pathname }
}

export function useParams<T extends Record<string, string | undefined>>(): T {
  return useNextParams() as unknown as T
}

type SetSearchParams = (next: URLSearchParams, options?: { replace?: boolean }) => void

// useSearchParams() → react-router's [params, setParams] tuple.
export function useSearchParams(): [URLSearchParams, SetSearchParams] {
  const router = useRouter()
  const pathname = usePathname()
  const current = useNextSearchParams()

  // Memoize on the serialized query so the returned object keeps a stable
  // identity between renders (react-router did — some effects depend on it).
  const queryString = current?.toString() ?? ''
  const params = useMemo(() => new URLSearchParams(queryString), [queryString])

  const setSearchParams = useCallback<SetSearchParams>(
    (next, options) => {
      const qs = next.toString()
      const url = qs ? `${pathname}?${qs}` : pathname
      if (options?.replace) router.replace(url)
      else router.push(url)
    },
    [router, pathname],
  )

  return [params, setSearchParams]
}
