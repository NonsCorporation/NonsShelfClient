import { useState } from 'react'
import { IoClose, IoLinkOutline, IoCloudDownloadOutline } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'
import { librarianService, UrlImportError } from '@/services/librarianService'

type Props = {
  isOpen: boolean
  onClose: () => void
  /** Called with the catalog id; `created` is false when the entry already existed. */
  onImported: (id: string, created: boolean) => void
}

// Librarian import from a link: paste the address of a book / film / series page
// and the server reads it, an LLM extracts the title, author and other fields,
// and a catalog entry is created. If the server can't fetch the page (the site
// blocks it), the librarian can paste the page text from their own browser.
export default function ImportLinkModal({ isOpen, ...rest }: Props) {
  // The body mounts only while open, so every open starts with fresh state.
  return isOpen ? <ImportLinkBody {...rest} /> : null
}

function ImportLinkBody({ onClose, onImported }: Omit<Props, 'isOpen'>) {
  const { t } = useLanguage()
  const [url, setUrl] = useState('')
  const [content, setContent] = useState('')
  const [needsPaste, setNeedsPaste] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    const link = url.trim()
    if (!link || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await librarianService.importFromUrl(link, needsPaste ? content : undefined)
      onImported(String(res.media.id), res.created)
    } catch (e) {
      if (e instanceof UrlImportError && e.code === 'fetch_failed') {
        setNeedsPaste(true)
        setError(e.message)
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = !!url.trim() && !busy && (!needsPaste || !!content.trim())

  return (
    <div onClick={busy ? undefined : onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--container)]"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--divider)] bg-[var(--surface)] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">{t('importLinkTitle')}</h3>
            <p className="mt-1 text-xs tracking-wide text-[var(--text-muted)]">{t('importLinkSubtitle')}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            <IoClose className="h-5 w-5 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="relative">
            <IoLinkOutline className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              autoFocus
              type="url"
              value={url}
              disabled={busy}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !needsPaste && canSubmit) run() }}
              placeholder={t('importLinkPlaceholder')}
              className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] pl-10 pr-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] disabled:opacity-60"
            />
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>
          )}

          {needsPaste && (
            <div className="mt-3">
              <p className="mb-2 text-xs text-[var(--text-muted)]">{t('importLinkPasteHint')}</p>
              <textarea
                value={content}
                disabled={busy}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('importLinkPastePlaceholder')}
                className="h-40 w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] disabled:opacity-60"
              />
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-3">
            {busy && <span className="text-xs text-[var(--text-muted)]">{t('importLinkReading')}</span>}
            <button
              onClick={run}
              disabled={!canSubmit}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-nonsprimary px-4 text-sm font-semibold text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-50"
            >
              <IoCloudDownloadOutline className="h-4 w-4" />
              {busy ? t('importing') : needsPaste ? t('importLinkPasteAction') : t('import')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
