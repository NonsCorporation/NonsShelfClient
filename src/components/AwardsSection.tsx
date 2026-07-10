'use client'

import { useCallback, useEffect, useState } from 'react'
import { IoAddOutline, IoCloseCircle } from 'react-icons/io5'
import { awardService } from '../services/awardService'
import { awardIcon } from '../lib/awardIcons'
import type { AppliedAward, AwardStatus, AwardSubject } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import AddAwardModal from './AddAwardModal'

type Props = {
  subject: AwardSubject
  /** Media: numeric id or uuid. Person: uuid. */
  subjectId: string
  /** Show the librarian add/remove controls. */
  canEdit?: boolean
}

// The awards a media item or person holds — winners shown in the body's color
// with a filled marker, nominees muted/outlined. Librarians get an "add" button
// (opens AddAwardModal) and a remove control per chip. Renders nothing for
// non-librarians when there are no awards, so it never shows an empty card.
export default function AwardsSection({ subject, subjectId, canEdit = false }: Props) {
  const { t } = useLanguage()
  const [awards, setAwards] = useState<AppliedAward[]>([])
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    const p = subject === 'media' ? awardService.getMediaAwards(subjectId) : awardService.getPersonAwards(subjectId)
    p.then((rows) => { setAwards(rows); setLoaded(true) })
  }, [subject, subjectId])

  useEffect(() => { load() }, [load])

  if (!loaded) return null
  if (awards.length === 0 && !canEdit) return null

  const handleAdd = async (input: { categoryId: number; year: number; status: AwardStatus }) => {
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
      </div>

      {awards.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">{t('noAwardsYet')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {awards.map((a) => {
            const Icon = awardIcon(a.icon)
            const winner = a.status === 'winner'
            return (
              <span
                key={a.id}
                title={`${a.body_name} — ${a.category_name} (${a.year})`}
                style={winner ? { borderColor: a.color, backgroundColor: `${a.color}1a` } : undefined}
                className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                  winner ? 'text-[var(--text)]' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: winner ? a.color : 'var(--text-muted)' }} />
                <span className="font-medium">{a.body_name}</span>
                <span className="opacity-70">{a.category_name}</span>
                <span className="opacity-60">· {a.year}</span>
                {!winner && <span className="opacity-70">· {t('awardNominee')}</span>}
                {canEdit && (
                  <button
                    onClick={() => handleRemove(a.id)}
                    title={t('remove') || 'Remove'}
                    className="ml-0.5 text-[var(--text-muted)] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  >
                    <IoCloseCircle className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      <AddAwardModal isOpen={adding} subject={subject} onClose={() => setAdding(false)} onAdd={handleAdd} />
    </div>
  )
}
