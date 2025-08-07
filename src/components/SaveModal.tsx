import { useState, useEffect } from 'react'
import { XMarkIcon, HeartIcon, BookmarkIcon, EyeIcon, PlusIcon, LockClosedIcon, UserGroupIcon, GlobeAltIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid, BookmarkIcon as BookmarkIconSolid, EyeIcon as EyeIconSolid } from '@heroicons/react/24/solid'
import { createPortal } from 'react-dom'
import type { List, Place } from '../types/index.js'
import SearchBar from './SearchBar'

type SaveStatus = 'loved' | 'tried' | 'want'
type TriedRating = 'liked' | 'neutral' | 'disliked'

interface SaveModalProps {
  isOpen: boolean
  onClose: () => void
  place: Place
  userLists: List[]
  selectedListIds?: string[]
  onSave: (status: SaveStatus, rating?: TriedRating, listIds?: string[], note?: string, savedFromListId?: string) => void
  onCreateList: (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => void
  savedFromListId?: string
}

const SaveModal: React.FC<SaveModalProps> = ({
  isOpen,
  onClose,
  place,
  userLists,
  selectedListIds: selectedListIdsProp,
  onSave,
  onCreateList,
  savedFromListId
}) => {
  
  const [selectedStatus, setSelectedStatus] = useState<SaveStatus | null>(null)
  const [triedRating, setTriedRating] = useState<TriedRating | null>(null)
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set(selectedListIdsProp || []))
  const [note, setNote] = useState('')
  const [showCreateList, setShowCreateList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')
  // Mock user preference - in real app this would come from user settings
  const userPrivacyPreference: 'public' | 'private' | 'friends' = 'public'
  const [newListPrivacy, setNewListPrivacy] = useState<'public' | 'private' | 'friends'>(userPrivacyPreference)
  const [newListTags, setNewListTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [newListCoverImage, setNewListCoverImage] = useState('')
  const [listSearch, setListSearch] = useState('')
  const [filteredLists, setFilteredLists] = useState(userLists)

  // Update filtered lists when user types or userLists change
  useEffect(() => {
    setFilteredLists(
      userLists.filter(list =>
        list.name.toLowerCase().includes(listSearch.toLowerCase())
      )
    )
  }, [listSearch, userLists])

  useEffect(() => {
    if (selectedListIdsProp) {
      setSelectedListIds(new Set(selectedListIdsProp))
    }
  }, [selectedListIdsProp])

  const handleCreateList = () => {
    if (newListName.trim()) {
      onCreateList({
        name: newListName.trim(),
        description: newListDescription.trim(),
        privacy: newListPrivacy,
        tags: newListTags,
        coverImage: newListCoverImage || undefined
      });
      setShowCreateList(false);
      setNewListName('');
      setNewListDescription('');
      setNewListPrivacy(userPrivacyPreference);
      setNewListTags([]);
      setNewTag('');
      setNewListCoverImage('');
    }
  };

  const resetForm = () => {
    setSelectedStatus(null)
    setTriedRating(null)
    setSelectedListIds(new Set())
    setNote('')
    setNewListName('')
    setNewListDescription('')
    setNewListPrivacy(userPrivacyPreference)
    setNewListTags([])
    setNewTag('')
    setNewListCoverImage('')
  }

  const addTag = () => {
    if (newTag.trim() && !newListTags.includes(newTag.trim())) {
      setNewListTags([...newListTags, newTag.trim()])
      setNewTag('')
    }
  }

  const getStatusIcon = (status: SaveStatus, isSelected: boolean) => {
    const iconClass = `w-6 h-6 ${isSelected ? 'text-white' : 'text-charcoal-600'}`
    switch (status) {
      case 'loved':
        return isSelected ? <HeartIconSolid className={iconClass} /> : <HeartIcon className={iconClass} />
      case 'tried':
        return isSelected ? <BookmarkIconSolid className={iconClass} /> : <BookmarkIcon className={iconClass} />
      case 'want':
        return isSelected ? <EyeIconSolid className={iconClass} /> : <EyeIcon className={iconClass} />
    }
  }

  const getStatusColor = (status: SaveStatus) => {
    switch (status) {
      case 'loved':
        return 'bg-gold-500 hover:bg-gold-600'
      case 'tried':
        return 'bg-sage-500 hover:bg-sage-600'
      case 'want':
        return 'bg-charcoal-500 hover:bg-charcoal-600'
    }
  }

  const getRatingColor = (rating: TriedRating) => {
    switch (rating) {
      case 'liked':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'neutral':
        return 'bg-sage-100 text-sage-700 border-sage-200'
      case 'disliked':
        return 'bg-red-100 text-red-700 border-red-200'
    }
  }

  if (!isOpen) return null
  
  const modalContent = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[80vh] rounded-2xl shadow-botanical border border-linen-200 bg-white overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-linen-200 flex-shrink-0">
          <h2 className="text-lg font-serif font-semibold text-charcoal-700">Save Place</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-linen-100 transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-charcoal-500" />
          </button>
        </div>

        {/* Place Info */}
        <div className="p-4 border-b border-linen-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            {place.hubImage && (
              <img
                src={place.hubImage}
                alt={place.name}
                className="w-12 h-12 rounded-xl object-cover border border-linen-200"
              />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-charcoal-700 mb-1">{place.name}</h3>
              <p className="text-sm text-charcoal-500">{place.address}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(place.tags || []).slice(0, 2).map(tag => (
                  <span key={tag} className="px-2 py-1 text-xs rounded-full bg-sage-50 text-sage-700 border border-sage-100">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto">
          {!showCreateList ? (
            <>
              {/* Status Selection */}
              <div className="mb-4">
                <label className="block font-medium text-charcoal-700 mb-2">How do you feel about this place?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'loved', label: 'Loved', desc: 'Absolutely loved it!' },
                    { key: 'tried', label: 'Tried', desc: 'Been there, done that' },
                    { key: 'want', label: 'Want to', desc: 'Want to try it' }
                  ].map(status => (
                    <button
                      key={status.key}
                      onClick={() => setSelectedStatus(status.key as SaveStatus)}
                      className={`p-3 rounded-xl border-2 transition-all text-center ${
                        selectedStatus === status.key
                          ? `${getStatusColor(status.key as SaveStatus)} border-transparent text-white`
                          : 'border-linen-200 hover:border-sage-200 hover:bg-sage-25'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {getStatusIcon(status.key as SaveStatus, selectedStatus === status.key)}
                        <div>
                          <div className="font-medium text-sm">{status.label}</div>
                          <div className="text-xs opacity-80">{status.desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating for Tried */}
              {selectedStatus === 'tried' && (
                <div className="mb-4">
                  <label className="block font-medium text-charcoal-700 mb-2">How was it?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'liked', label: 'Liked', emoji: '😊' },
                      { key: 'neutral', label: 'Neutral', emoji: '😐' },
                      { key: 'disliked', label: 'Disliked', emoji: '😞' }
                    ].map(rating => (
                      <button
                        key={rating.key}
                        onClick={() => setTriedRating(rating.key as TriedRating)}
                        className={`p-2 rounded-lg border transition-all ${
                          triedRating === rating.key
                            ? getRatingColor(rating.key as TriedRating)
                            : 'border-linen-200 hover:border-sage-200 hover:bg-sage-25'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-base">{rating.emoji}</span>
                          <span className="font-medium text-sm">{rating.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional: Add to Specific Lists */}
              <div className="mb-4">
                <label className="block font-medium text-charcoal-700 mb-2">
                  Add to specific lists? <span className="text-sm text-charcoal-500 font-normal">(Optional)</span>
                </label>
                <div className="relative mb-2">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-charcoal-600 pointer-events-none z-10" />
                  <input
                    type="text"
                    value={listSearch}
                    onChange={e => setListSearch(e.target.value)}
                    placeholder="Search or select lists..."
                    className="w-full p-2 pl-10 pr-10 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreateList(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-sage-100 text-sage-700 hover:bg-sage-200 transition"
                    title="Create new list"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {filteredLists.map(list => (
                    <label
                      key={list.id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all ${
                        selectedListIds.has(list.id)
                          ? 'border-sage-300 bg-sage-50'
                          : 'border-linen-200 hover:border-sage-200 hover:bg-sage-25'
                      }`}
                    >
                      <input
                        type="checkbox"
                        value={list.id}
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
                        className="w-3 h-3 text-sage-500 focus:ring-sage-400"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-charcoal-700 text-sm truncate">{list.name}</span>
                          {list.privacy === 'private' && <LockClosedIcon className="w-3 h-3 text-charcoal-400 flex-shrink-0" />}
                          {list.privacy === 'friends' && <UserGroupIcon className="w-3 h-3 text-charcoal-400 flex-shrink-0" />}
                          {list.privacy === 'public' && <GlobeAltIcon className="w-3 h-3 text-charcoal-400 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-charcoal-500 truncate">{list.description}</p>
                      </div>
                    </label>
                  ))}
                  {filteredLists.length === 0 && (
                    <div className="text-xs text-charcoal-400 px-2 py-1">No lists found.</div>
                  )}
                </div>
                {selectedListIds.size > 0 && (
                  <div className="mt-2 text-xs text-charcoal-500">
                    Selected {selectedListIds.size} list{selectedListIds.size !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Optional Note */}
              <div className="mb-4">
                <label className="block font-medium text-charcoal-700 mb-2">
                  Add a note? <span className="text-sm text-charcoal-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full p-2 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 resize-none text-sm"
                  rows={2}
                />
              </div>
            </>
          ) : (
            <>
              {/* Create New List Form (Simplified) */}
              <div className="space-y-3">
                <div>
                  <label className="block font-medium text-charcoal-700 mb-2">List name</label>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g., Coffee Spots, Date Night Places"
                    className="w-full p-2 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-charcoal-700 mb-2">Description <span className="text-sm text-charcoal-500 font-normal">(Optional)</span></label>
                  <textarea
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                    placeholder="What's this list about?"
                    className="w-full p-2 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 resize-none text-sm"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block font-medium text-charcoal-700 mb-2">Privacy</label>
                  <select
                    value={newListPrivacy}
                    onChange={(e) => setNewListPrivacy(e.target.value as 'public' | 'private' | 'friends')}
                    className="w-full p-2 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 text-sm"
                  >
                    <option value="public">🌍 Public - Anyone can see this list</option>
                    <option value="friends">👥 Friends only - Only your friends can see this list</option>
                    <option value="private">🔒 Private - Only you can see this list</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Save/Cancel Buttons - Always visible at bottom */}
        <div className="p-4 border-t border-linen-200 flex-shrink-0 bg-white">
          {!showCreateList ? (
            <button
              onClick={() => {
                if (selectedStatus) {
                  onSave(
                    selectedStatus,
                    selectedStatus === 'tried' ? triedRating || undefined : undefined,
                    selectedListIds.size > 0 ? Array.from(selectedListIds) : undefined,
                    note.trim() || undefined,
                    savedFromListId
                  )
                  onClose()
                  resetForm()
                }
              }}
              disabled={!selectedStatus || (selectedStatus === 'tried' && !triedRating)}
              className="w-full py-2 rounded-xl font-semibold bg-sage-400 text-white shadow-soft hover:bg-sage-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateList(false)}
                className="flex-1 py-2 rounded-xl font-medium border border-linen-200 text-charcoal-600 hover:bg-linen-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateList}
                disabled={!newListName.trim()}
                className="flex-1 py-2 rounded-xl font-semibold bg-sage-400 text-white shadow-soft hover:bg-sage-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create & Save
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default SaveModal
