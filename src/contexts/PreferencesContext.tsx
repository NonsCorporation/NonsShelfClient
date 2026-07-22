import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getPrivacy, savePrivacy } from '../services/privacyService'

const STORAGE_KEY = 'nons_show_inprogress'
const MEDIA_LANG_KEY = 'nons_preferred_media_lang'
const THEME_KEY = 'nons_theme'

// 'system' follows the OS/browser color-scheme preference; light/dark pin it.
export type Theme = 'system' | 'light' | 'dark'

const resolveTheme = (theme: Theme): 'light' | 'dark' =>
  theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : theme

// The feed's top-row blocks, each independently hideable from Settings.
export type FeedBlock = 'progress' | 'challenge' | 'stats' | 'trending'
export const FEED_BLOCKS: FeedBlock[] = ['progress', 'challenge', 'stats', 'trending']
const FEED_BLOCKS_KEY = 'nons_feed_blocks'
const DEFAULT_FEED_BLOCKS: Record<FeedBlock, boolean> = {
  progress: true,
  challenge: true,
  stats: true,
  trending: true,
}

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
  /** ISO 639-1 code of the preferred display language for movies/series (e.g. "ru"). Empty = use catalog default. */
  preferredMediaLang: string
  setPreferredMediaLang: (value: string) => void
  /** Which of the feed's top-row blocks (in progress / challenge / stats / trending) are shown. */
  feedBlocks: Record<FeedBlock, boolean>
  setFeedBlockVisible: (block: FeedBlock, value: boolean) => void
  /** Color scheme: 'system' follows the OS preference; light/dark pin it. */
  theme: Theme
  setTheme: (value: Theme) => void
  /** Whether the viewer's own likes/comments on someone else's post surface as
   *  a banner ("You liked this") when friends see that post in their feed.
   *  Persisted server-side alongside privacy (defaults true until loaded). */
  showActivityReactions: boolean
  setShowActivityReactions: (value: boolean) => void
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined)

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [showInProgress, setShowInProgressState] = useState<boolean>(() =>
    // Guarded for SSR (public /b and /m pages render on the server, where there
    // is no localStorage). Defaults to shown.
    typeof window === 'undefined' ? true : localStorage.getItem(STORAGE_KEY) !== 'false',
  )
  const [preferredMediaLang, setPreferredMediaLangState] = useState<string>(() =>
    typeof window === 'undefined' ? '' : (localStorage.getItem(MEDIA_LANG_KEY) ?? ''),
  )
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === 'undefined' ? 'dark' : ((localStorage.getItem(THEME_KEY) as Theme | null) ?? 'dark'),
  )
  const [privacy, setPrivacy] = useState<Privacy>(DEFAULT_PRIVACY)
  const [showActivityReactions, setShowActivityReactionsState] = useState<boolean>(true)
  const [feedBlocks, setFeedBlocksState] = useState<Record<FeedBlock, boolean>>(() => {
    if (typeof window === 'undefined') return DEFAULT_FEED_BLOCKS
    try {
      const stored = JSON.parse(localStorage.getItem(FEED_BLOCKS_KEY) ?? '{}')
      return { ...DEFAULT_FEED_BLOCKS, ...stored }
    } catch {
      return DEFAULT_FEED_BLOCKS
    }
  })

  // Load the signed-in user's saved privacy settings from the server;
  // anonymous / unreachable just keeps the defaults.
  useEffect(() => {
    let cancelled = false
    getPrivacy().then((p) => {
      if (!p || cancelled) return
      setPrivacy({ shelf: p.shelf, ratings: p.ratings, activity: p.activity })
      setShowActivityReactionsState(p.showActivityReactions)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setShowInProgress = (value: boolean) => {
    setShowInProgressState(value)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(value))
  }

  // Applies the resolved light/dark value to <html data-theme>, and while
  // 'system' is selected, follows OS-level scheme changes live.
  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(theme)
    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => { document.documentElement.dataset.theme = resolveTheme(theme) }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = (value: Theme) => {
    setThemeState(value)
    if (typeof window !== 'undefined') localStorage.setItem(THEME_KEY, value)
  }

  const setShowActivityReactions = (value: boolean) => {
    setShowActivityReactionsState(value)
    void savePrivacy({ ...privacy, showActivityReactions: value }) // optimistic; persist server-side
  }

  const setPreferredMediaLang = (value: string) => {
    setPreferredMediaLangState(value)
    if (typeof window !== 'undefined') localStorage.setItem(MEDIA_LANG_KEY, value)
  }

  const setVisibility = (facet: PrivacyFacet, value: Visibility) => {
    setPrivacy((prev) => {
      const next = { ...prev, [facet]: value }
      void savePrivacy({ ...next, showActivityReactions }) // optimistic; persist server-side
      return next
    })
  }

  const setFeedBlockVisible = (block: FeedBlock, value: boolean) => {
    setFeedBlocksState((prev) => {
      const next = { ...prev, [block]: value }
      if (typeof window !== 'undefined') localStorage.setItem(FEED_BLOCKS_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <PreferencesContext.Provider
      value={{
        showInProgress,
        setShowInProgress,
        privacy,
        setVisibility,
        preferredMediaLang,
        setPreferredMediaLang,
        feedBlocks,
        setFeedBlockVisible,
        theme,
        setTheme,
        showActivityReactions,
        setShowActivityReactions,
      }}
    >
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
