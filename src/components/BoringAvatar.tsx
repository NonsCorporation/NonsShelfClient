import Avatar from 'boring-avatars'

const COLORS = ['#6768ab', '#080808', '#4A90A4', '#ff7b00', '#39ff9c', '#E8F0F3']

export default function BoringAvatar({ name, size = 32, square = false }: { name: string; size?: number; square?: boolean }) {
  return <Avatar size={size} name={name} variant="bauhaus" colors={COLORS} square={square} />
}
