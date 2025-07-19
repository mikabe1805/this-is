import { useState, useEffect, useRef } from 'react'
import { HeartIcon, ChatBubbleLeftIcon, ShareIcon, BookmarkIcon, PlayIcon, PauseIcon, UserIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid, BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import CommentsModal from '../components/CommentsModal.tsx'
import SaveModal from '../components/SaveModal.tsx'
import ProfileModal from '../components/ProfileModal.tsx'
import HubModal from '../components/HubModal.tsx'
import ImageCarousel from '../components/ImageCarousel.tsx'
import type { User, Post, Story, Reel, Comment, List, Place, Hub } from '../types/index.js'

// Mock data for reels content - ordered from newest to oldest (top to bottom)
const mockFollowingReels: Reel[] = [
  {
    id: '1',
    type: 'video',
    user: {
      id: '1',
      name: 'Sarah Chen',
      username: 'sarah.chen',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      location: 'San Francisco, CA'
    },
    place: {
      name: 'Blue Bottle Coffee',
      address: '300 Webster St, Oakland, CA'
    },
    content: {
      video: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=600&fit=crop',
      caption: 'The perfect spot for a morning coffee ☕️ #coffee #oakland #cozy'
    },
    stats: {
      likes: 1247,
      comments: 89,
      shares: 23,
      views: '12.4k'
    },
    isLiked: false,
    isSaved: false,
    isFollowing: true,
    timestamp: '2 hours ago'
  },
  {
    id: '2',
    type: 'story',
    user: {
      id: '2',
      name: 'Alex Rodriguez',
      username: 'alex.rodriguez',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      location: 'Oakland, CA'
    },
    place: {
      name: 'Tacos El Gordo',
      address: '123 Mission St, San Francisco, CA'
    },
    content: {
      images: [
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=600&fit=crop',
        'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400&h=600&fit=crop'
      ],
      caption: 'Best tacos in the city! 🌮 #tacos #authentic #sanfrancisco'
    },
    stats: {
      likes: 892,
      comments: 45,
      shares: 12,
      views: '8.7k'
    },
    isLiked: true,
    isSaved: false,
    isFollowing: true,
    timestamp: '4 hours ago'
  }
]

const mockDiscoveryReels: Reel[] = [
  {
    id: '3',
    type: 'post',
    user: {
      id: '3',
      name: 'Maya Patel',
      username: 'maya.patel',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      location: 'Berkeley, CA'
    },
    place: {
      name: 'Golden Gate Park',
      address: 'San Francisco, CA'
    },
    content: {
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=600&fit=crop',
      caption: 'Perfect day for a walk in the park 🌳 #outdoors #goldengate #nature'
    },
    stats: {
      likes: 2156,
      comments: 134,
      shares: 67,
      views: '24.1k'
    },
    isLiked: false,
    isSaved: true,
    isFollowing: false,
    timestamp: '1 day ago'
  },
  {
    id: '4',
    type: 'video',
    user: {
      id: '4',
      name: 'David Kim',
      username: 'david.kim',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      location: 'San Jose, CA'
    },
    place: {
      name: 'Philz Coffee',
      address: '789 Castro St, San Francisco, CA'
    },
    content: {
      video: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=600&fit=crop',
      caption: 'The art of pour-over coffee 🎨 #coffee #artisan #philz'
    },
    stats: {
      likes: 3421,
      comments: 234,
      shares: 89,
      views: '45.2k'
    },
    isLiked: true,
    isSaved: true,
    isFollowing: false,
    timestamp: '3 days ago'
  }
]

// Mock comments data
const mockComments: Comment[] = [
  {
    id: '1',
    userId: '5',
    username: 'coffee_lover',
    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    text: 'This place looks amazing! I need to check it out.',
    createdAt: '2024-01-15T10:30:00Z',
    likes: 12,
    likedBy: ['1', '2'],
    replies: [
      {
        id: '1-1',
        userId: '1',
        username: 'sarah.chen',
        userAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
        text: 'You definitely should! The atmosphere is incredible.',
        createdAt: '2024-01-15T11:00:00Z',
        likes: 5,
        likedBy: ['5']
      }
    ]
  },
  {
    id: '2',
    userId: '6',
    username: 'foodie_adventures',
    userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    text: 'Love the vibes here! What did you order?',
    createdAt: '2024-01-15T09:15:00Z',
    likes: 8,
    likedBy: ['1', '3']
  }
]

// Mock user lists
const mockUserLists: List[] = [
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
  }
]

