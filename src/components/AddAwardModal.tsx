'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoClose } from 'react-icons/io5'
import { awardService } from '../services/awardService'
import { awardIcon } from '../lib/awardIcons'
import type { AwardBody, AwardStatus, AwardSubject } from '../types'
import { useLanguage } from '../contexts/LanguageContext'

type Props = {
  isOpen: boolean
  subject: AwardSubject
  onClose: () => void
  onAdd: (input: { categoryId: number; year: number; status: AwardStatus }) => Promise<void>
}

// Librarian-only add-award picker: body → category (filtered to the subject
// being awarded, so a person picker never offers "Best Picture") → year →
// winner/nominee. Shared by the media and person award sections.
export default function AddAwardModal({ isOpen, subject, onClose, onAdd }: Props) {
  const { t } = useLanguage()
  const [bodies, setBodies] = useState<AwardBody[]>([])
  const [bodyKey, setBodyKey] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [status, setStatus] = useState<AwardStatus>('winner')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setBodyKey('')
    setCategoryId(null)
    setYear(String(new Date().getFullYear()))
    setStatus('winner')
    setError(null)
    awardService.getTaxonomy().then(setBodies)
  }, [isOpen])

  // Only bodies that have at least one category for this subject type are
  // offered, and within a body only the matching categories.
  const eligibleBodies = useMemo(
    () => bodies
      .map((b) => ({ ...b, categories: b.categories.filter((c) => c.subject_type === subject) }))
      .filter((b) => b.categories.length > 0),
    [bodies, subject],
  )
  const activeBody = eligibleBodies.find((b) => b.key === bodyKey) ?? null

  if (!isOpen) return null

  const submit = async () => {
    if (!categoryId) {
      setError(t('awardPickCategory'))
      return
    }
    const y = Number(year)
    if (!y) {
      setError(t('awardPickYear'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onAdd({ categoryId, year: y, status })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add award')
    } finally {
      setBusy(false)
    }
  }

  const selectCls =
    'h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text)]">{t('addAward')}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
          {t('awardBody')}
          <select
            value={bodyKey}
            onChange={(e) => { setBodyKey(e.target.value); setCategoryId(null) }}
            className={selectCls}
          >
            <option value="">{t('awardPickBody')}</option>
            {eligibleBodies.map((b) => (
              <option key={b.key} value={b.key}>{b.name}</option>
            ))}
          </select>
        </label>

        {activeBody && (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('awardCategory')}
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(Number(e.target.value) || null)}
              className={selectCls}
            >
              <option value="">{t('awardPickCategory')}</option>
              {activeBody.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('year')}
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={selectCls}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--text)]">{t('awardStatus')}</span>
            <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
              {(['winner', 'nominee'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    status === s ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {s === 'winner' ? t('awardWinner') : t('awardNominee')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live preview of the chip that will be added. */}
        {activeBody && categoryId != null && (() => {
          const cat = activeBody.categories.find((c) => c.id === categoryId)
          const Icon = awardIcon(activeBody.icon)
          if (!cat) return null
          return (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm">
              <Icon className="h-4 w-4 flex-shrink-0" style={{ color: status === 'winner' ? activeBody.color : 'var(--text-muted)' }} />
              <span className="text-[var(--text)]">{activeBody.name} — {cat.name}</span>
              <span className="ml-auto text-xs text-[var(--text-muted)]">{year} · {status === 'winner' ? t('awardWinner') : t('awardNominee')}</span>
            </div>
          )
        })()}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {t('cancel')}
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="h-10 rounded-lg bg-nonsprimary px-6 text-sm font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
          >
            {busy ? t('saving') : t('add')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
