import { useState, useEffect } from 'react'
import { XMarkIcon, CameraIcon, EyeIcon, EyeSlashIcon, UsersIcon, PencilIcon } from '@heroicons/react/24/outline'
import AddressAutocomplete from './AddressAutocomplete'
import TagAutocomplete from './TagAutocomplete'
import { useMemo } from 'react'
import { firebaseDataService } from '../services/firebaseDataService.js'
import Button from './Button'

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
  const [location, setLocation] = useState<{ address: string; lat?: number; lng?: number }>({ address: '' })
  const [availableTags, setAvailableTags] = useState<string[]>([])

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

  return (
    <div className="fixed inset-0 z-[100200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-charcoal-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-botanical border border-linen-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-[1] p-6 border-b border-linen-200 bg-white/95 backdrop-blur-glass rounded-t-3xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-semibold text-charcoal-800">Edit List</h2>
            <button
              onClick={onClose}
              className="btn-icon"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 160px)', WebkitOverflowScrolling: 'touch' }}>
          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-3">Cover Image</label>
            <div className="relative">
              <img
                src={formData.coverImage || undefined as any}
                alt="List cover"
                className="w-full h-32 rounded-2xl object-cover border border-linen-200"
                onError={(e) => {
                  e.currentTarget.src = '/assets/leaf.png'
                }}
              />
              <button className="absolute bottom-2 right-2 btn-icon bg-sage-500 text-white hover:bg-sage-600 border-0">
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

          {/* Location (moved here under name) */}
          <div className="relative overflow-visible">
            <label className="block text-sm font-medium text-charcoal-700 mb-2">List Location (optional)</label>
            <AddressAutocomplete
              value={location.address}
              onPlaceSelect={(formatted, details) => {
                setLocation({
                  address: formatted,
                  lat: details?.geometry?.location?.lat?.() as number | undefined,
                  lng: details?.geometry?.location?.lng?.() as number | undefined,
                })
              }}
              placeholder="e.g., Miami, Florida, USA"
            />
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
            <TagAutocomplete
              value={newTag}
              onChange={setNewTag}
              onAdd={handleAddTag}
              currentTags={formData.tags}
              availableTags={availableTags}
            />
          </div>

          {/* Location: removed old manual inputs */}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-[1] p-6 border-t border-linen-200 bg-white/95 backdrop-blur-glass rounded-b-3xl">
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={isSaving || !formData.name.trim()}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditListModal 