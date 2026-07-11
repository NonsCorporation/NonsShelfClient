'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoClose, IoChevronDown } from 'react-icons/io5'
import { awardService } from '@/services/awardService'
import AwardIcon from '@/components/awards/AwardIcon'
import PersonPicker from '@/components/person/PersonPicker'
import MediaPicker from '@/components/media/MediaPicker'
import type { AwardBody, AwardStatus, AwardSubject } from '@/types'
import type { PersonSummary } from '@/services/librarianService'
import type { CatalogItem } from '@/services/catalogService'
import { useLanguage } from '@/contexts/LanguageContext'

type Props = {
  isOpen: boolean
  subject: AwardSubject
  onClose: () => void
  onAdd: (input: { categoryId: number; year: number; status: AwardStatus; personUuid?: string; mediaRef?: string }) => Promise<void>
}

// Librarian-only add-award picker: body → category → year → winner/nominee.
// The full taxonomy is offered regardless of which page opened it (not just
// categories matching `subject`) — a category whose subject_type differs from
// the page needs the *actual* subject picked (e.g. "Best Actor" opened from a
// movie page requires picking the actor; the movie becomes the linked work
// automatically). A category matching the page's own subject type may
// additionally cross-link the other side — required when picking a work from
// a person's award (the headline "for Oppenheimer" case), optional and
// tucked away when noting a person on a media-subject award.
export default function AddAwardModal({ isOpen, subject, onClose, onAdd }: Props) {
  const { t } = useLanguage()
  const [bodies, setBodies] = useState<AwardBody[]>([])
  const [bodyKey, setBodyKey] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [status, setStatus] = useState<AwardStatus>('winner')
  const [crossPerson, setCrossPerson] = useState<PersonSummary | null>(null)
  const [crossMedia, setCrossMedia] = useState<CatalogItem | null>(null)
  const [showOptionalLink, setShowOptionalLink] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setBodyKey('')
    setCategoryId(null)
    setYear(String(new Date().getFullYear()))
    setStatus('winner')
    setCrossPerson(null)
    setCrossMedia(null)
    setShowOptionalLink(false)
    setError(null)
    awardService.getTaxonomy().then(setBodies)
  }, [isOpen])

  const activeBody = bodies.find((b) => b.key === bodyKey) ?? null
  const activeCategory = activeBody?.categories.find((c) => c.id === categoryId) ?? null

  // A category whose subject type differs from the page requires picking the
  // real subject; one that matches may optionally cross-link the other side.
  const needsPersonSubject = activeCategory?.subject_type === 'person' && subject !== 'person'
  const needsMediaSubject = activeCategory?.subject_type === 'media' && subject !== 'media'
  const offerPersonLink = activeCategory?.subject_type === subject && subject === 'media'
  const offerMediaLink = activeCategory?.subject_type === subject && subject === 'person'

  if (!isOpen) return null

  const submit = async () => {
    if (!categoryId || !activeCategory) {
      setError(t('awardPickCategory'))
      return
    }
    const y = Number(year)
    if (!y) {
      setError(t('awardPickYear'))
      return
    }
    if (needsPersonSubject && !crossPerson) {
      setError(t('awardPickPerson'))
      return
    }
    if (needsMediaSubject && !crossMedia) {
      setError(t('awardPickWork'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onAdd({
        categoryId, year: y, status,
        personUuid: crossPerson?.uuid,
        mediaRef: crossMedia?.id,
      })
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
            onChange={(e) => { setBodyKey(e.target.value); setCategoryId(null); setCrossPerson(null); setCrossMedia(null) }}
            className={selectCls}
          >
            <option value="">{t('awardPickBody')}</option>
            {bodies.map((b) => (
              <option key={b.key} value={b.key}>{b.name}</option>
            ))}
          </select>
        </label>

        {activeBody && (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('awardCategory')}
            <select
              value={categoryId ?? ''}
              onChange={(e) => { setCategoryId(Number(e.target.value) || null); setCrossPerson(null); setCrossMedia(null) }}
              className={selectCls}
            >
              <option value="">{t('awardPickCategory')}</option>
              {activeBody.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}

        {needsPersonSubject && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--text)]">{t('awardWho')}</span>
            {crossPerson ? (
              <button
                type="button"
                onClick={() => setCrossPerson(null)}
                className="flex items-center justify-between rounded-lg border border-nonsprimary bg-[var(--primary-soft)] px-3 py-2 text-left text-sm text-[var(--text)]"
              >
                {crossPerson.name}
                <IoClose className="h-4 w-4 text-[var(--text-muted)]" />
              </button>
            ) : (
              <PersonPicker onPick={setCrossPerson} />
            )}
          </div>
        )}

        {needsMediaSubject && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--text)]">{t('awardWhichWork')}</span>
            {crossMedia ? (
              <button
                type="button"
                onClick={() => setCrossMedia(null)}
                className="flex items-center justify-between rounded-lg border border-nonsprimary bg-[var(--primary-soft)] px-3 py-2 text-left text-sm text-[var(--text)]"
              >
                {crossMedia.title}
                <IoClose className="h-4 w-4 text-[var(--text-muted)]" />
              </button>
            ) : (
              <MediaPicker onPick={setCrossMedia} />
            )}
          </div>
        )}

        {offerMediaLink && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--text)]">{t('awardForWork')}</span>
            {crossMedia ? (
              <button
                type="button"
                onClick={() => setCrossMedia(null)}
                className="flex items-center justify-between rounded-lg border border-nonsprimary bg-[var(--primary-soft)] px-3 py-2 text-left text-sm text-[var(--text)]"
              >
                {crossMedia.title}
                <IoClose className="h-4 w-4 text-[var(--text-muted)]" />
              </button>
            ) : (
              <MediaPicker onPick={setCrossMedia} />
            )}
          </div>
        )}

        {offerPersonLink && !showOptionalLink && !crossPerson && (
          <button
            type="button"
            onClick={() => setShowOptionalLink(true)}
            className="inline-flex items-center gap-1 self-start text-xs font-medium text-nonsprimary hover:underline"
          >
            <IoChevronDown className="h-3.5 w-3.5" />
            {t('awardNotePerson')}
          </button>
        )}
        {offerPersonLink && (showOptionalLink || crossPerson) && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--text)]">{t('awardNotePerson')}</span>
            {crossPerson ? (
              <button
                type="button"
                onClick={() => setCrossPerson(null)}
                className="flex items-center justify-between rounded-lg border border-nonsprimary bg-[var(--primary-soft)] px-3 py-2 text-left text-sm text-[var(--text)]"
              >
                {crossPerson.name}
                <IoClose className="h-4 w-4 text-[var(--text-muted)]" />
              </button>
            ) : (
              <PersonPicker onPick={setCrossPerson} />
            )}
          </div>
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
        {activeBody && activeCategory && (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm">
            <AwardIcon bodyKey={activeBody.key} color={status === 'winner' ? activeBody.color : 'var(--text-muted)'} size={20} />
            <span className="min-w-0 truncate text-[var(--text)]">
              {activeBody.name} — {activeCategory.name}
              {(crossPerson || crossMedia) && <> · {crossPerson?.name ?? crossMedia?.title}</>}
            </span>
            <span className="ml-auto flex-shrink-0 text-xs text-[var(--text-muted)]">{year} · {status === 'winner' ? t('awardWinner') : t('awardNominee')}</span>
          </div>
        )}

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
