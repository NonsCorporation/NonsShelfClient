'use client'

import { useCallback, useEffect, useState } from 'react'
import { IoAddOutline, IoCloseCircle, IoCloudDownloadOutline } from 'react-icons/io5'
import { Link } from '@/lib/router'
import { awardService } from '../services/awardService'
import AwardIcon from './AwardIcon'
import type { AppliedAward, AwardStatus, AwardSubject } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { mediaPath } from '../lib/paths'
import AddAwardModal from './AddAwardModal'
import WikidataImportModal from './WikidataImportModal'

// The clickable "who/what this award is for" line: the cross-shown subject
// when the award's real subject differs from the page (e.g. a movie page's
// Best Actor win), otherwise the optional cross-linked entity. Falls back to
// plain (unlinked) text when there's no uuid to link to.
function secondaryLine(a: AppliedAward, crossShown: boolean, forWorkLabel: (name: string) => string): { text: string; href?: string } | null {
  if (crossShown && a.subject_name) {
    const href =
      a.subject_type === 'person'
        ? a.subject_uuid && `/p/${a.subject_uuid}`
        : a.subject_uuid && a.media_type && mediaPath({ type: a.media_type, uuid: a.subject_uuid, id: a.subject_uuid })
    return { text: a.subject_name, href: href || undefined }
  }
  if (a.linked_media_title) {
    const href = a.linked_media_uuid && a.media_type ? mediaPath({ type: a.media_type, uuid: a.linked_media_uuid, id: a.linked_media_uuid }) : undefined
    return { text: forWorkLabel(a.linked_media_title), href }
  }
  if (a.linked_person_name) {
    const href = a.linked_person_uuid ? `/p/${a.linked_person_uuid}` : undefined
    return { text: forWorkLabel(a.linked_person_name), href }
  }
  return null
}

type Props = {
  subject: AwardSubject
  /** Media: numeric id or uuid. Person: uuid. */
  subjectId: string
  /** Show the librarian add/remove controls. */
  canEdit?: boolean
  /** 'slider' (default): fixed-height single row, horizontal overflow scrolls
   *  instead of wrapping — for a wide main-content placement. 'grid': a
   *  2-column wrapping grid — for a narrow sidebar placement (e.g. below a
   *  person's portrait), where a horizontal scroller would only fit ~2 tiles
   *  at a time anyway. */
  layout?: 'slider' | 'grid'
}

// The awards a media item or person holds — winners shown in the body's color,
// nominees muted. Same big icon-forward tile everywhere (trophy on top, award
// name + year below). Librarians get an "add" button (opens AddAwardModal)
// and a remove control per award. Renders nothing for non-librarians when
// there are no awards, so it never shows an empty card.
export default function AwardsSection({ subject, subjectId, canEdit = false, layout = 'slider' }: Props) {
  const { t } = useLanguage()
  const [awards, setAwards] = useState<AppliedAward[]>([])
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)

  const load = useCallback(() => {
    const p = subject === 'media' ? awardService.getMediaAwards(subjectId) : awardService.getPersonAwards(subjectId)
    p.then((rows) => { setAwards(rows); setLoaded(true) })
  }, [subject, subjectId])

  useEffect(() => { load() }, [load])

  if (!loaded) return null
  if (awards.length === 0 && !canEdit) return null

  const handleAdd = async (input: { categoryId: number; year: number; status: AwardStatus; personUuid?: string; mediaRef?: string }) => {
    if (subject === 'media') await awardService.addMediaAward(subjectId, input)
    else await awardService.addPersonAward(subjectId, input)
    load()
  }

  const handleRemove = async (id: number) => {
    await awardService.deleteAward(id)
    setAwards((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('awards')}</h3>
        {canEdit && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-nonsprimary hover:underline"
          >
            <IoAddOutline className="h-3.5 w-3.5" />
            {t('addAward')}
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => setImporting(true)}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-nonsprimary hover:underline"
          >
            <IoCloudDownloadOutline className="h-3.5 w-3.5" />
            {t('awardAutoImport')}
          </button>
        )}
      </div>

      {awards.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">{t('noAwardsYet')}</p>
      ) : (
        <div className={layout === 'grid' ? 'grid grid-cols-2 gap-4' : 'flex gap-4 overflow-x-auto pb-1'}>
          {awards.map((a) => {
            const winner = a.status === 'winner'
            // Cross-shown: this award's real subject is the other type (e.g.
            // a movie page also lists its Best Actor win) — show who/what it
            // actually belongs to instead of the (redundant) linked-entity text.
            const crossShown = a.subject_type !== subject
            const secondary = secondaryLine(a, crossShown, (name) => t('awardForWorkLabel', { name }))
            return (
              <div
                key={a.id}
                className={`group relative flex flex-col items-center gap-1.5 text-center ${layout === 'grid' ? 'w-full' : 'w-24 flex-shrink-0'}`}
              >
                <AwardIcon bodyKey={a.body_key} color={winner ? '#d2b781' : 'var(--text-muted)'} size={layout === 'grid' ? 56 : 72} />
                <span className="text-xs font-semibold leading-tight text-[var(--text)]">{a.body_name}</span>
                <span className="text-[11px] leading-tight text-[var(--text-muted)]">
                  {a.category_name} · {a.year}
                </span>
                {secondary && (
                  secondary.href ? (
                    <Link
                      to={secondary.href}
                      className="text-[11px] leading-tight text-[var(--text-muted)] hover:text-nonsprimary hover:underline"
                    >
                      {secondary.text}
                    </Link>
                  ) : (
                    <span className="text-[11px] leading-tight text-[var(--text-muted)]">{secondary.text}</span>
                  )
                )}
                {!winner && (
                  <span className="rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    {t('awardNominee')}
                  </span>
                )}
                {canEdit && (
                  <button
                    onClick={() => handleRemove(a.id)}
                    title={t('remove') || 'Remove'}
                    className="absolute -right-1 -top-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  >
                    <IoCloseCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AddAwardModal isOpen={adding} subject={subject} onClose={() => setAdding(false)} onAdd={handleAdd} />
      <WikidataImportModal
        isOpen={importing}
        subject={subject}
        subjectId={subjectId}
        onClose={() => setImporting(false)}
        onImported={load}
      />
    </div>
  )
}
