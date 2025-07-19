import { useState, useEffect } from 'react'
import { XMarkIcon, CameraIcon, EyeIcon, EyeSlashIcon, UsersIcon, PencilIcon } from '@heroicons/react/24/outline'

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
  onDelete?: (list: any) => void
  onPrivacyChange?: (listId: string, newPrivacy: 'public' | 'private' | 'friends') => void
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

  useEffect(() => {
    if (isOpen && list) {
      setFormData({
        name: list.name,
        description: list.description,
        privacy: list.privacy,
        tags: [...list.tags],
        coverImage: list.coverImage
      })
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

  const handleSave = async () => {
    if (!formData.name.trim()) return
    
    setIsSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Error saving list:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen || !list) return null

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
            <h2 className="text-xl font-serif font-semibold text-charcoal-800">Edit List</h2>
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
          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-3">Cover Image</label>
            <div className="relative">
              <img
                src={formData.coverImage}
                alt="List cover"
                className="w-full h-32 rounded-2xl object-cover border border-linen-200"
              />
              <button className="absolute bottom-2 right-2 p-2 bg-sage-500 text-white rounded-full shadow-soft hover:bg-sage-600 transition-colors">
                <CameraIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List Name */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-2">List Name</label>
            <div className="relative">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300 transition-colors"
                placeholder="Enter list name"
              />
              <PencilIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-charcoal-400" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-2">Description</label>
            <div className="relative">
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300 transition-colors resize-none"
                placeholder="Describe your list..."
              />
              <PencilIcon className="absolute right-3 top-3 w-4 h-4 text-charcoal-400" />
            </div>
          </div>

          {/* Privacy Settings */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-3">Privacy</label>
            <div className="space-y-2">
              <button
                onClick={() => handlePrivacyChange('public')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  formData.privacy === 'public'
                    ? 'border-sage-300 bg-sage-50 text-sage-700'
                    : 'border-linen-200 bg-linen-50 text-charcoal-600 hover:bg-linen-100'
                }`}
              >
                <EyeIcon className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Public</div>
                  <div className="text-xs opacity-75">Anyone can see this list</div>
                </div>
              </button>

              <button
                onClick={() => handlePrivacyChange('friends')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  formData.privacy === 'friends'
                    ? 'border-sage-300 bg-sage-50 text-sage-700'
                    : 'border-linen-200 bg-linen-50 text-charcoal-600 hover:bg-linen-100'
                }`}
              >
                <UsersIcon className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Friends Only</div>
                  <div className="text-xs opacity-75">Only your friends can see this list</div>
                </div>
              </button>

              <button
                onClick={() => handlePrivacyChange('private')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  formData.privacy === 'private'
                    ? 'border-sage-300 bg-sage-50 text-sage-700'
                    : 'border-linen-200 bg-linen-50 text-charcoal-600 hover:bg-linen-100'
                }`}
              >
                <EyeSlashIcon className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Private</div>
                  <div className="text-xs opacity-75">Only you can see this list</div>
                </div>
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-3">Tags</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.tags.map(tag => (
                <span 
                  key={tag} 
                  className="px-3 py-1 rounded-full text-sm font-medium bg-sage-50 border border-sage-100 text-sage-700 flex items-center gap-2 group hover:bg-sage-100 transition-colors"
                >
                  #{tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="w-4 h-4 rounded-full bg-sage-200 text-sage-600 hover:bg-sage-300 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleAddTag()
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 text-sm"
              />
              <button 
                type="submit"
                className="px-3 py-2 rounded-xl bg-sage-500 text-white text-sm font-medium hover:bg-sage-600 transition-colors"
              >
                Add
              </button>
            </form>
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
              disabled={isSaving || !formData.name.trim()}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                isSaving || !formData.name.trim()
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

export default EditListModal 