'use client'

import { IoBulb } from 'react-icons/io5'
import Layout from '../components/layout/Layout'
import { useLanguage } from '../contexts/LanguageContext'

// /suggestions — where people will send their wishes for the site. Empty for
// now: just the page and its title, so the feed's prompt has somewhere to lead.
export default function SuggestionsPage() {
  const { t } = useLanguage()
  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{t('siteSuggestionsTitle')}</h1>
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] px-6 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface)]">
            <IoBulb className="h-7 w-7 text-[var(--text-muted)]" />
          </span>
          <p className="text-sm text-[var(--text-muted)]">{t('siteSuggestionsSoon')}</p>
        </div>
      </div>
    </Layout>
  )
}
