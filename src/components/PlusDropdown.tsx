import { useState, useRef, useEffect } from 'react'
import { PlusIcon, PhotoIcon, BookmarkIcon, LinkIcon, RectangleStackIcon } from '@heroicons/react/24/outline'
import { createPortal } from 'react-dom'

interface PlusDropdownProps {
  onCreatePost: () => void
  onSaveHub?: () => void
  onEmbedFrom?: () => void
  onCreateList?: () => void
  variant?: 'main' | 'list' // 'main' for navbar, 'list' for list pages
}

const PlusDropdown: React.FC<PlusDropdownProps> = ({ onCreatePost, onSaveHub, onEmbedFrom, onCreateList, variant = 'list' }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && 
          dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [isOpen])

  const handleCreatePost = () => {
    setIsOpen(false)
    onCreatePost()
  }

  const handleSaveHub = () => {
    setIsOpen(false)
    if (onSaveHub) {
      onSaveHub()
    }
  }

  const handleEmbedFrom = () => {
    setIsOpen(false)
    if (onEmbedFrom) {
      onEmbedFrom()
    }
  }

  const handleCreateList = () => {
    setIsOpen(false)
    if (onCreateList) {
      onCreateList()
    } else {
      try { window.dispatchEvent(new CustomEvent('openCreateList')) } catch {}
    }
  }

  const handleToggleDropdown = () => {
    if (buttonRef.current) {
      if (!isOpen) {
        const rect = buttonRef.current.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const dropdownHeight = variant === 'main' ? 168 : 216 // 3 buttons for main, 4 for list
        
        // Check if there's enough space below the button
        const spaceBelow = viewportHeight - rect.bottom
        const spaceAbove = rect.top
        
        // For main variant, position above the plus button with more space
        // For list variant, position above if not enough space below, otherwise below
        const top = variant === 'main'
          ? rect.top - dropdownHeight - 85 // Above the button with much larger gap
          : spaceBelow >= dropdownHeight + 8 
            ? rect.bottom + 8 
            : rect.top - dropdownHeight - 16 // More space above for list variant
        
        // For main variant, center the dropdown in the middle of the screen
        const left = variant === 'main' 
          ? (window.innerWidth / 2) - 96 // Center of viewport - half dropdown width
          : rect.right - 192 // 192px is the width of the dropdown (w-48)
        
        setDropdownPosition({
          top,
          left
        })
      }
    }
    setIsOpen(!isOpen)
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          ref={buttonRef}
          onClick={handleToggleDropdown}
          aria-label="Create post or add to list"
          className="amber-pebble w-[56px] h-[56px] flex items-center justify-center focus:outline-none"
        >
          <PlusIcon
            className="w-7 h-7 stroke-[2.4] relative"
            style={{ color: 'rgba(255, 244, 218, 0.95)' }}
          />
        </button>
      </div>
      
      {isOpen && createPortal(
        <div
          className="fixed w-56 bg-card rounded-2xl border border-edge py-2 z-50"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            boxShadow: '0 18px 40px rgba(31, 26, 20, 0.18), 0 2px 6px rgba(31, 26, 20, 0.06)',
          }}
          ref={dropdownRef}
        >
          <button
            onClick={handleCreatePost}
            className="flex items-center gap-3 w-full px-4 py-3 text-left text-ink hover:bg-paper-deep transition-colors"
          >
            <PhotoIcon className="w-5 h-5" style={{ color: 'var(--accent-mid)' }} />
            <div>
              <div className="font-display text-[16px] leading-tight">Create</div>
              <div className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-0.5">Post a place</div>
            </div>
          </button>
          <button
            onClick={handleCreateList}
            className="flex items-center gap-3 w-full px-4 py-3 text-left text-ink hover:bg-paper-deep transition-colors"
          >
            <RectangleStackIcon className="w-5 h-5" style={{ color: 'var(--accent-mid)' }} />
            <div>
              <div className="font-display text-[16px] leading-tight">New list</div>
              <div className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-0.5">Group places under a theme</div>
            </div>
          </button>
          <button
            onClick={handleEmbedFrom}
            className="flex items-center gap-3 w-full px-4 py-3 text-left text-ink hover:bg-paper-deep transition-colors"
          >
            <LinkIcon className="w-5 h-5" style={{ color: 'var(--accent-mid)' }} />
            <div>
              <div className="font-display text-[16px] leading-tight">Embed</div>
              <div className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-0.5">From Instagram, TikTok…</div>
            </div>
          </button>
          {variant === 'list' && (
            <button
              onClick={handleSaveHub}
              className="flex items-center gap-3 w-full px-4 py-3 text-left text-ink hover:bg-paper-deep transition-colors"
            >
              <BookmarkIcon className="w-5 h-5" style={{ color: 'var(--accent-mid)' }} />
              <div>
                <div className="font-display text-[16px] leading-tight">Save place</div>
                <div className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-0.5">Add to this list</div>
              </div>
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

export default PlusDropdown 