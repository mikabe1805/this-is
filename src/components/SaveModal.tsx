import { useState, useEffect, useRef } from 'react'
import { useModalDismiss } from '../hooks/useModalDismiss'
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss'
import { XMarkIcon, HeartIcon, BookmarkIcon, EyeIcon, PlusIcon, LockClosedIcon, UserGroupIcon, GlobeAltIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid, BookmarkIcon as BookmarkIconSolid, EyeIcon as EyeIconSolid } from '@heroicons/react/24/solid'
import { createPortal } from 'react-dom'
import type { List, Place } from '../types/index.js'
import SearchBar from './SearchBar'
import Button from './Button'

type SaveStatus = 'loved' | 'tried' | 'want'
type TriedRating = 'liked' | 'neutral' | 'disliked'

interface SaveModalProps {
  isOpen: boolean
  onClose: () => void
  place: Place
  userLists: List[]
  selectedListIds?: string[]
  onSave: (status: SaveStatus, rating?: TriedRating, listIds?: string[], note?: string, savedFromListId?: string) => void
  /** Called from the "Create & Save" path. The picked status / rating /
   *  note from the previous screen are forwarded so the new list also gets
   *  the place added with the correct relationship. Previously these were
   *  dropped, and every Create-and-Save persisted as 'loved' regardless of
   *  what the user actually picked. */
  onCreateList: (
    listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string },
    saveContext?: { status: SaveStatus; rating?: TriedRating; note?: string },
  ) => void
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
  const [isCommitting, setIsCommitting] = useState(false)
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
    // Only show non auto-generated lists to pick from
    setFilteredLists(
      userLists.filter(list => {
        const tags = Array.isArray((list as any).tags) ? (list as any).tags : []
        const isAutoTag = tags.includes('#auto-generated')
        const nameLower = (list.name || '').toLowerCase()
        const isAutoByName = nameLower === 'all loved' || nameLower === 'all tried' || nameLower === 'all want'
        return !isAutoTag && !isAutoByName && nameLower.includes(listSearch.toLowerCase())
      })
    )
  }, [listSearch, userLists])

  useEffect(() => {
    if (selectedListIdsProp) {
      setSelectedListIds(new Set(selectedListIdsProp))
    }
  }, [selectedListIdsProp])

  const handleCreateList = () => {
    if (newListName.trim()) {
      // Forward the status / rating / note picked on the previous screen so
      // the just-created list also gets the place added with the correct
      // relationship. Falls back to 'loved' only if the user reached the
      // Create flow without picking a status (the Save button gates against
      // that, but defensive).
      const ctx = selectedStatus ? {
        status: selectedStatus,
        rating: selectedStatus === 'tried' ? (triedRating || undefined) : undefined,
        note: note.trim() || undefined,
      } : undefined
      onCreateList({
        name: newListName.trim(),
        description: newListDescription.trim(),
        privacy: newListPrivacy,
        tags: newListTags,
        coverImage: newListCoverImage || undefined
      }, ctx);
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
    const iconClass = `w-6 h-6 ${isSelected ? 'text-white' : 'text-ink-soft'}`
    switch (status) {
      case 'loved':
        return isSelected ? <HeartIconSolid className={iconClass} /> : <HeartIcon className={iconClass} />
      case 'tried':
        return isSelected ? <BookmarkIconSolid className={iconClass} /> : <BookmarkIcon className={iconClass} />
      case 'want':
        return isSelected ? <EyeIconSolid className={iconClass} /> : <EyeIcon className={iconClass} />
    }
  }

  const sheetRef = useRef<HTMLDivElement>(null)
  useModalDismiss(isOpen, onClose)
  useSwipeToDismiss({ ref: sheetRef, onDismiss: onClose, enabled: isOpen })

  if (!isOpen) return null

  const PRIVACY_LABEL: Record<'public'|'friends'|'private', string> = {
    public: 'Anyone can see this list',
    friends: 'Only friends can see this list',
    private: 'Only you can see this list',
  }

  const modalContent = (
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-[#1A1815]/55 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal={true}
        className="modal-paper w-full sm:max-w-md max-h-[88vh] rounded-t-[24px] sm:rounded-[24px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0 touch-none" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>
        <div data-drag-handle className="flex items-center justify-between px-5 py-4 border-b border-edge">
          <p className="label-eyebrow text-ink-mute">{showCreateList ? 'New list' : 'Save'}</p>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center" aria-label="Close">
            <XMarkIcon className="w-5 h-5 text-ink" />
          </button>
        </div>

        {!showCreateList && (
          <div className="px-5 py-5 border-b border-edge flex items-center gap-3.5">
            {(place as { mainImage?: string }).mainImage && (
              <img src={(place as { mainImage?: string }).mainImage} alt={place.name} className="w-12 h-12 rounded-[10px] object-cover bg-paper-deep" />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-[20px] leading-tight text-ink truncate">{place.name}</h3>
              {place.address && <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute truncate mt-1">{place.address}</p>}
            </div>
          </div>
        )}

        <div className="px-5 py-5 flex-1 overflow-y-auto">
          {!showCreateList ? (
            <>
              <div className="mb-6">
                <p className="label-eyebrow text-ink-mute mb-3">How do you feel about it?</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { key: 'loved', label: 'Loved' },
                    { key: 'tried', label: 'Been' },
                    { key: 'want', label: 'Want' },
                  ] as const).map(s => {
                    const active = selectedStatus === s.key
                    return (
                      <button
                        key={s.key}
                        onClick={() => setSelectedStatus(s.key)}
                        className={`h-12 rounded-full text-[13px] font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                          active
                            ? 'bg-accent text-white border-accent'
                            : 'bg-card text-ink border-edge hover:border-ink/40'
                        }`}
                      >
                        {getStatusIcon(s.key, active)}
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedStatus === 'tried' && (
                <div className="mb-6">
                  <p className="label-eyebrow text-ink-mute mb-3">How was it?</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['liked', 'neutral', 'disliked'] as const).map(r => {
                      const active = triedRating === r
                      return (
                        <button
                          key={r}
                          onClick={() => setTriedRating(r)}
                          className={`h-10 rounded-full text-[13px] font-medium border transition-colors capitalize ${
                            active
                              ? 'bg-ink text-paper border-ink'
                              : 'bg-card text-ink border-edge hover:border-ink/40'
                          }`}
                        >
                          {r}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-stone-500">Add to lists</p>
                  <button
                    type="button"
                    onClick={() => setShowCreateList(true)}
                    className="text-[12px] font-medium text-stone-700 hover:text-stone-900 inline-flex items-center gap-1"
                  >
                    <PlusIcon className="w-3.5 h-3.5" /> New list
                  </button>
                </div>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={listSearch}
                    onChange={e => setListSearch(e.target.value)}
                    placeholder="Search lists"
                    className="w-full h-10 pl-10 pr-3 rounded-xl border border-stone-200 bg-white text-[14px] text-stone-900 placeholder:text-stone-400 outline-none focus:border-stone-400"
                  />
                </div>
                {selectedStatus && selectedListIds.size === 0 && filteredLists.length > 0 && (
                  <p className="text-[12px] text-stone-500 mt-2">Pick a list to save into, or tap New list above.</p>
                )}
                <div className="mt-2 max-h-40 overflow-y-auto -mx-2">
                  {filteredLists.length === 0 ? (
                    <p className="text-[13px] text-stone-500 text-center py-4">No lists. Create one above.</p>
                  ) : (
                    <ul className="px-2">
                      {filteredLists.map(list => {
                        const checked = selectedListIds.has(list.id)
                        const PrivacyIcon = list.privacy === 'private' ? LockClosedIcon : list.privacy === 'friends' ? UserGroupIcon : GlobeAltIcon
                        return (
                          <li key={list.id}>
                            <label className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                              checked ? 'bg-stone-100' : 'hover:bg-stone-50'
                            }`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  const next = new Set(selectedListIds)
                                  if (e.target.checked) next.add(list.id); else next.delete(list.id)
                                  setSelectedListIds(next)
                                }}
                                className="w-4 h-4 rounded accent-stone-900"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[14px] font-medium text-stone-900 truncate">{list.name}</span>
                                  <PrivacyIcon className="w-3 h-3 text-stone-400 shrink-0" />
                                </div>
                                {list.description && <p className="text-[12px] text-stone-500 truncate">{list.description}</p>}
                              </div>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-stone-500 mb-2">Note <span className="font-normal text-stone-400">· optional</span></p>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="What did you think?"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-[14px] text-stone-900 placeholder:text-stone-400 resize-none outline-none focus:border-stone-400"
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-stone-500 mb-2">List name</p>
                <input
                  type="text"
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  placeholder="Coffee spots, weekend trips…"
                  className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-[14px] text-stone-900 placeholder:text-stone-400 outline-none focus:border-stone-400"
                />
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-stone-500 mb-2">Description <span className="font-normal text-stone-400">· optional</span></p>
                <textarea
                  value={newListDescription}
                  onChange={e => setNewListDescription(e.target.value)}
                  placeholder="What's this list about?"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-[14px] text-stone-900 placeholder:text-stone-400 resize-none outline-none focus:border-stone-400"
                />
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-stone-500 mb-2">Privacy</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['public', 'friends', 'private'] as const).map(p => {
                    const active = newListPrivacy === p
                    const Icon = p === 'private' ? LockClosedIcon : p === 'friends' ? UserGroupIcon : GlobeAltIcon
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewListPrivacy(p)}
                        className={`h-10 rounded-xl text-[13px] font-medium border transition-colors capitalize flex items-center justify-center gap-1.5 ${
                          active
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {p}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[12px] text-stone-500 mt-2">{PRIVACY_LABEL[newListPrivacy]}</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-edge bg-paper flex gap-2">
          {!showCreateList ? (
            <button
              onClick={async () => {
                // Require at least one list. Without this guard, the user could
                // tap Save with status set but no list selected → savedCount got
                // bumped via recordUserSave, but the place never appeared on
                // any list. The status (loved/tried/want) lives on the
                // ListPlace row, not on the place itself, so a "list-less"
                // save dropped the relationship on the floor.
                if (!selectedStatus || isCommitting || selectedListIds.size === 0) return
                setIsCommitting(true)
                try {
                  await Promise.resolve(onSave(
                    selectedStatus,
                    selectedStatus === 'tried' ? triedRating || undefined : undefined,
                    Array.from(selectedListIds),
                    note.trim() || undefined,
                    savedFromListId
                  ))
                } finally {
                  onClose()
                  resetForm()
                  setIsCommitting(false)
                }
              }}
              disabled={
                isCommitting ||
                !selectedStatus ||
                (selectedStatus === 'tried' && !triedRating) ||
                selectedListIds.size === 0
              }
              title={selectedListIds.size === 0 ? 'Pick a list, or create a new one above' : undefined}
              className="btn-cta flex-1 h-12 font-semibold text-[15px]"
            >
              {isCommitting ? 'Saving…' : 'Save'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowCreateList(false)}
                className="btn-secondary flex-1 h-12 font-medium text-[15px]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isCommitting || !newListName.trim()) return
                  setIsCommitting(true)
                  try {
                    await Promise.resolve(handleCreateList())
                  } finally {
                    setIsCommitting(false)
                  }
                }}
                disabled={isCommitting || !newListName.trim()}
                className="btn-cta flex-1 h-12 font-semibold text-[15px]"
              >
                {isCommitting ? 'Creating…' : 'Create & Save'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default SaveModal
