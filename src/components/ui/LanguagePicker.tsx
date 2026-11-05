import { useEffect, useMemo, useRef, useState } from 'react'
import { IoCheckmark, IoChevronDown, IoLanguageOutline } from 'react-icons/io5'
import { LangFlag } from './Flag'
import { MEDIA_LANG_OPTIONS, langNames } from '@/lib/mediaLangs'

// One language picker for the whole app (film/series language, preferred media
// language, edition language, name language…), replacing native <select>s so
// the menu matches the app instead of the OS chrome and shows flags.
//
// Search is invisible on purpose: there's no input box. Open the menu (or just
// focus it) and type — "rus", "рус", "ja" — and the matching language is
// highlighted; Enter picks it. Matches the native name, the English name or the
// code, so it works from any keyboard layout. Arrows/Home/End/Esc work as in a
// native select.

const COMMON_CODES = MEDIA_LANG_OPTIONS.map((o) => o.code)
const TYPE_RESET_MS = 900
const MENU_MAX_PX = 288 // max-h-72, used to decide whether to flip upwards

type Item = { code: string; native: string; english: string; keys: string[] }

type Props = {
  value: string
  onChange: (code: string) => void
  /** Language codes to offer. Defaults to the common list. */
  options?: string[]
  /** Label of the "no choice" entry (value ''); omit to not offer one. */
  emptyLabel?: string
  /** `inline`: small uppercase text link (page meta rows). `field`: a form field. */
  variant?: 'inline' | 'field'
  /** Text size of the inline variant. */
  size?: 'sm' | 'md'
  title?: string
  className?: string
  /** Which edge of the trigger the menu lines up with (inline variant). */
  align?: 'left' | 'right'
  disabled?: boolean
}

export default function LanguagePicker({
  value,
  onChange,
  options,
  emptyLabel,
  variant = 'field',
  size = 'sm',
  title,
  className = '',
  align = 'left',
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [openUp, setOpenUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const typed = useRef('')
  const typedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const items = useMemo<Item[]>(() => {
    const codes = [...(options ?? COMMON_CODES)]
    // Keep a current value that isn't in the list (odd legacy code) selectable.
    if (value && !codes.includes(value)) codes.unshift(value)
    const langs = codes.map((code) => {
      const { native, english } = langNames(code)
      return { code, native, english, keys: [native.toLowerCase(), english.toLowerCase(), code.toLowerCase()] }
    })
    return emptyLabel !== undefined ? [{ code: '', native: emptyLabel, english: '', keys: [] }, ...langs] : langs
  }, [options, emptyLabel, value])

  const current = items.find((i) => i.code === value) ?? items[0]

  const openMenu = () => {
    if (disabled) return
    const rect = rootRef.current?.getBoundingClientRect()
    setOpenUp(!!rect && window.innerHeight - rect.bottom < MENU_MAX_PX && rect.top > window.innerHeight - rect.bottom)
    setActive(Math.max(0, items.findIndex((i) => i.code === value)))
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    typed.current = ''
  }
  const pick = (item: Item) => {
    onChange(item.code)
    close()
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  useEffect(() => () => clearTimeout(typedTimer.current), [])

  // Index of the best match for what's been typed: names starting with it win
  // over names merely containing it.
  const find = (q: string) => {
    const hit = items.findIndex((i) => i.keys.some((k) => k.startsWith(q)))
    return hit >= 0 ? hit : items.findIndex((i) => i.keys.some((k) => k.includes(q)))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || e.ctrlKey || e.metaKey || e.altKey) return
    const k = e.key

    // Printable key (a space only continues a word already being typed).
    if ((k.length === 1 && k !== ' ') || (k === ' ' && typed.current) || (k === 'Backspace' && typed.current)) {
      e.preventDefault()
      typed.current = k === 'Backspace' ? typed.current.slice(0, -1) : typed.current + k.toLowerCase()
      clearTimeout(typedTimer.current)
      typedTimer.current = setTimeout(() => (typed.current = ''), TYPE_RESET_MS)
      if (!open) openMenu()
      const hit = typed.current ? find(typed.current) : -1
      if (hit >= 0) setActive(hit)
      return
    }

    switch (k) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault()
        if (!open) return openMenu()
        const d = k === 'ArrowDown' ? 1 : -1
        setActive((a) => (a + d + items.length) % items.length)
        break
      }
      case 'Home':
      case 'End':
        if (!open) return
        e.preventDefault()
        setActive(k === 'Home' ? 0 : items.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open) pick(items[active])
        else openMenu()
        break
      case 'Escape':
        if (open) {
          e.preventDefault()
          e.stopPropagation() // don't also close a modal this sits in
          close()
        }
        break
      case 'Tab':
        close()
        break
    }
  }

  const inline = variant === 'inline'
  const triggerCls = inline
    ? `inline-flex items-center gap-1.5 uppercase tracking-widest text-[var(--text-muted)] transition-colors hover:text-[var(--text)] focus-visible:text-[var(--text)] focus:outline-none ${
        size === 'md' ? 'text-xs' : 'text-[10px]'
      }`
    : 'flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--text)] transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-nonsprimary disabled:opacity-50'
  const chevronCls = inline ? (size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5') : 'h-3.5 w-3.5 text-[var(--text-muted)]'

  return (
    <div ref={rootRef} className={`relative ${inline ? 'inline-flex' : ''} ${className}`}>
      <button
        type="button"
        title={title}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={triggerCls}
      >
        <span className="flex min-w-0 items-center gap-2">
          {current.code ? (
            <LangFlag lang={current.code} />
          ) : (
            <IoLanguageOutline className={inline ? (size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3') : 'h-4 w-4 text-[var(--text-muted)]'} />
          )}
          <span className="truncate">{current.native}</span>
        </span>
        <IoChevronDown className={`flex-shrink-0 transition-transform ${chevronCls} ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          // Keep focus on the trigger so typing keeps working while the menu is open.
          onMouseDown={(e) => e.preventDefault()}
          className={`animate-fade-up absolute z-50 max-h-72 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--container)] py-1 text-sm normal-case tracking-normal shadow-xl ${
            openUp ? 'bottom-full mb-1' : 'top-full mt-1'
          } ${inline ? 'min-w-[14rem]' : 'w-full'} ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {items.map((item, i) => {
            const selected = item.code === value
            return (
              <div
                key={item.code || '__empty'}
                role="option"
                aria-selected={selected}
                data-i={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(item)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 ${
                  i === active ? 'bg-[var(--border-subtle)] text-[var(--text)]' : 'text-[var(--text-muted)]'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {item.code ? <LangFlag lang={item.code} /> : <IoLanguageOutline className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate">{item.native}</span>
                  {item.code && item.english && item.english !== item.native && (
                    <span className="truncate text-xs text-[var(--placeholder)]">{item.english}</span>
                  )}
                </span>
                {selected && <IoCheckmark className="h-4 w-4 flex-shrink-0 text-nonsprimary" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
