import type { List, User } from '../types/index.js'
import { HeartIcon, BookmarkIcon, PlusIcon, MapPinIcon, CalendarIcon, ArrowLeftIcon, EyeIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import SearchAndFilter from '../components/SearchAndFilter'
import SaveModal from '../components/SaveModal'
import CreatePost from '../components/CreatePost'
import EditListModal from '../components/EditListModal'
import ConfirmModal from '../components/ConfirmModal'
import SaveToListModal from '../components/SaveToListModal'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useAuth } from '../contexts/AuthContext.js'
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
  { key: 'recent', label: 'Most Recent' },
  { key: 'popular', label: 'Most Popular' },
  { key: 'alphabetical', label: 'Alphabetical' },
  { key: 'places', label: 'Most Places' },
]

const filterOptions = [
  { key: 'friends', label: 'Friends\' Lists' },
]

const availableTags = ['coffee', 'food', 'outdoors', 'work', 'study', 'cozy', 'trendy', 'local', 'authentic']

const ViewAllLists = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { openListModal } = useNavigation()
  const [sortBy, setSortBy] = useState('recent')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [hubFilter, setHubFilter] = useState<string | null>(null)
  const [likedLists, setLikedLists] = useState<Set<string>>(new Set())
  const [savedLists, setSavedLists] = useState<Set<string>>(new Set())
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
    
    if (type === 'popular') {
      setSortBy('popular')
    } else if (type === 'friends') {
      setActiveFilters(['friends'])
    }
    
    // Set hub filter if provided
    if (hub) {
      console.log('Filtering by hub:', hub)
      setHubFilter(hub)
    }
  }, [searchParams])

  const { currentUser: authUser } = useAuth()
  const [allLists, setAllLists] = useState<List[]>([])
  const [listCreators, setListCreators] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchListsAndCreators = async () => {
      if (authUser) {
        setLoading(true);
        const userLists = await firebaseDataService.getUserLists(authUser.id);
        const following = await firebaseDataService.getUserFollowing(authUser.id);
        const friendsPublicListsPromises = following.map(friend => 
          firebaseDataService.getUserLists(friend.id).then(lists => 
            lists.filter(list => list.privacy === 'public')
          )
        );
        const friendsPublicListsArrays = await Promise.all(friendsPublicListsPromises);
        const friendsLists = friendsPublicListsArrays.flat();

        const allFetchedLists = [...userLists, ...friendsLists];
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
  }, [authUser])

  // Filter and sort lists based on current state
  const filteredLists = allLists.filter(list => {
    // Filter by privacy (friends filter)
    if (activeFilters.length > 0) {
      if (!activeFilters.includes(list.privacy)) return false
    }
    
    // Filter by hub (if hub filter is set)
    if (hubFilter) {
      // Check if the list contains the hub (this would need to be implemented based on your data structure)
      // For now, we'll assume lists have a hubs array or similar
      const hasHub = list.hubs && list.hubs.some(hub => 
        hub.toLowerCase().includes(hubFilter.toLowerCase())
      )
      if (!hasHub) return false
    }
    
    // Filter by tags
    if (selectedTags.length > 0) {
      const hasMatchingTag = selectedTags.some(tag => 
        list.tags.some(listTag => listTag.toLowerCase().includes(tag.toLowerCase()))
      )
      if (!hasMatchingTag) return false
    }
    
    return true
  }).sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'popular':
        return b.likes - a.likes
      case 'alphabetical':
        return a.name.localeCompare(b.name)
      case 'places':
        return (b.hubs?.length || 0) - (a.hubs?.length || 0)
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
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag)
      } else {
        return [...prev, tag]
      }
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
            sortOptions={sortOptions}
            filterOptions={filterOptions}
            availableTags={availableTags}
            sortBy={sortBy}
            setSortBy={setSortBy}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            filterCount={activeFilters.length + selectedTags.length + (hubFilter ? 1 : 0)}
            hubFilter={hubFilter}
          />
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
                      {new Date(list.updatedAt.seconds ? list.updatedAt.toDate() : list.updatedAt).toLocaleDateString()}
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
    </div>
  )
}

export default ViewAllLists
