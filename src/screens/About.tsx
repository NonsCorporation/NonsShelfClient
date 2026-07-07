'use client'

import { useState } from 'react'
import { IoChevronDown } from 'react-icons/io5'
import Layout from '../components/layout/Layout'
import { useLanguage } from '../contexts/LanguageContext'

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[var(--border-subtle)] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--surface)]"
      >
        <span className="text-sm font-medium text-[var(--text)]">{question}</span>
        <IoChevronDown
          className={`h-4 w-4 flex-shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="px-4 pb-4 text-sm leading-relaxed text-[var(--text-muted)]">{answer}</p>
      )}
    </div>
  )
}

export default function About() {
  const { t } = useLanguage()

  const faqs = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    q: t(`aboutFaqQ${n}`),
    a: t(`aboutFaqA${n}`),
  }))

  return (
    <Layout>
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[var(--text)]">{t('aboutTitle')}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{t('aboutSubtitle')}</p>
        </div>

        <div className="mb-8 space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
          <p className="text-sm leading-relaxed text-[var(--text)]">{t('aboutIntro1')}</p>
          <p className="text-sm leading-relaxed text-[var(--text)]">{t('aboutIntro2')}</p>
        </div>

        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          {t('aboutFaqTitle')}
        </p>
        <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
          {faqs.map((faq, i) => (
            <FaqItem key={i} question={faq.q} answer={faq.a} />
          ))}
        </div>
      </div>
    </Layout>
  )
}
