import Avatar from 'boring-avatars'

// Same palette and default variant as nons-client's BoringAvatar
// (src/components/ui/BoringAvatar.tsx) — keep the two in sync so a user's
// fallback avatar looks identical whether they're on nons or nons-library.
const COLORS = ['#6768ab', '#080808', '#4A90A4', '#ff7b00', '#39ff9c', '#E8F0F3']

type Props = {
  name: string
  size?: number
  variant?: 'marble' | 'beam' | 'pixel' | 'sunset' | 'ring' | 'bauhaus'
  square?: boolean
  className?: string
}

export default function BoringAvatar({ name, size = 32, variant = 'bauhaus', square = false, className = '' }: Props) {
  return <Avatar size={size} name={name} variant={variant} colors={COLORS} square={square} className={className} />
}
