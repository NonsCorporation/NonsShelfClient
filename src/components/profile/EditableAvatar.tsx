import { useRef } from 'react'
import type { ReactNode } from 'react'
import { IoCameraOutline, IoCloseOutline } from 'react-icons/io5'

type Props = {
  /** The avatar itself (image or generated placeholder), already sized. */
  children: ReactNode
  /** Shows the change control (own profile, premium). */
  editable: boolean
  /** Whether a custom photo is set, i.e. there's something to reset. */
  hasCustom: boolean
  onPick: (file: File) => void
  onReset: () => void
  changeLabel: string
  resetLabel: string
  className?: string
}

// Wraps the profile avatar with a camera badge (always visible, so it works on
// touch) that opens the file picker, and a reset badge once a custom photo is set.
export default function EditableAvatar({ children, editable, hasCustom, onPick, onReset, changeLabel, resetLabel, className = '' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  if (!editable) return <div className={`flex-shrink-0 ${className}`}>{children}</div>

  return (
    <div className={`group/avatar relative flex-shrink-0 ${className}`}>
      {children}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={changeLabel}
        title={changeLabel}
        className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--container)] bg-nonsprimary text-white transition-colors hover:bg-nonsprimaryfocus"
      >
        <IoCameraOutline className="h-3.5 w-3.5" />
      </button>
      {hasCustom && (
        <button
          type="button"
          onClick={onReset}
          aria-label={resetLabel}
          title={resetLabel}
          className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--container)] bg-[var(--surface-active)] text-[var(--text)] transition-colors hover:bg-[var(--border-strong)]"
        >
          <IoCloseOutline className="h-3.5 w-3.5" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onPick(file)
        }}
      />
    </div>
  )
}
