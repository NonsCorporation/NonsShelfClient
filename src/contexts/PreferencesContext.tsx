import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

const STORAGE_KEY = 'nons_show_inprogress'
const PRIVACY_KEY = 'nons_privacy'

// Who may see a given facet of your profile. Mirrors the nons platform's own
// audience model so it reads familiarly: nobody / friends only / everyone.
export type Visibility = 'nobody' | 'friends' | 'everyone'

// The independently-controllable slices of your profile.
export type PrivacyFacet = 'shelf' | 'ratings' | 'favorites' | 'activity'

export type Privacy = Record<PrivacyFacet, Visibility>

export const PRIVACY_FACETS: PrivacyFacet[] = ['shelf', 'ratings', 'favorites', 'activity']

// Sensible defaults: your shelf and ratings are public (the point of a shared
// shelf), what you're up to is friends-only, and favorites stay private — which
// matches today's behaviour, where favorites are never exposed on other users'
// profiles.
const DEFAULT_PRIVACY: Privacy = {
  shelf: 'everyone',
  ratings: 'everyone',
  activity: 'friends',
  favorites: 'nobody',
}

function loadPrivacy(): Privacy {
  if (typeof window === 'undefined') return DEFAULT_PRIVACY
  try {
    const raw = localStorage.getItem(PRIVACY_KEY)
    if (!raw) return DEFAULT_PRIVACY
    // Merge over defaults so a newly-added facet is never left undefined.
    return { ...DEFAULT_PRIVACY, ...(JSON.parse(raw) as Partial<Privacy>) }
  } catch {
    return DEFAULT_PRIVACY
  }
}

interface PreferencesContextType {
  /** Whether the "In progress" section is shown on the Library page. */
  showInProgress: boolean
  setShowInProgress: (value: boolean) => void
  /** Per-facet profile visibility (persisted locally for now). */
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
  const [privacy, setPrivacy] = useState<Privacy>(loadPrivacy)

  const setShowInProgress = (value: boolean) => {
    setShowInProgressState(value)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(value))
  }

  const setVisibility = (facet: PrivacyFacet, value: Visibility) => {
    setPrivacy((prev) => {
      const next = { ...prev, [facet]: value }
      if (typeof window !== 'undefined') localStorage.setItem(PRIVACY_KEY, JSON.stringify(next))
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
