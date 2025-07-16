import { useState, useRef } from 'react'
import { XMarkIcon, CameraIcon, MapPinIcon, TagIcon, EyeIcon, EyeSlashIcon, UsersIcon, PhotoIcon, MagnifyingGlassIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { createPortal } from 'react-dom'

// Mock EXIF extraction (replace with real library if needed)
async function extractLocationFromImage(file: File): Promise<{ lat: number, lng: number } | null> {
  // In a real app, use exif-js or piexifjs to extract GPS
  // Here, we mock: if filename contains 'oakland', return Oakland coords
  if (file.name.toLowerCase().includes('oakland')) {
    return { lat: 37.8044, lng: -122.2712 }
  }
  return null
}

interface CreatePostProps {
  isOpen: boolean
  onClose: () => void
  preSelectedHub?: CreatePostHub
  preSelectedListIds?: string[]
}

interface CreatePostHub {
  id: string
  name: string
  address: string
  description?: string
  lat?: number
  lng?: number
}

const CreatePost = ({ isOpen, onClose, preSelectedHub, preSelectedListIds }: CreatePostProps) => {
  const [step, setStep] = useState<'photo' | 'location' | 'details'>('photo')
  const [photos, setPhotos] = useState<File[]>([])
  const [extractedLocation, setExtractedLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [hubGuess, setHubGuess] = useState<CreatePostHub | null>(null)
  const [hubConfirmed, setHubConfirmed] = useState(false)
  const [selectedHub, setSelectedHub] = useState<CreatePostHub | null>(preSelectedHub || null)
  const [isCreatingNewHub, setIsCreatingNewHub] = useState(false)
  const [newHubName, setNewHubName] = useState('')
  const [newHubAddress, setNewHubAddress] = useState('')
  const [newHubDescription, setNewHubDescription] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [searchResults, setSearchResults] = useState<CreatePostHub[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [howWasIt, setHowWasIt] = useState<'loved' | 'tried'>('loved')
  const [triedFeeling, setTriedFeeling] = useState<'liked' | 'neutral' | 'disliked'>('liked')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'private'>('public')
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set(preSelectedListIds || []))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Mock data
  const availableTags = ['cozy', 'trendy', 'quiet', 'local', 'charming', 'authentic', 'chill', 'work-friendly', 'romantic', 'family-friendly']
  const userLists = [
    { id: '4', name: 'Coffee Spots' },
    { id: '5', name: 'Book Nooks' },
    { id: '6', name: 'Vegan Eats' },
  ]
  const mockSearchResults: CreatePostHub[] = [
    { id: '1', name: 'Blue Bottle Coffee', address: '300 Webster St, Oakland, CA', lat: 37.8044, lng: -122.2712 },
    { id: '2', name: 'Tacos El Gordo', address: '123 Mission St, San Francisco, CA', lat: 37.7749, lng: -122.4194 },
    { id: '3', name: 'Golden Gate Park', address: 'San Francisco, CA', lat: 37.7694, lng: -122.4862 },
  ]

  // Step 1: Photo upload/take
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      setPhotos(files)
      // Try to extract location from the first photo
      const loc = await extractLocationFromImage(files[0])
      setExtractedLocation(loc)
      
      // If hub is pre-selected, skip to details
      if (selectedHub) {
        setStep('details')
      } else {
        setStep('location')
        // Try to guess hub if location found
        if (loc) {
          // Find closest mock hub (in real app, use geospatial search)
          const guess = mockSearchResults.find(hub => Math.abs(hub.lat! - loc.lat) < 0.1 && Math.abs(hub.lng! - loc.lng) < 0.1)
          if (guess) setHubGuess(guess)
        }
      }
    }
  }
  const handleTakePhoto = () => {
    photoInputRef.current?.click()
  }
  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  // Step 2: Location/hub selection
  const handleConfirmHub = () => {
    setSelectedHub(hubGuess)
    setHubConfirmed(true)
    setStep('details')
  }
  const handleRejectHub = () => {
    setHubGuess(null)
    setSelectedHub(null)
    setHubConfirmed(false)
  }
  const handleLocationSearch = (query: string) => {
    setLocationSearch(query)
    if (query.length > 2) {
      setIsSearching(true)
      setTimeout(() => {
        setSearchResults(mockSearchResults.filter(hub => 
          hub.name.toLowerCase().includes(query.toLowerCase()) ||
          hub.address.toLowerCase().includes(query.toLowerCase())
        ))
        setIsSearching(false)
      }, 500)
    } else {
      setSearchResults([])
    }
  }
  const handleSelectHub = (hub: CreatePostHub) => {
    setSelectedHub(hub)
    setHubConfirmed(true)
    setStep('details')
  }
  const handleCreateNewHub = () => {
    if (newHubName && newHubAddress) {
      const newHub: CreatePostHub = {
        id: 'new',
        name: newHubName,
        address: newHubAddress,
        description: newHubDescription
      }
      setSelectedHub(newHub)
      setHubConfirmed(true)
      setStep('details')
    }
  }

  // Step 3: Details
  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(prev => [...prev, newTag.trim()])
      setNewTag('')
    }
  }
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove))
  }
  const handleSubmit = () => {
    // In a real app, this would submit the post
    onClose()
  }
  const resetForm = () => {
    setStep('photo')
    setPhotos([])
    setExtractedLocation(null)
    setHubGuess(null)
    setHubConfirmed(false)
    setSelectedHub(preSelectedHub || null)
    setIsCreatingNewHub(false)
    setNewHubName('')
    setNewHubAddress('')
    setNewHubDescription('')
    setLocationSearch('')
    setSearchResults([])
    setHowWasIt('loved')
    setTriedFeeling('liked')
    setDescription('')
    setTags([])
    setNewTag('')
    setPrivacy('public')
    setSelectedListIds(new Set(preSelectedListIds || []))
  }
  const handleClose = () => {
    resetForm()
    onClose()
  }

  // Step navigation
  const handleBack = () => {
    if (step === 'location') setStep('photo')
    else if (step === 'details') setStep('location')
    else handleClose()
  }

  if (!isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-botanical border border-linen-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-linen-200 bg-linen-50 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-soft hover:shadow-botanical transition-all duration-200"
            aria-label="Back"
          >
            <ArrowLeftIcon className="w-6 h-6 text-charcoal-600" />
          </button>
          <h2 className="text-xl font-serif font-semibold text-charcoal-700 flex-1 text-center">Create Post</h2>
          <button
            onClick={handleClose}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-soft hover:shadow-botanical transition-all duration-200"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6 text-charcoal-600" />
          </button>
        </div>
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mt-4 px-6">
          <div className={`w-3 h-3 rounded-full ${step === 'photo' ? 'bg-sage-500' : 'bg-sage-200'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'location' ? 'bg-sage-500' : 'bg-sage-200'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'details' ? 'bg-sage-500' : 'bg-sage-200'}`} />
        </div>
        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-12rem)] overflow-y-auto">
          {/* Step 1: Photo */}
          {step === 'photo' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-charcoal-700 mb-2">Add Photos</h3>
                <p className="text-charcoal-500 text-sm mb-4">Share your experience by uploading or taking photos. You can add multiple images.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleTakePhoto}
                  className="aspect-square bg-linen-50 border-2 border-dashed border-linen-300 rounded-2xl flex flex-col items-center justify-center hover:bg-linen-100 transition"
                >
                  <CameraIcon className="w-8 h-8 text-charcoal-400 mb-2" />
                  <span className="text-sm text-charcoal-500">Take Photo</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square bg-linen-50 border-2 border-dashed border-linen-300 rounded-2xl flex flex-col items-center justify-center hover:bg-linen-100 transition"
                >
                  <PhotoIcon className="w-8 h-8 text-charcoal-400 mb-2" />
                  <span className="text-sm text-charcoal-500">Upload Photo(s)</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              {photos.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-charcoal-700">Selected Photos</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative aspect-square group">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-full object-cover rounded-xl"
                        />
                        <button
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs opacity-80 group-hover:opacity-100"
                          aria-label="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => setStep('location')}
                disabled={photos.length === 0}
                className="w-full bg-sage-400 text-white py-3 rounded-xl font-medium hover:bg-sage-500 transition disabled:bg-charcoal-200 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}
          {/* Step 2: Location/Hub */}
          {step === 'location' && (
            <div className="space-y-6">
              {extractedLocation && !hubGuess && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-xl text-yellow-800">
                  <span>We found a location in your photo, but couldn't match it to a hub. Please search for the place below.</span>
                </div>
              )}
              {hubGuess && !hubConfirmed && (
                <div className="bg-sage-50 border-l-4 border-sage-400 p-4 rounded-xl text-sage-800 flex flex-col gap-2">
                  <span>We think this photo was taken at:</span>
                  <div className="font-semibold">{hubGuess.name}</div>
                  <div className="text-sm text-sage-700">{hubGuess.address}</div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleConfirmHub}
                      className="bg-sage-400 text-white px-4 py-2 rounded-xl font-medium hover:bg-sage-500 transition"
                    >
                      Yes, that's correct
                    </button>
                    <button
                      onClick={handleRejectHub}
                      className="bg-linen-200 text-sage-700 px-4 py-2 rounded-xl font-medium hover:bg-linen-300 transition"
                    >
                      No, search for another
                    </button>
                  </div>
                </div>
              )}
              {!hubGuess && !hubConfirmed && (
                <div>
                  <h3 className="text-lg font-semibold text-charcoal-700 mb-2">Where are you?</h3>
                  <p className="text-charcoal-500 text-sm mb-4">Search for a place or create a new hub</p>
                  <div className="relative mb-4">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-charcoal-400" />
                    <input
                      type="text"
                      value={locationSearch}
                      onChange={(e) => handleLocationSearch(e.target.value)}
                      placeholder="Search for a place..."
                      className="w-full pl-10 pr-4 py-3 border border-linen-200 rounded-xl bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200"
                    />
                  </div>
                  {isSearching && (
                    <div className="text-center py-4 text-charcoal-500">
                      Searching...
                    </div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.map((hub) => (
                        <button
                          key={hub.id}
                          onClick={() => handleSelectHub(hub)}
                          className="w-full p-3 text-left bg-white border border-linen-200 rounded-xl hover:bg-linen-50 transition"
                        >
                          <div className="font-medium text-charcoal-700">{hub.name}</div>
                          <div className="text-sm text-charcoal-500">{hub.address}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {locationSearch && searchResults.length === 0 && !isSearching && (
                    <div className="text-center py-4">
                      <p className="text-charcoal-500 mb-4">Can't find what you're looking for?</p>
                      <button
                        onClick={() => setIsCreatingNewHub(true)}
                        className="bg-sage-400 text-white px-4 py-2 rounded-xl font-medium hover:bg-sage-500 transition"
                      >
                        Create New Hub
                      </button>
                    </div>
                  )}
                </div>
              )}
              {isCreatingNewHub && (
                <div className="bg-linen-50 rounded-2xl p-4 space-y-4">
                  <h4 className="font-semibold text-charcoal-700">Create New Hub</h4>
                  <input
                    type="text"
                    value={newHubName}
                    onChange={(e) => setNewHubName(e.target.value)}
                    placeholder="Place name"
                    className="w-full px-4 py-3 border border-linen-200 rounded-xl bg-white text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200"
                  />
                  <input
                    type="text"
                    value={newHubAddress}
                    onChange={(e) => setNewHubAddress(e.target.value)}
                    placeholder="Address"
                    className="w-full px-4 py-3 border border-linen-200 rounded-xl bg-white text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200"
                  />
                  <textarea
                    value={newHubDescription}
                    onChange={(e) => setNewHubDescription(e.target.value)}
                    placeholder="Short description (optional)"
                    rows={3}
                    className="w-full px-4 py-3 border border-linen-200 rounded-xl bg-white text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 resize-none"
                  />
                  <button
                    onClick={handleCreateNewHub}
                    disabled={!newHubName || !newHubAddress}
                    className="w-full bg-sage-400 text-white py-3 rounded-xl font-medium hover:bg-sage-500 transition disabled:bg-charcoal-200 disabled:cursor-not-allowed"
                  >
                    Create Hub & Continue
                  </button>
                </div>
              )}
              <button
                onClick={() => setStep('photo')}
                className="w-full bg-linen-200 text-sage-700 py-3 rounded-xl font-medium hover:bg-linen-300 transition"
              >
                Back
              </button>
            </div>
          )}
          {/* Step 3: Details */}
          {step === 'details' && selectedHub && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-charcoal-700 mb-2">Post Details</h3>
                <p className="text-charcoal-500 text-sm mb-4">Tell us about your experience</p>
              </div>
              {/* How was it? Only Loved/Tried */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-3">How was it?</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['loved', 'tried'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setHowWasIt(type)}
                      className={`p-3 rounded-xl border-2 transition ${
                        howWasIt === type
                          ? 'border-sage-400 bg-sage-50 text-sage-700'
                          : 'border-linen-200 bg-white text-charcoal-600 hover:border-sage-200'
                      }`}
                    >
                      <div className="text-sm font-medium capitalize">{type}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* If tried, show feeling */}
              {howWasIt === 'tried' && (
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-3">How did you feel about it?</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['liked', 'neutral', 'disliked'] as const).map((feeling) => (
                      <button
                        key={feeling}
                        onClick={() => setTriedFeeling(feeling)}
                        className={`p-3 rounded-xl border-2 transition ${
                          triedFeeling === feeling
                            ? 'border-sage-400 bg-sage-50 text-sage-700'
                            : 'border-linen-200 bg-white text-charcoal-600 hover:border-sage-200'
                        }`}
                      >
                        <div className="text-sm font-medium capitalize">{feeling}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Share your experience..."
                  rows={4}
                  className="w-full px-4 py-3 border border-linen-200 rounded-xl bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 resize-none"
                />
              </div>
              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-sage-100 text-sage-700 rounded-full text-sm flex items-center gap-2"
                    >
                      #{tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-sage-500 hover:text-sage-700"
                      >
                        ×
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
                    className="flex-1 px-4 py-2 border border-linen-200 rounded-xl bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-sage-400 text-white rounded-xl hover:bg-sage-500 transition"
                  >
                    Add
                  </button>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-charcoal-500 mb-2">Popular tags:</p>
                  <div className="flex flex-wrap gap-1">
                    {availableTags.slice(0, 6).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => !tags.includes(tag) && setTags(prev => [...prev, tag])}
                        disabled={tags.includes(tag)}
                        className={`px-2 py-1 rounded-full text-xs transition ${
                          tags.includes(tag)
                            ? 'bg-sage-200 text-sage-600 cursor-not-allowed'
                            : 'bg-linen-100 text-charcoal-600 hover:bg-sage-100'
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* List Selection (exclude All Loved/All Tried) */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-2">Save to Lists (optional)</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {userLists.map((list) => (
                    <label
                      key={list.id}
                      className={`flex items-center gap-3 p-3 border border-linen-200 rounded-xl cursor-pointer hover:bg-linen-50 transition ${
                        selectedListIds.has(list.id)
                          ? 'border-sage-300 bg-sage-50'
                          : 'border-linen-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedListIds.has(list.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedListIds)
                          if (e.target.checked) {
                            newSet.add(list.id)
                          } else {
                            newSet.delete(list.id)
                          }
                          setSelectedListIds(newSet)
                        }}
                        className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-charcoal-700">{list.name}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedListIds.size > 0 && (
                  <div className="mt-2 text-xs text-charcoal-500">
                    Selected {selectedListIds.size} list{selectedListIds.size !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              {/* Privacy Settings */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-2">Privacy</label>
                <div className="space-y-2">
                  {([
                    { key: 'public', label: 'Public', icon: EyeIcon, desc: 'Anyone can see this post' },
                    { key: 'friends', label: 'Friends', icon: UsersIcon, desc: 'Only your friends can see this post' },
                    { key: 'private', label: 'Private', icon: EyeSlashIcon, desc: 'Only you can see this post' }
                  ] as const).map(({ key, label, icon: Icon, desc }) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 p-3 border border-linen-200 rounded-xl cursor-pointer hover:bg-linen-50 transition"
                    >
                      <input
                        type="radio"
                        name="privacy"
                        value={key}
                        checked={privacy === key}
                        onChange={() => setPrivacy(key)}
                        className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                      />
                      <Icon className="w-5 h-5 text-charcoal-400" />
                      <div>
                        <div className="font-medium text-charcoal-700">{label}</div>
                        <div className="text-sm text-charcoal-500">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={handleSubmit}
                className="w-full bg-sage-400 text-white py-3 rounded-xl font-medium hover:bg-sage-500 transition"
              >
                Create Post
              </button>
              <button
                onClick={() => setStep('location')}
                className="w-full bg-linen-200 text-sage-700 py-3 rounded-xl font-medium hover:bg-linen-300 transition"
              >
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default CreatePost 