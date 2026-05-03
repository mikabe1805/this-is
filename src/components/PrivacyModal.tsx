import { XMarkIcon, EyeIcon, EyeSlashIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import Button from './Button'

interface PrivacyModalProps {
  isOpen: boolean
  onClose: () => void
  currentPrivacy: 'public' | 'private' | 'friends'
  onPrivacyChange: (privacy: 'public' | 'private' | 'friends') => void
  listName: string
}

const PrivacyModal = ({ isOpen, onClose, currentPrivacy, onPrivacyChange, listName }: PrivacyModalProps) => {
  const [selectedPrivacy, setSelectedPrivacy] = useState<'public' | 'private' | 'friends'>(currentPrivacy)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (selectedPrivacy === currentPrivacy) {
      onClose()
      return
    }

    setIsSubmitting(true)
    try {
      await onPrivacyChange(selectedPrivacy)
      onClose()
    } catch (error) {
      console.error('Error updating privacy:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setSelectedPrivacy(currentPrivacy)
    setIsSubmitting(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="modal-paper relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-edge overflow-hidden"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-edge relative z-10">
          <p className="label-eyebrow text-ink-mute">Change privacy</p>
          <button
            type="button"
            onClick={handleClose}
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 sm:px-6 py-5 relative z-10">
          <p className="text-[14px] text-ink-soft leading-relaxed mb-4">
            Choose who can see your list <span className="font-display-italic text-ink">"{listName}"</span>
          </p>

          <div className="space-y-1.5">
            {([
              { value: 'public',  Icon: EyeIcon,        label: 'Public',       desc: 'Anyone can see and save this list' },
              { value: 'friends', Icon: UserGroupIcon,  label: 'Friends only', desc: 'Only your friends can see this list' },
              { value: 'private', Icon: EyeSlashIcon,   label: 'Private',      desc: 'Only you can see this list' },
            ] as const).map(({ value, Icon, label, desc }) => {
              const checked = selectedPrivacy === value
              return (
                <label
                  key={value}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${checked ? 'bg-paper-deep' : 'hover:bg-paper-deep'}`}
                >
                  <input
                    type="radio"
                    name="privacy"
                    value={value}
                    checked={checked}
                    onChange={(e) => setSelectedPrivacy(e.target.value as typeof value)}
                    className="w-4 h-4 accent-ink"
                  />
                  <Icon className="w-5 h-5 text-ink-mute" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-ink">{label}</div>
                    <div className="text-[12px] text-ink-soft">{desc}</div>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 sm:px-6 py-4 border-t border-edge relative z-10">
          <Button variant="secondary" className="flex-1" type="button" onClick={handleClose}>Cancel</Button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedPrivacy === currentPrivacy || isSubmitting}
            className="btn-cta flex-1 h-12 font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Updating…' : 'Update privacy'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PrivacyModal 