import type { List } from '../types/index.js'
import { XMarkIcon, PhotoIcon, EyeIcon, EyeSlashIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { useState, useRef } from 'react'

interface CreateListModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => void
}

const CreateListModal = ({ isOpen, onClose, onCreate }: CreateListModalProps) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'friends'>('public')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [coverImage, setCoverImage] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const availableTags = ['coffee', 'food', 'outdoors', 'work', 'study', 'cozy', 'trendy', 'local', 'authentic', 'romantic', 'social', 'quiet', 'artisan', 'hidden-gems', 'weekend', 'brunch', 'adventure', 'nature', 'books', 'date-night']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        privacy,
        tags,
        coverImage: coverImage || undefined
      })
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
    setCoverImage('')
    setIsSubmitting(false)
    onClose()
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim()) && tags.length < 5) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleTagClick = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag])
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setCoverImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setCoverImage('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-botanical border border-linen-200 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-linen-200">
          <h2 className="text-xl font-serif font-semibold text-charcoal-800">Create New List</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-charcoal-400 hover:text-charcoal-600 hover:bg-linen-100 transition"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-180px)] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cover Image */}
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-3">Cover Image</label>
              <div className="relative">
                {coverImage ? (
                  <div className="relative">
                    <img 
                      src={coverImage} 
                      alt="Cover preview" 
                      className="w-full h-32 object-cover rounded-xl border border-linen-200"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-charcoal-900/70 text-white hover:bg-charcoal-900 transition"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-linen-300 rounded-xl flex flex-col items-center justify-center text-charcoal-400 hover:text-charcoal-600 hover:border-sage-300 transition"
                  >
                    <PhotoIcon className="w-8 h-8 mb-2" />
                    <span className="text-sm">Upload cover image</span>
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
              <label htmlFor="name" className="block text-sm font-medium text-charcoal-700 mb-2">
                List Name *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Cozy Coffee Spots"
                className="w-full px-4 py-3 rounded-xl border border-linen-200 bg-white text-charcoal-700 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-transparent"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-charcoal-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this list is about..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-linen-200 bg-white text-charcoal-700 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-transparent resize-none"
              />
            </div>

            {/* Privacy */}
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-3">Privacy</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-linen-200 hover:bg-linen-50 cursor-pointer transition">
                  <input
                    type="radio"
                    name="privacy"
                    value="public"
                    checked={privacy === 'public'}
                    onChange={(e) => setPrivacy(e.target.value as 'public')}
                    className="text-sage-600 focus:ring-sage-200"
                  />
                  <div className="flex items-center gap-2">
                    <EyeIcon className="w-5 h-5 text-sage-600" />
                    <div>
                      <div className="font-medium text-charcoal-700">Public</div>
                      <div className="text-sm text-charcoal-500">Anyone can see and save this list</div>
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-linen-200 hover:bg-linen-50 cursor-pointer transition">
                  <input
                    type="radio"
                    name="privacy"
                    value="friends"
                    checked={privacy === 'friends'}
                    onChange={(e) => setPrivacy(e.target.value as 'friends')}
                    className="text-sage-600 focus:ring-sage-200"
                  />
                  <div className="flex items-center gap-2">
                    <UserGroupIcon className="w-5 h-5 text-sage-600" />
                    <div>
                      <div className="font-medium text-charcoal-700">Friends Only</div>
                      <div className="text-sm text-charcoal-500">Only your friends can see this list</div>
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-linen-200 hover:bg-linen-50 cursor-pointer transition">
                  <input
                    type="radio"
                    name="privacy"
                    value="private"
                    checked={privacy === 'private'}
                    onChange={(e) => setPrivacy(e.target.value as 'private')}
                    className="text-sage-600 focus:ring-sage-200"
                  />
                  <div className="flex items-center gap-2">
                    <EyeSlashIcon className="w-5 h-5 text-sage-600" />
                    <div>
                      <div className="font-medium text-charcoal-700">Private</div>
                      <div className="text-sm text-charcoal-500">Only you can see this list</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-3">Tags ({tags.length}/5)</label>
              
              {/* Selected Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full text-sm font-medium bg-sage-100 text-sage-700 border border-sage-200 flex items-center gap-1"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-sage-500 hover:text-sage-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add Tag Input */}
              {tags.length < 5 && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Add a tag..."
                    className="flex-1 px-3 py-2 rounded-lg border border-linen-200 bg-white text-charcoal-700 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-transparent text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    disabled={!newTag.trim()}
                    className="px-3 py-2 rounded-lg bg-sage-100 text-sage-700 font-medium text-sm hover:bg-sage-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Add
                  </button>
                </div>
              )}

              {/* Available Tags */}
              <div>
                <div className="text-xs text-charcoal-500 mb-2">Popular tags:</div>
                <div className="flex flex-wrap gap-2">
                  {availableTags
                    .filter(tag => !tags.includes(tag))
                    .slice(0, 10)
                    .map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagClick(tag)}
                        disabled={tags.length >= 5}
                        className="px-2 py-1 rounded-full text-xs font-medium bg-linen-100 text-charcoal-600 border border-linen-200 hover:bg-sage-50 hover:text-sage-700 hover:border-sage-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        #{tag}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-linen-200">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-3 px-4 rounded-xl border border-linen-200 text-charcoal-600 font-medium hover:bg-linen-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-sage-500 to-gold-500 text-white font-medium hover:shadow-botanical disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSubmitting ? 'Creating...' : 'Create List'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateListModal 