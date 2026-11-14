'use client'

import { IoChevronForward, IoDocumentTextOutline } from 'react-icons/io5'
import Layout from '../components/layout/Layout'
import { Link } from '@/lib/router'

// /legal — the index of the legal pages.
const PAGES = [
  {
    to: '/legal/terms',
    title: 'Terms and conditions',
    hint: 'Using SomeShelf, and how Horizon payments, renewals, cancellation and refunds work.',
  },
  {
    to: '/legal/privacy',
    title: 'Privacy policy',
    hint: 'What we collect, why, who sees it, how long we keep it and your rights.',
  },
]

export default function Legal() {
  return (
    <Layout>
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Legal</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">The rules for using SomeShelf.</p>
        <ul className="mt-6 flex flex-col gap-3">
          {PAGES.map((pg) => (
            <li key={pg.to}>
              <Link
                to={pg.to}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 transition-colors hover:border-nonsprimary"
              >
                <IoDocumentTextOutline className="h-5 w-5 flex-shrink-0 text-[var(--text-muted)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--text)]">{pg.title}</span>
                  <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{pg.hint}</span>
                </span>
                <IoChevronForward className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}
