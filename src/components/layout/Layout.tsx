import type { ReactNode } from 'react'
import Header from './Header'

type LayoutProps = {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="app-ambient relative min-h-screen">
      <Header />
      <main className="relative z-10">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>
    </div>
  )
}
