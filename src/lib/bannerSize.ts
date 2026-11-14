// How big the banner is in each place it shows. One spot to tune them, each
// independent: the profile page and the edit page use the full banner, the hover
// card a smaller strip. Values are Tailwind classes for the banner's own box
// (width is always the container's; the picture will be cropped to fit, so these
// are ratios of the view, not of the uploaded file).
export const BANNER_SIZE = {
  /** Profile page and edit page. Phones: width:height = 2:1; sm and up: a fixed height. */
  page: 'aspect-[2/1] sm:aspect-auto sm:h-52',
  /** The small preview card shown when hovering a user. */
  hover: 'h-24',
} as const
