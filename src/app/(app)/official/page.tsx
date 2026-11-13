import type { Metadata } from 'next'
import Official from '@/screens/Official'

// /official — challenges, bingos and lists curated by SomeShelf itself.
export const metadata: Metadata = {
  title: 'Official :: SomeShelf',
  description: 'Challenges, bingos and lists curated by SomeShelf.',
}

export default function Page() {
  return <Official />
}
