import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getPrivacy, savePrivacy } from '../services/privacyService'

const STORAGE_KEY = 'nons_show_inprogress'

// Who may see a given facet of your profile. Mirrors the nons platform's own
// audience model so it reads familiarly: nobody / friends only / everyone.
export type Visibility = 'nobody' | 'friends' | 'everyone'

// The independently-controllable slices of your profile. (Favorites are never
// exposed on other users' profiles, so there's no toggle for them.)
export type PrivacyFacet = 'shelf' | 'ratings' | 'activity'

export type Privacy = Record<PrivacyFacet, Visibility>

export const PRIVACY_FACETS: PrivacyFacet[] = ['shelf', 'ratings', 'activity']

// Defaults until the server's settings load: shelf and ratings public (the point
// of a shared shelf), what you're up to is friends-only.
const DEFAULT_PRIVACY: Privacy = {
  shelf: 'everyone',
  ratings: 'everyone',
  activity: 'friends',
}

interface PreferencesContextType {
  /** Whether the "In progress" section is shown on the Library page. */
  showInProgress: boolean
  setShowInProgress: (value: boolean) => void
  /** Per-facet profile visibility (persisted server-side; defaults until loaded). */
  privacy: Privacy
  setVisibility: (facet: PrivacyFacet, value: Visibility) => void
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined)

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [showInProgress, setShowInProgressState] = useState<boolean>(() =>
    // Guarded for SSR (public /b and /m pages render on the server, where there
    // is no localStorage). Defaults to shown.
    typeof window === 'undefined' ? true : localStorage.getItem(STORAGE_KEY) !== 'false',
  )
  const [privacy, setPrivacy] = useState<Privacy>(DEFAULT_PRIVACY)

  // Load the signed-in user's saved visibility from the server; anonymous /
  // unreachable just keeps the defaults.
  useEffect(() => {
    let cancelled = false
    getPrivacy().then((p) => {
      if (p && !cancelled) setPrivacy(p)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setShowInProgress = (value: boolean) => {
    setShowInProgressState(value)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(value))
  }

  const setVisibility = (facet: PrivacyFacet, value: Visibility) => {
    setPrivacy((prev) => {
      const next = { ...prev, [facet]: value }
      void savePrivacy(next) // optimistic; persist server-side
      return next
    })
  }

  return (
    <PreferencesContext.Provider value={{ showInProgress, setShowInProgress, privacy, setVisibility }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export const usePreferences = () => {
  const context = useContext(PreferencesContext)
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider')
  }
  return context
}
