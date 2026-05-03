import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import Button from './Button'

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

  const tone = type === 'danger'
    ? { icon: 'text-red-700', iconBg: 'bg-red-50', confirm: 'btn-cta', confirmStyle: { background: 'linear-gradient(180deg, rgba(220, 60, 60, 0.95) 0%, rgba(160, 30, 30, 0.95) 100%)', color: '#fff', textShadow: 'none' } as React.CSSProperties }
    : type === 'warning'
    ? { icon: 'text-amber-700', iconBg: 'bg-amber-50', confirm: 'btn-cta', confirmStyle: undefined }
    : { icon: 'text-accent-deep', iconBg: 'bg-accent-soft', confirm: 'btn-cta', confirmStyle: undefined }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-paper relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-edge overflow-hidden"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>

        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-edge relative z-10 flex items-center justify-between">
          <p className="label-eyebrow text-ink-mute">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 sm:px-6 py-5 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className={`w-12 h-12 rounded-xl ${tone.iconBg} ring-1 ring-edge flex items-center justify-center flex-shrink-0`}>
              <ExclamationTriangleIcon className={`w-5 h-5 ${tone.icon}`} />
            </div>
            <p className="flex-1 text-[14px] text-ink-soft leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-edge relative z-10 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>{cancelText}</Button>
          <button
            type="button"
            onClick={() => { onConfirm(); onClose(); }}
            className={`${tone.confirm} flex-1 h-12 font-semibold text-[15px]`}
            style={tone.confirmStyle}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal 