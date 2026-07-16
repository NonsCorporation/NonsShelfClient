'use client'

import { useState } from 'react'
import ShelfLogo from '@/components/branding/ShelfLogo'
import MobileCatalogSearch from './MobileCatalogSearch'

// The mobile-only top row (logo + catalog search) that Feed originally had to
// itself. Discover/Home render it too now, since the mobile bottom nav has no
// search entry and desktop's inline HeaderSearch isn't reachable on small
// screens — signed-out visitors need a way to search on mobile as much as
// signed-in ones do.
export default function MobileHeaderRow({ t }: { t: (key: string) => string }) {
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <div className="mb-5 flex items-center gap-3 lg:hidden">
      {!searchFocused && (
        <div className="flex flex-shrink-0 items-center gap-2">
          <ShelfLogo className="h-6 w-6 text-[var(--text)]" />
          <span className="text-xl font-bold tracking-tight text-[var(--text)]">Nons Shelf</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <MobileCatalogSearch t={t} onFocusChange={setSearchFocused} />
      </div>
    </div>
  )
}
