import DOMPurify from 'dompurify'

// Chat messages are stored as plain text, or — when they use formatting — as
// the same small HTML the review editor produces (bold, italic, spoiler, quote).
// A message with no formatting is saved as plain text, so line breaks and
// pasted links behave exactly as before.

export const looksLikeHtml = (s: string) => /<\/?[a-z][^>]*>/i.test(s)

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The editor's HTML → what gets sent: plain text if nothing is formatted,
 *  otherwise the HTML itself. Empty string for an empty message. */
export function toMessageContent(editorHtml: string): string {
  if (!editorHtml || typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(editorHtml, 'text/html')
  const formatted = doc.body.querySelector('strong, em, blockquote, span[data-spoiler]')
  if (!formatted) {
    const lines = [...doc.body.children].map((block) => {
      block.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
      return block.textContent ?? ''
    })
    return lines.join('\n').trim()
  }
  return doc.body.innerHTML.replace(/(<p><\/p>)+$/, '').trim()
}

/** A stored message → HTML for the editor (to edit it): plain text becomes
 *  paragraphs; HTML is sanitised first. */
export function contentToEditorHtml(content: string): string {
  if (looksLikeHtml(content)) {
    return DOMPurify.sanitize(content, { ADD_ATTR: ['data-spoiler'] }) as string
  }
  return content
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}
