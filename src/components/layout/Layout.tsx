import type { ReactNode } from 'react'

// Header itself lives in the persistent (app) route layout (see
// app/(app)/providers.tsx) rather than here, so it survives client-side
// navigations between screens instead of remounting on every page — a
// remount would reset any nav transition/animation state on every click.
type LayoutProps = {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="app-ambient relative min-h-screen">
      <main className="relative z-10">
        <div className="mx-auto max-w-6xl px-4 py-6 pb-32 md:px-8 md:py-10 md:pb-10">{children}</div>
      </main>
    </div>
  )
}
