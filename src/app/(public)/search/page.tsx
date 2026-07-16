'use client'

import { Suspense } from 'react'
import Search from '@/screens/Search'

export default function Page() {
  return (
    <Suspense>
      <Search />
    </Suspense>
  )
}
