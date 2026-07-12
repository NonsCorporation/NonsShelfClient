import { useEffect, useState } from 'react'
import { IoClose, IoBarcodeOutline, IoCloudDownloadOutline, IoCheckmark } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'
import { catalogService } from '@/services/catalogService'
import type { CatalogItem } from '@/services/catalogService'
import { libraryService } from '@/services/libraryService'
import BarcodeScannerModal from '@/components/import-export/BarcodeScannerModal'

type Props = {
  isOpen: boolean
  onClose: () => void
  /** Called after an item is added to the shelf, with its media id. */
  onAdded: (mediaId: string) => void
}

type Status = 'scanning' | 'searching' | 'results' | 'not-found' | 'error'

// User-facing "scan a book's barcode to add it to my shelf" flow. Unlike the
// librarian import modal, this never creates a catalog row directly (readers
// can't call POST /api/media) — it hits /api/media/search-fill, which is open
// to every signed-in user: local catalog first, then an on-the-fly import
// from Google Books/OpenLibrary when the ISBN isn't in the catalog yet.
export default function ScanIsbnModal({ isOpen, onClose, onAdded }: Props) {
  const { t } = useLanguage()
  const [status, setStatus] = useState<Status>('scanning')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const reset = () => {
    setStatus('scanning')
    setResults([])
    setAddedIds(new Set())
  }

  // Reset to the camera view every time the modal reopens.
  useEffect(() => {
    if (isOpen) reset()
  }, [isOpen])

  if (!isOpen) return null

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleDetected = async (isbn: string) => {
    setStatus('searching')
    try {
      const { items } = await catalogService.searchFill(isbn, { limit: 3 })
      const books = items.filter((it) => it.type === 'book')
      if (books.length === 0) {
        setStatus('not-found')
        return
      }
      setResults(books)
      setStatus('results')
    } catch {
      setStatus('error')
    }
  }

  const handleAdd = async (item: CatalogItem) => {
    setAddingId(item.id)
    try {
      await libraryService.addItem({
        id: item.id,
        type: item.type,
        title: item.title,
        author: item.author,
        coverUrl: item.coverUrl,
        year: item.year,
        genre: item.genre,
        description: item.description,
        status: 'wishlist',
      })
      setAddedIds((prev) => new Set(prev).add(item.id))
      onAdded(item.id)
    } finally {
      setAddingId(null)
    }
  }

  // The scanning phase *is* the camera modal — no point layering our own
  // overlay behind it.
  if (status === 'scanning') {
    return <BarcodeScannerModal isOpen onClose={handleClose} onDetected={handleDetected} />
  }

  return (
    <div onClick={handleClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--container)]"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--divider)] bg-[var(--surface)] px-5 py-4">
          <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">{t('scanBarcode')}</h3>
          <button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] transition-colors hover:bg-[var(--surface-hover)]">
            <IoClose className="h-5 w-5 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {status === 'searching' && (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-[var(--text-muted)]">
              <IoBarcodeOutline className="h-8 w-8 animate-pulse" />
              {t('looking')}
            </div>
          )}

          {status === 'not-found' && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-[var(--text-muted)]">{t('isbnNotFound')}</p>
              <button
                onClick={reset}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)]"
              >
                {t('scanBarcode')}
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-red-500">{t('isbnNotFound')}</p>
              <button
                onClick={reset}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)]"
              >
                {t('scanBarcode')}
              </button>
            </div>
          )}

          {status === 'results' && (
            <div className="flex flex-col gap-2">
              {results.map((item) => {
                const added = addedIds.has(item.id)
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5">
                    <div className="h-16 w-11 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
                      {item.coverUrl ? <img src={item.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{item.title}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">{[item.author, item.year].filter(Boolean).join(' · ')}</p>
                    </div>
                    <button
                      onClick={() => handleAdd(item)}
                      disabled={added || addingId !== null}
                      className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                        added ? 'border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text)]' : 'bg-nonsprimary text-white hover:bg-nonsprimaryfocus'
                      }`}
                    >
                      {added ? <IoCheckmark className="h-4 w-4" /> : <IoCloudDownloadOutline className="h-4 w-4" />}
                      {added ? t('inLibrary') : addingId === item.id ? t('importing') : t('addToShelf')}
                    </button>
                  </div>
                )
              })}
              <button
                onClick={reset}
                className="mt-2 self-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)]"
              >
                {t('scanBarcode')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
