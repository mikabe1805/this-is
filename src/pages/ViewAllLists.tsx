import type { List, User } from '../types/index.js'
import { HeartIcon, BookmarkIcon, PlusIcon, MapPinIcon, CalendarIcon, ArrowLeftIcon, EyeIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchAndFilter from '../components/SearchAndFilter'
import SaveModal from '../components/SaveModal'
import CreatePost from '../components/CreatePost'
import EditListModal from '../components/EditListModal'
import ConfirmModal from '../components/ConfirmModal'
import { useNavigation } from '../contexts/NavigationContext.tsx'

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
  { key: 'public', label: 'Public' },
  { key: 'private', label: 'Private' },
  { key: 'friends', label: 'Friends Only' },
]

const availableTags = ['coffee', 'food', 'outdoors', 'work', 'study', 'cozy', 'trendy', 'local', 'authentic']

const ViewAllLists = () => {
  const navigate = useNavigate()
  const { openListModal } = useNavigation()
  const [sortBy, setSortBy] = useState('recent')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [likedLists, setLikedLists] = useState<Set<string>>(new Set())
  const [savedLists, setSavedLists] = useState<Set<string>>(new Set())
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [showEditListModal, setShowEditListModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<any>(null)
  const [selectedList, setSelectedList] = useState<List | null>(null)
  const [createPostListId, setCreatePostListId] = useState<string | null>(null)
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {}
  })

  // Mock current user
  const currentUser: User = {
    id: '1',
    name: 'Mika Chen',
    username: 'mika.chen',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    bio: 'Finding cozy spots and sharing them with friends ✨',
    location: 'San Francisco, CA',
    influences: 234
  }

  // Mock user lists
  const userLists: List[] = [
    {
      id: 'all-loved',
      name: 'All Loved',
      description: 'All the places you\'ve loved and want to visit again',
      userId: '1',
      isPublic: false,
      isShared: false,
      privacy: 'private',
      tags: ['loved', 'favorites', 'auto-generated'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-15',
      likes: 0,
      isLiked: false
    },
    {
      id: 'all-tried',
      name: 'All Tried',
      description: 'All the places you\'ve tried and experienced',
      userId: '1',
      isPublic: false,
      isShared: false,
      privacy: 'private',
      tags: ['tried', 'visited', 'auto-generated'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=200&fit=crop',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-15',
      likes: 0,
      isLiked: false
    },
    {
      id: 'all-want',
      name: 'All Want',
      description: 'All the places you want to visit someday',
      userId: '1',
      isPublic: false,
      isShared: false,
      privacy: 'private',
      tags: ['want', 'wishlist', 'auto-generated'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=300&h=200&fit=crop',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-15',
      likes: 0,
      isLiked: false
    },
    {
      id: '1',
      name: 'Cozy Coffee Spots',
      description: 'Perfect places to work and relax with great coffee and atmosphere',
      userId: '1',
      isPublic: true,
      isShared: false,
      privacy: 'public',
      tags: ['coffee', 'work-friendly', 'cozy'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop',
      createdAt: '2024-01-10',
      updatedAt: '2024-01-15',
      likes: 56,
      isLiked: false
    },
    {
      id: '2',
      name: 'Hidden Gems',
      description: 'Local favorites that tourists don\'t know about',
      userId: '1',
      isPublic: true,
      isShared: false,
      privacy: 'public',
      tags: ['local', 'hidden-gems', 'authentic'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=200&fit=crop',
      createdAt: '2024-01-12',
      updatedAt: '2024-01-14',
      likes: 42,
      isLiked: false
    },
    {
      id: '3',
      name: 'Book Nooks',
      description: 'Quiet places to read and study',
      userId: '1',
      isPublic: false,
      isShared: false,
      privacy: 'private',
      tags: ['books', 'quiet', 'study'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&h=200&fit=crop',
      createdAt: '2024-01-08',
      updatedAt: '2024-01-13',
      likes: 23,
      isLiked: false
    },
    {
      id: '4',
      name: 'Weekend Brunch Spots',
      description: 'The best places for weekend brunch with friends',
      userId: '1',
      isPublic: true,
      isShared: false,
      privacy: 'friends',
      tags: ['brunch', 'weekend', 'social'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=200&fit=crop',
      createdAt: '2024-01-05',
      updatedAt: '2024-01-12',
      likes: 34,
      isLiked: false
    },
    {
      id: '5',
      name: 'Outdoor Adventures',
      description: 'Places to explore nature and get some fresh air',
      userId: '1',
      isPublic: true,
      isShared: false,
      privacy: 'public',
      tags: ['outdoors', 'nature', 'adventure'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop',
      createdAt: '2024-01-03',
      updatedAt: '2024-01-10',
      likes: 28,
      isLiked: false
    },
    {
      id: '6',
      name: 'Date Night Ideas',
      description: 'Romantic spots for special evenings',
      userId: '1',
      isPublic: false,
      isShared: false,
      privacy: 'private',
      tags: ['romantic', 'date-night', 'special'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&h=200&fit=crop',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-08',
      likes: 19,
      isLiked: false
    }
  ]

  // Filter and sort lists
  let filteredLists = userLists.filter(list => {
    // Filter by privacy
    if (activeFilters.length > 0) {
      const hasPrivacyFilter = activeFilters.some(f => list.privacy === f)
      if (!hasPrivacyFilter) return false
    }
    
    // Filter by tags
    if (selectedTags.length > 0) {
      const hasTagFilter = selectedTags.some(tag => list.tags.includes(tag))
      if (!hasTagFilter) return false
    }
    
    return true
  })

  // Sort lists
  switch (sortBy) {
    case 'recent':
      filteredLists = [...filteredLists].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      break
    case 'popular':
      filteredLists = [...filteredLists].sort((a, b) => (b.likes || 0) - (a.likes || 0))
      break
    case 'alphabetical':
      filteredLists = [...filteredLists].sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'places':
      filteredLists = [...filteredLists].sort((a, b) => (b.hubs?.length || 0) - (a.hubs?.length || 0))
      break
  }

  // Always show auto-generated lists first
  filteredLists.sort((a, b) => {
    const aIsAuto = a.tags.includes('auto-generated')
    const bIsAuto = b.tags.includes('auto-generated')
    if (aIsAuto && !bIsAuto) return -1
    if (!aIsAuto && bIsAuto) return 1
    return 0
  })

  const handleLikeList = (listId: string) => {
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

  const handleSaveList = (listId: string) => {
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

  const handleSaveToPlace = (place: any) => {
    setSelectedPlace(place)
    setShowSaveModal(true)
  }

  const handleSave = (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
    console.log('Saving place:', { place: selectedPlace, status, rating, listIds, note })
    setShowSaveModal(false)
    setSelectedPlace(null)
  }

  const handleCreateList = (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => {
    console.log('Creating new list:', listData)
    setShowSaveModal(false)
    setSelectedPlace(null)
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
        console.log('Deleting list:', list.id)
        setShowConfirmModal(false)
      }
    })
    setShowConfirmModal(true)
  }

  const handlePrivacyChange = (listId: string, newPrivacy: 'public' | 'private' | 'friends') => {
    console.log('Changing privacy for list:', listId, 'to:', newPrivacy)
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  return (
    <div className="relative min-h-full overflow-x-hidden bg-linen-50">
      {/* Enhanced background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-linen-texture opacity-80 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gold-50/60 via-linen-100/80 to-sage-100/70 opacity-80"></div>
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-charcoal-900/10"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 px-4 pt-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-white/80 backdrop-blur-sm border border-linen-200 text-charcoal-600 hover:bg-white hover:shadow-soft transition"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-serif font-bold text-charcoal-800">My Lists</h1>
              <p className="text-sage-600 text-sm">{filteredLists.length} lists</p>
            </div>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('openCreateList'))
              }}
              className="p-2 rounded-xl bg-gradient-to-r from-sage-500 to-gold-500 text-white shadow-soft hover:shadow-botanical transition"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Search and Filter */}
          <div className="mb-6">
            <SearchAndFilter
              placeholder="Search your lists..."
              sortOptions={sortOptions}
              filterOptions={filterOptions}
              availableTags={availableTags}
              sortBy={sortBy}
              setSortBy={setSortBy}
              activeFilters={activeFilters}
              setActiveFilters={setActiveFilters}
              dropdownPosition="top-right"
            />
          </div>

          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="px-3 py-1 rounded-full text-sm font-medium bg-sage-100 text-sage-700 border border-sage-200 hover:bg-sage-200 transition flex items-center gap-1"
                >
                  #{tag}
                  <span className="text-sage-500">×</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lists Grid */}
      <div className="relative z-10 px-4 pb-20">
        <div className="max-w-2xl mx-auto">
          <div className="grid gap-4">
            {filteredLists.map((list) => (
              <div
                key={list.id}
                className="relative rounded-2xl shadow-botanical border border-linen-200 bg-white/98 overflow-hidden transition hover:shadow-cozy hover:-translate-y-1"
              >
                {/* Botanical accent */}
                <BotanicalAccent />
                
                <div className="flex flex-col md:flex-row gap-0">
                  {/* Cover Image */}
                  <div className="w-full md:w-40 h-32 md:h-auto flex-shrink-0 bg-linen-100 relative">
                    <img 
                      src={list.coverImage} 
                      alt={list.name} 
                      className="w-full h-full object-cover"
                    />
                    {/* Privacy indicator */}
                    <div className="absolute top-2 right-2">
                      {list.privacy === 'private' && (
                        <div className="p-1.5 rounded-full bg-charcoal-900/70 backdrop-blur-sm">
                          <EyeIcon className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {list.privacy === 'friends' && (
                        <div className="p-1.5 rounded-full bg-sage-900/70 backdrop-blur-sm">
                          <MapPinIcon className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 pr-2">
                          <h3 className="font-serif font-semibold text-lg text-charcoal-700">{list.name}</h3>
                          {list.tags.includes('auto-generated') && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gold-100 text-gold-700 border border-gold-200">
                              Auto
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleLikeList(list.id)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition ${
                              likedLists.has(list.id) 
                                ? 'bg-gold-100 text-gold-700 border border-gold-200' 
                                : 'bg-gold-50 text-gold-600 hover:bg-gold-100'
                            }`}
                          >
                            <HeartIcon className={`w-3 h-3 ${likedLists.has(list.id) ? 'fill-current' : ''}`} />
                            {list.likes || 0}
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-charcoal-500 mb-3 leading-relaxed">{list.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        {list.tags.filter(tag => tag !== 'auto-generated').map(tag => (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`px-2 py-1 rounded-full text-xs font-medium transition ${
                              selectedTags.includes(tag)
                                ? 'bg-sage-200 text-sage-800 border border-sage-300'
                                : 'bg-sage-50 text-sage-700 border border-sage-100 hover:bg-sage-100'
                            }`}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-charcoal-400">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          {new Date(list.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPinIcon className="w-3 h-3" />
                          {list.hubs?.length || 0} places
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-linen-200">
                      <button
                        onClick={() => openListModal(list, 'view-all-lists')}
                        className="flex-1 py-2 px-3 rounded-lg bg-sage-100 text-sage-700 font-medium text-sm hover:bg-sage-200 transition"
                      >
                        View List
                      </button>
                      
                      <button
                        onClick={() => handleCreatePost(list.id)}
                        className="p-2 rounded-lg bg-gold-50 text-gold-600 hover:bg-gold-100 transition"
                        title="Add to list"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => handleSaveToPlace({
                          id: list.id,
                          name: list.name,
                          address: 'Various locations',
                          tags: list.tags,
                          posts: [],
                          savedCount: list.likes,
                          createdAt: list.createdAt
                        })}
                        className="p-2 rounded-lg bg-gold-50 text-gold-600 hover:bg-gold-100 transition"
                        title="Save to list"
                      >
                        <BookmarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredLists.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-linen-100 flex items-center justify-center">
                <BookmarkIcon className="w-8 h-8 text-charcoal-400" />
              </div>
              <h3 className="text-lg font-serif font-semibold text-charcoal-700 mb-2">No lists found</h3>
              <p className="text-charcoal-500 mb-4">Try adjusting your filters or create a new list</p>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('openCreateList'))
                }}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-sage-500 to-gold-500 text-white font-medium hover:shadow-botanical transition"
              >
                Create Your First List
              </button>
            </div>
          )}
        </div>
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
          userLists={userLists}
          onSave={handleSave}
          onCreateList={handleCreateList}
        />
      )}

      <CreatePost
        isOpen={showCreatePost}
        onClose={() => {
          setShowCreatePost(false)
          setCreatePostListId(null)
        }}
        preSelectedListIds={createPostListId ? [createPostListId] : undefined}
      />

      {selectedList && (
        <EditListModal
          isOpen={showEditListModal}
          onClose={() => {
            setShowEditListModal(false)
            setSelectedList(null)
          }}
          list={selectedList}
          onSave={(updatedList) => {
            console.log('Updated list:', updatedList)
            setShowEditListModal(false)
            setSelectedList(null)
          }}
        />
      )}

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        onConfirm={confirmModalConfig.onConfirm}
      />
    </div>
  )
}

export default ViewAllLists 