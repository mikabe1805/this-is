import { useState } from 'react'
import { XMarkIcon, PlusIcon, LockClosedIcon, UserGroupIcon, GlobeAltIcon, BookmarkIcon } from '@heroicons/react/24/outline'
import type { List, Place } from '../types/index.js'

interface SaveToListModalProps {
  isOpen: boolean
  onClose: () => void
  place: Place
  userLists: List[]
  onSave: (listId: string, note?: string) => void
  onCreateList: (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags: string[] }) => void
}

const SaveToListModal: React.FC<SaveToListModalProps> = ({
  isOpen,
  onClose,
  place,
  userLists,
  onSave,
  onCreateList
}) => {
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [note, setNote] = useState('')
  const [showCreateList, setShowCreateList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')
  const [newListPrivacy, setNewListPrivacy] = useState<'public' | 'private' | 'friends'>('public')
  const [newListTags, setNewListTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  const handleSave = () => {
    if (selectedListId) {
      onSave(selectedListId, note.trim() || undefined)
      onClose()
      resetForm()
    }
  }

  const handleCreateList = () => {
    if (newListName.trim()) {
      onCreateList({
        name: newListName.trim(),
        description: newListDescription.trim(),
        privacy: newListPrivacy,
        tags: newListTags
      })
      setShowCreateList(false)
      resetForm()
    }
  }

  const resetForm = () => {
    setSelectedListId('')
    setNote('')
    setNewListName('')
    setNewListDescription('')
    setNewListPrivacy('public')
    setNewListTags([])
    setNewTag('')
  }

  const addTag = () => {
    if (newTag.trim() && !newListTags.includes(newTag.trim())) {
      setNewListTags([...newListTags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setNewListTags(newListTags.filter(tag => tag !== tagToRemove))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl shadow-botanical border border-linen-200 bg-white/98 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-linen-200">
          <h2 className="text-xl font-serif font-semibold text-charcoal-700">Save to List</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-linen-100 transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-charcoal-500" />
          </button>
        </div>

        {/* Place Info */}
        <div className="p-6 border-b border-linen-200">
          <div className="flex items-center gap-4">
            {place.hubImage && (
              <img
                src={place.hubImage}
                alt={place.name}
                className="w-16 h-16 rounded-xl object-cover border border-linen-200"
              />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-charcoal-700 mb-1">{place.name}</h3>
              <p className="text-sm text-charcoal-500">{place.address}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {place.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="px-2 py-1 text-xs rounded-full bg-sage-50 text-sage-700 border border-sage-100">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!showCreateList ? (
            <>
              {/* Select List */}
              <div className="mb-6">
                <label className="block font-medium text-charcoal-700 mb-3">Choose a list</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {userLists.map(list => (
                    <label
                      key={list.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                        selectedListId === list.id
                          ? 'border-sage-300 bg-sage-50'
                          : 'border-linen-200 hover:border-sage-200 hover:bg-sage-25'
                      }`}
                    >
                      <input
                        type="radio"
                        name="selectedList"
                        value={list.id}
                        checked={selectedListId === list.id}
                        onChange={(e) => setSelectedListId(e.target.value)}
                        className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-charcoal-700">{list.name}</span>
                          {list.privacy === 'private' && <LockClosedIcon className="w-4 h-4 text-charcoal-400" />}
                          {list.privacy === 'friends' && <UserGroupIcon className="w-4 h-4 text-charcoal-400" />}
                          {list.privacy === 'public' && <GlobeAltIcon className="w-4 h-4 text-charcoal-400" />}
                        </div>
                        <p className="text-sm text-charcoal-500 mt-1">{list.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Create New List Button */}
              <button
                onClick={() => setShowCreateList(true)}
                className="w-full p-3 rounded-xl border-2 border-dashed border-sage-200 text-sage-600 hover:border-sage-300 hover:bg-sage-25 transition-all flex items-center justify-center gap-2 mb-6"
              >
                <PlusIcon className="w-5 h-5" />
                Create New List
              </button>

              {/* Note Input */}
              <div className="mb-6">
                <label className="block font-medium text-charcoal-700 mb-2">Add a note (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why did you save this place?"
                  className="w-full p-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 resize-none"
                  rows={3}
                />
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={!selectedListId}
                className="w-full py-3 rounded-xl font-semibold bg-sage-400 text-white shadow-soft hover:bg-sage-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save to List
              </button>
            </>
          ) : (
            <>
              {/* Create New List Form */}
              <div className="space-y-4">
                <div>
                  <label className="block font-medium text-charcoal-700 mb-2">List name</label>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g., Coffee Spots, Date Night Places"
                    className="w-full p-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200"
                  />
                </div>

                <div>
                  <label className="block font-medium text-charcoal-700 mb-2">Description</label>
                  <textarea
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                    placeholder="What's this list about?"
                    className="w-full p-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 resize-none"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block font-medium text-charcoal-700 mb-2">Privacy</label>
                  <div className="space-y-2">
                    {[
                      { key: 'public', label: 'Public', icon: GlobeAltIcon, desc: 'Anyone can see this list' },
                      { key: 'friends', label: 'Friends only', icon: UserGroupIcon, desc: 'Only your friends can see this list' },
                      { key: 'private', label: 'Private', icon: LockClosedIcon, desc: 'Only you can see this list' }
                    ].map(option => (
                      <label
                        key={option.key}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                          newListPrivacy === option.key
                            ? 'border-sage-300 bg-sage-50'
                            : 'border-linen-200 hover:border-sage-200 hover:bg-sage-25'
                        }`}
                      >
                        <input
                          type="radio"
                          name="privacy"
                          value={option.key}
                          checked={newListPrivacy === option.key}
                          onChange={(e) => setNewListPrivacy(e.target.value as 'public' | 'private' | 'friends')}
                          className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                        />
                        <option.icon className="w-5 h-5 text-charcoal-500" />
                        <div>
                          <div className="font-medium text-charcoal-700">{option.label}</div>
                          <div className="text-sm text-charcoal-500">{option.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-charcoal-700 mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {newListTags.map(tag => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full text-sm bg-sage-100 text-sage-700 border border-sage-200 flex items-center gap-1"
                      >
                        #{tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="hover:text-sage-900"
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
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      placeholder="Add tag..."
                      className="flex-1 p-2 rounded-lg border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 text-sm"
                    />
                    <button
                      onClick={addTag}
                      className="px-3 py-2 rounded-lg bg-sage-100 text-sage-700 hover:bg-sage-200 transition text-sm"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowCreateList(false)}
                    className="flex-1 py-3 rounded-xl font-medium border border-linen-200 text-charcoal-600 hover:bg-linen-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateList}
                    disabled={!newListName.trim()}
                    className="flex-1 py-3 rounded-xl font-semibold bg-sage-400 text-white shadow-soft hover:bg-sage-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create & Save
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SaveToListModal 