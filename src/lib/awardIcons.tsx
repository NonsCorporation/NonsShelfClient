import type { IconType } from 'react-icons'
import {
  IoTrophyOutline,
  IoMedalOutline,
  IoRibbonOutline,
  IoStarOutline,
  IoBookOutline,
  IoRocketOutline,
  IoSparklesOutline,
  IoGlobeOutline,
} from 'react-icons/io5'

// Maps a backend award-body icon key (see the award seed's `icon` field) to a
// minimal io5 glyph. Kept as a small allowlist so the backend can pick a body's
// look by key without the frontend importing a new icon per award; anything
// unknown falls back to the trophy.
const REGISTRY: Record<string, IconType> = {
  trophy: IoTrophyOutline,
  medal: IoMedalOutline,
  ribbon: IoRibbonOutline,
  star: IoStarOutline,
  book: IoBookOutline,
  rocket: IoRocketOutline,
  sparkles: IoSparklesOutline,
  globe: IoGlobeOutline,
}

export function awardIcon(key: string): IconType {
  return REGISTRY[key] ?? IoTrophyOutline
}
