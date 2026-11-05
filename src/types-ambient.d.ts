declare module 'country-flag-icons/string/3x2/*' {
  const svg: string
  export default svg
}

declare module 'arabic-persian-reshaper' {
  export const ArabicShaper: { convertArabic(text: string): string }
  export const PersianShaper: { convertArabic(text: string): string }
}

declare module 'bidi-js' {
  type Levels = { levels: Uint8Array; paragraphs: { start: number; end: number; level: number }[] }
  export default function bidiFactory(): {
    getEmbeddingLevels(text: string, explicitDirection?: 'ltr' | 'rtl'): Levels
    getReorderedString(text: string, levels: Levels, start?: number, end?: number): string
  }
}
