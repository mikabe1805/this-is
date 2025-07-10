import { useState } from 'react'
import { HeartIcon, XMarkIcon, MinusIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid, XMarkIcon as XMarkIconSolid, MinusIcon as MinusIconSolid } from '@heroicons/react/24/solid'

interface RatingPromptProps {
  placeName: string
  placeImage?: string
  onRate: (rating: 'loved' | 'hated' | 'mediocre', feedback?: string) => void
  onDismiss: () => void
  isVisible: boolean
}

const RatingPrompt = ({ placeName, placeImage, onRate, onDismiss, isVisible }: RatingPromptProps) => {
  const [selectedRating, setSelectedRating] = useState<'loved' | 'hated' | 'mediocre' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRate = async (rating: 'loved' | 'hated' | 'mediocre') => {
    setSelectedRating(rating)
    setIsSubmitting(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))
    
    onRate(rating, feedback.trim() || undefined)
    setIsSubmitting(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-crystal rounded-2xl shadow-crystal border border-white/30 max-w-sm w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-earth-400 hover:text-earth-600 transition-colors"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-serif font-semibold text-earth-800 mb-2">
            How was your visit?
          </h3>
          <p className="text-earth-600 text-sm">
            You spent time at <span className="font-semibold">{placeName}</span>
          </p>
        </div>

        {/* Place image */}
        {placeImage && (
          <div className="mb-6">
            <img 
              src={placeImage} 
              alt={placeName}
              className="w-full h-32 object-cover rounded-xl shadow-soft"
            />
          </div>
        )}

        {/* Rating buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleRate('loved')}
            disabled={isSubmitting}
            className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl border-2 transition-all duration-300 ${
              selectedRating === 'loved'
                ? 'border-warm-500 bg-gradient-to-r from-warm-500 to-warm-400 text-white shadow-warm-200'
                : 'border-warm-200 bg-white hover:border-warm-300 hover:bg-warm-50 text-warm-600'
            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {selectedRating === 'loved' ? (
              <HeartIconSolid className="w-6 h-6" />
            ) : (
              <HeartIcon className="w-6 h-6" />
            )}
            <span className="font-semibold">Loved It</span>
          </button>

          <button
            onClick={() => handleRate('mediocre')}
            disabled={isSubmitting}
            className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl border-2 transition-all duration-300 ${
              selectedRating === 'mediocre'
                ? 'border-sage-500 bg-gradient-to-r from-sage-500 to-sage-400 text-white shadow-sage-200'
                : 'border-sage-200 bg-white hover:border-sage-300 hover:bg-sage-50 text-sage-600'
            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {selectedRating === 'mediocre' ? (
              <MinusIconSolid className="w-6 h-6" />
            ) : (
              <MinusIcon className="w-6 h-6" />
            )}
            <span className="font-semibold">Mediocre</span>
          </button>

          <button
            onClick={() => handleRate('hated')}
            disabled={isSubmitting}
            className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl border-2 transition-all duration-300 ${
              selectedRating === 'hated'
                ? 'border-earth-500 bg-gradient-to-r from-earth-500 to-earth-400 text-white shadow-earth-200'
                : 'border-earth-200 bg-white hover:border-earth-300 hover:bg-earth-50 text-earth-600'
            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {selectedRating === 'hated' ? (
              <XMarkIconSolid className="w-6 h-6" />
            ) : (
              <XMarkIcon className="w-6 h-6" />
            )}
            <span className="font-semibold">Hated It</span>
          </button>
        </div>

        {/* Optional feedback */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-earth-700 mb-2">
            Additional feedback (optional)
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What made this place special (or not so special)?"
            className="w-full px-4 py-3 border border-warm-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-white/80 backdrop-blur-sm"
            rows={3}
            maxLength={200}
          />
          <div className="text-xs text-earth-400 mt-1 text-right">
            {feedback.length}/200
          </div>
        </div>

        {/* Submit button */}
        {selectedRating && (
          <button
            onClick={() => handleRate(selectedRating)}
            disabled={isSubmitting}
            className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
              isSubmitting
                ? 'bg-earth-300 text-white cursor-not-allowed'
                : 'bg-gradient-to-r from-warm-500 to-earth-500 text-white hover:from-warm-600 hover:to-earth-600 shadow-soft hover:shadow-lg'
            }`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Rating'}
          </button>
        )}
      </div>
    </div>
  )
}

export default RatingPrompt 