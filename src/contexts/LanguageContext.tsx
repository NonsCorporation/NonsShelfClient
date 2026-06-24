import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { en } from '../lib/locales/en';
import { ru } from '../lib/locales/ru';
import { ro } from '../lib/locales/ro';

export type Language = 'en' | 'ru' | 'ro';

const translations: Record<Language, Record<string, string>> = { en, ru, ro };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Guarded for SSR: the public /b and /m pages render on the server (no
    // localStorage/navigator), where we default to English — which is also what
    // crawlers index. The client adopts the stored/browser language on hydration.
    if (typeof window === 'undefined') return 'en';
    const saved = localStorage.getItem('language');
    if (saved === 'en' || saved === 'ru' || saved === 'ro') return saved;

    // Default to browser language if supported
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'ru') return 'ru';
    if (browserLang === 'ro') return 'ro';
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') localStorage.setItem('language', lang);
  };

  const t = (key: string, variables?: Record<string, string | number>): string => {
    const dict = translations[language];
    const fallback = translations['en'];

    if (!(key in dict) && !(key in fallback)) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }

    let translation: string = dict[key] ?? fallback[key];

    if (variables) {
      Object.entries(variables).forEach(([name, value]) => {
        translation = translation.replace(`{${name}}`, String(value));
      });
    }
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
