import { useRef, useState, type ReactNode } from 'react'
import {
  IoClose, IoBookOutline, IoFilmOutline, IoCloudUploadOutline, IoArrowBack, IoCheckmarkCircle, IoChevronForward,
} from 'react-icons/io5'
import { libraryService, type ImportJob, type ImportProgress } from '../services/libraryService'
import { useLanguage } from '../contexts/LanguageContext'

type Props = { isOpen: boolean; onClose: () => void; onImported: () => void }
type Step = 'choose' | 'books' | 'bookdiary' | 'upload'
type SourceKey = 'goodreads' | 'bookdiarycsv' | 'bookdiarydb' | 'storygraph'

// Book import sources: how to get the file + which endpoint to send it to.
const SOURCES: Record<SourceKey, { name: string; sub: string; accept: string; fileLabel: string; steps: ReactNode[]; run: (f: File, onProgress?: ImportProgress) => Promise<ImportJob> }> = {
  goodreads: {
    name: 'Goodreads',
    sub: 'CSV export',
    accept: '.csv,text/csv',
    fileLabel: 'Choose CSV file',
    run: (f, p) => libraryService.importGoodreads(f, p),
    steps: [
      <>Go to <a href="https://www.goodreads.com/review/import" target="_blank" rel="noreferrer" className="text-nonsprimary underline">Goodreads → My Books → Import/Export</a>.</>,
      <>Click <b className="text-[var(--text)]">Export Library</b> and wait for the CSV to generate.</>,
      <>Download the file, then upload it here.</>,
    ],
  },
  bookdiarycsv: {
    name: 'Book Diary Pro',
    sub: 'CSV export',
    accept: '.csv,text/csv',
    fileLabel: 'Choose CSV file',
    run: (f, p) => libraryService.importBookDiary(f, p),
    steps: [
      <>Open <b className="text-[var(--text)]">Book Diary Pro</b> → Settings → Export.</>,
      <>Export your books as a <b className="text-[var(--text)]">CSV</b> file.</>,
      <>Save/share the file, then upload it here.</>,
    ],
  },
  bookdiarydb: {
    name: 'Book Diary Pro',
    sub: '.db file',
    accept: '.db',
    fileLabel: 'Choose .db file',
    run: (f, p) => libraryService.importBookDiaryDB(f, p),
    steps: [
      <>On your device, locate the <b className="text-[var(--text)]">Book Diary Pro</b> database — usually named <b className="text-[var(--text)]">book-diary-pro.db</b>.</>,
      <>On iOS you can share it via Files; on Android it's under the app's data folder.</>,
      <>Upload the <b className="text-[var(--text)]">.db</b> file here — no export step needed.</>,
    ],
  },
  storygraph: {
    name: 'StoryGraph',
    sub: 'CSV export',
    accept: '.csv,text/csv',
    fileLabel: 'Choose CSV file',
    run: (f, p) => libraryService.importStoryGraph(f, p),
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
  const [progress, setProgress] = useState<ImportJob | null>(null)
  const [result, setResult] = useState<ImportJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const reset = () => { setStep('choose'); setFile(null); setResult(null); setError(null); setBusy(false); setProgress(null) }
  const close = () => { reset(); onClose() }
  const back = () => {
    setError(null); setResult(null); setFile(null); setProgress(null)
    if (step === 'upload') {
      const isBookDiary = source === 'bookdiarycsv' || source === 'bookdiarydb'
      setStep(isBookDiary ? 'bookdiary' : 'books')
    } else if (step === 'bookdiary') {
      setStep('books')
    } else {
      setStep('choose')
    }
  }

  const pick = (key: SourceKey) => { setSource(key); setStep('upload') }

  const doImport = async () => {
    if (!file) return
    setBusy(true); setError(null); setProgress(null)
    try {
      const sum = await SOURCES[source].run(file, setProgress)
      setResult(sum)
      onImported()
    } catch (e) {
      setError((e as Error)?.message || t('importFailed') || 'Import failed — make sure the file is correct.')
    } finally {
      setBusy(false); setProgress(null)
    }
  }

  const card = 'flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 text-sm font-medium text-[var(--text)] transition-colors'
  const row = 'flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-left transition-colors hover:border-nonsprimary hover:bg-[var(--primary-soft)]'

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
            <button onClick={() => pick('goodreads')} className={row}>
              <span>
                <span className="block font-medium text-[var(--text)]">Goodreads</span>
                <span className="text-xs text-[var(--text-muted)]">CSV export</span>
              </span>
              <IoChevronForward className="h-4 w-4 text-[var(--text-muted)]" />
            </button>
            <button onClick={() => setStep('bookdiary')} className={row}>
              <span>
                <span className="block font-medium text-[var(--text)]">Book Diary Pro</span>
                <span className="text-xs text-[var(--text-muted)]">CSV export or .db file</span>
              </span>
              <IoChevronForward className="h-4 w-4 text-[var(--text-muted)]" />
            </button>
            <button onClick={() => pick('storygraph')} className={row}>
              <span>
                <span className="block font-medium text-[var(--text)]">StoryGraph</span>
                <span className="text-xs text-[var(--text-muted)]">CSV export</span>
              </span>
              <IoChevronForward className="h-4 w-4 text-[var(--text-muted)]" />
            </button>
          </div>
        )}

        {/* Step 2b — Book Diary Pro format submenu */}
        {step === 'bookdiary' && (
          <div className="flex flex-col gap-2">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Book Diary Pro</p>
            <button onClick={() => pick('bookdiarycsv')} className={row}>
              <span>
                <span className="block font-medium text-[var(--text)]">CSV export</span>
                <span className="text-xs text-[var(--text-muted)]">Settings → Export → CSV</span>
              </span>
              <IoChevronForward className="h-4 w-4 text-[var(--text-muted)]" />
            </button>
            <button onClick={() => pick('bookdiarydb')} className={row}>
              <span>
                <span className="block font-medium text-[var(--text)]">.db file</span>
                <span className="text-xs text-[var(--text-muted)]">Native database — no export needed</span>
              </span>
              <IoChevronForward className="h-4 w-4 text-[var(--text-muted)]" />
            </button>
          </div>
        )}

        {/* Step 3 — upload (per source) */}
        {step === 'upload' && !result && (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-[var(--text)]">
              {SOURCES[source].name}
              <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">{SOURCES[source].sub}</span>
            </p>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-[var(--text-muted)]">
              {SOURCES[source].steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>

            <input ref={fileRef} type="file" accept={SOURCES[source].accept} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] transition-colors hover:border-nonsprimary"
            >
              <IoCloudUploadOutline className="h-5 w-5" />
              {file ? file.name : (t('chooseFile') || SOURCES[source].fileLabel)}
            </button>

            {error && <p className="text-sm text-nonslightred">{error}</p>}

            {/* Live progress: the import runs as a background job we poll, so a big
                library shows a moving bar instead of timing out the request. */}
            {busy && (
              <div className="flex flex-col gap-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                  <div
                    className="h-full rounded-full bg-nonsprimary transition-all duration-300"
                    style={{ width: `${progress && progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 5}%` }}
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {progress && progress.total > 0
                    ? `${progress.processed} / ${progress.total} ${t('booksImported') || 'books imported'}`
                    : (t('importing') || 'Importing…')}
                </p>
              </div>
            )}

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
