import { useState } from "react"
import { IoMdStar, IoMdStarHalf, IoMdStarOutline } from "react-icons/io"

type StarsSelectorProps = {
  initialValue?: number
  onChange?: (value: number) => void
  isEditable?: boolean
}

export default function StarsSelector({
  initialValue = 0,
  onChange = () => {},
  isEditable = false
}: StarsSelectorProps) {
  // manage local state for rating and hover
  const [rating, setRating] = useState(initialValue)
  const [hover, setHover] = useState<number | null>(null)

  // determine the currently displayed value
  const displayValue = hover !== null ? hover : rating

  // update rating state and trigger callback
  const handleClick = (value: number) => {
    if (!isEditable) return
    setRating(value)
    onChange(value)
  }

  // clear hover state
  const handleMouseLeave = () => {
    if (!isEditable) return
    setHover(null)
  }

  return (
    <div 
      className="flex gap-0.2 text-nonsprimary"
      onMouseLeave={handleMouseLeave}
    >
      {/* create an invisible space on the left to select 0 */}
      {isEditable && (
        <div 
          className="w-3 h-9 cursor-pointer" 
          onMouseEnter={() => setHover(0)}
          onClick={() => handleClick(0)}
        />
      )}

      {/* iterate to render 5 star containers */}
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = (index + 1) * 2
        const leftValue = starValue - 1
        const rightValue = starValue

        const isFull = displayValue >= starValue
        const isHalf = displayValue === leftValue

        return (
          <div key={index} className="relative w-9 h-9">
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
  )
}