'use client'

import { useAuth } from '@/contexts/AuthContext'
import Feed from '@/screens/Feed'
import Discover from '@/screens/Discover'

// The home route serves two audiences. Signed-in members get their feed — the
// friends' activity they came for. Signed-out visitors have no feed to show
// (a feed needs people you follow), so they get Discover instead: the catalog,
// trending titles and universes are the honest first impression of the app, and
// every gated control there opens the login modal.
//
// RequireAuth resolves the session before this renders, so there's no flash of
// the wrong branch.
export default function Home() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Feed /> : <Discover />
}
