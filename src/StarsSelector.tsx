import { useState, useEffect } from "react"
import { IoMdStar, IoMdStarHalf, IoMdStarOutline } from "react-icons/io"
import { IoClose } from "react-icons/io5"

type StarsSelectorProps = {
  initialValue?: number | null
  onChange?: (value: number) => void
  onClear?: () => void
  isEditable?: boolean
  size?: 'sm' | 'md'
}

export default function StarsSelector({
  initialValue = null,
  onChange = () => {},
  onClear,
  isEditable = false,
  size = 'md',
}: StarsSelectorProps) {
  const starCls = size === 'sm' ? 'w-5 h-5' : 'w-9 h-9'
  const [rating, setRating] = useState(initialValue)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    setRating(initialValue)
  }, [initialValue])

  const displayValue = hover !== null ? hover : rating

  const handleClick = (value: number) => {
    if (!isEditable) return
    setRating(value)
    onChange(value)
  }

  const handleClear = () => {
    setRating(null)
    setHover(null)
    onClear?.()
  }

  // clear hover state
  const handleMouseLeave = () => {
    if (!isEditable) return
    setHover(null)
  }

  return (
    <div className="flex items-center gap-1.5">
    <div
      className={`relative flex gap-0.2 ${displayValue === 0 || displayValue === null ? "text-gray-500" : "text-nonsprimary"} ${isEditable ? "hover:text-nonsprimaryfocus transition-colors" : ""}`}
      onMouseLeave={handleMouseLeave}
    >
      {/* create an invisible space on the left to select 0 */}
      {isEditable && (
        <div 
          className="absolute -left-3 top-0 bottom-0 w-3 cursor-pointer z-10" 
          onMouseEnter={() => setHover(0)}
          onClick={() => handleClick(0)}
        />
      )}

      {/* iterate to render 5 star containers */}
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = (index + 1) * 2
        const leftValue = starValue - 1
        const rightValue = starValue

        const isFull = displayValue ? displayValue >= starValue : false
        const isHalf = displayValue === leftValue

        return (
          <div key={index} className={`relative ${starCls}`}>
            {/* render the appropriate visual icon */}
            {isFull ? (
              <IoMdStar className="w-full h-full pointer-events-none" />
            ) : isHalf ? (
              <IoMdStarHalf className="w-full h-full pointer-events-none" />
            ) : (
              <IoMdStarOutline className="w-full h-full pointer-events-none" />
            )}

            {/* render invisible left and right hit areas */}
            {isEditable && (
              <div className="absolute inset-0 flex">
                <span
                  className="w-1/2 h-full cursor-pointer"
                  onMouseEnter={() => setHover(leftValue)}
                  onClick={() => handleClick(leftValue)}
                />
                <span
                  className="w-1/2 h-full cursor-pointer"
                  onMouseEnter={() => setHover(rightValue)}
                  onClick={() => handleClick(rightValue)}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
    {isEditable && onClear && rating != null && rating > 0 && (
      <button
        type="button"
        onClick={handleClear}
        className="flex items-center justify-center rounded-full p-0.5 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        aria-label="Clear rating"
      >
        <IoClose className="h-4 w-4" />
      </button>
    )}
    </div>
  )
}