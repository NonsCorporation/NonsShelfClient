import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './contexts/LanguageContext.tsx'
import { PreferencesProvider } from './contexts/PreferencesContext.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <LanguageProvider>
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      </LanguageProvider>
    </AuthProvider>
  </StrictMode>,
)
