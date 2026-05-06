import { useState, useRef, useEffect } from 'react'
import { XMarkIcon, BookmarkIcon, EyeSlashIcon, CameraIcon, MusicalNoteIcon, LinkIcon, CheckCircleIcon, HeartIcon, HandThumbUpIcon, HandThumbDownIcon, MinusCircleIcon } from '@heroicons/react/24/outline'
import { createPortal } from 'react-dom'
import { extractEmbedData, createEmbedPreview, parseSocialMediaUrl, validateUrl, getPlatformPlaceholder, getPlatformDisplayName, type EmbedData, type EmbedPreview } from '../utils/embedUtils'
import { firebasePostService } from '../services/firebasePostService'
import { firebaseListService } from '../services/firebaseListService'
import { useAuth } from '../contexts/AuthContext'
import type { List } from '../types'

interface EmbedFromModalProps {
  isOpen: boolean
  onClose: () => void
  onEmbed?: (embedData: EmbedPostData) => void
}

interface EmbedPostData {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'other'
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
  const { currentUser } = useAuth()
  const [step, setStep] = useState<'url' | 'details'>('url')
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState<'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'other'>('instagram')
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
  const [userLists, setUserLists] = useState<List[]>([])

  useEffect(() => {
    const fetchLists = async () => {
      if (currentUser) {
        const lists = await firebaseListService.getUserLists(currentUser.id);
        setUserLists(lists);
      }
    };
    if (isOpen) {
      fetchLists();
    }
  }, [isOpen, currentUser]);

  const availableTags = ['cozy', 'trendy', 'quiet', 'local', 'charming', 'authentic', 'chill', 'work-friendly', 'romantic', 'family-friendly']

