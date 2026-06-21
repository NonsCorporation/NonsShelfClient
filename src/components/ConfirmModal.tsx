'use client'

import { createPortal } from 'react-dom'

// Confirmation popup (ported from nons-client, adapted to the library's CSS-var
// theme). Used before destructive actions like removing a feed post.
//
// Rendered through a portal to <body>: the overlay is position:fixed, and any
// ancestor with a transform (e.g. the feed's `animate-fade-up`, whose fill-mode
// leaves a lingering translateY) would otherwise trap it to that box, blurring
// only the feed instead of the whole viewport.
export default function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  busy = false,
}: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary'
  busy?: boolean
}) {
  const isDanger = variant === 'danger'
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--container)] p-6 shadow-2xl"
      >
        <h2 className="mb-2 text-lg font-semibold text-[var(--text)]">{title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-[var(--text-muted)]">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              isDanger
                ? 'border border-red-500/30 bg-red-500/10 text-red-400 hover:border-red-500/50 hover:bg-red-500/20'
                : 'bg-nonsprimary text-white hover:bg-nonsprimaryfocus'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
