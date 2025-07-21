import { useState, useRef, useEffect } from 'react'
import { PlusIcon, PhotoIcon, BookmarkIcon, LinkIcon } from '@heroicons/react/24/outline'
import { createPortal } from 'react-dom'

interface PlusDropdownProps {
  onCreatePost: () => void
  onSaveHub?: () => void
  onEmbedFrom?: () => void
  variant?: 'main' | 'list' // 'main' for navbar, 'list' for list pages
}

const PlusDropdown: React.FC<PlusDropdownProps> = ({ onCreatePost, onSaveHub, onEmbedFrom, variant = 'list' }) => {
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

  const handleToggleDropdown = () => {
    if (buttonRef.current) {
      if (!isOpen) {
        const rect = buttonRef.current.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const dropdownHeight = variant === 'main' ? 96 : 144 // 2 buttons for main, 3 for list
        
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
          className="w-14 h-14 bg-gradient-to-r from-sage-500 to-gold-500 text-white rounded-full flex items-center justify-center shadow-soft hover:shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sage-300"
          aria-label="Add to list"
        >
          <PlusIcon className="w-7 h-7" />
        </button>
      </div>
      
      {isOpen && createPortal(
        <div 
          className="fixed w-48 bg-white rounded-xl shadow-botanical border border-linen-200 py-2 z-50"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left
          }}
          ref={dropdownRef}
        >
          <button
            onClick={handleCreatePost}
            className={`flex items-center gap-3 w-full px-4 py-3 text-left text-charcoal-700 hover:bg-sage-50 transition-colors ${variant === 'main' ? 'rounded-t-xl' : ''}`}
          >
            <PhotoIcon className="w-5 h-5 text-sage-600" />
            <div>
              <div className="font-medium">Create Post</div>
              <div className="text-xs text-charcoal-500">Share your experience</div>
            </div>
          </button>
          <button
            onClick={handleEmbedFrom}
            className={`flex items-center gap-3 w-full px-4 py-3 text-left text-charcoal-700 hover:bg-sage-50 transition-colors ${variant === 'main' ? 'rounded-b-xl' : ''}`}
          >
            <LinkIcon className="w-5 h-5 text-sage-600" />
            <div>
              <div className="font-medium">Embed from...</div>
              <div className="text-xs text-charcoal-500">Instagram, TikTok, etc.</div>
            </div>
          </button>
          {variant === 'list' && (
            <button
              onClick={handleSaveHub}
              className="flex items-center gap-3 w-full px-4 py-3 text-left text-charcoal-700 hover:bg-sage-50 transition-colors rounded-b-xl"
            >
              <BookmarkIcon className="w-5 h-5 text-sage-600" />
              <div>
                <div className="font-medium">Save Hub</div>
                <div className="text-xs text-charcoal-500">Add a place to this list</div>
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