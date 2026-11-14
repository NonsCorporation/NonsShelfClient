'use client'

import { useEffect, useState } from 'react'
import { IoArrowUp } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'

// A floating "back to top" button: it appears once the page has been scrolled
// a while and smoothly scrolls back up. On phones it sits above the floating
// bottom navigation.
export default function ScrollToTop({ threshold = 700 }: { threshold?: number }) {
  const { t } = useLanguage()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('scrollToTop')}
      title={t('scrollToTop')}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-28 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--container)] text-[var(--text)] shadow-xl transition-all duration-200 hover:border-nonsprimary hover:text-nonsprimary lg:bottom-6 lg:right-6 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <IoArrowUp className="h-5 w-5" />
    </button>
  )
}
