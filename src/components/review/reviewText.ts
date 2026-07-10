// Flatten a review to plain text — dropping bold/italic/spoiler markup. Used
// where rich rendering makes no sense: exported share-card images (static, so a
// spoiler could never be revealed) and any other text-only surface.
export function reviewToPlainText(value: string): string {
  if (!value) return ''
  // Not HTML — already plain text.
  if (!/<[a-z][\s\S]*>/i.test(value)) return value
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(value, 'text/html')
    return (doc.body.textContent || '').trim()
  }
  // SSR fallback: strip tags and collapse whitespace.
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
