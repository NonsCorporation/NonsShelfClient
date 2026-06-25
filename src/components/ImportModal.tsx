import { useRef, useState, type ReactNode } from 'react'
import {
  IoClose, IoBookOutline, IoFilmOutline, IoCloudUploadOutline, IoArrowBack, IoCheckmarkCircle, IoChevronForward,
} from 'react-icons/io5'
import { libraryService, type ImportSummary } from '../services/libraryService'
import { useLanguage } from '../contexts/LanguageContext'

type Props = { isOpen: boolean; onClose: () => void; onImported: () => void }
type Step = 'choose' | 'books' | 'upload'
type SourceKey = 'goodreads' | 'bookdiary' | 'storygraph'

// Book import sources: how to get the file + which endpoint to send it to.
const SOURCES: Record<SourceKey, { name: string; sub: string; steps: ReactNode[]; run: (f: File) => Promise<ImportSummary> }> = {
  goodreads: {
    name: 'Goodreads',
    sub: 'CSV export',
    run: (f) => libraryService.importGoodreads(f),
    steps: [
      <>Go to <a href="https://www.goodreads.com/review/import" target="_blank" rel="noreferrer" className="text-nonsprimary underline">Goodreads → My Books → Import/Export</a>.</>,
      <>Click <b className="text-[var(--text)]">Export Library</b> and wait for the CSV to generate.</>,
      <>Download the file, then upload it here.</>,
    ],
  },
  bookdiary: {
    name: 'Book Diary Pro',
    sub: 'CSV export',
    run: (f) => libraryService.importBookDiary(f),
    steps: [
      <>Open <b className="text-[var(--text)]">Book Diary Pro</b> → Settings → Export.</>,
      <>Export your books as a <b className="text-[var(--text)]">CSV</b> file.</>,
      <>Save/share the file, then upload it here.</>,
    ],
  },
  storygraph: {
    name: 'StoryGraph',
    sub: 'CSV export',
    run: (f) => libraryService.importStoryGraph(f),
    steps: [
      <>Go to <a href="https://app.thestorygraph.com/profile/settings" target="_blank" rel="noreferrer" className="text-nonsprimary underline">StoryGraph → Profile → Settings</a>.</>,
      <>Scroll to <b className="text-[var(--text)]">Export Your Data</b> and click <b className="text-[var(--text)]">Export your books</b>.</>,
      <>Download the CSV file, then upload it here.</>,
    ],
  },
}

export default function ImportModal({ isOpen, onClose, onImported }: Props) {
  const { t } = useLanguage()
  const [step, setStep] = useState<Step>('choose')
  const [source, setSource] = useState<SourceKey>('goodreads')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const reset = () => { setStep('choose'); setFile(null); setResult(null); setError(null); setBusy(false) }
  const close = () => { reset(); onClose() }
  const back = () => {
    setError(null); setResult(null); setFile(null)
    setStep(step === 'upload' ? 'books' : 'choose')
  }

  const pick = (key: SourceKey) => { setSource(key); setStep('upload') }

  const doImport = async () => {
    if (!file) return
    setBusy(true); setError(null)
    try {
      const sum = await SOURCES[source].run(file)
      setResult(sum)
      onImported()
    } catch (e) {
      setError((e as Error)?.message || t('importFailed') || 'Import failed — make sure it’s the right CSV export.')
    } finally {
      setBusy(false)
    }
  }

  const card = 'flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 text-sm font-medium text-[var(--text)] transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--container)] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step !== 'choose' && (
              <button onClick={back} className="text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
                <IoArrowBack className="h-5 w-5" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-[var(--text)]">{t('importLibrary') || 'Import to library'}</h2>
          </div>
          <button onClick={close} className="text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1 — books or movies */}
        {step === 'choose' && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setStep('books')} className={`${card} hover:border-nonsprimary hover:bg-[var(--primary-soft)]`}>
              <IoBookOutline className="h-7 w-7" />
              {t('books') || 'Books'}
            </button>
            <button disabled title={t('comingSoon') || 'Coming soon'} className={`${card} cursor-not-allowed opacity-50`}>
              <IoFilmOutline className="h-7 w-7" />
              {t('movies') || 'Movies'}
            </button>
          </div>
        )}

        {/* Step 2 — book sources */}
        {step === 'books' && (
          <div className="flex flex-col gap-2">
            {(Object.keys(SOURCES) as SourceKey[]).map((key) => (
              <button
                key={key}
                onClick={() => pick(key)}
                className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-left transition-colors hover:border-nonsprimary hover:bg-[var(--primary-soft)]"
              >
                <span>
                  <span className="block font-medium text-[var(--text)]">{SOURCES[key].name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{SOURCES[key].sub}</span>
                </span>
                <IoChevronForward className="h-4 w-4 text-[var(--text-muted)]" />
              </button>
            ))}
          </div>
        )}

        {/* Step 3 — upload (per source) */}
        {step === 'upload' && !result && (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-[var(--text)]">{SOURCES[source].name}</p>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-[var(--text-muted)]">
              {SOURCES[source].steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>

            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] transition-colors hover:border-nonsprimary"
            >
              <IoCloudUploadOutline className="h-5 w-5" />
              {file ? file.name : (t('chooseFile') || 'Choose CSV file')}
            </button>

            {error && <p className="text-sm text-nonslightred">{error}</p>}

            <button
              onClick={doImport}
              disabled={!file || busy}
              className="rounded-xl bg-nonsprimary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-50"
            >
              {busy ? (t('importing') || 'Importing…') : (t('import') || 'Import')}
            </button>
          </div>
        )}

        {/* Result */}
        {step === 'upload' && result && (
          <div className="flex flex-col items-center gap-3 text-center">
            <IoCheckmarkCircle className="h-12 w-12 text-nonsprimary" />
            <p className="text-base font-semibold text-[var(--text)]">
              {result.shelved} / {result.total} {t('booksImported') || 'books imported'}
            </p>
            <ul className="text-sm text-[var(--text-muted)]">
              <li>{result.matched} already in catalog · {result.created} added from OpenLibrary</li>
              <li>{result.shelved} shelved · {result.rated} rated</li>
              {result.skipped > 0 && <li>{result.skipped} {t('notFoundSkipped') || 'not found — skipped'}</li>}
            </ul>
            <button onClick={close} className="mt-1 rounded-xl bg-nonsprimary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-nonsprimaryfocus">
              {t('done') || 'Done'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
