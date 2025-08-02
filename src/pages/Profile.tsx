import type { User, List, Activity, Place } from '../types/index.js'
import { BookmarkIcon, HeartIcon, PlusIcon, MapPinIcon, CalendarIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { useState, useRef, useEffect } from 'react'
import SearchAndFilter from '../components/SearchAndFilter'
import SaveModal from '../components/SaveModal'
import LocationSelectModal from '../components/LocationSelectModal'
import CreatePost from '../components/CreatePost'
import UserMenuDropdown from '../components/UserMenuDropdown'
import GoogleMapsImportModal from '../components/GoogleMapsImportModal'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useAuth } from '../contexts/AuthContext.tsx'
import { firebaseDataService } from '../services/firebaseDataService.js'

// SVG botanical accent (e.g., eucalyptus branch)
const BotanicalAccent = () => (
  <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -top-6 -left-6 opacity-30 select-none pointer-events-none">
    <path d="M10 50 Q30 10 50 50" stroke="#A3B3A3" strokeWidth="3" fill="none"/>
    <ellipse cx="18" cy="38" rx="4" ry="8" fill="#C7D0C7"/>
    <ellipse cx="30" cy="28" rx="4" ry="8" fill="#A3B3A3"/>
    <ellipse cx="42" cy="38" rx="4" ry="8" fill="#7A927A"/>
  </svg>
)

const sortOptions = [
  { key: 'popular', label: 'Most Popular' },
  { key: 'friends', label: 'Most Liked by Friends' },
  { key: 'nearby', label: 'Closest to Location' },
]
const filterOptions = [
  { key: 'loved', label: 'Loved' },
  { key: 'tried', label: 'Tried' },
  { key: 'want', label: 'Want to' },
]
const availableTags = ['cozy', 'trendy', 'quiet', 'local', 'charming', 'authentic', 'chill']

const Profile = () => {
  const { openListModal } = useNavigation()
  const { currentUser: authUser, logout } = useAuth()
  const navigate = useNavigate()
  
  // ALL HOOKS MUST BE CALLED FIRST - React Hook Rules
  // Real user data state
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userLists, setUserLists] = useState<List[]>([])
  const [listCount, setListCount] = useState(0);
  const [placeCount, setPlaceCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Search and filter state
  const [sortBy, setSortBy] = useState('popular')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showGoogleMapsImport, setShowGoogleMapsImport] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [newTag, setNewTag] = useState('');
  const [comments] = useState<any[]>([]);
  const [likedLists] = useState<Set<string>>(new Set());
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [createPostListId, setCreatePostListId] = useState<string | null>(null);
  const [activityItems, setActivityItems] = useState<Activity[]>([]);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);

  // Load user's real activity
  useEffect(() => {
    const loadUserActivity = async () => {
      if (!authUser) return
      
      try {
        const activity = await firebaseDataService.getUserActivity(authUser.uid, 20)
        setActivityItems(activity)
      } catch (error) {
        console.error('Error loading user activity:', error)
        setActivityItems([])
      }
    }
    
    if (currentUser) {
      loadUserActivity()
    }
  }, [currentUser, authUser])


  // Get user's profile tags (use their actual tags, not mock data)
  const profileTags = currentUser?.tags || []
  const setProfileTags = async (newTags: string[] | ((prev: string[]) => string[])) => {
    if (!currentUser) return
    
    const updatedTags = typeof newTags === 'function' ? newTags(currentUser.tags || []) : newTags
    setCurrentUser({
      ...currentUser,
      tags: updatedTags
    })
    
    // Update tags in Firebase
    try {
      await firebaseDataService.updateUserTags(currentUser.id, updatedTags)
    } catch (error) {
      console.error('Error updating user tags:', error)
    }
  }

  // Load real user data
  useEffect(() => {
    const loadUserData = async () => {
      if (!authUser) {
        navigate('/auth')
        return
      }

      try {
        setLoading(true)
        
        const [userProfile, lists, savedPlaces, followers] = await Promise.all([
          firebaseDataService.getCurrentUser(authUser.uid),
          firebaseDataService.getUserLists(authUser.uid),
          firebaseDataService.getSavedPlaces(authUser.uid),
          firebaseDataService.getFollowers(authUser.uid)
        ]);

        if (userProfile) {
          setCurrentUser(userProfile);
          setUserLists(lists);
          setListCount(lists.length);
          setPlaceCount(savedPlaces.length);
          setFollowerCount(followers.length);
        } else {
          setError('User profile not found.');
        }
        
      } catch (error) {
        console.error('Error loading user data:', error)
        setError('Failed to load profile data')
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [authUser, navigate])

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warmGray-50 via-white to-warmGray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E17373] mx-auto mb-4"></div>
          <p className="text-warmGray-600">Loading your profile...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warmGray-50 via-white to-warmGray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Failed to load profile'}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#E17373] text-white rounded-lg hover:bg-[#D55F5F] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Real user activity data (loaded async)
  
  let filteredLists = userLists.filter(list => {
    // Filter out auto-generated lists from popular lists section
    if (list.tags.includes('auto-generated')) return false
    if (activeFilters.length === 0) return true
    return activeFilters.some(f => list.tags.includes(f))
  })
  if (sortBy === 'popular') filteredLists = filteredLists
  if (sortBy === 'friends') filteredLists = [...filteredLists].reverse()
  if (sortBy === 'nearby') filteredLists = filteredLists

  const handleLikeList = (listId: string) => {
    if (!currentUser) return;
    firebaseDataService.likeList(listId, currentUser.id);
  }

  const handleSaveToPlace = (place: Place) => {
    setSelectedPlace(place)
    setShowSaveModal(true)
  }

  const handleSave = (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
    // In a real app, this would save the place with the selected status
    console.log('Saving place:', { 
      place: selectedPlace, 
      status, 
      rating, 
      listIds, 
      note,
      // Auto-save to appropriate "All" list
      autoSaveToList: `All ${status.charAt(0).toUpperCase() + status.slice(1)}`
    })
    // You could also show a success toast here
  }

  const handleCreateList = (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => {
    // In a real app, this would create a new list and save the place to it
    console.log('Creating new list:', listData, 'and saving place:', selectedPlace)
    // You could also show a success toast here
  }

  const handleSortByChange = (newSortBy: string) => {
    if (newSortBy === 'nearby') {
      setShowLocationModal(true)
    } else {
      setSortBy(newSortBy)
    }
  }

  const handleCreatePost = (listId?: string) => {
    setCreatePostListId(listId || null)
    setShowCreatePost(true)
  }

  const handleImportFromGoogleMaps = () => {
    setShowGoogleMapsImport(true)
  }

  const handleGoogleMapsImport = (importData: any) => {
    console.log('Importing from Google Maps:', importData)
    // TODO: Implement actual import logic
    // This would create a new list with the imported places
  }

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <div className="relative min-h-full overflow-x-hidden bg-linen-50">
      {/* Enhanced background: linen texture, sunlight gradient, vignette */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-linen-texture opacity-80 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gold-50/60 via-linen-100/80 to-sage-100/70 opacity-80"></div>
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-charcoal-900/10"></div>
      </div>
      {/* Top Bar */}
      <div className="relative z-10 px-4 pt-6">
        <SearchAndFilter
          placeholder="Search your lists, places, or friends..."
          sortOptions={sortOptions}
          filterOptions={filterOptions}
          availableTags={availableTags}
          sortBy={sortBy}
          setSortBy={handleSortByChange}
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          dropdownPosition="top-right"
        />
      </div>
      {/* Profile Header with botanical accent */}
      <div className="relative z-10 p-8 mt-8 rounded-3xl shadow-botanical border border-linen-200 bg-white max-w-2xl mx-auto overflow-hidden flex flex-col gap-2">
        {/* Botanical SVG accent */}
        <BotanicalAccent />
        <div className="flex items-center gap-6">
          <div className="relative">
            <img
              src={currentUser.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'}
              alt={currentUser.name}
              className="w-24 h-24 rounded-2xl border-4 border-linen-100 shadow-botanical object-cover bg-linen-200"
              onError={(e) => {
                // If the uploaded image fails to load, fallback to default
                console.warn('Profile image failed to load:', currentUser.avatar)
                e.currentTarget.src = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
              }}
              onLoad={() => {
                // Debug: Log when image loads successfully
                if (currentUser.avatar && !currentUser.avatar.includes('unsplash') && !currentUser.avatar.includes('placeholder')) {
                  console.log('✅ Custom profile image loaded successfully:', currentUser.avatar)
                }
              }}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-serif font-extrabold text-charcoal-800 tracking-tight">{currentUser.name}</h2>
                {/* Small leaf icon accent */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="ml-1 -mt-1">
                  <path d="M4 20 Q12 4 20 20" stroke="#A3B3A3" strokeWidth="2" fill="none"/>
                  <ellipse cx="8" cy="15" rx="2" ry="4" fill="#C7D0C7"/>
                  <ellipse cx="16" cy="15" rx="2" ry="4" fill="#A3B3A3"/>
                </svg>
              </div>
              <button
                ref={userMenuButtonRef}
                onClick={() => setShowUserMenu(true)}
                className="w-8 h-8 bg-linen-100 rounded-full flex items-center justify-center hover:bg-linen-200 transition-colors"
              >
                <EllipsisHorizontalIcon className="w-5 h-5 text-charcoal-600" />
              </button>
            </div>
            <p className="text-base text-charcoal-500 mb-1">@{currentUser.username}</p>
            {currentUser.location && (
              <div className="flex items-center gap-2 text-sm text-sage-700 mb-1">
                <MapPinIcon className="w-5 h-5 text-sage-400" />
                {currentUser.location}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gold-600">
              <CalendarIcon className="w-5 h-5 text-gold-400" />
              <span>Member since {authUser?.metadata?.creationTime ? new Date(authUser.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}</span>
            </div>
          </div>
        </div>
        {/* Influences stat - modern page breaker */}
        <div className="relative flex items-center justify-center my-6">
          <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-gold-200 via-sage-200 to-gold-200 opacity-60" />
          <span className="relative z-10 px-8 py-2 bg-white text-2xl font-extrabold tracking-widest text-gold-600 uppercase shadow-soft rounded-full border-2 border-gold-100" style={{letterSpacing: '0.2em'}}>
            {currentUser.influences} Influences
          </span>
        </div>
        {currentUser.bio && (
          <p className="mt-4 text-lg text-charcoal-700 italic bg-linen-100 rounded-xl p-4 shadow-soft">{currentUser.bio}</p>
        )}
        {/* Profile Tags */}
        <div className="flex flex-wrap gap-2 mt-4">
          {profileTags.map(tag => (
            <button
              key={tag}
              onClick={() => {
                // Navigate to search page with tag filter
                navigate(`/search?tag=${tag}`)
              }}
              className="px-4 py-2 rounded-full text-sm font-medium bg-sage-50 border border-sage-100 text-sage-700 shadow-soft transition hover:bg-sage-100 hover:shadow-botanical"
            >
              #{tag}
            </button>
          ))}
          <form
            onSubmit={e => {
              e.preventDefault()
              if (newTag.trim() && !profileTags.includes(newTag.trim())) {
                setProfileTags(tags => [...tags, newTag.trim()])
                setNewTag('')
              }
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="Add tag..."
              className="w-24 px-3 py-2 rounded-full text-sm border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 shadow-soft"
            />
            <button type="submit" className="p-2 rounded-full bg-sage-400 text-white shadow-soft hover:bg-sage-500 transition">
              <PlusIcon className="w-4 h-4" />
            </button>
          </form>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 border-t border-linen-200 pt-4">
          <div className="text-center cursor-pointer" onClick={() => navigate('/lists')}>
            <div className="text-2xl font-serif font-bold text-charcoal-700">{listCount}</div>
            <div className="text-sm text-charcoal-400">Lists</div>
          </div>
          <div className="text-center cursor-pointer" onClick={() => navigate('/places')}>
            <div className="text-2xl font-serif font-bold text-charcoal-700">{placeCount}</div>
            <div className="text-sm text-charcoal-400">Places</div>
          </div>
          <div className="text-center cursor-pointer" onClick={() => navigate('/followers')}>
            <div className="text-2xl font-serif font-bold text-charcoal-700">{followerCount}</div>
            <div className="text-sm text-charcoal-400">Followers</div>
          </div>
        </div>
      </div>
      {/* Quick Actions - moved to top */}
      <div className="relative z-10 p-4 max-w-2xl mx-auto">
        <div className="rounded-2xl shadow-botanical border border-linen-200 bg-white/98 p-6 flex gap-4 transition hover:shadow-cozy hover:-translate-y-1">
          <button 
            onClick={() => {
              // This will be handled by the parent App component
              // We'll use a custom event to communicate with the parent
              window.dispatchEvent(new CustomEvent('openCreateList'))
            }}
            className="flex-1 rounded-xl p-4 bg-sage-100 text-sage-700 font-semibold flex flex-col items-center gap-2 shadow-soft hover:bg-sage-200 hover:shadow-botanical transition"
          >
            <PlusIcon className="w-6 h-6" />
            New List
          </button>
          <button 
            onClick={() => navigate('/lists')}
            className="flex-1 rounded-xl p-4 bg-gold-100 text-gold-700 font-semibold flex flex-col items-center gap-2 shadow-soft hover:bg-gold-200 hover:shadow-botanical transition"
          >
            <BookmarkIcon className="w-6 h-6" />
            View My Lists
          </button>
          <button 
            onClick={() => navigate('/favorites')}
            className="flex-1 rounded-xl p-4 bg-charcoal-100 text-charcoal-700 font-semibold flex flex-col items-center gap-2 shadow-soft hover:bg-charcoal-200 hover:shadow-botanical transition"
          >
            <HeartIcon className="w-6 h-6" />
            Favorites
          </button>
        </div>
      </div>
      {/* Main Content */}
      <div className="relative z-10 p-4 max-w-2xl mx-auto space-y-8 pb-20">
        {/* Most Popular Lists */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-serif font-semibold text-charcoal-700">Most Popular Lists</h3>
            <button 
              onClick={() => navigate('/lists')}
              className="text-sm font-medium text-sage-700 hover:underline"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {filteredLists.map((list) => (
              <div
                key={list.id}
                role="button"
                tabIndex={0}
                className="w-full text-left rounded-2xl shadow-botanical border border-linen-200 bg-white/98 flex flex-col md:flex-row gap-4 overflow-hidden transition hover:shadow-cozy hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-sage-200"
                onClick={() => openListModal(list, 'profile')}
                aria-label={`Open list ${list.name}`}
              >
                <div className="w-full md:w-40 h-28 md:h-auto flex-shrink-0 bg-linen-100">
                  <img src={list.coverImage} alt={list.name} className="w-full h-full object-cover rounded-l-2xl" />
                </div>
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-serif font-semibold text-lg text-charcoal-700">{list.name}</h4>
                      {list.tags.includes('auto-generated') && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gold-100 text-gold-700 border border-gold-200">
                          Auto
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-charcoal-500 mb-2 leading-relaxed break-words">{list.description}</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {list.tags.filter(tag => tag !== 'auto-generated').map(tag => (
                        <button
                          key={tag}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/search?tag=${tag}`)
                          }}
                          className="px-3 py-1 rounded-full text-xs font-medium bg-sage-50 border border-sage-100 text-sage-700 transition hover:bg-sage-100 hover:shadow-botanical"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <img src={currentUser?.avatar || 'https://via.placeholder.com/150'} alt={currentUser?.name || 'User'} className="w-6 h-6 rounded-full border-2 border-white shadow-soft object-cover" />
                    <span className="text-xs text-charcoal-500 font-medium">{currentUser?.name || 'User'}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button 
                        onClick={e => { e.stopPropagation(); handleLikeList(list.id) }}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition ${
                          likedLists.has(list.id) 
                            ? 'bg-gold-100 text-gold-700 border border-gold-200' 
                            : 'bg-gold-50 text-gold-600 hover:bg-gold-100'
                        }`}
                        title="Add to favorites"
                      >
                        <HeartIcon className={`w-4 h-4 ${likedLists.has(list.id) ? 'fill-current' : ''}`} />
                        {list.likes || 0}
                      </button>
                      <button 
                        onClick={e => { 
                          e.stopPropagation()
                          // Save to list modal
                          const mockPlace: Place = {
                            id: list.id,
                            name: list.name,
                            address: 'Various locations',
                            tags: list.tags,
                            posts: [],
                            savedCount: list.likes || 0,
                            createdAt: list.createdAt || new Date().toISOString()
                          }
                          handleSaveToPlace(mockPlace)
                        }}
                        className="p-1.5 rounded-full bg-gold-50 text-gold-600 hover:bg-gold-100 transition"
                        title="Save to list"
                      >
                        <BookmarkIcon className="w-4 h-4" />
                      </button>
                      {currentUser?.id === list.userId && (
                        <button 
                          onClick={e => { 
                            e.stopPropagation()
                            handleCreatePost(list.id)
                          }}
                          className="p-1.5 rounded-full bg-sage-50 text-sage-600 hover:bg-sage-100 transition"
                          title="Create post"
                        >
                          <PlusIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Recent Activity */}
        <div>
          <h3 className="text-xl font-serif font-semibold text-charcoal-700 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {activityItems.map((activity) => (
              <div key={activity.id} className="rounded-2xl shadow-soft border border-linen-200 bg-white/98 flex items-center gap-4 p-4 transition hover:shadow-cozy hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-sage-100 flex items-center justify-center">
                  <BookmarkIcon className="w-6 h-6 text-sage-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-charcoal-700 font-medium">
                    Saved <span className="font-semibold">{activity.place?.name}</span> to <span className="font-semibold">{activity.list?.name}</span>
                  </p>
                  <p className="text-xs text-charcoal-400 mt-1">
                    {new Date(activity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Comment Wall */}
        <div className="rounded-2xl shadow-soft border border-linen-200 p-6">
          <h3 className="text-xl font-serif font-semibold text-charcoal-700 mb-4">Comments</h3>
          <div className="space-y-4 mb-4">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-3 p-3 bg-linen-50 rounded-xl">
                  <img src={comment.user.avatar} alt={comment.user.name} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-soft flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-charcoal-700">{comment.user.name}</span>
                      <span className="text-xs text-charcoal-400">{comment.date}</span>
                    </div>
                    <p className="text-sm text-charcoal-600">{comment.text}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-linen-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-linen-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-charcoal-500 mb-2">No comments yet</p>
                <p className="text-sm text-charcoal-400">Be the first to leave a comment on your profile!</p>
              </div>
            )}
          </div>
          <form
            onSubmit={e => {
              e.preventDefault()
              if (!commentInput.trim() || !currentUser || !authUser) return
              firebaseDataService.postProfileComment(currentUser.id, authUser.uid, commentInput);
              setCommentInput('')
            }}
            className="flex items-center gap-3 p-4 bg-linen-50 rounded-xl border border-linen-200"
          >
            <img src={currentUser?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'} alt={currentUser?.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-soft flex-shrink-0" />
            <input
              type="text"
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 rounded-full px-4 py-3 border border-linen-200 bg-white text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 shadow-soft"
            />
          </form>
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

      <LocationSelectModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSelect={() => setShowLocationModal(false)}
      />

      <CreatePost
        isOpen={showCreatePost}
        onClose={() => {
          setShowCreatePost(false)
          setCreatePostListId(null)
        }}
        preSelectedListIds={createPostListId ? [createPostListId] : undefined}
      />

      <UserMenuDropdown
        isOpen={showUserMenu}
        onClose={() => setShowUserMenu(false)}
        buttonRef={userMenuButtonRef}
        onEditProfile={() => {
          navigate('/profile/edit')
        }}
        onViewFollowing={() => {
          navigate('/profile/following')
        }}
        onUserSettings={() => {
          navigate('/settings')
        }}
        onImportFromGoogleMaps={handleImportFromGoogleMaps}
        onLogout={handleLogout}
      />

      <GoogleMapsImportModal
        isOpen={showGoogleMapsImport}
        onClose={() => setShowGoogleMapsImport(false)}
        onImport={handleGoogleMapsImport}
      />


    </div>
  )
}

export default Profile