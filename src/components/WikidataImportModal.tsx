'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoClose, IoCloudDownloadOutline } from 'react-icons/io5'
import { awardService } from '../services/awardService'
import type { AwardSubject, WikidataImportItem, WikidataImportPreview } from '../types'
import { useLanguage } from '../contexts/LanguageContext'

type Props = {
  isOpen: boolean
  subject: AwardSubject
  /** Media: numeric id or uuid. Person: uuid. */
  subjectId: string
  onClose: () => void
  /** Called after a successful import so the caller can reload the awards list. */
  onImported: () => void
}

// "Auto-import awards": resolves this media item/person on Wikidata, previews
// the award claims it can match against our taxonomy, and lets a librarian
// uncheck any before writing them — nothing is saved until Import is clicked.
export default function WikidataImportModal({ isOpen, subject, subjectId, onClose, onImported }: Props) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<WikidataImportPreview | null>(null)
  const [checked, setChecked] = useState<boolean[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setPreview(null)
    setError(null)
    setResult(null)
    setLoading(true)
    const suggest = subject === 'media' ? awardService.suggestMediaWikidata(subjectId) : awardService.suggestPersonWikidata(subjectId)
    suggest
      .then((p) => { setPreview(p); setChecked(p.matched.map(() => true)) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to fetch Wikidata awards'))
      .finally(() => setLoading(false))
  }, [isOpen, subject, subjectId])

  if (!isOpen) return null

  const toggle = (i: number) => setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)))

  const confirmImport = async () => {
    if (!preview) return
    const items: WikidataImportItem[] = preview.matched.filter((_, i) => checked[i])
    setBusy(true)
    setError(null)
    try {
      const res = subject === 'media' ? await awardService.importMediaWikidata(subjectId, items) : await awardService.importPersonWikidata(subjectId, items)
      setResult(res)
      onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import awards')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
            <IoCloudDownloadOutline className="h-5 w-5 text-[var(--text-muted)]" />
            {t('awardImportPreviewTitle')}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto">
          {loading && <p className="text-sm text-[var(--text-muted)]">…</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}

          {result && (
            <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">
              {t('awardImportSuccess', { imported: result.imported })}
            </p>
          )}

          {!loading && preview && !result && (
            <>
              {preview.matched.length === 0 && preview.unmatched.length === 0 && (
                <p className="text-sm text-[var(--text-muted)]">{t('awardImportNoneFound')}</p>
              )}

              {preview.matched.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {preview.matched.map((item, i) => (
                    <label
                      key={`${item.category_id}-${item.subject_id}-${item.year}-${item.linked_media_id ?? 0}-${item.linked_person_id ?? 0}`}
                      className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm"
                    >
                      <input type="checkbox" checked={checked[i] ?? false} onChange={() => toggle(i)} className="h-4 w-4 flex-shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[var(--text)]">
                          {item.body_name} — {item.category_name}
                        </span>
                        <span className="block text-xs text-[var(--text-muted)]">
                          {item.subject_name} · {item.year} · {item.status === 'winner' ? t('awardWinner') : t('awardNominee')}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {preview.unmatched.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('awardImportUnmatched')}</span>
                  {preview.unmatched.map((u, i) => (
                    <div key={i} className="rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-muted)]">
                      {u.label} {u.year ? `· ${u.year}` : ''} — {u.reason}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {t('cancel')}
          </button>
          {!result && preview && preview.matched.length > 0 && (
            <button
              onClick={confirmImport}
              disabled={busy || checked.every((c) => !c)}
              className="h-10 rounded-lg bg-nonsprimary px-6 text-sm font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
            >
              {busy ? t('saving') : t('awardImportConfirm')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
