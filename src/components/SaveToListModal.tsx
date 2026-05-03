import { useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, PlusIcon, LockClosedIcon, UserGroupIcon, GlobeAltIcon, BookmarkIcon } from '@heroicons/react/24/outline'
import type { List, Place } from '../types/index.js'
import { useAuth } from '../contexts/AuthContext'
import { firebaseListService } from '../services/firebaseListService'

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
  const { currentUser } = useAuth()
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [note, setNote] = useState('')
  const [showCreateList, setShowCreateList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')
  const [newListPrivacy, setNewListPrivacy] = useState<'public' | 'private' | 'friends'>('public')
  const [newListTags, setNewListTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  const handleSave = async () => {
    if (selectedListId && currentUser) {
      await firebaseListService.savePlaceToList(place.id, selectedListId, currentUser.id, note.trim() || undefined)
      onClose()
      resetForm()
    }
  }

  const handleCreateList = async () => {
    if (newListName.trim() && currentUser) {
      const newListId = await firebaseListService.createList({
        name: newListName.trim(),
        description: newListDescription.trim(),
        privacy: newListPrivacy,
        tags: newListTags,
        userId: currentUser.id
      })
      if (newListId) {
        await firebaseListService.savePlaceToList(place.id, newListId, currentUser.id, note.trim() || undefined)
      }
      setShowCreateList(false)
      resetForm()
      onClose()
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

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm">
      <div className="modal-paper w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-edge overflow-hidden" style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}>
        <div className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-edge relative z-10">
          <p className="label-eyebrow text-ink-mute">Save to list</p>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5 text-ink" />
          </button>
        </div>

        {/* Place Info */}
        <div className="px-5 sm:px-6 py-5 border-b border-edge relative z-10">
          <div className="flex items-center gap-3.5">
            {(place as any).mainImage ? (
              <img
                src={(place as any).mainImage}
                alt=""
                className="w-12 h-12 rounded-[10px] object-cover bg-paper-deep ring-1 ring-edge"
              />
            ) : (
              <div className="w-12 h-12 rounded-[10px] bg-paper-deep ring-1 ring-edge flex items-center justify-center font-display text-[18px] text-ink-soft">
                {(place.name || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-[18px] leading-tight text-ink truncate">{place.name}</h3>
              {place.address && (
                <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute truncate mt-0.5">{place.address}</p>
              )}
              {place.tags && place.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {place.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="glass-honey px-2.5 h-6 rounded-full font-mono text-[10px] tracking-wide inline-flex items-center">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 sm:px-6 py-5 relative z-10">
          {!showCreateList ? (
            <>
              {/* Select List */}
              <div className="mb-5">
                <p className="label-eyebrow text-ink-mute mb-2.5">Choose a list</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto -mx-1 px-1">
                  {userLists.map(list => {
                    const checked = selectedListId === list.id
                    const PrivacyIcon = list.privacy === 'private' ? LockClosedIcon : list.privacy === 'friends' ? UserGroupIcon : GlobeAltIcon
                    return (
                      <label
                        key={list.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${checked ? 'bg-paper-deep' : 'hover:bg-paper-deep'}`}
                      >
                        <input
                          type="radio"
                          name="selectedList"
                          value={list.id}
                          checked={checked}
                          onChange={(e) => setSelectedListId(e.target.value)}
                          className="w-4 h-4 accent-ink"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[14px] font-medium text-ink truncate">{list.name}</span>
                            <PrivacyIcon className="w-3 h-3 text-ink-mute shrink-0" />
                          </div>
                          {list.description && (
                            <p className="text-[12px] text-ink-soft truncate">{list.description}</p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Create New List Button */}
              <button
                type="button"
                onClick={() => setShowCreateList(true)}
                className="w-full h-11 rounded-full border border-dashed border-edge text-ink-soft hover:border-ink/30 hover:text-ink transition-colors inline-flex items-center justify-center gap-2 mb-5 label-eyebrow"
              >
                <PlusIcon className="w-4 h-4" />
                New list
              </button>

              {/* Note Input */}
              <div className="mb-5">
                <label htmlFor="save-list-note" className="label-eyebrow text-ink-mute mb-2 block">
                  Note <span className="text-ink-faint">· optional</span>
                </label>
                <textarea
                  id="save-list-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why did you save this place?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 resize-none"
                  rows={3}
                />
              </div>

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={!selectedListId}
                className="btn-cta w-full h-12 font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save to list
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
                    className="w-full h-11 px-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                  />
                </div>

                <div>
                  <label className="label-eyebrow text-ink-mute mb-2 block">Description</label>
                  <textarea
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                    placeholder="What's this list about?"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="label-eyebrow text-ink-mute mb-2 block">Privacy</label>
                  <div className="space-y-1.5">
                    {[
                      { value: 'public', label: 'Public', icon: GlobeAltIcon, description: 'Anyone can see this list' },
                      { value: 'friends', label: 'Friends', icon: UserGroupIcon, description: 'Only your friends can see this list' },
                      { value: 'private', label: 'Private', icon: LockClosedIcon, description: 'Only you can see this list' }
                    ].map(option => {
                      const Icon = option.icon
                      const checked = newListPrivacy === option.value
                      return (
                        <label
                          key={option.value}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${checked ? 'bg-paper-deep' : 'hover:bg-paper-deep'}`}
                        >
                          <input
                            type="radio"
                            name="privacy"
                            value={option.value}
                            checked={checked}
                            onChange={(e) => setNewListPrivacy(e.target.value as 'public' | 'private' | 'friends')}
                            className="w-4 h-4 accent-ink"
                          />
                          <Icon className="w-4 h-4 text-ink-mute" />
                          <div className="flex-1">
                            <div className="text-[14px] font-medium text-ink">{option.label}</div>
                            <div className="text-[12px] text-ink-soft">{option.description}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="label-eyebrow text-ink-mute mb-2 block">Tags <span className="text-ink-faint">· optional</span></label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {newListTags.map(tag => (
                      <span
                        key={tag}
                        className="glass-honey px-3 h-7 rounded-full label-eyebrow inline-flex items-center gap-1.5"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          aria-label={`Remove ${tag}`}
                          className="text-ink-mute hover:text-ink"
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
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      placeholder="Add a tag…"
                      className="flex-1 h-10 px-3.5 rounded-full border border-edge bg-card text-[13px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="btn-secondary h-10 px-4 label-eyebrow"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateList(false)}
                    className="btn-secondary flex-1 h-12 font-medium text-[15px]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateList}
                    disabled={!newListName.trim()}
                    className="btn-cta flex-1 h-12 font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create list
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default SaveToListModal
