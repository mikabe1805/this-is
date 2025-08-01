import React, { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HeartIcon, BookmarkIcon, EyeIcon, PlusIcon, ChatBubbleLeftIcon, ShareIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import SearchAndFilter from '../components/SearchAndFilter'
import HubModal from '../components/HubModal'
import ListModal from '../components/ListModal'
import SaveModal from '../components/SaveModal'
import LocationSelectModal from '../components/LocationSelectModal'
import CreatePost from '../components/CreatePost'
import CommentsModal from '../components/CommentsModal'
import ReplyModal from '../components/ReplyModal'
import ShareModal from '../components/ShareModal'
import ProfileModal from '../components/ProfileModal'
import type { Hub, Place, List, Post, User } from '../types/index.js'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { firebaseDataService } from '../services/firebaseDataService.js'
import { auth } from '../firebase/config.ts'

// Botanical SVG accent (eucalyptus branch)
const BotanicalAccent = () => (
  <svg width="80" height="80" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -top-8 -left-8 opacity-30 select-none pointer-events-none">
    <path d="M10 50 Q30 10 50 50" stroke="#A3B3A3" strokeWidth="3" fill="none"/>
    <ellipse cx="18" cy="38" rx="4" ry="8" fill="#C7D0C7"/>
    <ellipse cx="30" cy="28" rx="4" ry="8" fill="#A3B3A3"/>
    <ellipse cx="42" cy="38" rx="4" ry="8" fill="#7A927A"/>
  </svg>
)

// Interface for Firebase activity data
interface FriendActivity {
  id: string
  user: {
    name: string
    avatar: string
  }
  action: 'loved' | 'tried' | 'want' | 'created'
  place?: string
  placeImage?: string
  note?: string
  timestamp: string
  list?: string
  description?: string
  places?: number
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
  const navigate = useNavigate()
  const { 
    showHubModal, 
    showListModal, 
    selectedHub, 
    selectedList, 
    openHubModal, 
    openListModal, 
    closeHubModal, 
    closeListModal,
    hubModalFromList,
    goBackFromHubModal,
    goBackFromListModal,
    openFullScreenHub,
    openFullScreenList,
    openFullScreenUser
  } = useNavigation()
  
  // Firebase data state
  const [friendsActivity, setFriendsActivity] = useState<FriendActivity[]>([])
  const [discoveryItems, setDiscoveryItems] = useState<DiscoveryItem[]>([])
  const [isLoadingActivity, setIsLoadingActivity] = useState(true)
  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(true)
  
  // UI state
  const [activeTab, setActiveTab] = useState<'friends' | 'discovery'>('friends')
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set())
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState('popular')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<{ id: string; name: string; address: string; coordinates: { lat: number; lng: number } } | null>(null)
  const [createPostListId, setCreatePostListId] = useState<string | null>(null)
  const [createPostHub, setCreatePostHub] = useState<any>(null)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [showReplyModal, setShowReplyModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // Current user (mock for now, in real app would come from auth)
  const currentUser: User = {
    id: 'current-user',
    name: 'Demo User',
    username: 'current_user',
    bio: 'Love discovering amazing places!',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
    influences: 10,
    location: 'San Francisco, CA',
    tags: ['coffee', 'food', 'discovery']
  }

  // Load Firebase data on mount
  useEffect(() => {
    loadFriendsActivity()
    loadDiscoveryItems()
  }, [])

  const loadFriendsActivity = async () => {
    try {
      setIsLoadingActivity(true)
      
      // Get current user to load their friends
      const currentUser = auth.currentUser
      if (!currentUser) {
        setFriendsActivity([])
        return
      }
      
      // Get user's friends first
      const friends = await firebaseDataService.getUserFriends(currentUser.uid)
      
      if (friends.length === 0) {
        // If no friends, show general recent activity as fallback
        const searchData = await firebaseDataService.performSearch('', {}, 15)
        
        const fallbackActivities: FriendActivity[] = searchData.posts.slice(0, 8).map(post => ({
          id: post.id,
          user: {
            name: post.username || 'User',
            avatar: post.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face'
          },
          action: post.postType as 'loved' | 'tried' | 'want',
          place: searchData.places.find(p => p.id === post.hubId)?.name || 'Unknown Place',
          placeImage: post.images?.[0] || 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=400&h=300&fit=crop',
          note: post.description,
          timestamp: formatTimestamp(post.createdAt),
          list: post.listId ? searchData.lists.find(l => l.id === post.listId)?.name || 'Unknown List' : undefined
        }))
        
        setFriendsActivity(fallbackActivities)
        return
      }
      
      // Get activity from friends
      const allActivities: FriendActivity[] = []
      for (const friend of friends.slice(0, 10)) { // Limit to 10 friends for performance
        try {
          const friendActivity = await firebaseDataService.getUserActivity(friend.id, 5)
          
          // Transform activities to FriendActivity format
          const transformedActivities: FriendActivity[] = friendActivity.map(activity => ({
            id: activity.id,
            user: {
              name: friend.name,
              avatar: friend.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face'
            },
            action: activity.type as 'loved' | 'tried' | 'want' | 'created',
            place: activity.place?.name,
            placeImage: activity.place?.hubImage || 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=400&h=300&fit=crop',
            note: activity.description,
            timestamp: formatTimestamp(activity.createdAt),
            list: activity.list?.name,
            description: activity.list?.description,
            places: activity.list?.hubs?.length || 0
          }))
          
          allActivities.push(...transformedActivities)
        } catch (error) {
          console.error(`Error loading activity for friend ${friend.id}:`, error)
          // Continue with other friends
        }
      }
      
      // Sort by most recent and limit to 12 activities
      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
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
      
      // Get popular places and lists
      const searchData = await firebaseDataService.performSearch('', {}, 10)
      
      // Transform places and lists into discovery format
      const placeItems: DiscoveryItem[] = searchData.places.slice(0, 3).map(place => ({
        id: place.id,
        type: 'hub' as const,
        title: place.name,
        description: place.address || 'Popular spot to discover',
        activity: `${place.savedCount || 0} people have saved this`,
        image: place.hubImage || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
      }))

      const listItems: DiscoveryItem[] = searchData.lists.slice(0, 3).map(list => ({
        id: list.id,
        type: 'list' as const,
        title: list.name,
        description: list.description || 'Curated collection of great places',
        owner: searchData.users.find(u => u.id === list.userId)?.name || 'User',
        likes: list.likes || 0,
        places: list.hubs?.length || 0,
        image: list.coverImage || 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop'
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
      case 'created':
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
      case 'created':
        return 'created a list'
      default:
        return action
    }
  }

  const handleActivityClick = (activity: FriendActivity) => {
    if (activity.action === 'created') {
      // Create a mock list for the modal
      const mockList: List = {
        id: activity.list === 'SF Coffee Tour' ? 'rami-coffee-tour' : 'generic-list',
        name: activity.list || 'Unknown List',
        description: activity.description || 'A wonderful collection of places.',
        userId: activity.user.name,
        isPublic: true,
        isShared: true,
        privacy: 'public' as const,
        tags: ['coffee', 'san francisco', 'cafes'],
        hubs: [],
        coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
        createdAt: '2024-01-15',
        updatedAt: '2024-01-15',
        likes: activity.list === 'SF Coffee Tour' ? 24 : 12,
        isLiked: false
      }
      openListModal(mockList, 'home')
    } else {
      // Create a mock hub for the place
      const mockHub: Hub = {
        id: '1',
        name: activity.place || 'Unknown Place',
        description: 'A wonderful place to visit and experience.',
        tags: ['cozy', 'trendy'],
        images: [activity.placeImage || ''],
        location: {
          address: 'San Francisco, CA',
          lat: 37.7749,
          lng: -122.4194,
        },
        googleMapsUrl: 'https://www.google.com/maps',
        mainImage: activity.placeImage || '',
        posts: [],
        lists: [],
      }
      openHubModal(mockHub, 'home')
    }
  }

  const handleDiscoveryClick = (item: DiscoveryItem) => {
    if (item.type === 'list') {
      // Create a mock list for the modal
      const mockList: List = {
        id: item.id,
        name: item.title,
        description: item.description || 'A wonderful collection of places.',
        userId: item.owner || 'Unknown User',
        isPublic: true,
        isShared: true,
        privacy: 'public' as const,
        tags: ['cozy', 'trendy'],
        hubs: [],
        coverImage: item.image,
        createdAt: '2024-01-15',
        updatedAt: '2024-01-15',
        likes: item.likes || 0,
        isLiked: false
      }
      openListModal(mockList, 'home')
    } else {
      // Create a mock hub for the place
      const mockHub: Hub = {
        id: '2',
        name: item.title,
        description: item.description,
        tags: ['trendy', 'popular'],
        images: [item.image],
        location: {
          address: 'San Francisco, CA',
          lat: 37.7749,
          lng: -122.4194,
        },
        googleMapsUrl: 'https://www.google.com/maps',
        mainImage: item.image,
        posts: [],
        lists: [],
      }
      openHubModal(mockHub, 'home')
    }
  }

  const handleLikeItem = (itemId: string) => {
    setLikedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const handleSaveItem = (itemId: string) => {
    setSavedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
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

  const handleLocationSelect = (location: { id: string; name: string; address: string; coordinates: { lat: number; lng: number } }) => {
    setSelectedLocation(location)
    setSortBy('nearby') // Set the sort to nearby
    setShowLocationModal(false)
    // In a real app, you would filter/sort based on this location
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

  const handleViewComments = (post: Post) => {
    setSelectedPost(post)
    setShowCommentsModal(true)
  }

  const handleReply = (post: Post) => {
    setSelectedPost(post)
    setShowReplyModal(true)
  }

  const handleShare = (title: string, description: string, image?: string) => {
    setShowShareModal(true)
  }

  const handleAddComment = (text: string) => {
    if (!selectedPost) return
    // In a real app, this would make an API call to add a comment
    console.log('Adding comment to post:', selectedPost.id, 'Text:', text)
  }

  const handleLikeComment = (commentId: string) => {
    // In a real app, this would make an API call to like a comment
    console.log('Liking comment:', commentId)
  }

  const handleReplyToComment = (commentId: string, text: string) => {
    // In a real app, this would make an API call to reply to a comment
    console.log('Replying to comment:', commentId, 'Text:', text)
  }

  const handlePostReply = async (text: string, images?: string[]) => {
    if (!selectedPost) return
    // In a real app, this would make an API call to create a reply post
    console.log('Creating reply to post:', selectedPost.id, 'Text:', text, 'Images:', images)
  }

  const handleHubModalBack = () => {
    if (hubModalFromList) {
      goBackFromHubModal()
    } else {
      closeHubModal()
    }
  }

  const handleListModalBack = () => {
    goBackFromListModal()
  }

  // Add handlers for HubModal and ListModal buttons
  const handleHubModalSave = (hub: Hub) => {
    // Convert hub to place and open save modal
    const place: Place = {
      id: hub.id,
      name: hub.name,
      address: hub.location.address,
      tags: hub.tags,
      posts: hub.posts,
      savedCount: 0,
      createdAt: new Date().toISOString()
    }
    setSelectedPlace(place)
    setShowSaveModal(true)
  }

  const handleHubModalAddPost = (hub: Hub) => {
    console.log('Home: handleHubModalAddPost called with hub:', hub.name)
    console.log('Home: Setting createPostHub and showCreatePost to true')
    setCreatePostHub(hub)
    setShowCreatePost(true)
  }

  const handleHubModalShare = (hub: Hub) => {
    setShowShareModal(true)
  }

  const handleListModalSave = (list: List) => {
    // Convert list to place and open save modal
    const place: Place = {
      id: list.id,
      name: list.name,
      address: 'List', // Lists don't have addresses, but SaveModal expects a Place
      tags: list.tags,
      posts: [],
      savedCount: list.likes || 0,
      createdAt: list.createdAt
    }
    setSelectedPlace(place)
    setShowSaveModal(true)
  }

  const handleListModalAddPost = (list: List) => {
    setCreatePostListId(list.id)
    setShowCreatePost(true)
  }

  const handleListModalShare = (list: List) => {
    setShowShareModal(true)
  }

  const handleListModalOpenHub = (place: Place) => {
    // Convert place to hub and open hub modal
    const hub: Hub = {
      id: place.id,
      name: place.name,
      description: `A great place to visit`,
      tags: place.tags,
      images: [],
      location: {
        address: place.address,
        lat: 37.7749,
        lng: -122.4194,
      },
      googleMapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(place.name)}`,
      mainImage: place.hubImage,
      posts: place.posts,
      lists: [],
    }
    openHubModal(hub, 'list-modal')
  }

  const handleUserClick = (user: User) => {
    setSelectedUser(user)
    setShowProfileModal(true)
  }

  const handleHubModalOpenList = (list: List) => {
    openListModal(list, 'hub-modal')
  }

  const handleHubModalFullScreen = (hub: Hub) => {
    openFullScreenHub(hub)
  }

  const handleListModalFullScreen = (list: List) => {
    openFullScreenList(list)
  }

  return (
    <div className="min-h-full relative bg-linen-50 overflow-x-hidden">
      {/* Enhanced background: linen texture, sunlight gradient, vignette */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-linen-texture opacity-80 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gold-50/60 via-linen-100/80 to-sage-100/70 opacity-80"></div>
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-charcoal-900/10"></div>
      </div>
      {/* Header */}
      <div className="relative z-10 p-8 pb-4 max-w-2xl mx-auto flex flex-col gap-2 overflow-visible">
        {/* Botanical SVG accent */}
        <BotanicalAccent />
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-serif font-extrabold text-charcoal-800 tracking-tight">
                This Is
              </h1>
              {/* Small leaf icon accent */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="ml-1 -mt-1">
                <path d="M4 20 Q12 4 20 20" stroke="#A3B3A3" strokeWidth="2" fill="none"/>
                <ellipse cx="8" cy="15" rx="2" ry="4" fill="#C7D0C7"/>
                <ellipse cx="16" cy="15" rx="2" ry="4" fill="#A3B3A3"/>
              </svg>
            </div>
            <p className="text-sage-700 text-base mt-1">
              Your personal memory journal
            </p>
          </div>
        </div>
        {/* Search Bar */}
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
        {/* Tab Navigation */}
        <div className="flex bg-white/80 rounded-xl p-1 mb-6 shadow-soft">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'friends'
                ? 'bg-gradient-to-r from-sage-400 to-gold-300 text-white shadow-botanical'
                : 'text-sage-700 hover:text-sage-900'
            }`}
          >
            Friends
          </button>
          <button
            onClick={() => setActiveTab('discovery')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'discovery'
                ? 'bg-gradient-to-r from-sage-400 to-gold-300 text-white shadow-botanical'
                : 'text-sage-700 hover:text-sage-900'
            }`}
          >
            Discovery
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="relative z-10 px-8 pb-8 max-w-2xl mx-auto overflow-x-hidden">
        {activeTab === 'friends' ? (
          /* Friends Tab */
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
                            handleUserClick({
                              id: activity.user.name.toLowerCase().replace(' ', '.'),
                              name: activity.user.name,
                              username: activity.user.name.toLowerCase().replace(' ', '.'),
                              avatar: activity.user.avatar,
                              bio: activity.user.name === 'Emma' ? 'Finding cozy spots and sharing them with friends ✨' : 
                                   activity.user.name === 'Rami' ? 'Coffee enthusiast and food lover' :
                                   activity.user.name === 'Sophie' ? 'Exploring hidden gems and local favorites' : '',
                              location: 'San Francisco, CA',
                              tags: activity.user.name === 'Emma' ? ['cozy', 'coffee', 'foodie', 'local'] :
                                    activity.user.name === 'Rami' ? ['coffee', 'artisan', 'tacos', 'authentic'] :
                                    activity.user.name === 'Sophie' ? ['hidden-gems', 'local', 'authentic', 'charming'] : []
                            })
                          }}
                          className="font-semibold text-charcoal-800 hover:text-sage-600 transition-colors cursor-pointer"
                        >
                          {activity.user.name}
                        </span>
                        <span className="text-sage-400">•</span>
                        <span className="text-sage-500 text-sm">{activity.timestamp}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        {getActionIcon(activity.action)}
                        <div className="flex-1">
                          <p className="text-sage-900">
                            {activity.action === 'created' ? (
                              <>
                                <span className="font-medium">{getActionText(activity.action)}</span>
                                <span className="font-semibold text-charcoal-800"> "{activity.list}"</span>
                              </>
                            ) : (
                              <>
                                <span className="font-medium">{getActionText(activity.action)}</span>
                                <span className="font-semibold text-charcoal-800"> {activity.place}</span>
                              </>
                            )}
                          </p>
                          {activity.action === 'created' && (
                            <p className="text-sage-700 text-sm mt-1">{activity.description}</p>
                          )}
                          {activity.note && (
                            <p className="text-sage-700 text-sm mt-2 italic">
                              "{activity.note}"
                            </p>
                          )}
                          {activity.placeImage && (
                            <img 
                              src={activity.placeImage} 
                              alt={activity.place}
                              className="w-full h-32 object-cover rounded-lg mt-3 shadow-soft"
                            />
                          )}
                          {activity.list && activity.action !== 'created' && (
                            <div className="mt-2">
                              <span className="text-xs bg-linen-100 text-sage-700 px-2 py-1 rounded-full">
                                Saved to {activity.list}
                              </span>
                            </div>
                          )}
                          {activity.action === 'created' && (
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
          /* Discovery Tab */
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
                              handleLikeItem(item.id);
                            }}
                            className="p-1.5 rounded-full bg-sage-50 text-sage-600 hover:bg-sage-100 transition"
                            title="Like"
                          >
                            <HeartIcon className="w-4 h-4" />
                          </button>
                          {item.type === 'list' && (
                            <>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  // Save to list modal
                                  const mockPlace = {
                                    id: item.id,
                                    name: item.title,
                                    address: 'San Francisco, CA',
                                    tags: [],
                                    posts: [],
                                    savedCount: item.likes || 0,
                                    createdAt: '2024-01-15'
                                  };
                                  handleSaveToPlace(mockPlace);
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
                                  // Save to list modal
                                  const mockPlace = {
                                    id: item.id,
                                    name: item.title,
                                    address: 'San Francisco, CA',
                                    tags: [],
                                    posts: [],
                                    savedCount: item.likes || 0,
                                    createdAt: '2024-01-15'
                                  };
                                  handleSaveToPlace(mockPlace);
                                }}
                                className="p-1.5 rounded-full bg-gold-50 text-gold-600 hover:bg-gold-100 transition"
                                title="Save to list"
                              >
                                <BookmarkIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  // Create a mock hub for the place
                                  const mockHub = {
                                    id: item.id,
                                    name: item.title,
                                    address: 'San Francisco, CA',
                                    description: item.description,
                                    lat: 37.7749,
                                    lng: -122.4194,
                                  }
                                  handleCreatePost(undefined, mockHub);
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


              {/* Modals */}
        {selectedPlace && (
          <SaveModal
            isOpen={showSaveModal}
            onClose={() => {
              setShowSaveModal(false)
              setSelectedPlace(null)
            }}
            place={selectedPlace}
            userLists={[]} // Mock empty list for demo
            onSave={handleSave}
            onCreateList={handleCreateList}
          />
        )}

      {/* Hub Modal and List Modal are now handled globally in App.tsx */}

      <LocationSelectModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSelect={handleLocationSelect}
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

      {/* Comments Modal */}
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

      {/* Reply Modal */}
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

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="this.is"
        description="Discover amazing places with friends"
        url={window.location.href}
        type="post"
      />

      {/* Profile Modal */}
      {selectedUser && (
        <ProfileModal
          user={selectedUser}
          isOpen={showProfileModal}
          onClose={() => {
            setShowProfileModal(false)
            setSelectedUser(null)
          }}
          onFollow={(userId) => {
            console.log('Followed user:', userId)
            // In real app, this would make an API call
          }}
        />
      )}


    </div>
  )
}

export default Home 