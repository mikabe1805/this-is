import { useState } from 'react'
import { HeartIcon, XMarkIcon, MinusIcon, BookmarkIcon, TagIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { createPortal } from 'react-dom'

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

  const getSuggestedTags = () => {
    switch (feeling) {
      case 'loved': return ['amazing', 'perfect', 'favorite', 'must-visit', 'cozy', 'romantic']
      case 'liked': return ['good', 'nice', 'pleasant', 'comfortable', 'friendly', 'convenient']
      case 'neutral': return ['okay', 'average', 'standard', 'decent', 'fine', 'adequate']
      case 'disliked': return ['overrated', 'expensive', 'crowded', 'noisy', 'slow', 'disappointing']
      default: return []
    }
  }

  const handleFeelingSelect = (selectedFeeling: 'loved' | 'liked' | 'neutral' | 'disliked') => {
    setFeeling(selectedFeeling)
    setStep('save')
  }

  const handleSave = async (status: 'loved' | 'tried') => {
    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    const fullNote = selectedTags.length > 0
      ? `${note.trim()} ${selectedTags.map(tag => `#${tag}`).join(' ')}`.trim()
      : note.trim()
    onSave(status, fullNote || undefined)
    setIsSubmitting(false)
  }

  const getSaveOptions = () => {
    switch (feeling) {
      case 'loved':
        return [{ status: 'loved' as const, label: 'Save to All Loved', description: 'This place made your heart sing' }]
      case 'liked':
        return [
          { status: 'tried' as const, label: 'Save to All Tried', description: 'You enjoyed your time here' },
          { status: 'loved' as const, label: 'Save to All Loved', description: 'Actually, you really loved it!' }
        ]
      case 'neutral':
        return [{ status: 'tried' as const, label: 'Save to All Tried', description: 'You experienced this place' }]
      case 'disliked':
        return [{ status: 'tried' as const, label: 'Save to All Tried', description: "You tried it, even if it wasn't great" }]
      default: return []
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
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  if (!isVisible) return null

  const feelingOptions = [
    { key: 'loved' as const, label: 'Loved it!', desc: 'Made my heart sing', Icon: HeartIconSolid },
    { key: 'liked' as const, label: 'Liked it', desc: 'Had a good time', Icon: HeartIcon },
    { key: 'neutral' as const, label: 'It was okay', desc: 'Neither great nor terrible', Icon: MinusIcon },
    { key: 'disliked' as const, label: "Didn't like it", desc: "Won't be back", Icon: XMarkIcon }
  ]

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm" onClick={onDismiss}>
      <div
        className="modal-paper relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-edge max-h-[92vh] flex flex-col overflow-hidden"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-edge relative z-10">
          <p className="label-eyebrow text-ink-mute">{step === 'feeling' ? 'How did you feel?' : 'Save this memory'}</p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto relative z-10 px-5 sm:px-6 py-5 space-y-5">
          {/* Place card */}
          <div className="flex items-center gap-3.5">
            {placeImage ? (
              <div className="w-14 h-14 rounded-[10px] overflow-hidden bg-paper-deep ring-1 ring-edge flex-shrink-0">
                <img src={placeImage} alt={placeName} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-[10px] bg-paper-deep ring-1 ring-edge flex items-center justify-center flex-shrink-0">
                <span className="font-display text-[20px] text-ink-soft">{placeName.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-[18px] leading-tight text-ink truncate">{placeName}</h3>
              <p className="text-[12px] text-ink-soft truncate">
                {step === 'feeling' ? 'You spent time here' : 'Pick where to save this memory'}
              </p>
            </div>
          </div>

          {step === 'feeling' ? (
            <div className="space-y-1.5">
              {feelingOptions.map(({ key, label, desc, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleFeelingSelect(key)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-edge bg-card hover:border-ink/40 hover:bg-paper-deep transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full glass-honey flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-ink" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-ink">{label}</div>
                    <div className="text-[12px] text-ink-soft">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                {getSaveOptions().map((option) => (
                  <button
                    key={option.status}
                    type="button"
                    onClick={() => handleSave(option.status)}
                    disabled={isSubmitting}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-edge bg-card hover:border-ink/40 hover:bg-paper-deep transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full glass-honey flex items-center justify-center shrink-0">
                      {option.status === 'loved' ? <HeartIconSolid className="w-5 h-5 text-ink" /> : <BookmarkIcon className="w-5 h-5 text-ink" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-ink">{option.label}</div>
                      <div className="text-[12px] text-ink-soft">{option.description}</div>
                    </div>
                  </button>
                ))}
              </div>

              {getSuggestedTags().length > 0 && (
                <div>
                  <p className="label-eyebrow text-ink-mute mb-2 flex items-center gap-1.5">
                    <TagIcon className="w-3.5 h-3.5" />
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {getSuggestedTags().map((tag) => {
                      const active = selectedTags.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          aria-pressed={active}
                          className={`h-7 px-2.5 rounded-full text-[12px] font-medium border transition-colors ${
                            active
                              ? 'bg-paper-deep border-ink text-ink'
                              : 'bg-card border-edge text-ink-soft hover:border-ink/40'
                          }`}
                        >
                          #{tag}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Personal note */}
          <div>
            <label htmlFor="rating-note" className="label-eyebrow text-ink-mute mb-1.5 block">
              Note · optional
            </label>
            <textarea
              id="rating-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What made this place special?"
              className="w-full px-3.5 py-2.5 rounded-xl border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 resize-none"
              rows={3}
              maxLength={200}
            />
            <div className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-1 text-right">
              {note.length}/200
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-edge relative z-10 flex gap-2">
          {step === 'save' && (
            <button
              type="button"
              onClick={resetPrompt}
              disabled={isSubmitting}
              className="btn-secondary flex-1 h-11 font-semibold text-[14px]"
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            disabled={isSubmitting}
            className={`${step === 'save' ? 'flex-1' : 'w-full'} h-11 rounded-full text-[13px] font-medium text-ink-mute hover:text-ink transition-colors`}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default RatingPrompt
