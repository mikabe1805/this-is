import { useState, useEffect } from 'react'
import { HeartIcon, BookmarkIcon, EyeIcon, PlusIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import SearchAndFilter from '../components/SearchAndFilter'
import SaveModal from '../components/SaveModal'
import LocationSelectModal from '../components/LocationSelectModal'
import CreatePost from '../components/CreatePost'
import CommentsModal from '../components/CommentsModal'
import ReplyModal from '../components/ReplyModal'
import ShareModal from '../components/ShareModal'
import type { Place, Post, List, Activity, Hub, User } from '../types/index.js'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { firebaseListService } from '../services/firebaseListService.js';
import { useAuth } from '../contexts/AuthContext.tsx'
import { firebaseDataService } from '../services/firebaseDataService.js'

const BotanicalAccent = () => (
    <svg width="80" height="80" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -top-8 -left-8 opacity-30 select-none pointer-events-none">
        <path d="M10 50 Q30 10 50 50" stroke="#A3B3A3" strokeWidth="3" fill="none" />
        <ellipse cx="18" cy="38" rx="4" ry="8" fill="#C7D0C7" />
        <ellipse cx="30" cy="28" rx="4" ry="8" fill="#A3B3A3" />
        <ellipse cx="42" cy="38" rx="4" ry="8" fill="#7A927A" />
    </svg>
)

interface FriendActivity extends Omit<Activity, 'list'> {
    user: User
    place?: Place
    placeImage?: string
    list?: string
    places?: number
    note?: string
}

interface DiscoveryItem {
    id: string
    type: 'list' | 'hub'
    title: string
    description: string
    owner?: string
    likes?: number
    places?: number
    image: string
    activity?: string
    item: List | Place
}

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

const Home = () => {
    const {
        openProfileModal,
        openListModal,
        openHubModal,
    } = useNavigation()

    const [friendsActivity, setFriendsActivity] = useState<FriendActivity[]>([])
    const [discoveryItems, setDiscoveryItems] = useState<DiscoveryItem[]>([])
    const [isLoadingActivity, setIsLoadingActivity] = useState(true)
    const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(true)
    const [activeTab, setActiveTab] = useState<'friends' | 'discovery'>('friends')
    const [sortBy, setSortBy] = useState('popular')
    const [activeFilters, setActiveFilters] = useState<string[]>([])
    const [showSaveModal, setShowSaveModal] = useState(false)
    const [showLocationModal, setShowLocationModal] = useState(false)
    const [showCreatePost, setShowCreatePost] = useState(false)
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
    const [createPostListId, setCreatePostListId] = useState<string | null>(null)
    const [createPostHub, setCreatePostHub] = useState<any>(null)
    const [showCommentsModal, setShowCommentsModal] = useState(false)
    const [showReplyModal, setShowReplyModal] = useState(false)
    const [showShareModal, setShowShareModal] = useState(false)
    const [selectedPost, setSelectedPost] = useState<Post | null>(null)
    const { currentUser } = useAuth()

    useEffect(() => {
        if (currentUser) {
            loadFriendsActivity()
            loadDiscoveryItems()
        }
    }, [currentUser])

    const loadFriendsActivity = async () => {
        if (!currentUser) return;
        try {
            setIsLoadingActivity(true)
            const friends = await firebaseDataService.getUserFriends(currentUser.id)
            if (friends.length === 0) {
                setFriendsActivity([])
                return
            }
            const allActivities: FriendActivity[] = []
            for (const friend of friends.slice(0, 10)) {
                try {
                    const friendActivity = await firebaseDataService.getUserActivity(friend.id, 5)
                    const transformedActivities: FriendActivity[] = friendActivity.map(activity => ({
                        ...activity,
                        user: friend,
                        place: activity.place,
                        placeImage: activity.place?.hubImage || 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=400&h=300&fit=crop',
                        list: activity.list?.name,
                        places: activity.list?.hubs?.length || 0,
                    }))
                    allActivities.push(...transformedActivities)
                } catch (error) {
                    console.error(`Error loading activity for friend ${friend.id}:`, error)
                }
            }
            allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            setFriendsActivity(allActivities.slice(0, 12))
        } catch (error) {
            console.error('Error loading friends activity:', error)
            setFriendsActivity([])
        } finally {
            setIsLoadingActivity(false)
        }
    }

    const loadDiscoveryItems = async () => {
        try {
            setIsLoadingDiscovery(true)
            const searchData = await firebaseDataService.performSearch('', {}, 10)
            const placeItems: DiscoveryItem[] = searchData.places.slice(0, 3).map(place => ({
                id: place.id,
                type: 'hub' as const,
                title: place.name,
                description: place.address || 'Popular spot to discover',
                activity: `${place.savedCount || 0} people have saved this`,
                image: place.hubImage || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
                item: place
            }))
            const listItems: DiscoveryItem[] = searchData.lists.slice(0, 3).map(list => ({
                id: list.id,
                type: 'list' as const,
                title: list.name,
                description: list.description || 'Curated collection of great places',
                owner: searchData.users.find(u => u.id === list.userId)?.name || 'User',
                likes: list.likes || 0,
                places: list.hubs?.length || 0,
                image: list.coverImage || 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
                item: list
            }))
            setDiscoveryItems([...placeItems, ...listItems])
        } catch (error) {
            console.error('Error loading discovery items:', error)
            setDiscoveryItems([])
        } finally {
            setIsLoadingDiscovery(false)
        }
    }

    const formatTimestamp = (timestamp: any): string => {
        if (!timestamp) return 'Recently'
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
            const now = new Date()
            const diffMs = now.getTime() - date.getTime()
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
            const diffDays = Math.floor(diffHours / 24)
            if (diffHours < 1) return 'Just now'
            if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
            if (diffDays === 1) return '1 day ago'
            if (diffDays < 7) return `${diffDays} days ago`
            return date.toLocaleDateString()
        } catch (error) {
            return 'Recently'
        }
    }

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'loved':
                return <HeartIconSolid className="w-5 h-5 text-sage-500" />
            case 'tried':
                return <BookmarkIcon className="w-5 h-5 text-gold-500" />
            case 'want':
                return <EyeIcon className="w-5 h-5 text-sage-400" />
            case 'create_list':
                return <PlusIcon className="w-5 h-5 text-gold-500" />
            default:
                return null
        }
    }

    const getActionText = (action: string) => {
        switch (action) {
            case 'loved':
                return 'loved'
            case 'tried':
                return 'tried'
            case 'want':
                return 'wants to try'
            case 'create_list':
                return 'created a list'
            default:
                return action
        }
    }

    const handleActivityClick = async (activity: FriendActivity) => {
        if (activity.type === 'create_list' && activity.listId) {
            const list = await firebaseDataService.getList(activity.listId)
            if (list) openListModal(list, 'home-activity-feed');
        } else if (activity.type === 'post' && activity.placeId) {
            const place = await firebaseDataService.getPlace(activity.placeId)
            if (place) {
                const hub: Hub = { ...place, id: place.id, name: place.name, description: ``, tags: place.tags, images: [], location: { address: place.address, lat: 0, lng: 0 }, googleMapsUrl: '', mainImage: '', posts: [], lists: [] };
                openHubModal(hub, 'home-activity-feed');
            }
        }
    }

    const handleDiscoveryClick = (item: DiscoveryItem) => {
        if (item.type === 'list') {
            openListModal(item.item as List, 'home-discovery-feed');
        } else {
            const hub: Hub = { ...item.item as Place, id: item.item.id, name: item.item.name, description: ``, tags: item.item.tags, images: [], location: { address: (item.item as Place).address, lat: 0, lng: 0 }, googleMapsUrl: '', mainImage: '', posts: [], lists: [] };
            openHubModal(hub, 'home-discovery-feed');
        }
    }

    const handleLikeItem = async (itemId: string, itemType: 'list' | 'hub') => {
    if (!currentUser) return;

    if (itemType === 'list') {
      setDiscoveryItems(prevItems =>
        prevItems.map(item => {
          if (item.id === itemId) {
            const isLiked = (item.item as List).likedBy?.includes(currentUser.id);
            const newLikedBy = isLiked
              ? (item.item as List).likedBy.filter(id => id !== currentUser.id)
              : [...((item.item as List).likedBy || []), currentUser.id];
            
            return {
              ...item,
              item: {
                ...item.item,
                likedBy: newLikedBy,
                likes: newLikedBy.length,
              },
              likes: newLikedBy.length,
            };
          }
          return item;
        })
      );

      try {
        await firebaseListService.likeList(itemId, currentUser.id);
        await firebaseDataService.saveList(itemId, currentUser.id);
      } catch (error) {
        console.error("Failed to like list:", error);
        // Revert UI on failure
        loadDiscoveryItems();
      }
    }
  };

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
        })
    }

    const handleCreateList = (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => {
        console.log('Creating new list:', listData, 'and saving place:', selectedPlace)
    }

    const handleLocationSelect = (location: { id: string; name: string; address: string; coordinates: { lat: number; lng: number } }) => {
        setSortBy('nearby')
        setShowLocationModal(false)
        console.log('Selected location for sorting:', location)
    }

    const handleSortByChange = (newSortBy: string) => {
        if (newSortBy === 'nearby') {
            setShowLocationModal(true)
        } else {
            setSortBy(newSortBy)
        }
    }

    const handleCreatePost = (listId?: string, hub?: any) => {
        setCreatePostListId(listId || null)
        setCreatePostHub(hub || null)
        setShowCreatePost(true)
    }

    const handleAddComment = (text: string) => {
        if (!selectedPost) return
        console.log('Adding comment to post:', selectedPost.id, 'Text:', text)
    }

    const handleLikeComment = (commentId: string) => {
        console.log('Liking comment:', commentId)
    }

    const handleReplyToComment = (commentId: string, text: string) => {
        console.log('Replying to comment:', commentId, 'Text:', text)
    }

    const handlePostReply = async (text: string, images?: string[]) => {
        if (!selectedPost) return
        console.log('Creating reply to post:', selectedPost.id, 'Text:', text, 'Images:', images)
    }

    const handleUserClick = (userId: string) => {
        openProfileModal(userId, 'home-activity-feed')
    }

    return (
        <div className="min-h-full relative bg-linen-50 overflow-x-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-linen-texture opacity-80 mix-blend-multiply"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-gold-50/60 via-linen-100/80 to-sage-100/70 opacity-80"></div>
                <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-charcoal-900/10"></div>
            </div>
            <div className="relative z-10 p-8 pb-4 max-w-2xl mx-auto flex flex-col gap-2 overflow-visible">
                <BotanicalAccent />
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-serif font-extrabold text-charcoal-800 tracking-tight">
                                This Is
                            </h1>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="ml-1 -mt-1">
                                <path d="M4 20 Q12 4 20 20" stroke="#A3B3A3" strokeWidth="2" fill="none" />
                                <ellipse cx="8" cy="15" rx="2" ry="4" fill="#C7D0C7" />
                                <ellipse cx="16" cy="15" rx="2" ry="4" fill="#A3B3A3" />
                            </svg>
                        </div>
                        <p className="text-sage-700 text-base mt-1">
                            Your personal memory journal
                        </p>
                    </div>
                </div>
                <div className="relative mb-6">
                    <SearchAndFilter
                        placeholder="Search places, lists, or friends..."
                        sortOptions={sortOptions}
                        filterOptions={filterOptions}
                        availableTags={availableTags}
                        sortBy={sortBy}
                        setSortBy={handleSortByChange}
                        activeFilters={activeFilters}
                        setActiveFilters={setActiveFilters}
                        onLocationSelect={handleLocationSelect}
                        dropdownPosition="top-right"
                    />
                </div>
                <div className="flex bg-white/80 rounded-xl p-1 mb-6 shadow-soft">
                    <button
                        onClick={() => setActiveTab('friends')}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${activeTab === 'friends'
                            ? 'bg-gradient-to-r from-sage-400 to-gold-300 text-white shadow-botanical'
                            : 'text-sage-700 hover:text-sage-900'
                            }`}
                    >
                        Friends
                    </button>
                    <button
                        onClick={() => setActiveTab('discovery')}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${activeTab === 'discovery'
                            ? 'bg-gradient-to-r from-sage-400 to-gold-300 text-white shadow-botanical'
                            : 'text-sage-700 hover:text-sage-900'
                            }`}
                    >
                        Discovery
                    </button>
                </div>
            </div>
            <div className="relative z-10 px-8 pb-8 max-w-2xl mx-auto overflow-x-hidden">
                {activeTab === 'friends' ? (
                    <div className="space-y-6">
                        <h2 className="text-xl font-serif font-semibold text-charcoal-700 mb-4">
                            Recent Activity
                        </h2>
                        {isLoadingActivity ? (
                            <p className="text-center py-8">Loading activity...</p>
                        ) : friendsActivity.length === 0 ? (
                            <p className="text-center py-8">No recent activity yet.</p>
                        ) : (
                            friendsActivity.map((activity) => (
                                <button
                                    key={activity.id}
                                    onClick={() => handleActivityClick(activity)}
                                    className="w-full bg-white/98 rounded-2xl shadow-botanical border border-linen-200 p-5 hover:shadow-cozy hover:-translate-y-1 transition-all duration-300 text-left flex flex-col gap-2 overflow-hidden"
                                >
                                    <div className="flex items-start gap-4">
                                        <img
                                            src={activity.user.avatar}
                                            alt={activity.user.name}
                                            className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-soft"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleUserClick(activity.user.id)
                                                    }}
                                                    className="font-semibold text-charcoal-800 hover:text-sage-600 transition-colors cursor-pointer"
                                                >
                                                    {activity.user.name}
                                                </span>
                                                <span className="text-sage-400">•</span>
                                                <span className="text-sage-500 text-sm">{formatTimestamp(activity.createdAt)}</span>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                {getActionIcon(activity.type)}
                                                <div className="flex-1">
                                                    <p className="text-sage-900">
                                                        {activity.type === 'create_list' ? (
                                                            <>
                                                                <span className="font-medium">{getActionText(activity.type)}</span>
                                                                <span className="font-semibold text-charcoal-800"> "{activity.list}"</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="font-medium">{getActionText(activity.type)}</span>
                                                                <span className="font-semibold text-charcoal-800"> {activity.place?.name}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                    {activity.type === 'create_list' && (
                                                        <p className="text-sage-700 text-sm mt-1">{activity.note}</p>
                                                    )}
                                                    {activity.note && (
                                                        <p className="text-sage-700 text-sm mt-2 italic">
                                                            "{activity.note}"
                                                        </p>
                                                    )}
                                                    {activity.placeImage && (
                                                        <img
                                                            src={activity.placeImage}
                                                            alt={activity.place?.name}
                                                            className="w-full h-32 object-cover rounded-lg mt-3 shadow-soft"
                                                        />
                                                    )}
                                                    {activity.list && activity.type !== 'create_list' && (
                                                        <div className="mt-2">
                                                            <span className="text-xs bg-linen-100 text-sage-700 px-2 py-1 rounded-full">
                                                                Saved to {activity.list}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {activity.type === 'create_list' && (
                                                        <div className="mt-2">
                                                            <span className="text-xs bg-sage-100 text-sage-600 px-2 py-1 rounded-full">
                                                                {activity.places} places
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <h2 className="text-xl font-serif font-semibold text-charcoal-700 mb-4">
                            Trending Now
                        </h2>
                        {isLoadingDiscovery ? (
                            <p className="text-center py-8">Loading discovery items...</p>
                        ) : discoveryItems.length === 0 ? (
                            <p className="text-center py-8">No trending items yet.</p>
                        ) : (
                            discoveryItems.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleDiscoveryClick(item)}
                                    className="w-full bg-white/98 rounded-2xl shadow-botanical border border-linen-200 p-5 hover:shadow-cozy hover:-translate-y-1 transition-all duration-300 text-left flex flex-col gap-2 overflow-hidden cursor-pointer"
                                >
                                    <div className="flex items-start gap-4">
                                        <img
                                            src={item.image}
                                            alt={item.title}
                                            className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-soft"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="font-semibold text-charcoal-800 line-clamp-2">{item.title}</h3>
                                                <div className="flex items-center gap-1 ml-2">
                                                    <button
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            handleLikeItem(item.id, item.type);
                                                        }}
                                                        className="p-1.5 rounded-full bg-sage-50 text-sage-600 hover:bg-sage-100 transition"
                                                        title="Like"
                                                    >
                                                        {(item.item as List).likedBy?.includes(currentUser!.id) ? <HeartIconSolid className="w-4 h-4 text-red-500" /> : <HeartIcon className="w-4 h-4" />}
                                                    </button>
                                                    {item.type === 'list' && (
                                                        <>
                                                            <button
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    handleSaveToPlace(item.item as Place);
                                                                }}
                                                                className="p-1.5 rounded-full bg-gold-50 text-gold-600 hover:bg-gold-100 transition"
                                                                title="Save to list"
                                                            >
                                                                <BookmarkIcon className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    handleCreatePost(item.id);
                                                                }}
                                                                className="p-1.5 rounded-full bg-sage-50 text-sage-600 hover:bg-sage-100 transition"
                                                                title="Create post"
                                                            >
                                                                <PlusIcon className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {item.type === 'hub' && (
                                                        <>
                                                            <button
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    handleSaveToPlace(item.item as Place);
                                                                }}
                                                                className="p-1.5 rounded-full bg-gold-50 text-gold-600 hover:bg-gold-100 transition"
                                                                title="Save to list"
                                                            >
                                                                <BookmarkIcon className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    handleCreatePost(undefined, item.item);
                                                                }}
                                                                className="p-1.5 rounded-full bg-sage-50 text-sage-600 hover:bg-sage-100 transition"
                                                                title="Create post"
                                                            >
                                                                <PlusIcon className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sage-700 text-sm mb-3">{item.description}</p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {item.owner && (
                                                    <span className="text-xs text-sage-500">by {item.owner}</span>
                                                )}
                                                {item.type === 'list' && (
                                                    <span className="text-xs bg-sage-100 text-sage-600 px-2 py-0.5 rounded-full">
                                                        {item.places} places
                                                    </span>
                                                )}
                                                {item.type === 'hub' && (
                                                    <span className="text-xs bg-gold-100 text-gold-700 px-2 py-0.5 rounded-full">
                                                        {item.activity}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
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
                    userLists={[]}
                    onSave={handleSave}
                    onCreateList={handleCreateList}
                />
            )}
            <LocationSelectModal
                isOpen={showLocationModal}
                onClose={() => setShowLocationModal(false)}
                onLocationSelect={(location) => console.log(location)}
            />
            <CreatePost
                isOpen={showCreatePost}
                onClose={() => {
                    setShowCreatePost(false)
                    setCreatePostListId(null)
                    setCreatePostHub(null)
                }}
                preSelectedListIds={createPostListId ? [createPostListId] : undefined}
                preSelectedHub={createPostHub || undefined}
            />
            {selectedPost && (
                <CommentsModal
                    isOpen={showCommentsModal}
                    onClose={() => {
                        setShowCommentsModal(false)
                        setSelectedPost(null)
                    }}
                    comments={selectedPost.comments || []}
                    onAddComment={handleAddComment}
                    onLikeComment={handleLikeComment}
                    onReplyToComment={handleReplyToComment}
                />
            )}
            {selectedPost && (
                <ReplyModal
                    isOpen={showReplyModal}
                    onClose={() => {
                        setShowReplyModal(false)
                        setSelectedPost(null)
                    }}
                    postId={selectedPost.id}
                    postAuthor={selectedPost.username}
                    postContent={selectedPost.description}
                    postImage={selectedPost.images?.[0]}
                    onReply={handlePostReply}
                />
            )}
            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                title="this.is"
                description="Discover amazing places with friends"
                url={window.location.href}
                type="post"
            />
        </div>
    )
}

export default Home
