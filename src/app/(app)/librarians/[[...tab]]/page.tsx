'use client'

import Librarians from '@/screens/Librarians'

// /librarians, /librarians/catalog, /librarians/authors, /librarians/suggestions,
// /librarians/users — the tab is the first path segment (see screens/Librarians).
export default function Page() {
  return <Librarians />
}
