import type { User, List, Activity, Place } from '../types/index.js'
import { BookmarkIcon, HeartIcon, PlusIcon, MapPinIcon, CalendarIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { useState, useRef, useEffect, useMemo, useDeferredValue } from 'react'
// SearchAndFilter removed in UX refresh — replaced by inline header search
import SaveModal from '../components/SaveModal'
import PageWatermark from '../components/ui/PageWatermark'
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
// AdvancedFiltersDrawer removed in UX refresh
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
    const { openListModal, openHubModal } = useNavigation()
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

    // Refresh saved-place count and lists when a save happens elsewhere.
    useEffect(() => {
        if (!authUser) return
        const onSaved = async () => {
            try {
                const [lists, savedPlaces] = await Promise.all([
                    firebaseDataService.getUserLists(authUser.id),
                    firebaseDataService.getSavedPlaces(authUser.id),
                ])
                setUserLists(lists)
                setListCount(lists.length)
                setPlaceCount(savedPlaces.length)
            } catch (e) {
                console.warn('[profile] saved-event refresh failed', e)
            }
        }
        window.addEventListener('this-is:saved', onSaved)
        return () => window.removeEventListener('this-is:saved', onSaved)
    }, [authUser?.id]);

    // Keep follower count in sync when someone follows/unfollows this user.
    useEffect(() => {
        if (!authUser) return
        const onFollowed = (e: Event) => {
            const detail = (e as CustomEvent).detail as { followedId?: string; delta?: number } | undefined
            if (!detail || detail.followedId !== authUser.id) return
            setFollowerCount(prev => Math.max(0, prev + (detail.delta || 0)))
        }
        window.addEventListener('this-is:followed', onFollowed)
        return () => window.removeEventListener('this-is:followed', onFollowed)
    }, [authUser?.id]);

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

    const handleSave = async (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
        if (!selectedPlace || !authUser) { setShowSaveModal(false); return }
        try {
            const ids = Array.isArray(listIds) ? listIds : []
            for (const lid of ids) {
                await firebaseDataService.savePlaceToList(selectedPlace.id, lid, authUser.id, note, undefined, status, rating)
            }
            await firebaseDataService.saveToAutoList(selectedPlace.id, authUser.id, status, note, rating)
            await firebaseDataService.recordUserSave(selectedPlace.id, authUser.id)
        } catch (e) {
            console.error('[profile] save failed', e)
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
            console.error('[profile] create list + save failed', e)
        } finally {
            setShowSaveModal(false)
            setSelectedPlace(null)
        }
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
        <div className="relative min-h-full overflow-x-hidden">
            <PageWatermark variant="climbing" anchor="top" size={400} opacity={0.20} />
            <header className="sticky top-0 z-30 bg-[#FAF7F1]/85 backdrop-blur-md border-b border-stone-200/60">
                <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
                    <h1 className="text-[26px] font-semibold tracking-tight text-stone-900 leading-none">Profile</h1>
                    <div className="flex items-center gap-2">
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter your lists"
                            className="h-10 w-44 px-3.5 rounded-xl bg-white border border-stone-200 text-[14px] text-stone-900 placeholder:text-stone-400 focus:border-stone-400 outline-none"
                        />
                    </div>
                </div>
            </header>
            {!searchQuery.trim() && (
            <div className="relative z-10 px-5 pt-6 pb-2 max-w-2xl mx-auto">
                <div className="flex items-start gap-5">
                    <img
                        src={currentUser.avatar || '/assets/default-avatar.svg'}
                        alt={currentUser.name}
                        className="w-[88px] h-[88px] rounded-full object-cover bg-paper-deep ring-1 ring-edge"
                        onError={(e) => {
                            e.currentTarget.src = '/assets/default-avatar.svg'
                        }}
                    />
                    <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="font-display text-[34px] leading-[0.95] text-ink truncate">
                                    {currentUser.name}
                                </h2>
                                <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-mute mt-1.5">
                                    @{currentUser.username}
                                </p>
                            </div>
                            <button
                                ref={userMenuButtonRef}
                                onClick={() => setShowUserMenu(true)}
                                className="shrink-0 w-9 h-9 rounded-full bg-card border border-edge flex items-center justify-center hover:border-ink/30 transition-colors"
                                aria-label="More"
                            >
                                <EllipsisHorizontalIcon className="w-5 h-5 text-ink" />
                            </button>
                        </div>
                        {currentUser.location && (
                            <p className="text-[13px] text-ink-soft mt-2 flex items-center gap-1.5">
                                <MapPinIcon className="w-3.5 h-3.5 text-ink-mute" />
                                {currentUser.location}
                            </p>
                        )}
                    </div>
                </div>
                {currentUser.bio && (
                    <p className="font-display-italic text-[18px] text-ink-soft leading-snug mt-5 max-w-prose">
                        {currentUser.bio}
                    </p>
                )}
                <div className="grid grid-cols-3 divide-x divide-edge border-y border-edge mt-6">
                    <div className="px-2 py-3">
                        <div className="label-eyebrow text-ink-mute">Lists</div>
                        <div className="font-display text-[26px] leading-none mt-1.5 text-ink">{listCount}</div>
                    </div>
                    <div className="px-2 py-3 pl-4">
                        <div className="label-eyebrow text-ink-mute">Places</div>
                        <div className="font-display text-[26px] leading-none mt-1.5 text-ink">{placeCount}</div>
                    </div>
                    <div className="px-2 py-3 pl-4">
                        <div className="label-eyebrow text-ink-mute">Followers</div>
                        <div className="font-display text-[26px] leading-none mt-1.5 text-ink">{followerCount}</div>
                    </div>
                </div>
                <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute mt-3 flex items-center gap-1.5">
                    <CalendarIcon className="w-3 h-3" />
                    Member since {formatTimestamp(currentUser.createdAt)}
                </p>
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
            </div>
            )}
            {!searchQuery.trim() && (
            <div className="relative z-10 px-5 max-w-2xl mx-auto mt-6">
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('openCreateList'))}
                        className="rounded-2xl px-4 py-4 bg-card border border-edge text-ink flex flex-col items-start gap-3 hover:border-ink/30 transition-colors press"
                    >
                        <PlusIcon className="w-5 h-5 text-accent" />
                        <span className="label-eyebrow">New list</span>
                    </button>
                    <button
                        onClick={() => navigate('/lists')}
                        className="rounded-2xl px-4 py-4 bg-card border border-edge text-ink flex flex-col items-start gap-3 hover:border-ink/30 transition-colors press"
                    >
                        <BookmarkIcon className="w-5 h-5 text-ink" />
                        <span className="label-eyebrow">My lists</span>
                    </button>
                    <button
                        onClick={() => navigate('/favorites')}
                        className="rounded-2xl px-4 py-4 bg-card border border-edge text-ink flex flex-col items-start gap-3 hover:border-ink/30 transition-colors press"
                    >
                        <HeartIcon className="w-5 h-5 text-ink" />
                        <span className="label-eyebrow">Favorites</span>
                    </button>
                </div>
            </div>
            )}
            <div className="relative z-10 p-4 max-w-2xl mx-auto space-y-8 pb-20">
                <div>
                    <Section title="Your Lists" action={
                      <button onClick={() => { const params = new URLSearchParams(); if (selectedTags.length > 0) params.set('tags', selectedTags.join(',')); if (sortBy) params.set('sort', sortBy); params.set('onlyMine', 'true'); navigate(`/lists?${params.toString()}`) }} className="text-sm font-medium text-body hover:underline">View All</button>
                    }>
                    <div className="space-y-3">
                        {visibleLists.map((list) => (
                            <div
                                key={list.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => openListModal(list, 'profile')}
                                aria-label={`Open list ${list.name}`}
                                className="w-full text-left rounded-2xl bg-card border border-edge flex gap-3.5 overflow-hidden hover:border-ink/20 transition-colors cursor-pointer p-3"
                            >
                                <div className="w-24 h-24 shrink-0 rounded-[12px] overflow-hidden bg-paper-deep ring-1 ring-edge">
                                    {list.coverImage ? (
                                        <img src={list.coverImage} alt={list.name} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center font-display text-[28px] text-ink-soft" aria-hidden>
                                            {(list.name || '?').slice(0, 1).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col">
                                    <div className="flex items-start gap-2">
                                        <h4 className="font-display text-[20px] leading-tight text-ink truncate flex-1">{list.name}</h4>
                                        {currentUser?.id === list.userId && (
                                            <button
                                                ref={listMenuButtonRef}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setSelectedListId(list.id)
                                                    // @ts-ignore
                                                    listMenuButtonRef.current = e.currentTarget as HTMLButtonElement
                                                    setShowListMenu(true)
                                                }}
                                                className="shrink-0 w-8 h-8 rounded-full hover:bg-paper-deep flex items-center justify-center"
                                                aria-label="List actions"
                                            >
                                                <EllipsisHorizontalIcon className="w-5 h-5 text-ink-mute" />
                                            </button>
                                        )}
                                    </div>
                                    {list.description && (
                                        <p className="text-[12px] text-ink-soft line-clamp-1 mt-1">{list.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-auto pt-2">
                                        <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute">
                                            {(list as any).hubs?.length || 0} places
                                        </span>
                                        {list.tags.includes('auto-generated') && (
                                            <span className="glass-honey label-eyebrow px-2 h-5 rounded-full inline-flex items-center">Auto</span>
                                        )}
                                        <div className="ml-auto flex items-center gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleLikeList(list.id) }}
                                                className="h-8 px-2 rounded-full font-mono text-[11px] tracking-wide flex items-center gap-1 transition-colors text-ink-mute hover:text-ink"
                                                title="Like"
                                            >
                                                {savedListIds.has(list.id) ? (
                                                    <HeartIconSolid className="w-4 h-4" style={{ color: 'var(--bloom-deep)' }} />
                                                ) : (
                                                    <HeartIcon className="w-4 h-4" />
                                                )}
                                                {list.likes ? list.likes : ''}
                                            </button>
                                            {currentUser?.id === list.userId && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleCreatePost(list.id) }}
                                                    className="h-8 w-8 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink-mute hover:text-ink"
                                                    title="Add a post"
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
                                className="btn-secondary h-10 px-5 label-eyebrow"
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
                            <button
                                key={activity.id}
                                type="button"
                                onClick={() => {
                                    if (activity.type === 'create_list' && activity.list) {
                                        openListModal(activity.list as any, 'profile-activity')
                                    } else if (activity.place) {
                                        openHubModal(activity.place as any, 'profile-activity')
                                    } else if (activity.list) {
                                        openListModal(activity.list as any, 'profile-activity')
                                    }
                                }}
                                className="w-full text-left rounded-xl glass flex items-center gap-4 p-4 transition hover:bg-white/20 cursor-pointer"
                            >
                                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                    <BookmarkIcon className="w-6 h-6 text-bark-700" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-charcoal-700 font-medium truncate">
                                        Saved <span className="font-semibold">{activity.place?.name}</span> to <span className="font-semibold">{activity.list?.name}</span>
                                    </p>
                                    <p className="text-xs text-charcoal-400 mt-1">{formatTimestamp((activity as any).createdAt)}</p>
                                </div>
                            </button>
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
                <div className="px-5 mt-8">
                    <div className="flex items-baseline justify-between mb-4">
                        <div>
                            <span className="label-eyebrow flex items-center gap-1.5" style={{ color: 'var(--accent-deep)' }}>
                                <span className="accent-bead-sm accent-bead" /> Guestbook
                            </span>
                            <h2 className="font-display text-[24px] leading-none text-ink mt-1.5">
                                Comments<span style={{ color: 'var(--bloom)' }}>.</span>
                            </h2>
                        </div>
                    </div>
                    {comments.length > 0 ? (
                        <ul className="divide-y divide-edge border-y border-edge mb-4">
                            {comments.map((comment) => {
                                const canDelete = !!currentUser && !!authUser && (
                                    comment.userId === currentUser.id || authUser.id === currentUser.id
                                )
                                return (
                                <li key={comment.id} className="py-3.5 flex items-start gap-3">
                                    <img src={comment.userAvatar || '/assets/default-avatar.svg'} alt={comment.username} className="w-9 h-9 rounded-full object-cover ring-1 ring-edge shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-[14px] font-medium text-ink truncate">{comment.username}</span>
                                            <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute">{formatTimestamp(comment.createdAt)}</span>
                                        </div>
                                        <p className="text-[14px] text-ink-soft leading-relaxed mt-1 whitespace-pre-wrap">{comment.text}</p>
                                    </div>
                                    {canDelete && (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (!authUser || !currentUser) return
                                                if (!window.confirm('Delete this comment?')) return
                                                const ok = await firebaseDataService.deleteProfileComment(authUser.id, comment.id, currentUser.id)
                                                if (ok) setComments(prev => prev.filter(c => c.id !== comment.id))
                                            }}
                                            className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute hover:text-ink shrink-0"
                                            aria-label="Delete comment"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </li>
                            )})}
                        </ul>
                    ) : (
                        <div className="border border-edge rounded-[14px] px-5 py-8 text-center bg-card mb-4">
                            <p className="font-display text-[20px] text-ink leading-tight">Quiet here.</p>
                            <p className="text-[12px] text-ink-soft mt-1">Friends can leave a note when they visit.</p>
                        </div>
                    )}
                    <form
                        onSubmit={async e => {
                            e.preventDefault()
                            if (!commentInput.trim() || !currentUser || !authUser) return
                            const text = commentInput
                            setCommentInput('')
                            try {
                                await firebaseDataService.postProfileComment(currentUser.id, authUser.id, text)
                                const profileComments = await firebaseDataService.getProfileComments(authUser.id)
                                setComments(profileComments)
                            } catch (error) {
                                console.error('Error posting profile comment:', error)
                                setCommentInput(text)
                            }
                        }}
                        className="flex items-center gap-2"
                    >
                        <img src={currentUser?.avatar || '/assets/default-avatar.svg'} alt={currentUser?.name} className="w-9 h-9 rounded-full object-cover ring-1 ring-edge shrink-0" />
                        <input
                            type="text"
                            value={commentInput}
                            onChange={e => setCommentInput(e.target.value)}
                            placeholder="Leave a note…"
                            className="flex-1 h-11 px-4 rounded-full bg-card border border-edge text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
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
        </div>
    )
}

export default Profile
