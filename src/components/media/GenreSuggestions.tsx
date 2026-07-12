import { useState } from 'react'
import { IoSparklesOutline, IoCheckmark, IoClose } from 'react-icons/io5'
import { librarianService } from '@/services/librarianService'
import type { GenreSuggestion } from '@/services/librarianService'
import { useLanguage } from '@/contexts/LanguageContext'

// Librarian-only panel: asks the AI assistant to propose genres for this book
// (title/author/description → normalized genre + a one-line reason), then
// lets the librarian approve (appends the genre to the catalog row) or
// reject each proposal. Nothing is written to the media item until reviewed.
export default function GenreSuggestions({ mediaId, onApplied }: { mediaId: string; onApplied?: (genreName: string) => void }) {
  const { t } = useLanguage()
  const [items, setItems] = useState<GenreSuggestion[]>([])
  const [busy, setBusy] = useState(false)
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [opened, setOpened] = useState(false)

  const suggest = async () => {
    setBusy(true)
    setErr('')
    setOpened(true)
    try {
      setItems(await librarianService.suggestGenres(mediaId))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const approve = async (s: GenreSuggestion) => {
    setReviewingId(s.id)
    setErr('')
    try {
      await librarianService.approveGenreSuggestion(s.id)
      setItems((prev) => prev.map((it) => (it.id === s.id ? { ...it, status: 'approved' } : it)))
      onApplied?.(s.genre.name)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setReviewingId(null)
    }
  }

  const reject = async (s: GenreSuggestion) => {
    setReviewingId(s.id)
    setErr('')
    try {
      await librarianService.rejectGenreSuggestion(s.id)
      setItems((prev) => prev.map((it) => (it.id === s.id ? { ...it, status: 'rejected' } : it)))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setReviewingId(null)
    }
  }

  const pending = items.filter((i) => i.status === 'pending')
  const reviewed = items.filter((i) => i.status !== 'pending')

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={suggest}
        disabled={busy}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
      >
        <IoSparklesOutline className="h-3.5 w-3.5" />
        {busy ? t('genreSuggestLoading') : t('genreSuggestButton')}
      </button>

      {err && <p className="text-xs text-red-500">{err}</p>}

      {opened && !busy && items.length === 0 && !err && (
        <p className="text-xs text-[var(--text-muted)]">{t('genreSuggestEmpty')}</p>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-nonsprimary/40 bg-[var(--surface)] p-3">
          {pending.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-2 rounded-lg bg-[var(--input)] p-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text)]">{s.genre.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{s.reason}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => approve(s)}
                  disabled={reviewingId === s.id}
                  title={t('genreApprove')}
                  className="rounded-lg p-1.5 text-nonsprimary hover:bg-nonsprimary/10 disabled:opacity-50"
                >
                  <IoCheckmark className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => reject(s)}
                  disabled={reviewingId === s.id}
                  title={t('genreReject')}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                >
                  <IoClose className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {reviewed.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 px-2 py-1 opacity-60">
              <span className="text-sm text-[var(--text)]">{s.genre.name}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {s.status === 'approved' ? t('genreApproved') : t('genreRejected')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
