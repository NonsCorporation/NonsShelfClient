import { PROFILE_IMAGE_SIZE, renderProfileImage } from '@/lib/profileSeo'

// Link-preview image for /u/<username> (see lib/profileSeo.tsx).
export const alt = 'SomeShelf profile'
export const size = PROFILE_IMAGE_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return renderProfileImage(decodeURIComponent(id))
}
