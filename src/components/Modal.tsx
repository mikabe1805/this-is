import { XMarkIcon } from '@heroicons/react/24/outline'
import { createPortal } from 'react-dom'
import { useEffect } from 'react'

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
  footer?: React.ReactNode
  className?: string
}

// Standardized modal wrapper for consistent UI across all modals
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  footer,
  className = ''
}: ModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4'
  }[size]

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay"
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-charcoal-900/50 backdrop-blur-sm" />

      {/* Modal container */}
      <div
        className={`relative bg-white rounded-2xl shadow-liquid border border-linen-200 w-full ${sizeClasses} max-h-[90vh] flex flex-col modal-container ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-linen-200">
            {title && (
              <h2 id="modal-title" className="text-xl font-serif font-semibold text-charcoal-800">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-full text-charcoal-500 hover:bg-linen-50 hover:text-charcoal-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-300"
                aria-label="Close modal"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 modal-content">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-6 border-t border-linen-200 bg-linen-50/50">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
