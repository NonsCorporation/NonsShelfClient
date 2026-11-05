import type { Language } from '@/contexts/LanguageContext'
import LanguagePicker from './LanguagePicker'

// The app's UI language (header menu, settings). Same picker as every other
// language field — flags, native + English names, type-to-search — limited to
// the languages the interface is translated into.
const UI_LANGUAGES: Language[] = ['en', 'ru', 'ro']

export default function LanguageSelect({ value, onChange }: { value: Language; onChange: (v: Language) => void }) {
  return <LanguagePicker value={value} onChange={(code) => onChange(code as Language)} options={UI_LANGUAGES} />
}
