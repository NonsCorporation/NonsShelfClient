import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

const STORAGE_KEY = 'nons_show_inprogress'

interface PreferencesContextType {
  /** Whether the "In progress" section is shown on the Library page. */
  showInProgress: boolean
  setShowInProgress: (value: boolean) => void
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined)

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [showInProgress, setShowInProgressState] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) !== 'false',
  )

  const setShowInProgress = (value: boolean) => {
    setShowInProgressState(value)
    localStorage.setItem(STORAGE_KEY, String(value))
  }

  return (
    <PreferencesContext.Provider value={{ showInProgress, setShowInProgress }}>
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