  // Filter lists based on search query (exclude automatic lists)
  const filteredLists = userLists.filter(list =>
    list.name.toLowerCase().includes(listSearchQuery.toLowerCase())
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

  const handleSubmit = async () => {
    if (!embedPreview || !currentUser) return

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
      listIds: Array.from(selectedListIds)
    }
    
    await firebasePostService.createEmbedPost(embedData, currentUser.id);

    // Notify subscribers (Profile activity, list views, friends feed) so
    // they re-fetch instead of waiting for a route change.
    try {
      window.dispatchEvent(new CustomEvent('this-is:posted', {
        detail: { listIds: Array.from(selectedListIds), embed: true }
      }))
    } catch (e) { console.warn('[embed] post-event dispatch failed', e) }

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
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="modal-paper w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-edge overflow-hidden max-h-[92vh] flex flex-col"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-edge relative z-10">
          <div className="flex items-center gap-2 min-w-0">
            {step === 'details' && (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Back"
                className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
              >
                <XMarkIcon className="w-5 h-5 rotate-45" />
              </button>
            )}
            <div className="min-w-0">
              <p className="label-eyebrow text-ink-mute">{step === 'url' ? 'Embed from…' : 'Add to lists'}</p>
            </div>
          </div>
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
        <div className="flex-1 overflow-y-auto relative z-10">
          {step === 'url' && (
            <div className="px-5 sm:px-6 py-5 space-y-5">
              {/* Platform Selection */}
              <div>
                <p className="label-eyebrow text-ink-mute mb-2.5">Platform</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'instagram', label: 'Instagram', Icon: CameraIcon },
                    { key: 'tiktok', label: 'TikTok', Icon: MusicalNoteIcon },
                    { key: 'other', label: 'Other', Icon: LinkIcon }
                  ].map(({ key, label, Icon }) => {
                    const active = platform === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPlatform(key as any)}
                        aria-pressed={active}
                        className={`p-3 rounded-xl border transition-colors flex flex-col items-center justify-center gap-1.5 ${active ? 'border-ink bg-paper-deep' : 'border-edge bg-card hover:border-ink/40'}`}
                      >
                        <Icon className="w-5 h-5 text-ink" />
                        <div className="text-[13px] font-medium text-ink">{label}</div>
                      </button>
                    )
                  })}
                </div>
                <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-2">
                  Platform auto-detected from URL
                </p>
              </div>

              {/* URL Input */}
              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div>
                  <label htmlFor="embed-url" className="label-eyebrow text-ink-mute mb-1.5 block">
                    {platform === 'instagram' ? 'Instagram Post URL' :
                     platform === 'tiktok' ? 'TikTok Video URL' : 'Social Media URL'}
                  </label>
                  <input
                    id="embed-url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={getPlatformPlaceholder(platform)}
                    className="w-full h-11 px-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                    required
                    autoComplete="url"
                  />
                  {error && (
                    <p className="text-[12px] text-red-700 mt-2">{error}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!url.trim() || isLoading}
                  className="btn-cta w-full h-12 font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Loading…' : 'Continue'}
                </button>
              </form>
            </div>
          )}

          {step === 'details' && embedPreview && (
            <div className="px-5 sm:px-6 py-5 space-y-5">
              {/* Embed Preview */}
              <div className="bg-card rounded-xl p-4 border border-edge">
                <div className="space-y-3">
                  {/* Header with platform and author */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 bg-paper-deep text-ink rounded-full font-medium">
                      {getPlatformDisplayName(embedPreview.platform)}
                    </span>
                    <span className="text-[13px] font-medium text-ink">{embedPreview.author}</span>
                    <span className="text-[12px] text-ink-mute">{embedPreview.timestamp}</span>
                  </div>
                  
                  {/* Content preview with thumbnail */}
                  <div className="flex gap-3">
                    {embedPreview.mediaUrl && (
                      <img
                        src={embedPreview.mediaUrl}
                        alt="Content preview"
                        className="w-20 h-20 object-cover rounded-[10px] ring-1 ring-edge flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      {embedPreview.title && (
                        <h4 className="font-display text-[16px] leading-tight text-ink mb-1 line-clamp-2">
                          {embedPreview.title}
                        </h4>
                      )}
                      <p className="text-[13px] text-ink-soft line-clamp-3">
                        {embedPreview.description || embedPreview.content}
                      </p>
                      <p className="font-mono text-[10px] tracking-[0.06em] text-ink-mute mt-2 truncate">
                        {embedPreview.url}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Selection */}
              <div>
                <label className="label-eyebrow text-ink-mute mb-2.5 block">How do you feel about this?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'want', label: 'Want', Icon: BookmarkIcon },
                    { key: 'tried', label: 'Tried', Icon: CheckCircleIcon },
                    { key: 'loved', label: 'Loved', Icon: HeartIcon }
                  ].map(({ key, label, Icon }) => {
                    const active = status === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStatus(key as any)}
                        aria-pressed={active}
                        className={`p-3 rounded-xl border transition-colors flex flex-col items-center justify-center gap-1.5 ${
                          active
                            ? 'border-ink bg-paper-deep text-ink'
                            : 'border-edge bg-card text-ink hover:border-ink/40'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <div className="text-[13px] font-medium">{label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tried Feeling (only if status is 'tried') */}
              {status === 'tried' && (
                <div>
                  <label className="label-eyebrow text-ink-mute mb-2.5 block">How was it?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'liked', label: 'Liked', Icon: HandThumbUpIcon },
                      { key: 'neutral', label: 'Okay', Icon: MinusCircleIcon },
                      { key: 'disliked', label: 'Disliked', Icon: HandThumbDownIcon }
                    ].map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        onClick={() => setTriedFeeling(key as any)}
                        className={`p-3 rounded-xl border transition-colors flex flex-col items-center justify-center gap-1.5 ${
                          triedFeeling === key
                            ? 'border-ink bg-paper-deep text-ink'
                            : 'border-edge bg-card text-ink hover:border-ink/40'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <div className="text-[12px] font-medium">{label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label htmlFor="embed-description" className="label-eyebrow text-ink-mute mb-1.5 block">Add your thoughts</label>
                <textarea
                  id="embed-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Share your experience or thoughts..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 resize-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="label-eyebrow text-ink-mute mb-1.5 block">Tags</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-paper-deep text-ink rounded-full text-sm"
                    >
                      #{tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                        className="hover:text-ink"
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
                    className="flex-1 h-10 px-3.5 rounded-full border border-edge bg-card text-[13px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  />
                  <button
                    onClick={handleAddTag}
                    className="btn-secondary h-10 px-4 label-eyebrow"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="bg-accent-soft rounded-xl p-4 border border-edge">
                <div className="flex items-start gap-3">
                  <EyeSlashIcon className="w-5 h-5 text-accent-deep mt-0.5" />
                  <div>
                    <div className="text-[14px] font-medium text-ink mb-1">Private Embed</div>
                    <div className="text-[13px] text-ink-soft">
                      Embedded content is always private to respect copyright and avoid content theft. Only you can see this post.
                    </div>
                  </div>
                </div>
              </div>

              {/* Lists */}
              <div>
                <label className="label-eyebrow text-ink-mute mb-2.5 block">Add to Lists</label>
                <input
                  type="text"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  placeholder="Search lists..."
                  className="w-full h-11 px-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 mb-3"
                />
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {filteredLists.map(list => {
                    const checked = selectedListIds.has(list.id)
                    return (
                      <label
                        key={list.id}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${checked ? 'bg-paper-deep' : 'hover:bg-paper-deep'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleList(list.id)}
                          className="w-4 h-4 accent-ink rounded"
                        />
                        <BookmarkIcon className="w-5 h-5 text-ink-mute" />
                        <span className="text-[14px] font-medium text-ink truncate">{list.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'details' && (
          <div className="px-5 sm:px-6 py-4 border-t border-edge relative z-10">
            <button
              type="button"
              onClick={handleSubmit}
              className="btn-cta w-full h-12 font-semibold text-[15px]"
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
