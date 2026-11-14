'use client'

import { useState } from 'react'
import { IoColorPaletteOutline, IoImageOutline } from 'react-icons/io5'
import { Link } from '@/lib/router'
import { bannerCss, bannerStored, defaultBannerColor, hslToHex, textOn } from '@/lib/bannerColor'
import { hashHue } from '@/lib/hashHue'
import { HORIZON_ON } from '@/lib/horizon'
import { useAvatarColor } from '@/lib/useAvatarColor'
import { useToast } from '@/components/ui/Toast'
import HorizonBadge from '@/components/badges/HorizonBadge'
import ColorPicker from '@/components/ui/ColorPicker'
import { useLanguage } from '@/contexts/LanguageContext'

// Swatches: the banner colours you can pick, bright enough to tell apart on the dark
// panel. Stored form ("F12312") so they compare directly with the chosen colour.
const SWATCHES = [0, 28, 140, 190, 225, 285].map((h) => bannerStored(hslToHex(`hsl(${h} 55% 40%)`)))

const ROW = 'flex items-center gap-1.5'
const PILL = 'rounded-xl border border-white/10 bg-black/55 shadow-lg backdrop-blur-md'

// The banner's edit button, Discord-style. Line one: "Auto" (the colour of the
// profile picture), colour swatches and a custom colour (the shared ColorPicker:
// picker area plus a hex field). Line two: upload an image, which is a Horizon
// feature — marked with the Horizon icon; for non-members it leads to /horizon.
// Place it inside the banner's `relative` box (which must not clip it: the colour
// picker hangs below the banner).
//
// Controlled: `color` is the stored value ("F12312", or "" for automatic) and
// `onChange` gets the new one; saving it is the caller's job. Image upload isn't
// built yet and just says "soon".
export default function BannerEditor({
  color,
  onChange,
  avatarUrl,
  avatarSeed,
  horizon,
}: {
  color: string
  onChange: (stored: string) => void
  avatarUrl?: string | null
  avatarSeed: string
  horizon: boolean
}) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const toast = useToast()
  const chosen = bannerCss(color) ? color.toUpperCase() : ''
  // What "Auto" gives: the profile picture's dominant colour (the photo, or the generated avatar).
  const dominant = useAvatarColor(avatarUrl, avatarSeed)
  const autoColor = dominant ?? defaultBannerColor(hashHue(avatarSeed))
  const current = bannerCss(chosen) ?? hslToHex(autoColor)
  const custom = chosen !== '' && !SWATCHES.includes(chosen)

  return (
    <div className="absolute right-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] items-start gap-2">
      {open && (
        <div className={`relative flex min-w-0 flex-col gap-2 p-2.5 ${PILL}`}>
          {/* line 1: colour */}
          <div className={`${ROW} gap-2`}>
            {/* Auto: coloured as the profile picture's dominant colour, with black or white text for contrast */}
            <button
              type="button"
              onClick={() => onChange('')}
              aria-pressed={chosen === ''}
              title={t('bannerColorAutoHint')}
              className={`flex-shrink-0 rounded-md border-2 px-2 py-0.5 text-[11px] font-semibold transition-transform hover:scale-105 ${chosen === '' ? 'border-white' : 'border-white/25'}`}
              style={{ background: autoColor, color: textOn(autoColor) }}
            >
              {t('bannerColorAuto')}
            </button>
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                aria-label={`#${c}`}
                aria-pressed={chosen === c}
                className={`h-6 w-6 flex-shrink-0 rounded-full border-2 transition-transform hover:scale-110 ${chosen === c ? 'border-white' : 'border-white/25'}`}
                style={{ background: `#${c}` }}
              />
            ))}
            <button
              type="button"
              onClick={() => setPicking((v) => !v)}
              aria-label={t('bannerCustomColor')}
              aria-expanded={picking}
              title={t('bannerCustomColor')}
              className={`h-6 w-6 flex-shrink-0 rounded-full border-2 transition-transform hover:scale-110 ${custom || picking ? 'border-white' : 'border-white/25'}`}
              style={{ background: 'conic-gradient(#f43f5e, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #f43f5e)' }}
            />
          </div>

          {/* line 2: upload — a Horizon feature */}
          {HORIZON_ON &&
            (horizon ? (
              <button
                type="button"
                onClick={() => toast.show(t('soon'))}
                className="flex items-center gap-2 rounded-lg bg-white/10 px-2 py-1 text-left text-[11px] font-medium text-white transition-colors hover:bg-white/20"
              >
                <IoImageOutline className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="flex-1">{t('bannerUploadImage')}</span>
                <HorizonBadge className="h-3.5 w-3.5" />
              </button>
            ) : (
              <Link
                to="/horizon"
                title={t('bannerHorizonOnly')}
                className="flex items-center gap-2 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                <IoImageOutline className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="flex-1">{t('bannerUploadImage')}</span>
                <HorizonBadge className="h-3.5 w-3.5" />
              </Link>
            ))}

          {/* the custom colour picker hangs below the panel */}
          {picking && (
            <div className="absolute right-0 top-full z-30 mt-2 rounded-xl border border-white/15 bg-[var(--container)] p-2 shadow-xl">
              <ColorPicker color={current} onChange={(hex) => onChange(bannerStored(hex))} />
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          setPicking(false)
        }}
        aria-expanded={open}
        aria-label={t('bannerEdit')}
        title={t('bannerEdit')}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/65"
      >
        <IoColorPaletteOutline className="h-4 w-4" />
      </button>
      {toast.node}
    </div>
  )
}
