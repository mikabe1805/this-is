import type { List, Place } from '../types/index.js'
import { ArrowLeftIcon, EyeIcon, HeartIcon, MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import SaveModal from '../components/SaveModal'
import HubImage from '../components/HubImage'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useAuth } from '../contexts/AuthContext.js'
import { firebaseDataService } from '../services/firebaseDataService.js'
import { formatTimestamp } from '../utils/dateUtils'

const Favorites = () => {
  const navigate = useNavigate()
  const { openListModal } = useNavigation()
  const { currentUser: authUser } = useAuth()

  const [savedLists, setSavedLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)

  useEffect(() => {
    const fetchSavedLists = async () => {
      if (authUser) {
        setLoading(true)
        const lists = await firebaseDataService.getSavedLists(authUser.id)
        // Hide legacy auto-lists that pre-date the auto-list removal — users
        // shouldn't see "All Loved" / "All Tried" / "All Want" in their
        // favorites.
        const visible = lists.filter(l => {
          const tags = (l as { tags?: string[] }).tags || []
          if (tags.includes('auto-generated') || tags.includes('#auto-generated')) return false
          const name = (l.name || '').trim().toLowerCase()
          if (name === 'all loved' || name === 'all tried' || name === 'all want') return false
          return true
        })
        setSavedLists(visible)
        setLoading(false)
      }
    }
    fetchSavedLists()
  }, [authUser])

  const filteredLists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return savedLists
    return savedLists.filter(list =>
      list.name.toLowerCase().includes(q) ||
      (list.description || '').toLowerCase().includes(q) ||
      (list.tags || []).some(t => t.toLowerCase().includes(q))
    )
  }, [savedLists, searchQuery])

  const handleUnfavoriteList = async (listId: string) => {
    if (!authUser) return
    await firebaseDataService.saveList(listId, authUser.id)
    setSavedLists(prev => prev.filter(list => list.id !== listId))
  }

  const handleSave = async (
    status: 'loved' | 'tried' | 'want',
    rating?: 'liked' | 'neutral' | 'disliked',
    listIds?: string[],
    note?: string,
  ) => {
    // Previously this read `currentUser` from a name that didn't exist in
    // scope (only `authUser` was ever defined), so the early return tripped
    // and saves silently no-oped. Use authUser consistently.
    if (!selectedPlace || !authUser) { setShowSaveModal(false); return }
    try {
      const ids = Array.isArray(listIds) ? listIds : []
      for (const lid of ids) {
        await firebaseDataService.savePlaceToList(selectedPlace.id, lid, authUser.id, note, undefined, status, rating)
      }
      await firebaseDataService.recordUserSave(selectedPlace.id, authUser.id)
    } catch (e) {
      console.error('[favorites] save failed', e)
    } finally {
      setShowSaveModal(false)
      setSelectedPlace(null)
    }
  }

  const handleCreateList = async (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => {
    if (!selectedPlace || !authUser) { setShowSaveModal(false); return }
    try {
      const newId = await firebaseDataService.createList({ ...listData, tags: listData.tags || [], userId: authUser.id })
      if (newId) {
        await firebaseDataService.savePlaceToList(selectedPlace.id, newId, authUser.id, undefined, undefined, 'loved')
        await firebaseDataService.recordUserSave(selectedPlace.id, authUser.id)
      }
    } catch (e) {
      console.error('[favorites] create list + save failed', e)
    } finally {
      setShowSaveModal(false)
      setSelectedPlace(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-paper">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-ink/20 border-t-ink/80 mx-auto mb-3" />
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-mute">Loading favorites…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-full bg-paper">
      {/* Header */}
      <div className="relative z-10 px-5 pt-6 max-w-2xl mx-auto">
        <div className="flex items-start gap-4 mb-5">
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/profile') }}
            aria-label="Back"
            className="p-2 rounded-full bg-card border border-edge text-ink-soft hover:border-ink/40 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 pt-1">
            <h1 className="font-display text-[34px] leading-tight text-ink">Favorites</h1>
            <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute mt-1">
              {filteredLists.length} {filteredLists.length === 1 ? 'list' : 'lists'} you've hearted
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 h-11 px-4 rounded-full bg-card border border-edge focus-within:border-ink/40 transition-colors mb-6">
          <MagnifyingGlassIcon className="w-[18px] h-[18px] text-ink-mute shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search favorites…"
            className="flex-1 bg-transparent outline-none text-[14px] text-ink placeholder:text-ink-mute"
            aria-label="Search favorites"
          />
        </div>
      </div>

      {/* List grid */}
      <div className="relative z-10 px-5 pb-20 max-w-2xl mx-auto">
        {filteredLists.length === 0 ? (
          <div className="border border-edge rounded-[14px] px-5 py-12 text-center bg-card">
            <HeartIcon className="w-10 h-10 text-ink-mute mx-auto mb-3" />
            <p className="font-display text-[24px] text-ink leading-tight">No favorites yet.</p>
            <p className="text-[13px] text-ink-soft mt-1.5">
              {searchQuery.trim() ? 'No lists match that search.' : 'Heart a list to keep it here.'}
            </p>
            {!searchQuery.trim() && (
              <button
                onClick={() => navigate('/search')}
                className="btn-cta h-10 px-4 mt-4 label-eyebrow"
              >
                Discover lists
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLists.map((list) => {
              const placeCount = (list as { hubs?: unknown[] }).hubs?.length || 0
              return (
                <article
                  key={list.id}
                  className="bg-card border border-edge rounded-[14px] overflow-hidden hover:border-ink/30 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Cover */}
                    <button
                      type="button"
                      onClick={() => openListModal(list, 'saved-lists')}
                      aria-label={`Open ${list.name}`}
                      className="w-full sm:w-40 h-32 sm:h-auto bg-paper-deep relative shrink-0 group"
                    >
                      {list.coverImage ? (
                        <img
                          src={list.coverImage}
                          alt={list.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <HubImage
                          aspect=""
                          className="w-full h-full"
                          alt={list.name}
                          loadStrategy="fallback"
                          types={list.tags}
                        />
                      )}
                      {list.privacy === 'private' && (
                        <div className="absolute top-2 right-2 p-1.5 rounded-full bg-ink/70 backdrop-blur-sm">
                          <EyeIcon className="w-3 h-3 text-paper" />
                        </div>
                      )}
                    </button>

                    {/* Body */}
                    <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                      <div>
                        <h3 className="font-display text-[20px] leading-tight text-ink truncate">{list.name}</h3>
                        <div className="flex items-center gap-3 mt-1.5 text-[12px] text-ink-soft">
                          <span className="inline-flex items-center gap-1">
                            <MapPinIcon className="w-3.5 h-3.5" />
                            {placeCount} {placeCount === 1 ? 'place' : 'places'}
                          </span>
                          <span aria-hidden>•</span>
                          <span>Updated {formatTimestamp(list.updatedAt)}</span>
                        </div>
                        {list.description && (
                          <p className="text-[13px] text-ink-soft mt-2 line-clamp-2">{list.description}</p>
                        )}
                        {(list.tags || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {(list.tags || []).slice(0, 4).map(tag => (
                              <span
                                key={tag}
                                className="px-2.5 h-6 rounded-full bg-aurum-200/50 border border-aurum-200/70 inline-flex items-center label-eyebrow text-bark-900"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-edge">
                        <button
                          onClick={() => openListModal(list, 'saved-lists')}
                          className="btn-secondary h-9 px-4 label-eyebrow flex-1"
                        >
                          View list
                        </button>
                        <button
                          onClick={() => handleUnfavoriteList(list.id)}
                          aria-label="Remove from favorites"
                          title="Remove from favorites"
                          className="h-9 w-9 rounded-full border border-edge bg-card text-bark-900 hover:border-ink/40 inline-flex items-center justify-center transition-colors"
                        >
                          <HeartIconSolid className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedPlace && (
        <SaveModal
          isOpen={showSaveModal}
          onClose={() => {
            setShowSaveModal(false)
            setSelectedPlace(null)
          }}
          place={selectedPlace}
          userLists={[]}
          onSave={handleSave}
          onCreateList={handleCreateList}
        />
      )}
    </div>
  )
}

export default Favorites
