import type { Metadata } from 'next'
import Feed from '@/screens/Feed'

// Server Component on purpose — metadata exports aren't allowed from a
// 'use client' file, and this used to be one (Feed.tsx itself now carries its
// own 'use client' directive so it doesn't need to inherit the boundary from
// here). RequireAuth (providers.tsx) still renders nothing until mount and
// shows the client-only Login screen for signed-out visitors, so this only
// fixes the <title>/description/OG tags, not full SSR of the landing copy —
// providers.tsx's own comment already flags that as a separate follow-up.
// Description/keywords are paraphrased from the real signed-out landing copy
// (landingTitle/landingSubtitle etc. in src/lib/locales/en.ts), not invented.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://shelf.nonsapp.com').replace(/\/+$/, '')

export const metadata: Metadata = {
  title: 'Nons Shelf — Every Book and Film You Love, on One Shelf',
  description:
    'Track what you read and watch, rate it, and see what your friends on nons are into — one shelf for books and films instead of switching between Goodreads and Letterboxd.',
  keywords: [
    'Nons Shelf',
    'book and film tracker',
    'book and movie tracker',
    'shelf for books and movies',
    'Goodreads and Letterboxd alternative',
    'track what you read and watch',
    'movie and book ratings with friends',
    'shared media catalog',
    'no ads no tracking media tracker',
  ],
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: 'Nons Shelf — Every Book and Film You Love, on One Shelf',
    description:
      'Track what you read and watch, rate it, and see what your friends on nons are into — without the noise.',
    siteName: 'Nons Shelf',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: 'Nons Shelf — Every Book and Film You Love, on One Shelf',
    description:
      'Track what you read and watch, rate it, and see what your friends on nons are into — without the noise.',
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function Page() {
  return <Feed />
}
