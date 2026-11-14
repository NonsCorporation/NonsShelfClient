import BannerArt from './BannerArt'
import { BANNER_SIZE } from '@/lib/bannerSize'

// The banner on a profile card: a plain flat colour.
//
// It is the card's first child and stays inside the card: the -mx/-mt cancel the
// card's padding so it runs edge to edge along the top, with the card's rounded
// top corners. Its size comes from BANNER_SIZE.page (lib/bannerSize.ts) — a ratio on
// phones and a plain height from sm up, not a ratio plus max-height, because that
// would shrink the width too and leave the banner narrower than the card.
export default function ProfileBanner(props: { color?: string | null; avatarUrl?: string | null; avatarSeed: string }) {
  return <BannerArt {...props} className={`-mx-5 -mt-5 rounded-t-2xl sm:-mx-6 sm:-mt-6 ${BANNER_SIZE.page}`} />
}
