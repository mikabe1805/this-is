import type { List, User } from '../types/index.js'
import { HeartIcon, BookmarkIcon, PlusIcon, MapPinIcon, CalendarIcon, ArrowLeftIcon, EyeIcon } from '@heroicons/react/24/outline'
import { useState, useEffect, useRef } from 'react'
import { formatTimestamp } from '../utils/dateUtils'
import { useNavigate, useSearchParams } from 'react-router-dom'
import SearchAndFilter from '../components/SearchAndFilter'
import AdvancedFiltersDrawer from '../components/AdvancedFiltersDrawer'
import SaveModal from '../components/SaveModal'
import CreatePost from '../components/CreatePost'
import EditListModal from '../components/EditListModal'
import ConfirmModal from '../components/ConfirmModal'
import SaveToListModal from '../components/SaveToListModal'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useAuth } from '../contexts/AuthContext.js'
import { useFilters } from '../contexts/FiltersContext.tsx'
import { firebaseDataService } from '../services/firebaseDataService.js'
import { firebaseListService } from '../services/firebaseListService.js'

// SVG botanical accent
const BotanicalAccent = () => (
  <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -top-6 -left-6 opacity-30 select-none pointer-events-none">
    <path d="M10 50 Q30 10 50 50" stroke="#A3B3A3" strokeWidth="3" fill="none"/>
    <ellipse cx="18" cy="38" rx="4" ry="8" fill="#C7D0C7"/>
    <ellipse cx="30" cy="28" rx="4" ry="8" fill="#A3B3A3"/>
    <ellipse cx="42" cy="38" rx="4" ry="8" fill="#7A927A"/>
  </svg>
)

const sortOptions = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'popular', label: 'Most Popular' },
  { key: 'friends', label: 'Most Liked by Friends' },
  { key: 'nearby', label: 'Closest to Location' },
]

const filterOptions: any[] = []

// Available tags are fetched from Firebase so tag search can reach the full set

