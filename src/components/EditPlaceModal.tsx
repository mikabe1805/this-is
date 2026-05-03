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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-paper relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-edge max-h-[92vh] overflow-y-auto"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 sm:px-6 py-4 border-b border-edge bg-paper/95 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <p className="label-eyebrow text-ink-mute">Edit place</p>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 sm:px-6 py-5 space-y-5 relative z-10">
          {/* Place Info */}
          <div className="bg-card rounded-2xl p-4 border border-edge">
            <div className="flex items-start gap-3.5">
              <div className="w-14 h-14 rounded-[12px] overflow-hidden bg-paper-deep ring-1 ring-edge flex items-center justify-center shrink-0">
                {listPlace.place.hubImage ? (
                  <img
                    src={listPlace.place.hubImage}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-display text-[22px] text-ink-soft" aria-hidden>
                    {(listPlace.place.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-[18px] leading-tight text-ink truncate">{listPlace.place.name}</h3>
                <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute truncate mt-0.5">{listPlace.place.address}</p>
                {listPlace.place.tags && listPlace.place.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {listPlace.place.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="glass-honey px-2.5 h-6 rounded-full font-mono text-[10px] tracking-wide inline-flex items-center">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <p className="label-eyebrow text-ink-mute mb-2.5">Status</p>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { key: 'want',  label: 'Want',  Icon: BookmarkIcon },
                { key: 'tried', label: 'Been',  Icon: StarIcon },
                { key: 'loved', label: 'Loved', Icon: HeartIcon },
              ] as const).map(({ key, label, Icon }) => {
                const active = formData.status === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleStatusChange(key)}
                    aria-pressed={active}
                    className={`h-12 rounded-full text-[13px] font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                      active ? 'bg-accent text-white border-accent' : 'bg-card text-ink border-edge hover:border-ink/40'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Feeling Selection (only for 'tried' status) */}
          {formData.status === 'tried' && (
            <div>
              <p className="label-eyebrow text-ink-mute mb-2.5">How was it?</p>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { key: 'amazing',       label: 'Amazing',       stars: '⭐️⭐️⭐️⭐️⭐️' },
                  { key: 'good',          label: 'Good',          stars: '⭐️⭐️⭐️⭐️' },
                  { key: 'okay',          label: 'Okay',          stars: '⭐️⭐️⭐️' },
                  { key: 'disappointing', label: 'Disappointing', stars: '⭐️⭐️' },
                ] as const).map(({ key, label, stars }) => {
                  const active = formData.feeling === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleFeelingChange(key)}
                      aria-pressed={active}
                      className={`p-3 rounded-xl border transition-colors text-left ${
                        active ? 'border-ink bg-paper-deep text-ink' : 'border-edge bg-card text-ink hover:border-ink/40'
                      }`}
                    >
                      <div className="text-[14px] font-medium">{label}</div>
                      <div className="text-[10px] mt-0.5 opacity-80">{stars}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label htmlFor="edit-place-note" className="label-eyebrow text-ink-mute mb-2 block">Note</label>
            <div className="relative">
              <textarea
                id="edit-place-note"
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value.slice(0, 200) }))}
                rows={3}
                maxLength={200}
                className="w-full px-3.5 py-3 rounded-xl border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 resize-none"
                placeholder="Add your thoughts about this place…"
              />
              <PencilIcon className="absolute right-3 top-3 w-4 h-4 text-ink-mute" />
            </div>
            <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-1">{formData.note.length} / 200</p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-5 sm:px-6 py-4 border-t border-edge bg-paper/95 backdrop-blur-md">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 h-12 font-medium text-[15px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-cta flex-1 h-12 font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditPlaceModal 
