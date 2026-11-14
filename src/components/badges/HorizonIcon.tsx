import type { IconBaseProps } from 'react-icons'

// The Horizon rings as a react-icons-style icon: it takes `className`, `style` and
// `size` like any icon from the set and draws in the current text colour, so it can
// sit in the bubble icon palette next to the others and take the bubble's accent.
// (HorizonBadge is the fixed amber version used for the member badge.)
export default function HorizonIcon({ size = '1em', className, style, ...rest }: IconBaseProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      style={style}
      aria-hidden
      {...(rest as object)}
    >
      <circle cx="8" cy="8" r="6.5" />
      <circle cx="8" cy="8" r="3.5" />
    </svg>
  )
}
