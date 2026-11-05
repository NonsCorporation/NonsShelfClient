import { IoGlobeOutline } from 'react-icons/io5'
import AD from 'country-flag-icons/string/3x2/AD'
import AL from 'country-flag-icons/string/3x2/AL'
import AM from 'country-flag-icons/string/3x2/AM'
import AZ from 'country-flag-icons/string/3x2/AZ'
import BD from 'country-flag-icons/string/3x2/BD'
import BG from 'country-flag-icons/string/3x2/BG'
import BY from 'country-flag-icons/string/3x2/BY'
import CN from 'country-flag-icons/string/3x2/CN'
import CZ from 'country-flag-icons/string/3x2/CZ'
import DE from 'country-flag-icons/string/3x2/DE'
import DK from 'country-flag-icons/string/3x2/DK'
import EE from 'country-flag-icons/string/3x2/EE'
import ES from 'country-flag-icons/string/3x2/ES'
import FI from 'country-flag-icons/string/3x2/FI'
import FR from 'country-flag-icons/string/3x2/FR'
import GE from 'country-flag-icons/string/3x2/GE'
import GR from 'country-flag-icons/string/3x2/GR'
import HR from 'country-flag-icons/string/3x2/HR'
import HU from 'country-flag-icons/string/3x2/HU'
import ID from 'country-flag-icons/string/3x2/ID'
import IE from 'country-flag-icons/string/3x2/IE'
import IL from 'country-flag-icons/string/3x2/IL'
import IN from 'country-flag-icons/string/3x2/IN'
import IR from 'country-flag-icons/string/3x2/IR'
import IS from 'country-flag-icons/string/3x2/IS'
import IT from 'country-flag-icons/string/3x2/IT'
import JP from 'country-flag-icons/string/3x2/JP'
import KR from 'country-flag-icons/string/3x2/KR'
import KZ from 'country-flag-icons/string/3x2/KZ'
import LT from 'country-flag-icons/string/3x2/LT'
import LV from 'country-flag-icons/string/3x2/LV'
import MK from 'country-flag-icons/string/3x2/MK'
import MY from 'country-flag-icons/string/3x2/MY'
import NL from 'country-flag-icons/string/3x2/NL'
import NO from 'country-flag-icons/string/3x2/NO'
import PK from 'country-flag-icons/string/3x2/PK'
import PL from 'country-flag-icons/string/3x2/PL'
import PT from 'country-flag-icons/string/3x2/PT'
import RO from 'country-flag-icons/string/3x2/RO'
import RS from 'country-flag-icons/string/3x2/RS'
import RU from 'country-flag-icons/string/3x2/RU'
import SA from 'country-flag-icons/string/3x2/SA'
import SE from 'country-flag-icons/string/3x2/SE'
import SI from 'country-flag-icons/string/3x2/SI'
import SK from 'country-flag-icons/string/3x2/SK'
import TH from 'country-flag-icons/string/3x2/TH'
import TR from 'country-flag-icons/string/3x2/TR'
import UA from 'country-flag-icons/string/3x2/UA'
import UZ from 'country-flag-icons/string/3x2/UZ'
import LU from 'country-flag-icons/string/3x2/LU'
import US from 'country-flag-icons/string/3x2/US'
import VA from 'country-flag-icons/string/3x2/VA'
import VN from 'country-flag-icons/string/3x2/VN'

// Flags as images, not emoji: Windows has no flag emoji (they show as "US",
// "RU" letter pairs), so the same UI would look different per OS.
const SVGS: Record<string, string> = { UZ, LU, AD, AL, AM, AZ, BD, BG, BY, CN, CZ, DE, DK, EE, ES, FI, FR, GE, GR, HR, HU, ID, IE, IL, IN, IR, IS, IT, JP, KR, KZ, LT, LV, MK, MY, NL, NO, PK, PL, PT, RO, RS, RU, SA, SE, SI, SK, TH, TR, UA, US, VA, VN }

// A language isn't a country; this picks the flag people expect for each one.
const LANG_COUNTRY: Record<string, string> = {
  uz: 'UZ', lb: 'LU',
  en: 'US', ru: 'RU', de: 'DE', fr: 'FR', es: 'ES', it: 'IT', pt: 'PT', ja: 'JP', ko: 'KR', zh: 'CN', ar: 'SA', tr: 'TR', pl: 'PL', nl: 'NL', sv: 'SE', da: 'DK', fi: 'FI', nb: 'NO', no: 'NO', cs: 'CZ', uk: 'UA', ro: 'RO', el: 'GR', he: 'IL', hi: 'IN', hu: 'HU', bg: 'BG', sr: 'RS', hr: 'HR', sk: 'SK', sl: 'SI', lt: 'LT', lv: 'LV', et: 'EE', vi: 'VN', th: 'TH', id: 'ID', ms: 'MY', fa: 'IR', ka: 'GE', hy: 'AM', az: 'AZ', kk: 'KZ', be: 'BY', is: 'IS', ga: 'IE', sq: 'AL', mk: 'MK', bn: 'BD', ur: 'PK', la: 'VA', ca: 'AD',
}

const dataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

/** Flag for an ISO 3166 country code; a globe when there isn't one. */
export function Flag({ country, className = '' }: { country?: string; className?: string }) {
  const svg = country ? SVGS[country.toUpperCase()] : undefined
  if (!svg) {
    return (
      <span className={`inline-flex h-3.5 w-5 flex-shrink-0 items-center justify-center text-[var(--text-muted)] ${className}`}>
        <IoGlobeOutline className="h-3.5 w-3.5" />
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUri(svg)}
      alt=""
      draggable={false}
      className={`inline-block h-3.5 w-5 flex-shrink-0 rounded-[3px] object-cover ring-1 ring-black/15 ${className}`}
    />
  )
}

/** Flag for a language code (ISO 639-1): "ru" -> Russia, "en" -> US, ... */
export function LangFlag({ lang, className }: { lang?: string; className?: string } ) {
  return <Flag country={lang ? LANG_COUNTRY[lang.toLowerCase()] : undefined} className={className} />
}
