'use client'

import Profile from '@/screens/Profile'

// The profile screen is interactive (and behind sign-in); the route's server
// page.tsx wraps it so it can add SEO metadata around it.
export default function ProfileClient() {
  return <Profile />
}
