import { useState, useRef } from 'react'
import { XMarkIcon, LinkIcon, PhotoIcon, HeartIcon, BookmarkIcon, EyeIcon, EyeSlashIcon, UsersIcon, TagIcon, PlusIcon } from '@heroicons/react/24/outline'
import { createPortal } from 'react-dom'
import { extractEmbedData, createEmbedPreview, parseSocialMediaUrl, validateUrl, getPlatformPlaceholder, getPlatformDisplayName, type EmbedData, type EmbedPreview } from '../utils/embedUtils'

interface EmbedFromModalProps {
  isOpen: boolean
  onClose: () => void
  onEmbed?: (embedData: EmbedPostData) => void
}

interface EmbedPostData {
  platform: 'instagram' | 'tiktok' | 'other'
  url: string
  content: string
  mediaUrl?: string
  status: 'want' | 'tried' | 'loved'
  triedFeeling?: 'liked' | 'neutral' | 'disliked'
  description: string
  tags: string[]
  privacy: 'public' | 'friends' | 'private'
  listIds: string[]
}

const EmbedFromModal = ({ isOpen, onClose, onEmbed }: EmbedFromModalProps) => {
  const [step, setStep] = useState<'url' | 'details'>('url')
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState<'instagram' | 'tiktok' | 'other'>('instagram')
  const [isLoading, setIsLoading] = useState(false)
  const [embedPreview, setEmbedPreview] = useState<EmbedPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Details step state
  const [status, setStatus] = useState<'want' | 'tried' | 'loved'>('want')
  const [triedFeeling, setTriedFeeling] = useState<'liked' | 'neutral' | 'disliked'>('liked')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'private'>('private') // Always private for embeds
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set())
  const [listSearchQuery, setListSearchQuery] = useState('')

  // Mock data
  const availableTags = ['cozy', 'trendy', 'quiet', 'local', 'charming', 'authentic', 'chill', 'work-friendly', 'romantic', 'family-friendly']
  const userLists = [
    { id: '1', name: 'All Loved', isAutomatic: true },
    { id: '2', name: 'All Tried', isAutomatic: true },
    { id: '3', name: 'All Want', isAutomatic: true },
    { id: '4', name: 'Coffee Spots', isAutomatic: false },
    { id: '5', name: 'Book Nooks', isAutomatic: false },
    { id: '6', name: 'Vegan Eats', isAutomatic: false },
    { id: '7', name: 'Date Night Spots', isAutomatic: false },
    { id: '8', name: 'Work Cafes', isAutomatic: false },
    { id: '9', name: 'Quick Bites', isAutomatic: false },
    { id: '10', name: 'Outdoor Dining', isAutomatic: false },
    { id: '11', name: 'Hidden Gems', isAutomatic: false },
  ]

  // Filter lists based on search query (exclude automatic lists)
  const filteredLists = userLists.filter(list =>
    !list.isAutomatic && list.name.toLowerCase().includes(listSearchQuery.toLowerCase())
  )

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    // Validate URL format
    if (!validateUrl(url)) {
      setError('Please enter a valid URL')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      // Auto-detect platform from URL
      const detectedPlatform = parseSocialMediaUrl(url).platform
      setPlatform(detectedPlatform)
      
      // Extract embed data using the actual algorithm
      const embedData = await extractEmbedData(url)
      
      if (embedData.error) {
        setError(embedData.error)
        setIsLoading(false)
        return
      }
      
      // Create preview for display
      const preview = createEmbedPreview(embedData)
      setEmbedPreview(preview)
      setIsLoading(false)
      setStep('details')
    } catch (error) {
      console.error('Embed extraction error:', error)
      setError('Failed to extract content from this URL. Please check the link and try again.')
      setIsLoading(false)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(prev => [...prev, newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove))
  }

  const handleToggleList = (listId: string) => {
    setSelectedListIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(listId)) {
        newSet.delete(listId)
      } else {
        newSet.add(listId)
      }
      return newSet
    })
  }

  const handleSubmit = () => {
    if (!embedPreview) return

    // Automatically add the appropriate "All" list based on status
    const automaticListId = status === 'loved' ? '1' : status === 'tried' ? '2' : '3'
    const allListIds = new Set(selectedListIds)
    allListIds.add(automaticListId)

    const embedData: EmbedPostData = {
      platform,
      url,
      content: embedPreview.content,
      mediaUrl: embedPreview.mediaUrl,
      status,
      triedFeeling: status === 'tried' ? triedFeeling : undefined,
      description,
      tags,
      privacy: 'private', // Always private for embeds to avoid copyright issues
      listIds: Array.from(allListIds)
    }

    if (onEmbed) {
      onEmbed(embedData)
    }
    onClose()
  }

  const handleClose = () => {
    setStep('url')
    setUrl('')
    setPlatform('instagram')
    setIsLoading(false)
    setEmbedPreview(null)
    setError(null)
    setStatus('want')
    setTriedFeeling('liked')
    setDescription('')
    setTags([])
    setNewTag('')
    setPrivacy('private')
    setSelectedListIds(new Set())
    setListSearchQuery('')
    onClose()
  }

  const handleBack = () => {
    if (step === 'details') {
      setStep('url')
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/20 backdrop-blur-md">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-linen-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-linen-200">
          <div className="flex items-center gap-3">
            {step === 'details' && (
              <button
                onClick={handleBack}
                className="p-2 rounded-full hover:bg-linen-100 transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-charcoal-600 rotate-45" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-serif font-semibold text-charcoal-700">
                {step === 'url' ? 'Embed from...' : 'Add to Lists'}
              </h2>
              <p className="text-sm text-charcoal-500">
                {step === 'url' ? 'Paste a social media link' : 'Choose lists and settings'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-linen-100 transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-charcoal-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'url' && (
            <div className="p-6 space-y-6">
              {/* Platform Selection */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-3">Platform</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'instagram', label: 'Instagram', icon: '📷' },
                    { key: 'tiktok', label: 'TikTok', icon: '🎵' },
                    { key: 'other', label: 'Other', icon: '🔗' }
                  ].map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() => setPlatform(key as any)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        platform === key
                          ? 'border-sage-400 bg-sage-50 text-sage-700'
                          : 'border-linen-200 bg-white text-charcoal-600 hover:border-sage-200'
                      }`}
                    >
                      <div className="text-2xl mb-1">{icon}</div>
                      <div className="text-sm font-medium">{label}</div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-charcoal-500 mt-2">
                  Platform will be auto-detected from your URL
                </p>
              </div>

              {/* URL Input */}
              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-2">
                    {platform === 'instagram' ? 'Instagram Post URL' :
                     platform === 'tiktok' ? 'TikTok Video URL' : 'Social Media URL'}
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={getPlatformPlaceholder(platform)}
                    className="w-full px-4 py-3 border border-linen-200 rounded-xl text-charcoal-600 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300"
                    required
                  />
                  {error && (
                    <p className="text-sm text-coral-600 mt-2">{error}</p>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={!url.trim() || isLoading}
                  className="w-full py-3 bg-sage-500 text-white rounded-xl font-semibold hover:bg-sage-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Loading...' : 'Continue'}
                </button>
              </form>
            </div>
          )}

          {step === 'details' && embedPreview && (
            <div className="p-6 space-y-6">
              {/* Embed Preview */}
              <div className="bg-linen-50 rounded-xl p-4 border border-linen-200">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-sage-100 rounded-full flex items-center justify-center">
                    <LinkIcon className="w-6 h-6 text-sage-600" />
                  </div>
                                    <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-1 bg-sage-100 text-sage-700 rounded-full font-medium">
                        {getPlatformDisplayName(embedPreview.platform)}
                      </span>
                      <span className="font-medium text-charcoal-700">{embedPreview.author}</span>
                      <span className="text-sm text-charcoal-500">{embedPreview.timestamp}</span>
                    </div>
                    <p className="text-sm text-charcoal-600 mb-3">{embedPreview.content}</p>
                    {embedPreview.mediaUrl && (
                      <img
                        src={embedPreview.mediaUrl}
                        alt="Embed preview"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-3">How do you feel about this?</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'want', label: 'Want', icon: '💭', color: 'gold' },
                    { key: 'tried', label: 'Tried', icon: '✅', color: 'sage' },
                    { key: 'loved', label: 'Loved', icon: '❤️', color: 'coral' }
                  ].map(({ key, label, icon, color }) => (
                    <button
                      key={key}
                      onClick={() => setStatus(key as any)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        status === key
                          ? `border-${color}-400 bg-${color}-50 text-${color}-700`
                          : 'border-linen-200 bg-white text-charcoal-600 hover:border-sage-200'
                      }`}
                    >
                      <div className="text-2xl mb-1">{icon}</div>
                      <div className="text-sm font-medium">{label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tried Feeling (only if status is 'tried') */}
              {status === 'tried' && (
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-3">How was it?</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'liked', label: 'Liked', icon: '😊' },
                      { key: 'neutral', label: 'Okay', icon: '😐' },
                      { key: 'disliked', label: 'Disliked', icon: '😕' }
                    ].map(({ key, label, icon }) => (
                      <button
                        key={key}
                        onClick={() => setTriedFeeling(key as any)}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          triedFeeling === key
                            ? 'border-sage-400 bg-sage-50 text-sage-700'
                            : 'border-linen-200 bg-white text-charcoal-600 hover:border-sage-200'
                        }`}
                      >
                        <div className="text-xl mb-1">{icon}</div>
                        <div className="text-xs font-medium">{label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-2">Add your thoughts</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Share your experience or thoughts..."
                  rows={3}
                  className="w-full px-4 py-3 border border-linen-200 rounded-xl text-charcoal-600 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300 resize-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-sage-100 text-sage-700 rounded-full text-sm"
                    >
                      #{tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-sage-800"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag..."
                    className="flex-1 px-3 py-2 border border-linen-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-3 py-2 bg-sage-500 text-white rounded-lg text-sm hover:bg-sage-600 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="bg-sage-50 rounded-xl p-4 border border-sage-200">
                <div className="flex items-start gap-3">
                  <EyeSlashIcon className="w-5 h-5 text-sage-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-sage-700 mb-1">Private Embed</div>
                    <div className="text-sm text-sage-600">
                      Embedded content is always private to respect copyright and avoid content theft. Only you can see this post.
                    </div>
                  </div>
                </div>
              </div>

              {/* Lists */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-3">Add to Lists</label>
                <div className="text-xs text-sage-600 mb-3 bg-sage-50 rounded-lg p-3 border border-sage-200">
                  💡 Your selection will automatically be added to "{status === 'loved' ? 'All Loved' : status === 'tried' ? 'All Tried' : 'All Want'}"
                </div>
                <input
                  type="text"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  placeholder="Search lists..."
                  className="w-full px-4 py-3 border border-linen-200 rounded-xl text-charcoal-600 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300 mb-3"
                />
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {filteredLists.map(list => (
                    <label key={list.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer border border-transparent hover:border-sage-200 hover:bg-sage-50">
                      <input
                        type="checkbox"
                        checked={selectedListIds.has(list.id)}
                        onChange={() => handleToggleList(list.id)}
                        className="w-4 h-4 text-sage-500 focus:ring-sage-400 rounded"
                      />
                      <BookmarkIcon className="w-5 h-5 text-sage-600" />
                      <span className="font-medium text-charcoal-700">{list.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'details' && (
          <div className="p-6 border-t border-linen-200">
            <button
              onClick={handleSubmit}
              className="w-full py-3 bg-sage-500 text-white rounded-xl font-semibold hover:bg-sage-600 transition-colors"
            >
              Create Embed Post
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default EmbedFromModal 