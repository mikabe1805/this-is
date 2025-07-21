import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { EllipsisHorizontalIcon, UserIcon, Cog6ToothIcon, HeartIcon, MapIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

interface UserMenuDropdownProps {
  isOpen: boolean
  onClose: () => void
  onEditProfile?: () => void
  onViewFollowing?: () => void
  onUserSettings?: () => void
  onImportFromGoogleMaps?: () => void
  onLogout?: () => void
  buttonRef?: React.RefObject<HTMLButtonElement | null>
}

const UserMenuDropdown: React.FC<UserMenuDropdownProps> = ({
  isOpen,
  onClose,
  onEditProfile,
  onViewFollowing,
  onUserSettings,
  onImportFromGoogleMaps,
  onLogout,
  buttonRef
}) => {
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleEditProfile = () => {
    if (onEditProfile) {
      onEditProfile()
    } else {
      // Default behavior - navigate to edit profile page
      navigate('/profile/edit')
    }
    onClose()
  }

  const handleViewFollowing = () => {
    if (onViewFollowing) {
      onViewFollowing()
    } else {
      // Default behavior - navigate to following page
      navigate('/profile/following')
    }
    onClose()
  }

  const handleUserSettings = () => {
    if (onUserSettings) {
      onUserSettings()
    } else {
      // Default behavior - navigate to settings page
      navigate('/settings')
    }
    onClose()
  }

  const handleImportFromGoogleMaps = () => {
    if (onImportFromGoogleMaps) {
      onImportFromGoogleMaps()
    } else {
      // Default behavior - could navigate to import page
      console.log('Import from Google Maps')
    }
    onClose()
  }

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
    } else {
      // Default behavior - could navigate to logout
      console.log('Logout')
    }
    onClose()
  }

  // Calculate position relative to the button
  const getDropdownPosition = () => {
    if (!buttonRef?.current) {
      return { top: '1rem', right: '1rem' }
    }

    const rect = buttonRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const dropdownWidth = 192 // w-48 = 12rem = 192px
    const dropdownHeight = 120 // approximate height

    // Phone UI constraints (max-w-md = 448px, centered)
    const phoneWidth = 448
    const phoneLeft = (viewportWidth - phoneWidth) / 2
    const phoneRight = phoneLeft + phoneWidth

    // Check if dropdown would go off the right edge of phone
    const rightSpace = phoneRight - rect.right
    const leftSpace = rect.left - phoneLeft

    // Check if dropdown would go off the bottom edge
    const bottomSpace = viewportHeight - rect.bottom
    const topSpace = rect.top

    let left: number
    let top: number

    // Position horizontally within phone bounds
    if (rightSpace >= dropdownWidth) {
      // Enough space on the right within phone
      left = rect.right + 4
    } else if (leftSpace >= dropdownWidth) {
      // Enough space on the left within phone
      left = rect.left - dropdownWidth - 4
    } else {
      // Center it within phone bounds
      left = Math.max(phoneLeft + 4, phoneLeft + (phoneWidth - dropdownWidth) / 2)
    }

    // Position vertically
    if (bottomSpace >= dropdownHeight) {
      // Enough space below
      top = rect.bottom + 4
    } else if (topSpace >= dropdownHeight) {
      // Enough space above
      top = rect.top - dropdownHeight - 4
    } else {
      // Center it vertically
      top = Math.max(4, (viewportHeight - dropdownHeight) / 2)
    }

    return { top: `${top}px`, left: `${left}px` }
  }

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div 
        ref={dropdownRef}
        className="absolute w-48 bg-white rounded-2xl shadow-botanical border border-linen-200 overflow-hidden"
        style={getDropdownPosition()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="py-2">
          <button
            onClick={handleEditProfile}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-charcoal-700 hover:bg-sage-50 transition-colors"
          >
            <UserIcon className="w-5 h-5 text-sage-600" />
            <span className="font-medium">Edit Profile</span>
          </button>
          
          <button
            onClick={handleViewFollowing}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-charcoal-700 hover:bg-sage-50 transition-colors"
          >
            <HeartIcon className="w-5 h-5 text-sage-600" />
            <span className="font-medium">View Following</span>
          </button>
          
          <button
            onClick={handleUserSettings}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-charcoal-700 hover:bg-sage-50 transition-colors"
          >
            <Cog6ToothIcon className="w-5 h-5 text-sage-600" />
            <span className="font-medium">User Settings</span>
          </button>
          
          <button
            onClick={handleImportFromGoogleMaps}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-charcoal-700 hover:bg-sage-50 transition-colors"
          >
            <MapIcon className="w-5 h-5 text-sage-600" />
            <span className="font-medium">Import from Google Maps</span>
          </button>

          <div className="border-t border-linen-200 my-1"></div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5 text-red-500" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default UserMenuDropdown 