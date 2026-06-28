'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { suggestionService, type ActionType } from '../services/suggestionService'
import { IoInformationCircleOutline } from 'react-icons/io5'

interface Pending {
  actionType: ActionType
  targetId: string
  payload: unknown
  resolve: () => void
  reject: (err: Error) => void
}

interface SuggestionContextValue {
  isSuggestionMode: boolean
  suggest: (actionType: ActionType, targetId: string, payload: unknown) => Promise<void>
}

const SuggestionContext = createContext<SuggestionContextValue>({
  isSuggestionMode: false,
  suggest: async () => {},
})

export function useSuggestion() {
  return useContext(SuggestionContext)
}

// SuggestionProvider wraps a page that supports suggestion mode. When
// isSuggestionMode is true, calls to suggest() open a modal where the user
// can add an optional note before submitting to POST /api/suggestions.
export function SuggestionProvider({
  isSuggestionMode,
  children,
}: {
  isSuggestionMode: boolean
  children: ReactNode
}) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const suggest = useCallback(
    (actionType: ActionType, targetId: string, payload: unknown): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        setNote('')
        setError('')
        setPending({ actionType, targetId, payload, resolve, reject })
      }),
    [],
  )

  const handleConfirm = async () => {
    if (!pending) return
    setBusy(true)
    setError('')
    try {
      await suggestionService.submit(pending.actionType, pending.targetId, pending.payload, note)
      pending.resolve()
      setPending(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = () => {
    pending?.reject(new Error('cancelled'))
    setPending(null)
  }

  return (
    <SuggestionContext.Provider value={{ isSuggestionMode, suggest }}>
      {children}
      {pending && typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={handleCancel}
            className="fixed inset-0 z-[80] flex items-end pb-28 sm:items-center sm:pb-0 bg-[var(--overlay)] p-4 backdrop-blur-sm"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-fade-up w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--container)] p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 rounded-lg bg-amber-500/15 p-2">
                  <IoInformationCircleOutline className="h-5 w-5 text-amber-500" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-[var(--text)]">Submitting a suggestion</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    You're not a librarian, so this change will be sent for review. Librarians can
                    approve or reject it from the dashboard.
                  </p>
                </div>
              </div>

              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                Note for librarians{' '}
                <span className="font-normal text-[var(--placeholder)]">(optional)</span>
              </label>
              <textarea
                className="mb-4 h-20 w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                placeholder="e.g. Found this ISBN on the publisher's website"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                autoFocus
              />

              {error && (
                <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCancel}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={busy}
                  className="rounded-lg bg-nonsprimary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-50"
                >
                  {busy ? 'Submitting…' : 'Submit suggestion'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </SuggestionContext.Provider>
  )
}
