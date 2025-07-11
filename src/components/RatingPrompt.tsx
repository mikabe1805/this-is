import { useState } from 'react'
import { HeartIcon, XMarkIcon, MinusIcon, BookmarkIcon, TagIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid, XMarkIcon as XMarkIconSolid, MinusIcon as MinusIconSolid } from '@heroicons/react/24/solid'

interface RatingPromptProps {
  placeName: string
  placeImage?: string
  onSave: (status: 'loved' | 'tried', note?: string) => void
  onDismiss: () => void
  isVisible: boolean
}

const RatingPrompt = ({ placeName, placeImage, onSave, onDismiss, isVisible }: RatingPromptProps) => {
  const [step, setStep] = useState<'feeling' | 'save'>('feeling')
  const [feeling, setFeeling] = useState<'loved' | 'liked' | 'neutral' | 'disliked' | null>(null)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Suggested tags based on feeling
  const getSuggestedTags = () => {
    switch (feeling) {
      case 'loved':
        return ['amazing', 'perfect', 'favorite', 'must-visit', 'cozy', 'romantic']
      case 'liked':
        return ['good', 'nice', 'pleasant', 'comfortable', 'friendly', 'convenient']
      case 'neutral':
        return ['okay', 'average', 'standard', 'decent', 'fine', 'adequate']
      case 'disliked':
        return ['overrated', 'expensive', 'crowded', 'noisy', 'slow', 'disappointing']
      default:
        return []
    }
  }

  const handleFeelingSelect = (selectedFeeling: 'loved' | 'liked' | 'neutral' | 'disliked') => {
    setFeeling(selectedFeeling)
    setStep('save')
  }

  const handleSave = async (status: 'loved' | 'tried') => {
    setIsSubmitting(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Combine note with selected tags
    const fullNote = selectedTags.length > 0 
      ? `${note.trim()} ${selectedTags.map(tag => `#${tag}`).join(' ')}`.trim()
      : note.trim()
    
    onSave(status, fullNote || undefined)
    setIsSubmitting(false)
  }

  const getSaveOptions = () => {
    switch (feeling) {
      case 'loved':
        return [
          { status: 'loved' as const, label: 'Save to All Loved', description: 'This place made your heart sing' }
        ]
      case 'liked':
        return [
          { status: 'tried' as const, label: 'Save to All Tried', description: 'You enjoyed your time here' },
          { status: 'loved' as const, label: 'Save to All Loved', description: 'Actually, you really loved it!' }
        ]
      case 'neutral':
        return [
          { status: 'tried' as const, label: 'Save to All Tried', description: 'You experienced this place' }
        ]
      case 'disliked':
        return [
          { status: 'tried' as const, label: 'Save to All Tried', description: 'You tried it, even if it wasn\'t great' }
        ]
      default:
        return []
    }
  }

  const resetPrompt = () => {
    setStep('feeling')
    setFeeling(null)
    setNote('')
    setSelectedTags([])
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-crystal rounded-2xl shadow-crystal border border-white/30 max-w-md w-full p-6 relative">
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
            {step === 'feeling' ? 'How did you feel about this place?' : 'Save this memory?'}
          </h3>
          <p className="text-earth-600 text-sm">
            {step === 'feeling' 
              ? `You spent time at ${placeName}`
              : `${placeName}`
            }
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

        {step === 'feeling' ? (
          /* Feeling Selection Step */
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleFeelingSelect('loved')}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl border-2 border-warm-200 bg-white hover:border-warm-300 hover:bg-warm-50 text-warm-600 transition-all duration-300 group"
            >
              <HeartIconSolid className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <div className="font-semibold">Loved it!</div>
                <div className="text-xs opacity-80">Made my heart sing</div>
              </div>
            </button>

            <button
              onClick={() => handleFeelingSelect('liked')}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl border-2 border-sage-200 bg-white hover:border-sage-300 hover:bg-sage-50 text-sage-600 transition-all duration-300 group"
            >
              <HeartIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <div className="font-semibold">Liked it</div>
                <div className="text-xs opacity-80">Had a good time</div>
              </div>
            </button>

            <button
              onClick={() => handleFeelingSelect('neutral')}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl border-2 border-earth-200 bg-white hover:border-earth-300 hover:bg-earth-50 text-earth-600 transition-all duration-300 group"
            >
              <MinusIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <div className="font-semibold">It was okay</div>
                <div className="text-xs opacity-80">Neither great nor terrible</div>
              </div>
            </button>

            <button
              onClick={() => handleFeelingSelect('disliked')}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl border-2 border-earth-200 bg-white hover:border-earth-300 hover:bg-earth-50 text-earth-600 transition-all duration-300 group"
            >
              <XMarkIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <div className="font-semibold">Didn't like it</div>
                <div className="text-xs opacity-80">Won't be back</div>
              </div>
            </button>
          </div>
        ) : (
          /* Save Step */
          <div className="space-y-4">
            <div className="space-y-3 mb-6">
              {getSaveOptions().map((option) => (
                <button
                  key={option.status}
                  onClick={() => handleSave(option.status)}
                  disabled={isSubmitting}
                  className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl border-2 transition-all duration-300 ${
                    option.status === 'loved'
                      ? 'border-warm-500 bg-gradient-to-r from-warm-500 to-warm-400 text-white shadow-warm-200'
                      : 'border-sage-500 bg-gradient-to-r from-sage-500 to-sage-400 text-white shadow-sage-200'
                  } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {option.status === 'loved' ? (
                    <HeartIconSolid className="w-6 h-6" />
                  ) : (
                    <BookmarkIcon className="w-6 h-6" />
                  )}
                  <div className="text-left">
                    <div className="font-semibold">{option.label}</div>
                    <div className="text-xs opacity-80">{option.description}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Tag Suggestions */}
            {getSuggestedTags().length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-earth-700 mb-2 flex items-center gap-2">
                  <TagIcon className="w-4 h-4" />
                  Add tags to your memory
                </label>
                <div className="flex flex-wrap gap-2">
                  {getSuggestedTags().map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                        selectedTags.includes(tag)
                          ? 'bg-gradient-to-r from-warm-500 to-warm-400 text-white shadow-warm-200'
                          : 'bg-warm-100 text-warm-600 hover:bg-warm-200 border border-warm-200'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Personal note */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-earth-700 mb-2">
            Add a personal note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What made this place special to you? Any memories or thoughts..."
            className="w-full px-4 py-3 border border-warm-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-white/80 backdrop-blur-sm shadow-soft"
            rows={3}
            maxLength={200}
          />
          <div className="text-xs text-earth-400 mt-1 text-right">
            {note.length}/200
          </div>
        </div>

        {/* Back button for save step */}
        {step === 'save' && (
          <button
            onClick={resetPrompt}
            disabled={isSubmitting}
            className="w-full py-3 px-6 rounded-xl font-medium text-earth-600 hover:text-earth-800 transition-colors mb-3"
          >
            ← Back to feeling
          </button>
        )}

        {/* Skip button */}
        <button
          onClick={onDismiss}
          disabled={isSubmitting}
          className="w-full py-2 text-center text-earth-400 hover:text-earth-600 font-medium text-sm transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}

export default RatingPrompt 