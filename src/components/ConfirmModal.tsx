import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger'
}: ConfirmModalProps) => {
  if (!isOpen) return null

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: 'text-red-500',
          confirmButton: 'bg-red-500 hover:bg-red-600 text-white',
          iconBg: 'bg-red-50'
        }
      case 'warning':
        return {
          icon: 'text-amber-500',
          confirmButton: 'bg-amber-500 hover:bg-amber-600 text-white',
          iconBg: 'bg-amber-50'
        }
      case 'info':
        return {
          icon: 'text-sage-500',
          confirmButton: 'bg-sage-500 hover:bg-sage-600 text-white',
          iconBg: 'bg-sage-50'
        }
      default:
        return {
          icon: 'text-red-500',
          confirmButton: 'bg-red-500 hover:bg-red-600 text-white',
          iconBg: 'bg-red-50'
        }
    }
  }

  const styles = getTypeStyles()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-charcoal-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-botanical border border-linen-200">
        {/* Header */}
        <div className="p-6 border-b border-linen-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-semibold text-charcoal-800">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-linen-100 text-charcoal-600 hover:bg-linen-200 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl ${styles.iconBg} flex items-center justify-center flex-shrink-0`}>
              <ExclamationTriangleIcon className={`w-6 h-6 ${styles.icon}`} />
            </div>
            <div className="flex-1">
              <p className="text-charcoal-700 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-linen-200">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-600 font-medium hover:bg-linen-100 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm()
                onClose()
              }}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors shadow-soft ${styles.confirmButton}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal 