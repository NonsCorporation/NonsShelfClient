'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import { IoClose } from 'react-icons/io5'
import { cropToBlob } from '@/lib/cropImage'
import { useLanguage } from '@/contexts/LanguageContext'

// Pick the area of an image to keep: drag to move it, slide to zoom. `src` is an
// object URL of the chosen file; `onConfirm` gets the cropped JPEG. For an avatar
// the crop is a circle over a square area (the saved picture is the square).
export default function ImageCropModal({
  src,
  aspect = 1,
  round = true,
  outputSize = 256,
  onConfirm,
  onCancel,
}: {
  src: string
  /** Width / height of the kept area. */
  aspect?: number
  /** Show the area as a circle (an avatar) rather than a rectangle. */
  round?: boolean
  /** Width in px of the saved image (the height follows `aspect`). */
  outputSize?: number
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}) {
  const { t } = useLanguage()
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel()
    document.addEventListener('keydown', onKey)
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = prev
    }
  }, [onCancel, busy])

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), [])

  const apply = async () => {
    if (!area || busy) return
    setBusy(true)
    setFailed(false)
    try {
      onConfirm(await cropToBlob(src, area, outputSize, Math.round(outputSize / aspect)))
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return createPortal(
    <div onClick={() => !busy && onCancel()} className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--overlay)] sm:items-center sm:p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('cropTitle')}
        className="flex w-full max-w-md flex-col gap-4 rounded-t-2xl border border-[var(--border)] bg-[var(--container)] p-5 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--text)]">{t('cropTitle')}</h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t('cropHint')}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label={t('cancel')}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <div className="relative h-72 overflow-hidden rounded-xl bg-black">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={round ? 'round' : 'rect'}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <label className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          {t('cropZoom')}
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer accent-nonsprimary"
          />
        </label>

        {failed && (
          <p role="alert" className="text-xs text-red-400">
            {t('cropFailed')}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full px-5 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:opacity-40"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!area || busy}
            className="rounded-full bg-nonsprimary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-40"
          >
            {busy ? '…' : t('cropApply')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
