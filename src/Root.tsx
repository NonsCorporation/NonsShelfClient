import App from './App.tsx'
import { LanguageProvider } from './contexts/LanguageContext.tsx'
import { PreferencesProvider } from './contexts/PreferencesContext.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

// Mirrors the old src/main.tsx provider tree. StrictMode is applied globally
// via reactStrictMode in next.config.ts.
export default function Root() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      </LanguageProvider>
    </AuthProvider>
  )
}