const ViewAllLists = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { openListModal } = useNavigation()
  const [sortBy, setSortBy] = useState('relevance')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [hubFilter, setHubFilter] = useState<string | null>(null)
  const [likedLists, setLikedLists] = useState<Set<string>>(new Set())
  const [savedLists, setSavedLists] = useState<Set<string>>(new Set())
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name?: string } | null>(null)
  const [listDistances, setListDistances] = useState<Record<string, number>>({})
  const [showOnlyMine, setShowOnlyMine] = useState(true)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [showEditListModal, setShowEditListModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showSaveToListModal, setShowSaveToListModal] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<any>(null)
  const [selectedList, setSelectedList] = useState<List | null>(null)
  const [selectedListForSave, setSelectedListForSave] = useState<List | null>(null)
  const [createPostListId, setCreatePostListId] = useState<string | null>(null)
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {}
  })

  // Handle URL parameters for filtering
  useEffect(() => {
    const type = searchParams.get('type')
    const hub = searchParams.get('hub')
    const tags = searchParams.get('tags')
    const sort = searchParams.get('sort')
    const onlyMine = searchParams.get('onlyMine')

    if (type === 'popular') setSortBy('popular')
    else if (type === 'friends') setActiveFilters(['friends'])

    if (hub) setHubFilter(hub)

    if (tags) setSelectedTags(tags.split(',').map(t => t.trim()).filter(Boolean))
    if (sort) setSortBy(sort)
    if (onlyMine != null) setShowOnlyMine(onlyMine !== 'false')
  }, [searchParams])

  const { currentUser: authUser } = useAuth()
  const [allLists, setAllLists] = useState<List[]>([])
  const placeCacheRef = useRef<Record<string, any>>({})
  const [listCreators, setListCreators] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { filters, setFilters } = useFilters()

  // Sync selected tags with global FiltersContext
  useEffect(() => {
    setSelectedTags(filters.tags || [])
  }, [filters.tags])

  // If a custom/location-origin is chosen in advanced filters, seed local location for distance sorting
  useEffect(() => {
    if (filters.location) {
      setSelectedLocation({ lat: filters.location.lat, lng: filters.location.lng, name: filters.location.name })
    }
  }, [filters.location])

  useEffect(() => {
    const fetchListsAndCreators = async () => {
      if (authUser) {
        setLoading(true);
        const userLists = await firebaseDataService.getUserLists(authUser.id);
        try {
          const tags = await firebaseDataService.getPopularTags(200)
          setAvailableTags(tags)
        } catch {
          setAvailableTags(['coffee','food','outdoors','work','study','cozy','trendy','local','authentic'])
        }
        let allFetchedLists = userLists
        if (!showOnlyMine) {
          const following = await firebaseDataService.getUserFollowing(authUser.id);
          const friendsPublicListsPromises = following.map(friend => 
            firebaseDataService.getUserLists(friend.id).then(lists => 
              lists.filter(list => list.privacy === 'public')
            )
          );
          const friendsPublicListsArrays = await Promise.all(friendsPublicListsPromises);
          const friendsLists = friendsPublicListsArrays.flat();
          allFetchedLists = [...userLists, ...friendsLists];
        }
        setAllLists(allFetchedLists);

        // Fetch creator names
        const creatorIds = [...new Set(allFetchedLists.map(list => list.userId))];
        const creatorNames: Record<string, string> = {};
        for (const id of creatorIds) {
          creatorNames[id] = await firebaseDataService.getUserDisplayName(id);
        }
        setListCreators(creatorNames);
        setLoading(false);
      }
    }
    fetchListsAndCreators()
  }, [authUser, showOnlyMine])

  // Nearby computation
  const toRad = (v: number) => (v * Math.PI) / 180
  const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  useEffect(() => {
    const computeDistances = async () => {
      if (!selectedLocation) { setListDistances({}); return }
      const distances: Record<string, number> = {}
      for (const list of allLists) {
        const anyList: any = list
        const hubs: any[] = Array.isArray(anyList.hubs) ? anyList.hubs : []
        let min = Infinity
        // If list has its own location, use that as a candidate
        if (anyList.location && typeof anyList.location.lat === 'number' && typeof anyList.location.lng === 'number') {
          min = Math.min(min, haversineKm(anyList.location.lat, anyList.location.lng, selectedLocation.lat, selectedLocation.lng))
        }
        for (const hubRef of hubs) {
          if (typeof hubRef === 'string') {
            let place = placeCacheRef.current[hubRef]
            if (!place) {
              place = await firebaseDataService.getPlace(hubRef)
              if (place) placeCacheRef.current[hubRef] = place
            }
            const lat = place?.coordinates?.lat
            const lng = place?.coordinates?.lng
            if (typeof lat === 'number' && typeof lng === 'number') {
              const d = haversineKm(lat, lng, selectedLocation.lat, selectedLocation.lng)
              if (d < min) min = d
            }
          } else {
            const lat = (hubRef.location && hubRef.location.lat) || hubRef.coordinates?.lat
            const lng = (hubRef.location && hubRef.location.lng) || hubRef.coordinates?.lng
            if (typeof lat === 'number' && typeof lng === 'number') {
              const d = haversineKm(lat, lng, selectedLocation.lat, selectedLocation.lng)
              if (d < min) min = d
            }
          }
        }
        if (min !== Infinity) distances[list.id] = min
      }
      setListDistances(distances)
    }
    computeDistances()
  }, [selectedLocation, allLists])

  // Filter and sort lists based on current state
  const filteredLists = allLists.filter(list => {
    // In-page search by name/description/tags
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matches = (
        list.name.toLowerCase().includes(q) ||
        (list.description || '').toLowerCase().includes(q) ||
        (list.tags || []).some(t => t.toLowerCase().includes(q))
      )
      if (!matches) return false
    }

    // Only mine filter
    if (showOnlyMine && authUser && list.userId !== authUser.id) return false

    // Friends filter not needed; using explicit Only mine toggle and following fetch
 
    // Filter by hub (if hub filter is set)
    if (hubFilter) {
      // Check if the list contains the hub (this would need to be implemented based on your data structure)
      // For now, we'll assume lists have a hubs array or similar
      const hasHub = list.hubs && list.hubs.some(hub => 
        hub.toLowerCase().includes(hubFilter.toLowerCase())
      )
      if (!hasHub) return false
    }
 
    // Filter by tags (from local selection synced with FiltersContext)
    if (selectedTags.length > 0) {
      const hasMatchingTag = selectedTags.some(tag => 
        list.tags.some(listTag => listTag.toLowerCase().includes(tag.toLowerCase()))
      )
      if (!hasMatchingTag) return false
    }
    // Filter by max distance if provided via Advanced Filters
    if (filters.location && typeof filters.distanceKm === 'number') {
      const d = listDistances[list.id]
      if (typeof d === 'number' && d > filters.distanceKm) return false
    }
     
    return true
  }).sort((a, b) => {
    switch (sortBy) {
      case 'relevance': {
        // Basic relevance: matches on name/desc/tags + boost for tag matches; tiebreaker by likes
        const q = searchQuery.trim().toLowerCase()
        const tags = selectedTags.map(t=>t.toLowerCase())
        const score = (l: List) => {
          let s = 0
          const name = l.name.toLowerCase()
          const desc = (l.description||'').toLowerCase()
          const lt = (l.tags||[]).map(t=>t.toLowerCase())
          if (q) { if (name.includes(q)) s+=4; if (desc.includes(q)) s+=2; if (lt.some(t=>t.includes(q))) s+=3 }
          if (tags.length>0) { s += lt.filter(t=>tags.includes(t)).length * 5 }
          return s
        }
        const sa = score(a), sb = score(b)
        if (sb !== sa) return sb - sa
        return (b.likes||0) - (a.likes||0)
      }
      case 'recent':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'popular':
        return b.likes - a.likes
      case 'alphabetical':
        return a.name.localeCompare(b.name)
      case 'places':
        return (b.hubs?.length || 0) - (a.hubs?.length || 0)
      case 'nearby':
        return (listDistances[a.id] ?? Number.MAX_VALUE) - (listDistances[b.id] ?? Number.MAX_VALUE)
      default:
        return 0
    }
  })

  const handleLikeList = async (listId: string) => {
    if (authUser) {
      await firebaseListService.likeList(listId, authUser.id);
      setLikedLists(prev => {
        const newSet = new Set(prev)
        if (newSet.has(listId)) {
          newSet.delete(listId)
        } else {
          newSet.add(listId)
        }
        return newSet
      })
    }
  }

  const handleSaveList = async (listId: string) => {
    if (authUser) {
      await firebaseListService.saveList(listId, authUser.id);
      setSavedLists(prev => {
        const newSet = new Set(prev)
        if (newSet.has(listId)) {
          newSet.delete(listId)
        } else {
          newSet.add(listId)
        }
        return newSet
      })
    }
  }
  
  const handleViewList = (list: List) => {
    openListModal(list, 'view-all-lists');
  }

  const handleQuickSaveList = (list: List) => {
    setSelectedListForSave(list)
    setShowSaveToListModal(true)
  }

  const handleSaveToPlace = (place: any) => {
    setSelectedPlace(place)
    setShowSaveModal(true)
  }

  const handleSave = (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
    console.log('Saving place:', { status, rating, listIds, note })
    setShowSaveModal(false)
  }

  const handleCreateList = (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: File }) => {
    if (authUser) {
      firebaseListService.createList({ ...listData, userId: authUser.id })
    }
    setShowSaveToListModal(false)
  }

  const handleCreatePost = (listId?: string) => {
    setCreatePostListId(listId || null)
    setShowCreatePost(true)
  }

  const handleEditList = (list: List) => {
    setSelectedList(list)
    setShowEditListModal(true)
  }

  const handleDeleteList = (list: List) => {
    setConfirmModalConfig({
      title: 'Delete List',
      message: `Are you sure you want to delete "${list.name}"? This action cannot be undone.`,
      onConfirm: () => {
        firebaseListService.deleteList(list.id)
        setShowConfirmModal(false)
      }
    })
    setShowConfirmModal(true)
  }

  const handlePrivacyChange = (listId: string, newPrivacy: 'public' | 'private' | 'friends') => {
    firebaseListService.updateList(listId, { privacy: newPrivacy })
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const next = prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
      setFilters({ tags: next })
      return next
    })
  }

  const handleSaveToList = (listId: string, note?: string) => {
    // Save list logic here
    if (selectedListForSave && authUser) {
      firebaseListService.savePlaceToList(selectedListForSave.id, listId, authUser.id, note);
    }
    setShowSaveToListModal(false)
    setSelectedListForSave(null)
  }

  if (loading) {
    return <div>Loading...</div>; // Or a proper loading spinner
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-linen-50 via-cream-50 to-sage-25">
      {/* Header */}
      <div className="relative bg-white shadow-botanical border-b border-linen-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-full hover:bg-linen-100 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-charcoal-600" />
              </button>
              <div>
                <h1 className="text-xl font-serif font-semibold text-charcoal-700">
                  {activeFilters.includes('friends') ? 'All Friends\' Lists' : 'All Lists'}
                  {hubFilter && ` with ${hubFilter}`}
                </h1>
                <p className="text-sm text-charcoal-500">{filteredLists.length} lists found</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreatePost(true)}
              className="flex items-center gap-2 px-4 py-2 bg-sage-500 text-white rounded-xl font-medium hover:bg-sage-600 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Create List
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-linen-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <SearchAndFilter
            placeholder="Search lists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sortOptions={sortOptions}
            filterOptions={filterOptions}
            availableTags={availableTags}
            sortBy={sortBy}
            setSortBy={(key) => {
              setSortBy(key)
              if (key === 'nearby' && !selectedLocation && 'geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition((pos) => {
                  setSelectedLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Current Location' })
                })
              }
            }}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
            selectedTags={selectedTags}
            setSelectedTags={(tags) => { setSelectedTags(tags); setFilters({ tags }) }}
            filterCount={activeFilters.length + selectedTags.length + (hubFilter ? 1 : 0)}
            hubFilter={hubFilter}
            onSubmitQuery={() => { /* in-place filtering */ }}
            onOpenAdvanced={() => setShowAdvanced(true)}
          />
          
          <div className="mt-2 flex items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={showOnlyMine} onChange={(e) => setShowOnlyMine(e.target.checked)} />
              <span>Only my lists</span>
            </label>
            {selectedLocation && <span className="text-charcoal-500">Location: {selectedLocation.name || `${selectedLocation.lat.toFixed(2)}, ${selectedLocation.lng.toFixed(2)}`}</span>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLists.map((list) => (
            <div
              key={list.id}
              className="relative bg-white rounded-2xl shadow-botanical border border-linen-200 overflow-hidden hover:shadow-liquid transition-all duration-300 group"
              onClick={() => handleViewList(list)}
            >
              <BotanicalAccent />
              
              {/* Cover Image */}
              <div className="relative h-48 bg-gradient-to-br from-cream-200 to-coral-200">
                {list.coverImage && (
                  <img
                    src={list.coverImage}
                    alt={list.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                {/* Quick Save Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickSaveList(list);
                  }}
                  className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-botanical hover:shadow-liquid hover:scale-105 transition-all duration-200"
                >
                  <BookmarkIcon className="w-4 h-4 text-charcoal-600" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-serif font-semibold text-charcoal-700 mb-1 group-hover:text-sage-600 transition-colors">
                      {list.name}
                    </h3>
                    <p className="text-sm text-charcoal-500 line-clamp-2">{list.description}</p>
                    <p className="text-sm text-charcoal-500 line-clamp-2">Created by {listCreators[list.userId] || '...'}</p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {list.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs rounded-full bg-sage-50 text-sage-700 border border-sage-100"
                    >
                      #{tag}
                    </span>
                  ))}
                  {list.tags.length > 3 && (
                    <span className="px-2 py-1 text-xs rounded-full bg-linen-100 text-charcoal-500">
                      +{list.tags.length - 3}
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-charcoal-500 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4" />
                      {formatTimestamp(list.updatedAt)}
                    </div>
                    <div className="flex items-center gap-1">
                      <EyeIcon className="w-4 h-4" />
                      {list.hubs?.length || 0} places
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <HeartIcon className="w-4 h-4" />
                    {list.likes}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLikeList(list.id);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                      likedLists.has(list.id)
                        ? 'bg-gold-50 text-gold-700 border border-gold-200'
                        : 'bg-linen-50 text-charcoal-600 border border-linen-200 hover:bg-linen-100'
                    }`}
                  >
                    <HeartIcon className="w-4 h-4" />
                    {likedLists.has(list.id) ? 'Liked' : 'Like'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveList(list.id);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                      savedLists.has(list.id)
                        ? 'bg-sage-50 text-sage-700 border border-sage-200'
                        : 'bg-linen-50 text-charcoal-600 border border-linen-200 hover:bg-linen-100'
                    }`}
                  >
                    <BookmarkIcon className="w-4 h-4" />
                    {savedLists.has(list.id) ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredLists.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-linen-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookmarkIcon className="w-8 h-8 text-charcoal-400" />
            </div>
            <h3 className="text-lg font-serif font-semibold text-charcoal-700 mb-2">No lists found</h3>
            <p className="text-charcoal-500">Try adjusting your filters or create a new list.</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <SaveModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        place={selectedPlace}
        userLists={allLists.filter(list => list.userId === authUser?.id)}
        onSave={handleSave}
        onCreateList={handleCreateList}
      />

      <CreatePost
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        preSelectedListIds={createPostListId ? [createPostListId] : undefined}
      />

      <EditListModal
        isOpen={showEditListModal}
        onClose={() => setShowEditListModal(false)}
        list={selectedList}
        onSave={(listData) => {
          if (selectedList) {
            firebaseListService.updateList(selectedList.id, listData);
          }
        }}
        onDelete={handleDeleteList}
        onPrivacyChange={handlePrivacyChange}
      />

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        onConfirm={confirmModalConfig.onConfirm}
      />

      <SaveToListModal
        isOpen={showSaveToListModal}
        onClose={() => {
          setShowSaveToListModal(false)
          setSelectedListForSave(null)
        }}
        place={{
          id: selectedListForSave?.id || '',
          name: selectedListForSave?.name || '',
          address: '',
          tags: selectedListForSave?.tags || [],
          posts: [],
          savedCount: 0,
          createdAt: selectedListForSave?.createdAt || ''
        }}
        userLists={allLists.filter(list => list.userId === authUser?.id)}
        onSave={handleSaveToList}
        onCreateList={handleCreateList}
      />
      <AdvancedFiltersDrawer isOpen={showAdvanced} onClose={() => setShowAdvanced(false)} onApply={() => { /* derived filters rerun automatically */ }} />
    </div>
  )
}

export default ViewAllLists
