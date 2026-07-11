'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { BsThreeDots } from 'react-icons/bs'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onClick?: () => void
  danger?: boolean
  divider?: boolean
}

interface DropdownMenuProps {
  items: MenuItem[]
  className?: string
  buttonClassName?: string
  menuClassName?: string
  align?: 'left' | 'right'
}

// Three-dots overflow menu (ported from nons-client). Closes on outside click;
// each item runs its onClick then dismisses. `danger` items render in red.
export default function DropdownMenu({
  items,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  align = 'right',
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleItemClick = (item: MenuItem) => {
    item.onClick?.()
    setIsOpen(false)
  }

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className={`rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--border-subtle)] hover:text-[var(--text)] ${buttonClassName}`}
      >
        <BsThreeDots className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          className={`animate-fade-up absolute top-full z-50 mt-1 w-max rounded-xl border border-[var(--border)] bg-[var(--container)] py-1 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'} ${menuClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, index) => (
            <div key={index}>
              {item.divider && <div className="my-1 border-t border-[var(--border)]" />}
              <button
                onClick={() => handleItemClick(item)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--border-subtle)] hover:text-[var(--text)]"
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
