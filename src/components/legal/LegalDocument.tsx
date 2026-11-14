'use client'

import Layout from '@/components/layout/Layout'
import { Link } from '@/lib/router'
import { LEGAL } from '@/lib/legal'

export type LegalSection = { id: string; title: string; body: React.ReactNode[] }

// The shared page for a legal document: breadcrumb, title, "last updated", a short
// summary, a table of contents and the numbered sections. Legal text is English
// only: a machine translation of one is worse than none.
export default function LegalDocument({
  title,
  summary,
  sections,
}: {
  title: string
  /** The "In short" points, shown first. */
  summary: React.ReactNode[]
  sections: LegalSection[]
}) {
  const updated = new Date(LEGAL.updated).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <nav className="mb-4 text-xs text-[var(--text-muted)]" aria-label="Breadcrumb">
          <Link to="/legal" className="hover:text-[var(--text)] hover:underline">
            Legal
          </Link>{' '}
          / <span className="text-[var(--text)]">{title}</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Last updated {updated}</p>

        <div className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">In short</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--text)]">
            {summary.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <nav aria-label="Contents" className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="text-[var(--text-muted)] hover:text-nonsprimary hover:underline">
              {s.title.replace(/^\d+\.\s*/, '')}
            </a>
          ))}
        </nav>

        <div className="mt-8 space-y-8">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-base font-semibold text-[var(--text)]">{s.title}</h2>
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-[var(--text)]">
                {s.body.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Layout>
  )
}