type TabType = 'following' | 'discovery'

const Reels = () => {
  const { 
    showHubModal: navShowHubModal, 
    showListModal, 
    selectedHub: navSelectedHub, 
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
  const [activeTab, setActiveTab] = useState<TabType>('following')
  const [currentReelIndex, setCurrentReelIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set(['2', '4']))
  const [savedReels, setSavedReels] = useState<Set<string>>(new Set(['3', '4']))
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set(['2', '4']))
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionDirection, setTransitionDirection] = useState<'up' | 'down' | null>(null)
  const [nextReelIndex, setNextReelIndex] = useState<number | null>(null)
  const [showComments, setShowComments] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showHubModal, setShowHubModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null)
  const [currentReelComments, setCurrentReelComments] = useState<Comment[]>([])
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  // Get current reels based on active tab
  const currentReels = activeTab === 'following' ? mockFollowingReels : mockDiscoveryReels
  const currentReel = currentReels[currentReelIndex]

  // Reset to top when switching tabs
  useEffect(() => {
    setCurrentReelIndex(0)
    setIsPlaying(false)
  }, [activeTab])

  useEffect(() => {
    // Auto-play the first video
    if (videoRefs.current[currentReelIndex]) {
      videoRefs.current[currentReelIndex]?.play()
      setIsPlaying(true)
    }
  }, [currentReelIndex])

  const handleVideoClick = () => {
    const video = videoRefs.current[currentReelIndex]
    if (video) {
      if (isPlaying) {
        video.pause()
        setIsPlaying(false)
      } else {
        video.play()
        setIsPlaying(true)
      }
    }
  }

  const handleLike = (reelId: string) => {
    setLikedReels(prev => {
      const newSet = new Set(prev)
      if (newSet.has(reelId)) {
        newSet.delete(reelId)
      } else {
        newSet.add(reelId)
      }
      return newSet
    })
    // In real app, this would update the algorithm preferences
    console.log('Like updated for algorithm:', reelId)
  }

  const handleSave = (reelId: string) => {
    console.log('Reels: Save button clicked for reel:', reelId)
    console.log('Reels: Setting showSaveModal to true')
    setShowSaveModal(true)
  }

  const handleSaveToPlace = (place: Place) => {
    console.log('Reels: handleSaveToPlace called with place:', place.name)
    // This will be called by SaveModal when user wants to save
    setShowSaveModal(true)
  }

  const handleSavePlace = (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
    console.log('Reels: handleSavePlace called with status:', status, 'rating:', rating, 'listIds:', listIds, 'note:', note)
    // In real app, this would save the place with the given status
    console.log('Saving place with status:', status, 'rating:', rating, 'listIds:', listIds, 'note:', note)
    setSavedReels(prev => {
      const newSet = new Set(prev)
      newSet.add(currentReel.id)
      return newSet
    })
    setShowSaveModal(false)
  }

  const handleCreateList = (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => {
    // In real app, this would create a new list
    console.log('Creating new list:', listData)
  }

  const handleFollow = (userId: string) => {
    setFollowingUsers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) {
        newSet.delete(userId)
      } else {
        newSet.add(userId)
      }
      return newSet
    })
  }

  const handleUserClick = (user: User) => {
    setSelectedUser(user)
    setShowProfileModal(true)
  }

  const handleLocationClick = (place: { name: string; address: string }) => {
    // Create a mock hub for the place
    const mockHub: Hub = {
      id: 'mock-hub-' + Math.random(),
      name: place.name,
      description: `A great place to visit`,
      tags: ['popular', 'trending'],
      images: [],
      location: {
        address: place.address,
        lat: 37.7749,
        lng: -122.4194,
      },
      googleMapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(place.name)}`,
      mainImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
      posts: [],
      lists: [],
    }
    setSelectedHub(mockHub)
    setShowHubModal(true)
  }

  const handleHubModalSave = (hub: Hub) => {
    // Convert hub to place and open save modal
    const place: Place = {
      id: hub.id,
      name: hub.name,
      address: hub.location.address,
      tags: hub.tags,
      posts: hub.posts,
      savedCount: 0,
      createdAt: new Date().toISOString(),
      hubImage: hub.mainImage
    }
    setShowSaveModal(true)
  }

  const handleHubModalAddPost = (hub: Hub) => {
    // In a real app, this would open CreatePost modal
    console.log('Add post to hub:', hub.name)
    setShowHubModal(false)
  }

  const handleHubModalShare = (hub: Hub) => {
    // In a real app, this would open ShareModal
    console.log('Share hub:', hub.name)
    setShowHubModal(false)
  }

  const handleHubModalOpenList = (list: List) => {
    // In a real app, this would open ListModal
    console.log('Open list:', list.name)
    setShowHubModal(false)
  }

  const handleHubModalFullScreen = (hub: Hub) => {
    openFullScreenHub(hub)
  }

  const handleListModalFullScreen = (list: List) => {
    openFullScreenList(list)
  }

  const handleScroll = (direction: 'up' | 'down') => {
    if (isTransitioning || showComments || showSaveModal || showProfileModal || showHubModal) return // Prevent scrolling when modals are open
    
    if (direction === 'down' && currentReelIndex > 0) {
      const newIndex = currentReelIndex - 1
      setNextReelIndex(newIndex)
      setIsTransitioning(true)
      setTransitionDirection('down')
      setTimeout(() => {
        setCurrentReelIndex(newIndex)
        setNextReelIndex(null)
        setIsTransitioning(false)
        setTransitionDirection(null)
      }, 300) // Match the CSS transition duration
    } else if (direction === 'up' && currentReelIndex < currentReels.length - 1) {
      const newIndex = currentReelIndex + 1
      setNextReelIndex(newIndex)
      setIsTransitioning(true)
      setTransitionDirection('up')
      setTimeout(() => {
        setCurrentReelIndex(newIndex)
        setNextReelIndex(null)
        setIsTransitioning(false)
        setTransitionDirection(null)
      }, 300) // Match the CSS transition duration
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (showComments || showSaveModal || showProfileModal || showHubModal) return // Prevent scrolling when modals are open
    e.preventDefault()
    if (e.deltaY > 0) {
      handleScroll('up') // Scroll wheel down = go to next reel (current slides up)
    } else {
      handleScroll('down') // Scroll wheel up = go to previous reel (current slides down)
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (showComments || showSaveModal || showProfileModal || showHubModal) return // Prevent touch when modals are open
    const touch = e.touches[0]
    const startY = touch.clientY
    const startX = touch.clientX
    setTouchStartX(startX)
    
    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0]
      const endY = touch.clientY
      const endX = touch.clientX
      const diffY = startY - endY
      const diffX = startX - endX
      
      // Check if it's a horizontal swipe for tab switching
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX > 0 && activeTab === 'discovery') {
          // Swipe left on discovery tab -> switch to following
          setActiveTab('following')
        } else if (diffX < 0 && activeTab === 'following') {
          // Swipe right on following tab -> switch to discovery
          setActiveTab('discovery')
        }
      } else if (Math.abs(diffY) > 50) {
        // Vertical swipe for reel navigation
        if (diffY > 0) {
          handleScroll('up') // Swipe up = go to next reel (current slides up)
        } else {
          handleScroll('down') // Swipe down = go to previous reel (current slides down)
        }
      }
      
      setTouchStartX(null)
      document.removeEventListener('touchend', handleTouchEnd)
    }
    document.addEventListener('touchend', handleTouchEnd)
  }

  const handleCommentsClick = () => {
    setCurrentReelComments(mockComments) // In real app, fetch comments for current reel
    setShowComments(true)
  }

  const handleAddComment = async (text: string) => {
    // In real app, this would make an API call
    const newComment: Comment = {
      id: Date.now().toString(),
      userId: 'current-user',
      username: 'You',
      userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      text,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: []
    }
    setCurrentReelComments(prev => [newComment, ...prev])
  }

  const handleLikeComment = (commentId: string) => {
    // In real app, this would make an API call
    console.log('Like comment:', commentId)
  }

  const handleReplyToComment = async (commentId: string, text: string) => {
    // In real app, this would make an API call
    const newReply: Comment = {
      id: Date.now().toString(),
      userId: 'current-user',
      username: 'You',
      userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      text,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: []
    }
    
    setCurrentReelComments(prev => 
      prev.map(comment => 
        comment.id === commentId 
          ? { ...comment, replies: [...(comment.replies || []), newReply] }
          : comment
      )
    )
  }

  // Convert reel to place object for SaveModal
  const getPlaceFromReel = (reel: Reel): Place => ({
    id: reel.id,
    name: reel.place.name,
    address: reel.place.address,
    tags: [], // In real app, extract tags from caption or place data
    hubImage: reel.type === 'video' ? reel.content.thumbnail : 
              reel.type === 'story' ? reel.content.images?.[0] : 
              reel.content.image,
    posts: [],
    savedCount: 0,
    createdAt: new Date().toISOString()
  })

  return (
    <div 
      ref={containerRef}
      className="h-full bg-black relative overflow-hidden"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
    >
      {/* Tab Navigation */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/50 to-transparent pt-12 pb-4">
        <div className="flex justify-center">
          <div className="flex bg-white/10 backdrop-blur-sm rounded-full p-1">
            <button
              onClick={() => setActiveTab('following')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === 'following'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setActiveTab('discovery')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === 'discovery'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Discovery
            </button>
          </div>
        </div>
      </div>

      {/* Reel Content */}
      <div className="h-full relative overflow-hidden">
        {/* Current Reel */}
        <div 
          className={`absolute inset-0 transition-transform duration-300 ease-out ${
            isTransitioning && transitionDirection === 'down' ? 'translate-y-full' :
            isTransitioning && transitionDirection === 'up' ? '-translate-y-full' :
            'translate-y-0'
          }`}
        >
          {currentReel.type === 'video' ? (
            <div className="relative h-full">
              <video
                ref={el => { videoRefs.current[currentReelIndex] = el }}
                src={currentReel.content.video}
                poster={currentReel.content.thumbnail}
                className="w-full h-full object-cover"
                loop
                muted
                onClick={handleVideoClick}
              />
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={handleVideoClick}
                    className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                  >
                    <PlayIcon className="w-8 h-8" />
                  </button>
                </div>
              )}
            </div>
          ) : currentReel.type === 'story' ? (
            <div className="relative h-full">
              {currentReel.content.images && currentReel.content.images.length > 1 ? (
                <ImageCarousel 
                  images={currentReel.content.images} 
                  className="h-full"
                  showArrows={true}
                />
              ) : (
                <img
                  src={currentReel.content.images?.[0] || ''}
                  alt="Story"
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>
          ) : (
            <div className="relative h-full">
              {currentReel.content.images && currentReel.content.images.length > 1 ? (
                <ImageCarousel 
                  images={currentReel.content.images} 
                  className="h-full"
                  showArrows={true}
                />
              ) : (
                <img
                  src={currentReel.content.image}
                  alt="Post"
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>
          )}

        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          {/* User Info */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => handleUserClick(currentReel.user)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <img
                src={currentReel.user.avatar}
                alt={currentReel.user.name}
                className="w-12 h-12 rounded-full border-2 border-white"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-semibold">{currentReel.user.name}</h3>
                  {currentReel.isFollowing && (
                    <span className="text-xs bg-white/20 text-white px-2 py-1 rounded-full">Following</span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleLocationClick(currentReel.place)
                  }}
                  className="flex items-center gap-2 text-white/80 text-sm hover:text-white transition-colors"
                >
                  <MapPinIcon className="w-4 h-4" />
                  <span>{currentReel.place.name}</span>
                </button>
              </div>
            </button>
            <button
              onClick={() => handleFollow(currentReel.user.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                currentReel.isFollowing
                  ? 'bg-white/20 text-white hover:bg-white/30'
                  : 'bg-white text-black hover:bg-gray-100'
              }`}
            >
              {currentReel.isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>

          {/* Caption */}
          <p className="text-white mb-4 text-sm leading-relaxed">
            {currentReel.content.caption}
          </p>

          {/* Place Info */}
          <div className="flex items-center gap-2 text-white/80 text-sm mb-4">
            <MapPinIcon className="w-4 h-4" />
            <span>{currentReel.place.address}</span>
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-2 text-white/60 text-xs mb-4">
            <ClockIcon className="w-3 h-3" />
            <span>{currentReel.timestamp}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="absolute right-4 bottom-40 flex flex-col items-center gap-6 z-10">
          <button
            onClick={() => handleLike(currentReel.id)}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
              {likedReels.has(currentReel.id) ? (
                <HeartIconSolid className="w-6 h-6 text-red-500" />
              ) : (
                <HeartIcon className="w-6 h-6 text-white" />
              )}
            </div>
            <span className="text-white text-xs font-medium">
              {currentReel.stats.likes.toLocaleString()}
            </span>
          </button>

          <button 
            onClick={handleCommentsClick}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
              <ChatBubbleLeftIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-xs font-medium">
              {currentReel.stats.comments.toLocaleString()}
            </span>
          </button>

          <button className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
              <ShareIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-xs font-medium">
              {currentReel.stats.shares.toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => handleSave(currentReel.id)}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
              {savedReels.has(currentReel.id) ? (
                <BookmarkIconSolid className="w-6 h-6 text-white" />
              ) : (
                <BookmarkIcon className="w-6 h-6 text-white" />
              )}
            </div>
            <span className="text-white text-xs font-medium">Save</span>
          </button>
        </div>
        </div>

        {/* Next Reel (during transition) */}
        {isTransitioning && nextReelIndex !== null && (
          <div 
            className={`absolute inset-0 transition-transform duration-300 ease-out ${
              transitionDirection === 'down' ? '-translate-y-full' :
              transitionDirection === 'up' ? 'translate-y-full' :
              'translate-y-0'
            }`}
            style={{
              transform: transitionDirection === 'down' ? 'translateY(-100%)' :
                         transitionDirection === 'up' ? 'translateY(100%)' :
                         'translateY(0)'
            }}
          >
            {currentReels[nextReelIndex].type === 'video' ? (
              <div className="relative h-full">
                <video
                  src={currentReels[nextReelIndex].content.video}
                  poster={currentReels[nextReelIndex].content.thumbnail}
                  className="w-full h-full object-cover"
                  loop
                  muted
                />
              </div>
            ) : currentReels[nextReelIndex].type === 'story' ? (
              <div className="relative h-full">
                <img
                  src={currentReels[nextReelIndex].content.images?.[0] || ''}
                  alt="Story"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              </div>
            ) : (
              <div className="relative h-full">
                <img
                  src={currentReels[nextReelIndex].content.image}
                  alt="Post"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comments Modal */}
      <CommentsModal
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        postId={currentReel.id}
        postTitle={currentReel.content.caption}
        comments={currentReelComments}
        onAddComment={handleAddComment}
        onLikeComment={handleLikeComment}
        onReplyToComment={handleReplyToComment}
        currentUserId="current-user"
      />

      {/* Save Modal */}
      <SaveModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        place={getPlaceFromReel(currentReel)}
        userLists={mockUserLists}
        onSave={handleSavePlace}
        onCreateList={handleCreateList}
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
          onFollow={handleFollow}
        />
      )}

      {/* Hub Modal is now handled globally in App.tsx */}
    </div>
  )
}

export default Reels 