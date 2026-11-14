'use client'

import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'

const HEX6 = /^#[0-9a-f]{6}$/i
const HEX3 = /^#[0-9a-f]{3}$/i

/** "f12" / "#F12" / "#f12312" → "#f12312"; null when it isn't a hex colour yet. */
function normalise(text: string): string | null {
  const t = text.trim()
  const h = t.startsWith('#') ? t : `#${t}`
  if (HEX6.test(h)) return h.toLowerCase()
  if (HEX3.test(h)) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`.toLowerCase()
  return null
}

// A reusable colour picker: a saturation/hue area (react-colorful) with a hex
// field underneath (type "#f12312" or "f12312"; it applies as soon as it is a
// valid colour). `color` is a #rrggbb string; `onChange` gets one too.
export default function ColorPicker({
  color,
  onChange,
  width = 200,
  className = '',
}: {
  color: string
  onChange: (hex: string) => void
  /** Width in px of the picker area and the field. */
  width?: number
  className?: string
}) {
  // While the field has focus it shows what is being typed; otherwise it follows `color`,
  // so dragging in the area updates it live.
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? color
  const invalid = draft !== null && normalise(draft) === null

  return (
    <div className={`flex flex-col gap-2 ${className}`} style={{ width }}>
      <HexColorPicker color={color} onChange={onChange} style={{ width, height: Math.round(width * 0.75) }} />
      <input
        type="text"
        value={shown}
        spellCheck={false}
        maxLength={7}
        aria-label="Hex colour"
        aria-invalid={invalid}
        placeholder="#f12312"
        onFocus={() => setDraft(color)}
        onChange={(e) => {
          setDraft(e.target.value)
          const hex = normalise(e.target.value)
          if (hex) onChange(hex)
        }}
        onBlur={() => setDraft(null)}
        className={`h-8 w-full rounded-md border bg-black/25 px-2 font-mono text-xs text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] ${
          invalid ? 'border-red-500/70' : 'border-[var(--border-subtle)]'
        }`}
      />
    </div>
  )
}
