import BannerArt from './BannerArt'

// The banner on a Horizon member's profile card.
//
// It is the card's first child and stays inside the card: the -mx/-mt cancel the
// card's padding so it runs edge to edge along the top, with the card's rounded
// top corners. On phones it is 2:1; from sm up it has a fixed
// 13rem height — a plain height, not a ratio plus max-height, because that would
// shrink the width too and leave the banner narrower than the card.
export default function ProfileBanner({ seed }: { seed: string }) {
  return <BannerArt seed={seed} className="-mx-5 -mt-5 aspect-[2/1] rounded-t-2xl sm:-mx-6 sm:-mt-6 sm:aspect-auto sm:h-52" />
}
