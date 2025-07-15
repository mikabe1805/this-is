import { useState, useRef, useEffect } from 'react'
import { PlusIcon, PhotoIcon, BookmarkIcon } from '@heroicons/react/24/outline'
import { createPortal } from 'react-dom'

interface PlusDropdownProps {
  onCreatePost: () => void
  onSaveHub: () => void
}

const PlusDropdown: React.FC<PlusDropdownProps> = ({ onCreatePost, onSaveHub }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleCreatePost = () => {
    setIsOpen(false)
    onCreatePost()
  }

  const handleSaveHub = () => {
    setIsOpen(false)
    onSaveHub()
  }

  const handleToggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.right - 192 // 192px is the width of the dropdown (w-48)
      })
    }
    setIsOpen(!isOpen)
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          ref={buttonRef}
          onClick={handleToggleDropdown}
          className="w-10 h-10 bg-gradient-to-r from-sage-400 to-gold-300 text-white rounded-full flex items-center justify-center shadow-botanical hover:from-sage-500 hover:to-gold-400 transition-all border-2 border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300"
          aria-label="Add to list"
        >
          <PlusIcon className="w-6 h-6" />
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
            className="flex items-center gap-3 w-full px-4 py-3 text-left text-charcoal-700 hover:bg-sage-50 transition-colors rounded-t-xl"
          >
            <PhotoIcon className="w-5 h-5 text-sage-600" />
            <div>
              <div className="font-medium">Create Post</div>
              <div className="text-xs text-charcoal-500">Share your experience</div>
            </div>
          </button>
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
        </div>,
        document.body
      )}
    </>
  )
}

export default PlusDropdown 