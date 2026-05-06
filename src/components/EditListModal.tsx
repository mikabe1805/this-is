import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, CameraIcon, EyeIcon, EyeSlashIcon, UsersIcon, PencilIcon } from '@heroicons/react/24/outline'
import AddressAutocomplete from './AddressAutocomplete'
import TagAutocomplete from './TagAutocomplete'
import { firebaseDataService } from '../services/firebaseDataService.js'
import { firebaseStorageService } from '../services/firebaseStorageService.js'

interface EditListModalProps {
  isOpen: boolean
  onClose: () => void
  list: {
    id: string
    name: string
    description: string
    privacy: 'public' | 'private' | 'friends'
    tags: string[]
    coverImage: string
  } | null
  onSave: (listData: {
    name: string
    description: string
    privacy: 'public' | 'private' | 'friends'
    tags: string[]
    coverImage?: string
  }) => void
  // onDelete + onPrivacyChange used to live here as no-ops; deletion and
  // privacy edits are now handled via dedicated modals (ConfirmModal +
  // PrivacyModal) opened from the list-menu dropdown, not from inside the
  // edit form.
}

const EditListModal = ({ isOpen, onClose, list, onSave }: EditListModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy: 'public' as const,
    tags: [] as string[],
    coverImage: ''
  })
  const [newTag, setNewTag] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [location, setLocation] = useState<{ address: string; lat?: number; lng?: number }>({ address: '' })
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && list) {
      setFormData({
        name: list.name,
        description: list.description,
        privacy: list.privacy,
        tags: [...list.tags],
        coverImage: list.coverImage
      })
      // Load existing location if present
      const anyList: any = list
      setLocation({ address: anyList.location?.address || '', lat: anyList.location?.lat, lng: anyList.location?.lng })
      // Load popular tags for suggestions
      firebaseDataService.getPopularTags(30).then(setAvailableTags).catch(() => setAvailableTags(['cozy','trendy','local','authentic','quiet','charming','coffee','food','outdoors']))
    }
  }, [isOpen, list])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePrivacyChange = (privacy: 'public' | 'private' | 'friends') => {
    setFormData(prev => ({ ...prev, privacy }))
  }

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleCoverFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !list) return
    setCoverError(null)
    setIsUploadingCover(true)
    try {
      const url = await firebaseStorageService.uploadListImage(list.id, file)
      setFormData(prev => ({ ...prev, coverImage: url }))
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setIsUploadingCover(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim()) return
    
    setIsSaving(true)
    try {
      await onSave({
        ...formData,
        ...(location.address?.trim() ? { location: { address: location.address, lat: location.lat, lng: location.lng } } : {})
      } as any)
      onClose()
    } catch (error) {
      console.error('Error saving list:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen || !list) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-[100200] flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm"
      onClick={onClose}
    >
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
          <p className="label-eyebrow text-ink-mute">Edit list</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 sm:px-6 py-5 space-y-5 overflow-y-auto relative z-10" style={{ maxHeight: 'calc(92vh - 160px)' }}>
          {/* Cover Image */}
          <div>
            <p className="label-eyebrow text-ink-mute mb-2 block">Cover image</p>
            <div className="relative w-full h-32 rounded-xl border border-edge overflow-hidden bg-paper-deep">
              {formData.coverImage ? (
                <img
                  src={formData.coverImage}
                  alt="List cover"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.src = '/assets/leaf.png' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-display text-[40px] text-ink-faint" aria-hidden>
                  {(formData.name || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              {isUploadingCover && (
                <div className="absolute inset-0 bg-[#1A1815]/40 backdrop-blur-sm flex items-center justify-center">
                  <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-white">Uploading…</span>
                </div>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverFileChosen}
              />
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploadingCover}
                className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-[#1A1815]/70 text-white hover:bg-[#1A1815] flex items-center justify-center disabled:opacity-60"
                aria-label="Change cover"
              >
                <CameraIcon className="w-4 h-4" />
              </button>
            </div>
            {coverError && <p className="text-[12px] text-red-700 mt-1.5">{coverError}</p>}
          </div>

          {/* Name */}
          <div>
            <label htmlFor="edit-list-name" className="label-eyebrow text-ink-mute mb-1.5 block">List name</label>
            <input
              id="edit-list-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., Cozy coffee spots"
              className="w-full h-11 px-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="edit-list-desc" className="label-eyebrow text-ink-mute mb-1.5 block">Description · optional</label>
            <textarea
              id="edit-list-desc"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              placeholder="A few words about what this list is for…"
              className="w-full px-3.5 py-3 rounded-xl border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 resize-none"
            />
          </div>

          {/* Location */}
          <div className="relative overflow-visible">
            <label className="label-eyebrow text-ink-mute mb-1.5 block">List location · optional</label>
            <AddressAutocomplete
              value={location.address}
              onPlaceSelect={(formatted, details) => {
                setLocation({
                  address: formatted,
                  lat: details?.geometry?.location?.lat?.() as number | undefined,
                  lng: details?.geometry?.location?.lng?.() as number | undefined,
                })
              }}
              placeholder="e.g., Miami, FL"
            />
          </div>

          {/* Privacy */}
          <div>
            <p className="label-eyebrow text-ink-mute mb-2 block">Privacy</p>
            <div className="space-y-1.5">
              {([
                { value: 'public',  Icon: EyeIcon,        label: 'Public',        desc: 'Anyone can see this list' },
                { value: 'friends', Icon: UsersIcon,      label: 'Friends only',  desc: 'Only your friends can see this list' },
                { value: 'private', Icon: EyeSlashIcon,   label: 'Private',       desc: 'Only you can see this list' },
              ] as const).map(({ value, Icon, label, desc }) => {
                const checked = formData.privacy === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handlePrivacyChange(value)}
                    aria-pressed={checked}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${checked ? 'bg-paper-deep' : 'hover:bg-paper-deep'}`}
                  >
                    <span className={`w-4 h-4 rounded-full border ${checked ? 'border-ink bg-ink' : 'border-edge bg-card'} flex items-center justify-center`}>
                      {checked && <span className="w-1.5 h-1.5 rounded-full bg-paper" />}
                    </span>
                    <Icon className="w-5 h-5 text-ink-mute" />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[14px] font-medium text-ink">{label}</div>
                      <div className="text-[12px] text-ink-soft">{desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="label-eyebrow text-ink-mute mb-2 block">Tags</label>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-paper-deep border border-edge text-[12px] font-medium text-ink"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      aria-label={`Remove ${tag}`}
                      className="text-ink-mute hover:text-ink"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <TagAutocomplete
              value={newTag}
              onChange={setNewTag}
              onAdd={handleAddTag}
              currentTags={formData.tags}
              availableTags={availableTags}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 sm:px-6 py-4 border-t border-edge relative z-10">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1 h-12 font-semibold text-[14px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !formData.name.trim()}
            className="btn-cta flex-1 h-12 font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default EditListModal
