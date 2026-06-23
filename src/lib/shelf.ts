import type { MediaType, ShelfStatus } from '../types'

type TFn = (key: string, vars?: Record<string, string | number>) => string

export const STATUS_ORDER: ShelfStatus[] = ['wishlist', 'active', 'done', 'dnf']

export const STATUS_COLOR: Record<ShelfStatus, string> = {
  wishlist: '#6768ab',
  active: '#f5a623',
  done: '#3ec98a',
  dnf: '#647da3', // a muted, "boring" steel blue — abandoned reads
}

/** Human, type-aware label for a shelf status (book vs film phrasing). */
export function statusLabel(type: MediaType, status: ShelfStatus | undefined, t: TFn): string {
  if (!status) return t('shelfWishlist')
  const isBook = type === 'book'
  switch (status) {
    case 'wishlist':
      return isBook ? t('wantToRead') : t('wantToWatch')
    case 'active':
      return isBook ? t('reading') : t('watching')
    case 'done':
      return isBook ? t('read') : t('watched')
    case 'dnf':
      return t('didNotFinish')
  }
}
