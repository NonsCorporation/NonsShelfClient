import { useEffect, useRef, useState } from 'react'
import { IoClose, IoWarningOutline } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'

type Props = {
  isOpen: boolean
  onClose: () => void
  /** Called with the decoded ISBN/EAN digits once a barcode is read. */
  onDetected: (isbn: string) => void
}

// Camera-based ISBN barcode scanner (book barcodes are EAN-13). Lazily loads
// @zxing/browser so the decoder + its wasm-ish internals never hit the bundle
// for users who never open the scanner.
export default function BarcodeScannerModal({ isOpen, onClose, onDetected }: Props) {
  const { t } = useLanguage()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setError('')

    ;(async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        if (cancelled || !videoRef.current) return
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (result) {
            const text = result.getText().trim()
            if (text) onDetected(text)
          }
        })
        controlsRef.current = controls
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [isOpen, onDetected])

  if (!isOpen) return null

  return (
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--container)]"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--divider)] bg-[var(--surface)] px-5 py-4">
          <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">{t('scanBarcode')}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] transition-colors hover:bg-[var(--surface-hover)]">
            <IoClose className="h-5 w-5 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="p-5">
          {error ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-8 text-center text-sm text-red-500">
              <IoWarningOutline className="h-6 w-6" />
              {error}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl bg-black">
                <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
              </div>
              <p className="mt-3 text-center text-xs text-[var(--text-muted)]">{t('scanBarcodeHint')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
