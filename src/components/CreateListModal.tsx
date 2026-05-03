import type { List } from '../types/index.js'
import { XMarkIcon, PhotoIcon, EyeIcon, EyeSlashIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { useState, useRef, useEffect } from 'react'
import { firebaseListService } from '../services/firebaseListService'
import { firebaseDataService } from '../services/firebaseDataService'
import { useAuth } from '../contexts/AuthContext'
import AddressAutocomplete from './AddressAutocomplete'
import TagAutocomplete from './TagAutocomplete'

interface CreateListModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: File }) => void
}

const CreateListModal = ({ isOpen, onClose, onCreate }: CreateListModalProps) => {
  const { currentUser } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'friends'>('public')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [coverImagePreview, setCoverImagePreview] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [location, setLocation] = useState<{ address: string; lat?: number; lng?: number }>({ address: '' })

  useEffect(() => {
    if (isOpen) {
      const fetchTags = async () => {
        try {
          const tags = await firebaseDataService.getPopularTags(30);
          setAvailableTags(tags);
        } catch (error) {
          console.error('Error fetching tags:', error);
          // Fallback to default tags if Firebase fails
          setAvailableTags(['coffee', 'food', 'outdoors', 'work', 'study', 'cozy', 'trendy', 'local', 'authentic', 'romantic', 'social', 'quiet', 'artisan', 'hidden-gems', 'weekend', 'brunch', 'adventure', 'nature', 'books', 'date-night']);
        }
      };
      fetchTags();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !currentUser) return

    setIsSubmitting(true)
    try {
      const newListId = await firebaseListService.createList({
        name: name.trim(),
        description: description.trim(),
        privacy,
        tags,
        userId: currentUser.id,
        coverImage: coverImage || undefined
      })
      // Save optional location on the created list
      if (newListId && location.address.trim()) {
        await firebaseListService.updateList(newListId, { location } as any)
      }
      handleClose()
    } catch (error) {
      console.error('Error creating list:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setPrivacy('public')
    setTags([])
    setNewTag('')
    setCoverImage(null)
    setCoverImagePreview('')
    setIsSubmitting(false)
    onClose()
  }

  const handleAddTag = async () => {
    const tagToAdd = newTag.trim()
    if (tagToAdd && !tags.includes(tagToAdd) && tags.length < 5) {
      setTags([...tags, tagToAdd])
      setNewTag('')
      try { await firebaseDataService.addTag(tagToAdd) } catch {}
    }
  }
  const handleSelectTag = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCoverImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setCoverImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setCoverImage(null)
    setCoverImagePreview('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (!isOpen) return null

  const filteredTags = availableTags.filter(tag => tag.toLowerCase().includes(newTag.toLowerCase()) && !tags.includes(tag));

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm" onClick={handleClose}>
      {/* Modal — paper surface, drag-handle on mobile, edge token border. */}
      <div
        className="relative modal-paper w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-edge max-h-[92vh] overflow-hidden"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-edge">
          <p className="label-eyebrow text-ink-mute">Create new list</p>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 sm:px-6 py-5 space-y-5 max-h-[calc(92vh-180px)] overflow-y-auto relative z-10" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Cover Image */}
            <div>
              <label className="label-eyebrow text-ink-mute mb-2 block">Cover image · optional</label>
              <div className="relative">
                {coverImagePreview ? (
                  <div className="relative">
                    <img
                      src={coverImagePreview}
                      alt="Cover preview"
                      className="w-full h-32 object-cover rounded-xl border border-edge"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      aria-label="Remove cover image"
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-[#1A1815]/70 text-white hover:bg-[#1A1815] flex items-center justify-center transition"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border border-dashed border-edge rounded-xl flex flex-col items-center justify-center text-ink-mute hover:text-ink hover:border-ink/40 transition bg-card"
                  >
                    <PhotoIcon className="w-7 h-7 mb-1.5" />
                    <span className="text-[13px]">Upload cover image</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="label-eyebrow text-ink-mute mb-1.5 block">List name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Cozy coffee spots"
                className="w-full h-11 px-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="label-eyebrow text-ink-mute mb-1.5 block">Description · optional</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A few words about what this list is for…"
                rows={3}
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
                  { value: 'public',  Icon: EyeIcon,        label: 'Public',        desc: 'Anyone can see and save this list' },
                  { value: 'friends', Icon: UserGroupIcon,  label: 'Friends only',  desc: 'Only your friends can see this list' },
                  { value: 'private', Icon: EyeSlashIcon,   label: 'Private',       desc: 'Only you can see this list' },
                ] as const).map(({ value, Icon, label, desc }) => {
                  const checked = privacy === value
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
                        onChange={() => setPrivacy(value)}
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

            {/* Tags */}
            <div className="relative">
              <label className="label-eyebrow text-ink-mute mb-2 block">Tags · {tags.length}/5</label>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {tags.map(tag => (
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

              {tags.length < 5 && (
                <TagAutocomplete
                  value={newTag}
                  onChange={setNewTag}
                  onAdd={handleAddTag}
                  currentTags={tags}
                  availableTags={availableTags}
                  className="mb-3"
                  showPopularTags={true}
                  popularLabel="Popular tags"
                  persistTo="tags"
                />
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 sm:px-6 py-4 border-t border-edge relative z-10">
          <button
            type="button"
            onClick={handleClose}
            className="btn-secondary flex-1 h-12 font-semibold text-[14px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
            className="btn-cta flex-1 h-12 font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating…' : 'Create list'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateListModal
