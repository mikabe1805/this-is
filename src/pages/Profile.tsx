import type { User, List, Activity, Place } from '../types/index.js'
import { BookmarkIcon, HeartIcon, PlusIcon, MapPinIcon, CalendarIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { useState, useRef, useEffect, useMemo, useDeferredValue } from 'react'
import SearchAndFilter from '../components/SearchAndFilter'
import SaveModal from '../components/SaveModal'
import LocationSelectModal from '../components/LocationSelectModal'
import CreatePost from '../components/CreatePost'
import UserMenuDropdown from '../components/UserMenuDropdown'
import ListMenuDropdown from '../components/ListMenuDropdown'
import EditListModal from '../components/EditListModal'
import PrivacyModal from '../components/PrivacyModal'
import ConfirmModal from '../components/ConfirmModal'
import { firebaseListService } from '../services/firebaseListService.js'
import GoogleMapsImportModal from '../components/GoogleMapsImportModal'
import { useNavigate } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useAuth } from '../contexts/AuthContext.tsx'
import { firebaseDataService } from '../services/firebaseDataService.js'
import TagAutocomplete from '../components/TagAutocomplete'
import TagPill from '../components/TagPill'
import { formatTimestamp } from '../utils/dateUtils'
import AdvancedFiltersDrawer from '../components/AdvancedFiltersDrawer'
// import Card from '../components/Card'
import Section from '../components/Section'

// BotanicalAccent removed for minimal profile header

const sortOptions = [
    { key: 'relevance', label: 'Relevance' },
    { key: 'popular', label: 'Most Popular' },
    { key: 'friends', label: 'Most Liked by Friends' },
    { key: 'nearby', label: 'Closest to Location' },
]
const filterOptions = [
    { key: 'loved', label: 'Loved' },
    { key: 'tried', label: 'Tried' },
    { key: 'want', label: 'Want to' },
]
// Tags for filters are fetched from Firebase so tag search can reach the full set

const Profile = () => {
    const { openListModal } = useNavigation()
    const { currentUser: authUser, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [userLists, setUserLists] = useState<List[]>([])
    const [savedListIds, setSavedListIds] = useState<Set<string>>(new Set())
    const [listCount, setListCount] = useState(0);
    const [placeCount, setPlaceCount] = useState(0);
    const [followerCount, setFollowerCount] = useState(0);
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [sortBy, setSortBy] = useState('relevance')
    const [activeFilters, setActiveFilters] = useState<string[]>([])
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const deferredSearch = useDeferredValue(searchQuery)
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name?: string } | null>(null)
    const [listDistances, setListDistances] = useState<Record<string, number>>({})
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showGoogleMapsImport, setShowGoogleMapsImport] = useState(false);
    const [showListMenu, setShowListMenu] = useState(false);
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [showEditListModal, setShowEditListModal] = useState(false);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmModalConfig, setConfirmModalConfig] = useState({ title: '', message: '', onConfirm: () => {} });
    const [commentInput, setCommentInput] = useState('');
    const [newTag, setNewTag] = useState('');
    const [availableUserTags, setAvailableUserTags] = useState<string[]>([])
    const [availableTags, setAvailableTags] = useState<string[]>([])
    const [comments, setComments] = useState<any[]>([]);
    // const [likedLists] = useState<Set<string>>(new Set());
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [createPostListId, setCreatePostListId] = useState<string | null>(null);
    const [activityItems, setActivityItems] = useState<Activity[]>([]);
    const [showAllActivity, setShowAllActivity] = useState(false);
    const userMenuButtonRef = useRef<HTMLButtonElement>(null);
    const listMenuButtonRef = useRef<HTMLButtonElement>(null);
    const placeCacheRef = useRef<Record<string, Place>>({})

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
        const loadUserActivity = async () => {
            if (!authUser) return
            try {
                const activity = await firebaseDataService.getUserActivity(authUser.id, 20)
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

    const profileTags = currentUser?.tags || []
    const setProfileTags = async (newTags: string[] | ((prev: string[]) => string[])) => {
        if (!currentUser) return
        const updatedTags = typeof newTags === 'function' ? newTags(currentUser.tags || []) : newTags
        setCurrentUser({
            ...currentUser,
            tags: updatedTags
        })
        try {
            await firebaseDataService.updateUserTags(currentUser.id, updatedTags)
        } catch (error) {
            console.error('Error updating user tags:', error)
        }
    }

    useEffect(() => {
        const loadUserTags = async () => {
            try {
                const [userTags, globalTags] = await Promise.all([
                    firebaseDataService.getPopularUserTags(100),
                    firebaseDataService.getPopularTags(200)
                ])
                setAvailableUserTags(userTags)
                setAvailableTags(globalTags)
            } catch (e) {
                console.warn('Failed to load tags, using defaults', e)
                setAvailableUserTags(['cozy','trendy','local','adventurous','bookworm','coffee-lover','foodie','night-owl','early-bird'])
                setAvailableTags(['cozy','trendy','quiet','local','charming','authentic','chill'])
            }
        }
        loadUserTags()
    }, [])

    // Compute nearest distances per list when a location is selected or lists change
    useEffect(() => {
        const compute = async () => {
            if (!selectedLocation) return
            const distances: Record<string, number> = {}
            await Promise.all(userLists.map(async (list) => {
                const hubs: any = (list as any).hubs || []
                if (!Array.isArray(hubs) || hubs.length === 0) return
                let min = Infinity
                for (const hubRef of hubs) {
                    // hubRef may be a placeId string or an object with coordinates
                    if (typeof hubRef === 'string') {
                        let place = placeCacheRef.current[hubRef]
                        if (!place) {
                            const fetched = await firebaseDataService.getPlace(hubRef)
                            if (fetched) {
                                placeCacheRef.current[hubRef] = fetched
                                place = fetched
                            }
                        }
                        const lat = place && place.coordinates ? place.coordinates.lat : undefined
                        const lng = place && place.coordinates ? place.coordinates.lng : undefined
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
            }))
            setListDistances(distances)
        }
        compute()
    }, [selectedLocation, userLists])

    useEffect(() => {
        const loadUserData = async () => {
            if (!authUser) {
                navigate('/auth')
                return
            }
            try {
                setLoading(true)
                const [userProfile, lists, savedPlaces, followers] = await Promise.all([
                    firebaseDataService.getCurrentUser(authUser.id),
                    firebaseDataService.getUserLists(authUser.id),
                    firebaseDataService.getSavedPlaces(authUser.id),
                    firebaseDataService.getFollowers(authUser.id),
                ]);

                if (userProfile) {
                    setCurrentUser(userProfile);
                    setUserLists(lists);
                    setListCount(lists.length);
                    setPlaceCount(savedPlaces.length);
                    setFollowerCount(followers.length);
                    
                    // Load profile comments
                    try {
                        const profileComments = await firebaseDataService.getProfileComments(authUser.id);
                        setComments(profileComments);
                    } catch (error) {
                        console.error('Error loading profile comments:', error);
                        setComments([]);
                    }
                    
                    // Load saved list IDs in one shot
                    try {
                        const savedLists = await firebaseDataService.getSavedLists(authUser.id)
                        setSavedListIds(new Set(savedLists.map(l => l.id)))
                    } catch (e) {
                        console.warn('Failed to load saved lists, falling back to empty set', e)
                        setSavedListIds(new Set())
                    }
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

    // Refetch data when page becomes visible (e.g., when returning from Favorites page)
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (!document.hidden && authUser && !loading) {
                try {
                    const updatedLists = await firebaseDataService.getUserLists(authUser.id);
                    setUserLists(updatedLists);
                } catch (error) {
                    console.error('Error refreshing lists:', error);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [authUser, loading]);

    // Refetch data when navigating back to this page
    useEffect(() => {
        if (authUser && !loading) {
            const refreshLists = async () => {
                try {
                    const updatedLists = await firebaseDataService.getUserLists(authUser.id);
                    setUserLists(updatedLists);
                } catch (error) {
                    console.error('Error refreshing lists:', error);
                }
            };
            refreshLists();
        }
    }, [location.pathname, authUser, loading]);

    useEffect(() => {
        const onOpenEdit = (e: any) => {
            const id = e.detail?.listId as string
            if (!id) return
            setSelectedListId(id)
            setShowEditListModal(true)
        }
        const onOpenPrivacy = (e: any) => {
            const id = e.detail?.listId as string
            if (!id) return
            setSelectedListId(id)
            setShowPrivacyModal(true)
        }
        const onOpenDelete = (e: any) => {
            const id = e.detail?.listId as string
            if (!id) return
            setSelectedListId(id)
            setConfirmModalConfig({ title: 'Delete List', message: 'Are you sure?', onConfirm: async () => {
                try {
                    await firebaseListService.deleteList(id)
                    setUserLists(prev => prev.filter(l => l.id !== id))
                } catch (e) { console.error(e) }
            } })
            setShowConfirmModal(true)
        }
        window.addEventListener('openEditListFromModal', onOpenEdit)
        window.addEventListener('openPrivacyFromModal', onOpenPrivacy)
        window.addEventListener('openDeleteFromModal', onOpenDelete)
        return () => {
            window.removeEventListener('openEditListFromModal', onOpenEdit)
            window.removeEventListener('openPrivacyFromModal', onOpenPrivacy)
            window.removeEventListener('openDeleteFromModal', onOpenDelete)
        }
    }, [])

    // Derived data (must be above any early returns to keep hook order stable)
    const filteredLists = useMemo(() => userLists.filter(list => {
        if ((list.tags || []).includes('auto-generated')) return false
        if (deferredSearch.trim()) {
            const q = deferredSearch.toLowerCase()
            const matches =
                list.name.toLowerCase().includes(q) ||
                (list.description || '').toLowerCase().includes(q) ||
                (list.tags || []).some(t => t.toLowerCase().includes(q))
            if (!matches) return false
        }
        if (selectedTags.length > 0) {
            const hasTag = selectedTags.some(tag => (list.tags || []).map(t=>t.toLowerCase()).includes(tag.toLowerCase()))
            if (!hasTag) return false
        }
        if (activeFilters.length === 0) return true
        return activeFilters.some(f => (list.tags || []).includes(f))
    }), [userLists, deferredSearch, activeFilters, selectedTags])

    const sortedLists = useMemo(() => {
        if (sortBy === 'relevance') {
            const q = deferredSearch.trim().toLowerCase()
            const tagSet = new Set(selectedTags.map(t=>t.toLowerCase()))
            const scored = filteredLists.map(l => {
                let score = 0
                const name = (l.name||'').toLowerCase()
                const desc = (l.description||'').toLowerCase()
                const tags = (l.tags||[]).map(t=>t.toLowerCase())
                if (q) {
                    if (name.includes(q)) score += 4
                    if (desc.includes(q)) score += 2
                    if (tags.some(t=>t.includes(q))) score += 3
                }
                if (tagSet.size>0) {
                    const matches = tags.filter(t=>tagSet.has(t)).length
                    score += matches * 5
                }
                // tie-breaker by popularity
                return { l, score: score, pop: l.likes||0 }
            })
            return scored.sort((a,b)=> (b.score - a.score) || (b.pop - a.pop)).map(s=>s.l)
        }
        if (sortBy === 'popular') return [...filteredLists].sort((a,b)=> (b.likes||0)-(a.likes||0))
        if (sortBy === 'friends') return [...filteredLists].reverse()
        if (sortBy === 'nearby' && selectedLocation) {
            return [...filteredLists].sort((a, b) => {
                const da = listDistances[a.id] ?? Number.MAX_VALUE
                const db = listDistances[b.id] ?? Number.MAX_VALUE
                return da - db
            })
        }
        return filteredLists
    }, [filteredLists, sortBy, selectedLocation, listDistances, deferredSearch, selectedTags])

    const [visibleCount, setVisibleCount] = useState(6)
    const visibleLists = useMemo(() => sortedLists.slice(0, visibleCount), [sortedLists, visibleCount])

    const filteredActivityItems = useMemo(() => activityItems.filter(activity => {
        const q = deferredSearch.trim().toLowerCase()
        if (!q) return true
        const placeMatch = activity.place?.name?.toLowerCase().includes(q) || activity.place?.address?.toLowerCase().includes(q)
        const listMatch = activity.list?.name?.toLowerCase().includes(q) || activity.list?.description?.toLowerCase().includes(q)
        return !!(placeMatch || listMatch)
    }), [activityItems, deferredSearch])

    const lastWeekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const weeklyActivityItems = useMemo(() => filteredActivityItems.filter(a => {
        const t = new Date((a as any).createdAt).getTime()
        return !Number.isNaN(t) && t >= lastWeekCutoff
    }), [filteredActivityItems, lastWeekCutoff])

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

    const activityToShow = showAllActivity ? weeklyActivityItems : filteredActivityItems.slice(0, 3)

        const handleLikeList = async (listId: string) => {
        if (!currentUser) return;

        // Optimistic update - immediately update the UI
        setSavedListIds(prevIds => {
            const newIds = new Set(prevIds);
            if (newIds.has(listId)) {
                newIds.delete(listId);
            } else {
                newIds.add(listId);
            }
            return newIds;
        });

        // Optimistic update for like count
        setUserLists(prevLists =>
            prevLists.map(list => {
                if (list.id === listId) {
                    const isCurrentlySaved = savedListIds.has(listId);
                    return {
                        ...list,
                        likes: isCurrentlySaved ? (list.likes || 1) - 1 : (list.likes || 0) + 1
                    };
                }
                return list;
            })
        );
        
        try {
            // Only toggle like, not save, to avoid double counting likes
            await firebaseListService.likeList(listId, currentUser.id);
        } catch (error) {
            console.error("Failed to like list:", error);
            // Revert on failure
            setSavedListIds(prevIds => {
                const newIds = new Set(prevIds);
                if (newIds.has(listId)) {
                    newIds.delete(listId);
                } else {
                    newIds.add(listId);
                }
                return newIds;
            });
            // Revert like count
            setUserLists(prevLists =>
                prevLists.map(list => {
                    if (list.id === listId) {
                        const isCurrentlySaved = savedListIds.has(listId);
                        return {
                            ...list,
                            likes: isCurrentlySaved ? (list.likes || 0) + 1 : (list.likes || 1) - 1
                        };
                    }
                    return list;
                })
            );
        }
    }

    const handleSaveToPlace = (place: Place) => {
        setSelectedPlace(place)
        setShowSaveModal(true)
    }

    const handleSave = (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
        console.log('Saving place:', {
            place: selectedPlace,
            status,
            rating,
            listIds,
            note,
            autoSaveToList: `All ${status.charAt(0).toUpperCase() + status.slice(1)}`
        })
    }

    const handleCreateList = (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => {
        console.log('Creating new list:', listData, 'and saving place:', selectedPlace)
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
        <div className="relative min-h-full overflow-x-hidden bg-surface sunlight-soft">
            <div className="relative z-10 px-4 pt-5">
                <form onSubmit={(e) => { e.preventDefault() }}>
                    <SearchAndFilter
                        placeholder="Search your lists, places, or friends..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        showBackButton={!!searchQuery}
                        onBackClick={() => setSearchQuery('')}
                        sortOptions={sortOptions}
                        filterOptions={filterOptions}
                        availableTags={availableTags}
                        selectedTags={selectedTags}
                        setSelectedTags={setSelectedTags}
                        sortBy={sortBy}
                        setSortBy={handleSortByChange}
                        activeFilters={activeFilters}
                        setActiveFilters={setActiveFilters}
                        dropdownPosition="top-right"
                        onSubmitQuery={() => { /* in-place filtering */ }}
                        onOpenAdvanced={() => setShowAdvanced(true)}
                    />
                </form>
                <AdvancedFiltersDrawer
                    isOpen={showAdvanced}
                    onClose={() => setShowAdvanced(false)}
                    onApply={() => {
                        setShowAdvanced(false);
                    }}
                />
            </div>
            {!searchQuery.trim() && (
            <div className="relative z-10 p-6 mt-6 rounded-2xl surface-soft max-w-2xl mx-auto overflow-hidden flex flex-col gap-2 sunlight-soft">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <span className="pointer-events-none absolute -top-3 -left-3 w-16 h-16 rounded-full bg-white/55 blur-xl opacity-80"></span>
                        <img
                            src={currentUser.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'}
                            alt={currentUser.name}
                            className="w-20 h-20 rounded-xl object-cover bg-white/20"
                            onError={(e) => {
                                console.warn('Profile image failed to load:', currentUser.avatar)
                                e.currentTarget.src = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
                            }}
                            onLoad={() => {
                                if (currentUser.avatar && !currentUser.avatar.includes('unsplash') && !currentUser.avatar.includes('placeholder')) {
                                    console.log('✅ Custom profile image loaded successfully:', currentUser.avatar)
                                }
                            }}
                        />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-serif font-extrabold text-title tracking-tight">{currentUser.name}</h2>
                            </div>
                            <button
                                ref={userMenuButtonRef}
                                onClick={() => setShowUserMenu(true)}
                                className="w-8 h-8 glass rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                <EllipsisHorizontalIcon className="w-5 h-5 text-charcoal-600" />
                            </button>
                        </div>
                        <p className="text-[1.05rem] text-meta mb-1">@{currentUser.username}</p>
                        {currentUser.location && (
                            <div className="flex items-center gap-2 text-[0.95rem] text-body mb-1">
                                <MapPinIcon className="w-5 h-5 text-bark-700/70" />
                                {currentUser.location}
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-[0.95rem] text-meta">
                            <CalendarIcon className="w-5 h-5 text-gold-500" />
                            <span>Member since {formatTimestamp(currentUser.createdAt)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-6 mt-4">
                    <div className="text-center">
                        <div className="text-xl font-serif font-bold text-charcoal-700">{listCount}</div>
                        <div className="text-xs text-charcoal-400">Lists</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-serif font-bold text-charcoal-700">{placeCount}</div>
                        <div className="text-xs text-charcoal-400">Places</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-serif font-bold text-charcoal-700">{followerCount}</div>
                        <div className="text-xs text-charcoal-400">Followers</div>
                    </div>
                </div>
                {currentUser.bio && (
                    <p className="mt-4 text-[0.95rem] text-body glass rounded-xl p-3">{currentUser.bio}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-4">
                    {profileTags.map(tag => (
                        <TagPill
                            key={tag}
                            label={tag}
                            size="sm"
                            onClick={() => navigate(`/search?tag=${tag}`)}
                        />
                    ))}
                    <div className="w-full max-w-xs">
                        <TagAutocomplete
                            value={newTag}
                            onChange={setNewTag}
                            onAdd={() => {
                                if (newTag.trim() && !profileTags.includes(newTag.trim())) {
                                    setProfileTags(tags => [...tags, newTag.trim()])
                                    setNewTag('')
                                }
                            }}
                            currentTags={profileTags}
                            availableTags={availableUserTags}
                            showPopularTags={true}
                            popularLabel="Relevant tags"
                            persistTo="userTags"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-6 border-t border-white/20 pt-4">
                    <div className="text-center cursor-pointer" onClick={() => navigate('/lists')}>
                        <div className="text-xl font-serif font-semibold text-title">{listCount}</div>
                        <div className="text-sm text-meta">Lists</div>
                    </div>
                    <div className="text-center cursor-pointer" onClick={() => navigate('/places')}>
                        <div className="text-xl font-serif font-semibold text-title">{placeCount}</div>
                        <div className="text-sm text-meta">Places</div>
                    </div>
                    <div className="text-center cursor-pointer" onClick={() => navigate('/profile/following')}>
                        <div className="text-xl font-serif font-semibold text-title">{followerCount}</div>
                        <div className="text-sm text-meta">Followers</div>
                    </div>
                </div>
            </div>
            )}
            {!searchQuery.trim() && (
            <div className="relative z-10 p-4 max-w-2xl mx-auto sunlight-soft">
                <div className="rounded-2xl surface-soft p-6 flex gap-4 transition hover-lift hover-lift-on">
                    <button
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent('openCreateList'))
                        }}
                        className="flex-1 rounded-xl p-4 bg-white/22 border border-white/26 backdrop-blur-md text-bark-900 font-semibold flex flex-col items-center gap-2 shadow-soft hover:bg-white/28 transition"
                    >
                        <PlusIcon className="w-6 h-6" />
                        New List
                    </button>
                    <button
                        onClick={() => navigate('/lists')}
                        className="flex-1 rounded-xl p-4 bg-white/22 border border-white/26 backdrop-blur-md text-bark-900 font-semibold flex flex-col items-center gap-2 shadow-soft hover:bg-white/28 transition"
                    >
                        <BookmarkIcon className="w-6 h-6" />
                        View My Lists
                    </button>
                    <button
                        onClick={() => navigate('/favorites')}
                        className="flex-1 rounded-xl p-4 bg-white/22 border border-white/26 backdrop-blur-md text-bark-900 font-semibold flex flex-col items-center gap-2 shadow-soft hover:bg-white/28 transition"
                    >
                        <HeartIcon className="w-6 h-6" />
                        Favorites
                    </button>
                </div>
            </div>
            )}
            <div className="relative z-10 p-4 max-w-2xl mx-auto space-y-8 pb-20">
                <div>
                    <Section title="Your Lists" action={
                      <button onClick={() => { const params = new URLSearchParams(); if (selectedTags.length > 0) params.set('tags', selectedTags.join(',')); if (sortBy) params.set('sort', sortBy); params.set('onlyMine', 'true'); navigate(`/lists?${params.toString()}`) }} className="text-sm font-medium text-body hover:underline">View All</button>
                    }>
                    <div className="space-y-4">
                        {visibleLists.map((list) => (
                            <div
                                key={list.id}
                                role="button"
                                tabIndex={0}
                                className="w-full text-left rounded-xl glass flex flex-col md:flex-row gap-4 overflow-hidden transition hover:bg-white/20 focus:outline-none"
                                                                    onClick={() => openListModal(list, 'profile')}
                                aria-label={`Open list ${list.name}`}
                            >
                    <div className="w-full md:w-40 h-28 md:h-auto flex-shrink-0 bg-white/10 rounded-xl overflow-hidden">
                                    <img src={list.coverImage} alt={list.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                                <div className="flex-1 p-4 flex flex-col justify-between">
                                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-title">{list.name}</h4>
                                            {list.tags.includes('auto-generated') && (
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gold-100 text-gold-700 border border-gold-200">
                                                    Auto
                                                </span>
                                            )}
                                            {currentUser?.id === list.userId && (
                                                <button
                                                    ref={listMenuButtonRef}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSelectedListId(list.id)
                                                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                                        // @ts-ignore
                                                        listMenuButtonRef.current = e.currentTarget as HTMLButtonElement
                                                        setShowListMenu(true)
                                                    }}
                                                    className="ml-auto w-8 h-8 bg-linen-100 rounded-full flex items-center justify-center hover:bg-linen-200 transition-colors"
                                                    aria-label="Open list actions"
                                                >
                                                    <EllipsisHorizontalIcon className="w-5 h-5 text-charcoal-600" />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-sm text-charcoal-500 mb-2 leading-relaxed break-words">{list.description}</p>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {list.tags.filter(tag => tag !== 'auto-generated').map(tag => (
                                                <TagPill
                                                    key={tag}
                                                    label={tag}
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/search?tag=${tag}`) }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <img src={currentUser?.avatar || 'https://via.placeholder.com/150'} alt={currentUser?.name || 'User'} className="w-6 h-6 rounded-full object-cover" loading="lazy" />
                                        <span className="text-xs text-charcoal-500 font-medium">{currentUser?.name || 'User'}</span>
                                        <div className="ml-auto flex items-center gap-2">
                                            <button
                                                onClick={e => { e.stopPropagation(); handleLikeList(list.id) }}
                                                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition ${savedListIds.has(list.id)
                                                    ? 'bg-red-100 text-red-600 border border-red-200'
                                                    : 'bg-gold-50 text-gold-600 hover:bg-gold-100'
                                                    }`}
                                                title="Add to favorites"
                                            >
                                                {savedListIds.has(list.id) ? (
                                                    <HeartIconSolid className="w-4 h-4" />
                                                ) : (
                                                    <HeartIcon className="w-4 h-4" />
                                                )}
                                                {list.likes || 0}
                                            </button>
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation()
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
                                                    className="p-1.5 rounded-full glass hover:bg-white/20 transition"
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
                    </Section>
                    {visibleCount < sortedLists.length && (
                        <div className="mt-4 flex justify-center">
                            <button
                                onClick={() => setVisibleCount(c => c + 6)}
                                className="pill pill--quiet"
                            >
                                Load more
                            </button>
                        </div>
                    )}
                    {/* Reset filters/tags when any tag filters are active */}
                    {(selectedTags.length > 0 || activeFilters.length > 0 || searchQuery.trim()) && (
                        <div className="mt-2">
                            <button
                                onClick={() => { setSelectedTags([]); setActiveFilters([]); setSearchQuery(''); setSortBy('popular'); }}
                                className="text-xs text-charcoal-500 hover:underline"
                            >
                                Reset filters
                            </button>
                        </div>
                    )}
                </div>
                <div>
                    <Section title="Recent Activity" action={!searchQuery.trim() ? (
                      <button onClick={() => setShowAllActivity(prev => !prev)} className="text-sm font-medium text-body hover:underline">{showAllActivity ? 'Show less' : 'See all recent activity'}</button>
                    ) : null}>
                    <div className="space-y-4">
                        {activityToShow.map((activity) => (
                            <div key={activity.id} className="rounded-xl glass flex items-center gap-4 p-4 transition hover:bg-white/20">
                                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                    <BookmarkIcon className="w-6 h-6 text-bark-700" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-charcoal-700 font-medium">
                                        Saved <span className="font-semibold">{activity.place?.name}</span> to <span className="font-semibold">{activity.list?.name}</span>
                                    </p>
                                    <p className="text-xs text-charcoal-400 mt-1">{formatTimestamp((activity as any).createdAt)}</p>
                                </div>
                            </div>
                        ))}
                        {(!searchQuery.trim() && !showAllActivity && filteredActivityItems.length > 3) && (
                            <button
                                onClick={() => setShowAllActivity(true)}
                                className="w-full mt-2 text-center text-sm font-medium text-body hover:underline"
                            >
                                See all recent activity
                            </button>
                        )}
                    </div>
                    </Section>
                </div>
                {!searchQuery.trim() && (
                <div className="rounded-2xl shadow-soft border border-linen-200 p-6">
                    <h3 className="text-xl font-serif font-semibold text-charcoal-700 mb-4">Comments</h3>
                    <div className="space-y-4 mb-4">
                        {comments.length > 0 ? (
                            comments.map((comment) => (
                                <div key={comment.id} className="flex items-start gap-3 p-3 bg-linen-50 rounded-xl">
                                    <img src={comment.userAvatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'} alt={comment.username} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-soft flex-shrink-0" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-charcoal-700">{comment.username}</span>
                                            <span className="text-xs text-charcoal-400">{formatTimestamp(comment.createdAt)}</span>
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
                            firebaseDataService.postProfileComment(currentUser.id, authUser.id, commentInput);
                            setCommentInput('')
                            // Refresh comments after posting
                            setTimeout(async () => {
                                try {
                                    const profileComments = await firebaseDataService.getProfileComments(authUser.id);
                                    setComments(profileComments);
                                } catch (error) {
                                    console.error('Error refreshing profile comments:', error);
                                }
                            }, 100);
                        }}
                        className="flex items-center gap-3 p-4 bg-linen-50 rounded-xl border border-linen-200"
                    >
                        <img src={currentUser?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'} alt={currentUser?.name} className="w-10 h-10 rounded-full object-cover shadow-soft flex-shrink-0" />
                        <input
                            type="text"
                            value={commentInput}
                            onChange={e => setCommentInput(e.target.value)}
                            placeholder="Write a comment..."
                            className="flex-1 rounded-full px-4 py-3 border border-linen-200 bg-white text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 shadow-soft"
                        />
                    </form>
                </div>
                )}
            </div>
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
                onLocationSelect={(loc: any) => {
                    setSelectedLocation({ lat: loc.coordinates.lat, lng: loc.coordinates.lng, name: loc.name })
                    setSortBy('nearby')
                    setShowLocationModal(false)
                }}
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
            {/* List Menu Dropdown */}
            <ListMenuDropdown
                isOpen={showListMenu}
                onClose={() => {
                    setShowListMenu(false)
                }}
                buttonRef={listMenuButtonRef}
                onEditList={() => {
                    const list = userLists.find(l => l.id === selectedListId)
                    if (!list) return
                    setShowListMenu(false)
                    // slight timeout to ensure menu unmounts before modal mounts
                    setTimeout(() => {
                        setShowEditListModal(true)
                    }, 0)
                }}
                onChangePrivacy={() => {
                    const list = userLists.find(l => l.id === selectedListId)
                    if (!list) return
                    setShowPrivacyModal(true)
                    setShowListMenu(false)
                }}
                onDeleteList={() => {
                    const list = userLists.find(l => l.id === selectedListId)
                    if (!list) return
                    setConfirmModalConfig({
                        title: 'Delete List',
                        message: `Are you sure you want to delete "${list.name}"? This action cannot be undone.`,
                        onConfirm: async () => {
                            try {
                                await firebaseListService.deleteList(list.id)
                                setUserLists(prev => prev.filter(l => l.id !== list.id))
                            } catch (e) {
                                console.error('Failed to delete list:', e)
                            }
                        }
                    })
                    setShowConfirmModal(true)
                    setShowListMenu(false)
                }}
                isPublic={(() => {
                    const list = userLists.find(l => l.id === selectedListId)
                    if (!list) return true
                    // Prefer explicit privacy flag, fallback to isPublic boolean
                    return (list as any).privacy ? (list as any).privacy === 'public' : !!(list as any).isPublic
                })()}
                isOwner={true}
            />
            {/* Edit List Modal */}
            <EditListModal
                isOpen={showEditListModal}
                onClose={() => setShowEditListModal(false)}
                list={selectedListId ? (userLists.find(l => l.id === selectedListId)
                  ? {
                      id: (userLists.find(l => l.id === selectedListId) as any)!.id,
                      name: (userLists.find(l => l.id === selectedListId) as any)!.name,
                      description: (userLists.find(l => l.id === selectedListId) as any)!.description || '',
                      privacy: (((userLists.find(l => l.id === selectedListId) as any)!.privacy) || 'public') as 'public' | 'private' | 'friends',
                      tags: (userLists.find(l => l.id === selectedListId) as any)!.tags || [],
                      coverImage: (userLists.find(l => l.id === selectedListId) as any)!.coverImage || ''
                    }
                  : null) : null}
                onSave={async (listData) => {
                    if (selectedListId) {
                        try {
                            await firebaseListService.updateList(selectedListId, listData as any)
                        } catch (e) {
                            console.error('Failed to save list changes:', e)
                        }
                    }
                    // Update locally after successful save upstream
                    setUserLists(prev => prev.map(l => l.id === selectedListId ? { ...l, ...listData } as List : l))
                    setShowEditListModal(false)
                }}
            />
            {/* Privacy Modal */}
            <PrivacyModal
                isOpen={showPrivacyModal}
                onClose={() => setShowPrivacyModal(false)}
                currentPrivacy={(selectedListId ? ((userLists.find(l => l.id === selectedListId) as any)?.privacy || 'public') : 'public')}
                onPrivacyChange={async (newPrivacy) => {
                    if (!selectedListId) return
                    try {
                        await firebaseListService.updateList(selectedListId, { privacy: newPrivacy } as any)
                    } catch (e) {
                        console.error('Failed to update privacy:', e)
                    }
                    setUserLists(prev => prev.map(l => l.id === selectedListId ? { ...l, privacy: newPrivacy, isPublic: (newPrivacy as any) === 'public' } as any : l))
                }}
                listName={selectedListId ? (userLists.find(l => l.id === selectedListId)?.name || '') : ''}
            />
            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={async () => {
                    const list = userLists.find(l => l.id === selectedListId)
                    if (!list) return
                    try {
                        await firebaseListService.deleteList(list.id)
                        setUserLists(prev => prev.filter(l => l.id !== list.id))
                    } catch (e) {
                        console.error('Failed to delete list:', e)
                    }
                    setShowConfirmModal(false)
                }}
                title={confirmModalConfig.title}
                message={confirmModalConfig.message}
                confirmText="Delete"
                type="danger"
            />
            <GoogleMapsImportModal
                isOpen={showGoogleMapsImport}
                onClose={() => setShowGoogleMapsImport(false)}
                onImport={handleGoogleMapsImport}
            />
            <AdvancedFiltersDrawer
                isOpen={showAdvanced}
                onClose={() => setShowAdvanced(false)}
                onApply={() => {
                    setShowAdvanced(false);
                }}
            />
        </div>
    )
}

export default Profile
