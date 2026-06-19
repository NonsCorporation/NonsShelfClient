import { useEffect, useState, useCallback, useMemo } from 'react'
import { IoTrashOutline, IoCreateOutline, IoCheckmark, IoClose } from 'react-icons/io5'
import { librarianService } from '../services/librarianService'
import type { Episode, EpisodeInput } from '../services/librarianService'
import { useLanguage } from '../contexts/LanguageContext'

// Full episodes CRUD for a series: list grouped by season, add, inline edit,
// delete. Reused by the media edit modal and the librarian edit page.
export default function EpisodesManager({ mediaId }: { mediaId: string }) {
  const { t } = useLanguage()
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    setLoading(true)
    librarianService
      .getEpisodes(mediaId)
      .then(setEpisodes)
      .finally(() => setLoading(false))
  }, [mediaId])

  useEffect(() => {
    reload()
  }, [reload])

  // Group episodes by season, seasons and episodes both ascending.
  const seasons = useMemo(() => {
    const map = new Map<number, Episode[]>()
    for (const e of episodes) {
      const arr = map.get(e.season) ?? []
      arr.push(e)
      map.set(e.season, arr)
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([season, eps]) => ({ season, eps: eps.sort((a, b) => a.number - b.number) }))
  }, [episodes])

  // Default the add form to the next episode of the latest season.
  const nextSlot = useMemo(() => {
    if (seasons.length === 0) return { season: 1, number: 1 }
    const last = seasons[seasons.length - 1]
    return { season: last.season, number: (last.eps[last.eps.length - 1]?.number ?? 0) + 1 }
  }, [seasons])

  const wrap = (fn: () => Promise<void>) => async () => {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleAdd = (input: EpisodeInput) =>
    wrap(async () => {
      await librarianService.addEpisode(mediaId, input)
      reload()
    })()

  const handleUpdate = (id: number, input: EpisodeInput) =>
    wrap(async () => {
      await librarianService.updateEpisode(mediaId, id, input)
      setEditingId(null)
      reload()
    })()

  const handleDelete = (id: number) =>
    wrap(async () => {
      await librarianService.deleteEpisode(mediaId, id)
      setEpisodes((prev) => prev.filter((e) => e.id !== id))
    })()

  const handleDeleteSeason = (season: number, count: number) =>
    wrap(async () => {
      if (!window.confirm(t('confirmDeleteSeason', { season, count }))) return
      await librarianService.deleteSeason(mediaId, season)
      setEpisodes((prev) => prev.filter((e) => e.season !== season))
    })()

  if (loading) return <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>

  return (
    <div className="flex flex-col gap-5">
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}

      {seasons.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">{t('noEpisodesYet')}</p>
      ) : (
        seasons.map(({ season, eps }) => (
          <div key={season}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-[var(--text)]">
                {season === 0 ? t('specials') : `${t('season')} ${season}`}
                <span className="ml-2 font-normal text-[var(--text-muted)]">({eps.length})</span>
              </h4>
              <button
                onClick={() => handleDeleteSeason(season, eps.length)}
                title={t('deleteSeason')}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
              >
                <IoTrashOutline className="h-3.5 w-3.5" />
                {t('deleteSeason')}
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {eps.map((ep) =>
                editingId === ep.id ? (
                  <EpisodeForm
                    key={ep.id}
                    initial={ep}
                    submitLabel={t('save')}
                    onSubmit={(input) => handleUpdate(ep.id, input)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div key={ep.id} className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5">
                    <div className="h-12 w-20 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
                      {ep.still_url ? <img src={ep.still_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate text-[var(--text)]">
                        <span className="text-[var(--text-muted)]">{ep.number}. </span>
                        {ep.title || `${t('season')} ${ep.season}`}
                      </p>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {[ep.air_date, ep.runtime_min ? `${ep.runtime_min} min` : undefined].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <button onClick={() => setEditingId(ep.id)} title={t('edit')} className="flex-shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
                      <IoCreateOutline className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(ep.id)} title={t('delete')} className="flex-shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500">
                      <IoTrashOutline className="h-4 w-4" />
                    </button>
                  </div>
                ),
              )}
            </div>
          </div>
        ))
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-[var(--text)]">{t('addEpisode')}</h4>
        <EpisodeForm key={`${nextSlot.season}-${nextSlot.number}`} initial={nextSlot} submitLabel={t('addEpisode')} onSubmit={handleAdd} />
      </div>
    </div>
  )
}

// Add/edit form for one episode.
function EpisodeForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Partial<Episode> & { season: number; number: number }
  submitLabel: string
  onSubmit: (input: EpisodeInput) => void | Promise<void>
  onCancel?: () => void
}) {
  const { t } = useLanguage()
  const [form, setForm] = useState({
    season: String(initial.season ?? 1),
    number: String(initial.number ?? 1),
    title: initial.title ?? '',
    air_date: initial.air_date ?? '',
    runtime_min: initial.runtime_min ? String(initial.runtime_min) : '',
    still_url: initial.still_url ?? '',
    overview: initial.overview ?? '',
  })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await onSubmit({
        season: parseInt(form.season, 10) || 1,
        number: parseInt(form.number, 10) || 1,
        title: form.title || undefined,
        air_date: form.air_date || undefined,
        runtime_min: form.runtime_min ? parseInt(form.runtime_min, 10) : undefined,
        still_url: form.still_url || undefined,
        overview: form.overview || undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const input =
    'h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input className={input} type="number" placeholder={t('season')} value={form.season} onChange={(e) => setForm((s) => ({ ...s, season: e.target.value }))} />
        <input className={input} type="number" placeholder={t('episodeNumber')} value={form.number} onChange={(e) => setForm((s) => ({ ...s, number: e.target.value }))} />
        <input className={input} placeholder={t('airDate')} value={form.air_date} onChange={(e) => setForm((s) => ({ ...s, air_date: e.target.value }))} />
        <input className={input} type="number" placeholder={t('runtimeMin')} value={form.runtime_min} onChange={(e) => setForm((s) => ({ ...s, runtime_min: e.target.value }))} />
      </div>
      <input className={input} placeholder={t('episodeTitle')} value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
      <input className={input} placeholder={t('stillUrl')} value={form.still_url} onChange={(e) => setForm((s) => ({ ...s, still_url: e.target.value }))} />
      <textarea
        rows={2}
        className="resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
        placeholder={t('synopsis')}
        value={form.overview}
        onChange={(e) => setForm((s) => ({ ...s, overview: e.target.value }))}
      />
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={busy} className="inline-flex w-fit items-center gap-2 rounded-lg bg-nonsprimary px-4 py-2 text-sm font-semibold text-white hover:bg-nonsprimaryfocus disabled:opacity-50">
          <IoCheckmark className="h-4 w-4" />
          {submitLabel}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="inline-flex w-fit items-center gap-2 rounded-lg bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]">
            <IoClose className="h-4 w-4" />
            {t('cancel')}
          </button>
        )}
      </div>
    </div>
  )
}
