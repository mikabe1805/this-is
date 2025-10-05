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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-charcoal-900/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-botanical border border-linen-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-linen-200">
          <h2 className="text-xl font-serif font-semibold text-charcoal-800">Change Privacy</h2>
          <button
            onClick={handleClose}
            className="btn-icon"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-charcoal-600 mb-4">
            Choose who can see your list <span className="font-semibold">"{listName}"</span>
          </p>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 rounded-xl border border-linen-200 hover:bg-linen-50 cursor-pointer transition">
              <input
                type="radio"
                name="privacy"
                value="public"
                checked={selectedPrivacy === 'public'}
                onChange={(e) => setSelectedPrivacy(e.target.value as 'public')}
                className="text-sage-600 focus:ring-sage-200"
              />
              <div className="flex items-center gap-3">
                <EyeIcon className="w-6 h-6 text-sage-600" />
                <div>
                  <div className="font-medium text-charcoal-700">Public</div>
                  <div className="text-sm text-charcoal-500">Anyone can see and save this list</div>
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-4 rounded-xl border border-linen-200 hover:bg-linen-50 cursor-pointer transition">
              <input
                type="radio"
                name="privacy"
                value="friends"
                checked={selectedPrivacy === 'friends'}
                onChange={(e) => setSelectedPrivacy(e.target.value as 'friends')}
                className="text-sage-600 focus:ring-sage-200"
              />
              <div className="flex items-center gap-3">
                <UserGroupIcon className="w-6 h-6 text-sage-600" />
                <div>
                  <div className="font-medium text-charcoal-700">Friends Only</div>
                  <div className="text-sm text-charcoal-500">Only your friends can see this list</div>
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-4 rounded-xl border border-linen-200 hover:bg-linen-50 cursor-pointer transition">
              <input
                type="radio"
                name="privacy"
                value="private"
                checked={selectedPrivacy === 'private'}
                onChange={(e) => setSelectedPrivacy(e.target.value as 'private')}
                className="text-sage-600 focus:ring-sage-200"
              />
              <div className="flex items-center gap-3">
                <EyeSlashIcon className="w-6 h-6 text-sage-600" />
                <div>
                  <div className="font-medium text-charcoal-700">Private</div>
                  <div className="text-sm text-charcoal-500">Only you can see this list</div>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-linen-200">
          <Button variant="secondary" className="flex-1" type="button" onClick={handleClose}>Cancel</Button>
          <Button className="flex-1" type="button" onClick={handleSubmit} disabled={selectedPrivacy === currentPrivacy || isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Privacy'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default PrivacyModal 