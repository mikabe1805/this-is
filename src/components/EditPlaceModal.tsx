import { useState, useEffect } from 'react'
import { XMarkIcon, HeartIcon, StarIcon, BookmarkIcon, PencilIcon } from '@heroicons/react/24/outline'

interface EditPlaceModalProps {
  isOpen: boolean
  onClose: () => void
  listPlace: {
    id: string
    place: {
      id: string
      name: string
      address: string
      tags: string[]
      hubImage?: string
    }
    note: string
    status: 'want' | 'tried' | 'loved'
    feeling?: 'amazing' | 'good' | 'okay' | 'disappointing'
  }
  onSave: (data: {
    note: string
    status: 'want' | 'tried' | 'loved'
    feeling?: 'amazing' | 'good' | 'okay' | 'disappointing'
  }) => void
}

const EditPlaceModal = ({ isOpen, onClose, listPlace, onSave }: EditPlaceModalProps) => {
  const [formData, setFormData] = useState({
    note: listPlace.note,
    status: listPlace.status,
    feeling: listPlace.feeling
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFormData({
        note: listPlace.note,
        status: listPlace.status,
        feeling: listPlace.feeling
      })
    }
  }, [isOpen, listPlace])

  const handleStatusChange = (status: 'want' | 'tried' | 'loved') => {
    setFormData(prev => ({ 
      ...prev, 
      status,
      // Clear feeling if switching away from 'tried'
      feeling: status !== 'tried' ? undefined : prev.feeling
    }))
  }

  const handleFeelingChange = (feeling: 'amazing' | 'good' | 'okay' | 'disappointing') => {
    setFormData(prev => ({ ...prev, feeling }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Error saving place:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'loved':
        return <HeartIcon className="w-5 h-5" />
      case 'tried':
        return <StarIcon className="w-5 h-5" />
      case 'want':
        return <BookmarkIcon className="w-5 h-5" />
      default:
        return <BookmarkIcon className="w-5 h-5" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'loved':
        return 'bg-gold-100 text-gold-700 border-gold-200'
      case 'tried':
        return 'bg-sage-100 text-sage-700 border-sage-200'
      case 'want':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-charcoal-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-botanical border border-linen-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 p-6 border-b border-linen-200 bg-white/95 backdrop-blur-glass rounded-t-3xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-semibold text-charcoal-800">Edit Place</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-linen-100 text-charcoal-600 hover:bg-linen-200 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Place Info */}
          <div className="bg-linen-50 rounded-2xl p-4">
            <div className="flex items-start gap-4">
              <img
                src={listPlace.place.hubImage || 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=150&h=150&fit=crop'}
                alt={listPlace.place.name}
                className="w-16 h-16 rounded-xl object-cover border border-linen-200"
              />
              <div className="flex-1">
                <h3 className="font-serif font-semibold text-charcoal-800 mb-1">{listPlace.place.name}</h3>
                <p className="text-sm text-charcoal-500 mb-2">{listPlace.place.address}</p>
                <div className="flex flex-wrap gap-1">
                  {listPlace.place.tags.slice(0, 3).map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-white text-charcoal-600 text-xs rounded-full border border-linen-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-3">Status</label>
            <div className="space-y-2">
              <button
                onClick={() => handleStatusChange('want')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  formData.status === 'want'
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-linen-200 bg-linen-50 text-charcoal-600 hover:bg-linen-100'
                }`}
              >
                <BookmarkIcon className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Want to Try</div>
                  <div className="text-xs opacity-75">Places you want to visit</div>
                </div>
              </button>

              <button
                onClick={() => handleStatusChange('tried')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  formData.status === 'tried'
                    ? 'border-sage-300 bg-sage-50 text-sage-700'
                    : 'border-linen-200 bg-linen-50 text-charcoal-600 hover:bg-linen-100'
                }`}
              >
                <StarIcon className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Tried</div>
                  <div className="text-xs opacity-75">Places you've visited</div>
                </div>
              </button>

              <button
                onClick={() => handleStatusChange('loved')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  formData.status === 'loved'
                    ? 'border-gold-300 bg-gold-50 text-gold-700'
                    : 'border-linen-200 bg-linen-50 text-charcoal-600 hover:bg-linen-100'
                }`}
              >
                <HeartIcon className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Loved</div>
                  <div className="text-xs opacity-75">Your favorite places</div>
                </div>
              </button>
            </div>
          </div>

          {/* Feeling Selection (only for 'tried' status) */}
          {formData.status === 'tried' && (
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-3">How was it?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleFeelingChange('amazing')}
                  className={`p-3 rounded-xl border transition-colors ${
                    formData.feeling === 'amazing'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-linen-200 bg-linen-50 text-charcoal-600 hover:bg-linen-100'
                  }`}
                >
                  <div className="font-medium">Amazing</div>
                  <div className="text-xs opacity-75">⭐️⭐️⭐️⭐️⭐️</div>
                </button>
                <button
                  onClick={() => handleFeelingChange('good')}
                  className={`p-3 rounded-xl border transition-colors ${
                    formData.feeling === 'good'
                      ? 'border-sage-300 bg-sage-50 text-sage-700'
                      : 'border-linen-200 bg-linen-50 text-charcoal-600 hover:bg-linen-100'
                  }`}
                >
                  <div className="font-medium">Good</div>
                  <div className="text-xs opacity-75">⭐️⭐️⭐️⭐️</div>
                </button>
                <button
                  onClick={() => handleFeelingChange('okay')}
                  className={`p-3 rounded-xl border transition-colors ${
                    formData.feeling === 'okay'
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-linen-200 bg-linen-50 text-charcoal-600 hover:bg-linen-100'
                  }`}
                >
                  <div className="font-medium">Okay</div>
                  <div className="text-xs opacity-75">⭐️⭐️⭐️</div>
                </button>
                <button
                  onClick={() => handleFeelingChange('disappointing')}
                  className={`p-3 rounded-xl border transition-colors ${
                    formData.feeling === 'disappointing'
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-linen-200 bg-linen-50 text-charcoal-600 hover:bg-linen-100'
                  }`}
                >
                  <div className="font-medium">Disappointing</div>
                  <div className="text-xs opacity-75">⭐️⭐️</div>
                </button>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-2">Note</label>
            <div className="relative">
              <textarea
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300 transition-colors resize-none"
                placeholder="Add your thoughts about this place..."
              />
              <PencilIcon className="absolute right-3 top-3 w-4 h-4 text-charcoal-400" />
            </div>
            <p className="text-xs text-charcoal-400 mt-1">{formData.note.length}/200 characters</p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-6 border-t border-linen-200 bg-white/95 backdrop-blur-glass rounded-b-3xl">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-600 font-medium hover:bg-linen-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                isSaving
                  ? 'bg-sage-200 text-sage-400 cursor-not-allowed'
                  : 'bg-sage-500 text-white hover:bg-sage-600 shadow-soft'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditPlaceModal 