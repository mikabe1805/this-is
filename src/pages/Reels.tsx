import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  HeartIcon, 
  ChatBubbleLeftIcon, 
  ShareIcon, 
  BookmarkIcon,
  PlayIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'
import { 
  HeartIcon as HeartIconSolid, 
  BookmarkIcon as BookmarkIconSolid 
} from '@heroicons/react/24/solid'
import ImageCarousel from '../components/ImageCarousel'
import { useNavigation } from '../contexts/NavigationContext'
import CommentsModal from '../components/CommentsModal'
import SaveModal from '../components/SaveModal'
import ProfileModal from '../components/ProfileModal'
import ShareModal from '../components/ShareModal'
import type { User, Comment, List, Place } from '../types/index.js'

// Mock data for now
const mockFollowingReels = [
  {
    id: '1',
    type: 'story' as const,
    user: {
      id: '1',
      name: 'Sarah Chen',
      username: 'sarah.chen',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face'
    },
    content: {
      images: [
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=900&fit=crop',
        'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=900&fit=crop',
        'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&h=900&fit=crop'
      ],
      caption: 'The perfect spot for a morning coffee ☕ #coffee #oakland #cozy'
    },
    place: {
      id: '1',
      name: 'Blue Bottle Coffee',
      address: '300 Webster St, Oakland, CA'
    },
    stats: {
      likes: 1247,
      comments: 89,
      shares: 23,
      saves: 156
    },
    isLiked: false,
    isSaved: false
  },
  {
    id: '2',
    type: 'video' as const,
    user: {
      id: '2',
      name: 'Alex Rivera',
      username: 'alex.rivera',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
    },
    content: {
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=900&fit=crop',
      caption: 'Amazing latte art at this hidden gem! The barista is incredibly talented 🎨'
    },
    place: {
      id: '2',
      name: 'Ritual Coffee Roasters',
      address: '432 Octavia St, San Francisco, CA'
    },
    stats: {
      likes: 892,
      comments: 45,
      shares: 12,
      saves: 78
    },
    isLiked: true,
    isSaved: false
  }
]

const mockDiscoveryReels = [
  {
    id: '3',
    type: 'story' as const,
    user: {
      id: '3',
      name: 'Maya Patel',
      username: 'maya.patel',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
    },
    content: {
      images: [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=900&fit=crop',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=900&fit=crop'
      ],
      caption: 'Perfect day for a walk in the park 🌳 #outdoors #goldengate #nature'
    },
    place: {
      id: '3',
      name: 'Golden Gate Park',
      address: 'San Francisco, CA'
    },
    stats: {
      likes: 2156,
      comments: 134,
      shares: 67,
      saves: 245
    },
    isLiked: false,
    isSaved: true
  },
  {
    id: '4',
    type: 'video' as const,
    user: {
      id: '4',
      name: 'David Kim',
      username: 'david.kim',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
    },
    content: {
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=900&fit=crop',
      caption: 'The art of pour-over coffee 🎨 #coffee #artisan #philz'
    },
    place: {
      id: '4',
      name: 'Philz Coffee',
      address: '789 Castro St, San Francisco, CA'
    },
    stats: {
      likes: 3421,
      comments: 234,
      shares: 89,
      saves: 456
    },
    isLiked: true,
    isSaved: true
  }
]

const Reels = () => {
  const navigate = useNavigate()
  const { openHubModal } = useNavigation()
  
  // State
  const [currentReelIndex, setCurrentReelIndex] = useState(0)
  const [imageIndices, setImageIndices] = useState<Record<string, number>>({})
  const [likedReels, setLikedReels] = useState<Record<string, boolean>>({})
  const [savedReels, setSavedReels] = useState<Record<string, boolean>>({})
  const [isPlaying, setIsPlaying] = useState(true)
  const [activeTab, setActiveTab] = useState<'following' | 'discovery'>('following')
  
  // Animation states
  const [heartAnimation, setHeartAnimation] = useState({ show: false, x: 0, y: 0 })
  const [lastTap, setLastTap] = useState(0)
  
  // Modal states
  const [showComments, setShowComments] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [currentReelComments, setCurrentReelComments] = useState<Comment[]>([])
  const [followingUsers, setFollowingUsers] = useState<Record<string, boolean>>({})
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const touchStartRef = useRef({ x: 0, y: 0 })
  const isScrollingRef = useRef(false)
  
  const currentReels = activeTab === 'following' ? mockFollowingReels : mockDiscoveryReels
  const currentReel = currentReels[currentReelIndex]
  
  // Initialize states from mock data
  useEffect(() => {
    const likes: Record<string, boolean> = {}
    const saves: Record<string, boolean> = {}
    const allReels = [...mockFollowingReels, ...mockDiscoveryReels]
    allReels.forEach(reel => {
      likes[reel.id] = reel.isLiked
      saves[reel.id] = reel.isSaved
    })
    setLikedReels(likes)
    setSavedReels(saves)
  }, [])
  
  // Reset to top when switching tabs
  useEffect(() => {
    setCurrentReelIndex(0)
  }, [activeTab])
  
  // Video management
  useEffect(() => {
    const currentVideo = videoRefs.current[currentReelIndex]
    if (currentVideo && currentReels[currentReelIndex]?.type === 'video') {
      currentVideo.play().catch(() => {})
      setIsPlaying(true)
    }
    
    // Pause other videos
    videoRefs.current.forEach((video, index) => {
      if (video && index !== currentReelIndex) {
        video.pause()
      }
    })
  }, [currentReelIndex, currentReels])
  
  // Scroll handling
    const handleScroll = (direction: 'up' | 'down') => {
    if (isScrollingRef.current) return

    const newIndex = direction === 'up' 
      ? Math.min(currentReelIndex + 1, currentReels.length - 1)
      : Math.max(currentReelIndex - 1, 0)

    if (newIndex === currentReelIndex) return

    isScrollingRef.current = true
    setCurrentReelIndex(newIndex)

    // Longer timeout to prevent melting
    setTimeout(() => {
      isScrollingRef.current = false
    }, 500)
  }
  
  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
  }
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    // Don't allow swiping if any modal is open
    if (showComments || showSaveModal || showProfileModal || showShareModal) {
      return
    }

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    }
    
    const diffY = touchStartRef.current.y - touchEnd.y
    const diffX = Math.abs(touchStartRef.current.x - touchEnd.x)
    
    // Only handle vertical swipes and prevent default only then
    if (Math.abs(diffY) > 30 && Math.abs(diffY) > diffX) {
      e.preventDefault()
      handleScroll(diffY > 0 ? 'up' : 'down')
    }
  }
  
  // Wheel handler for desktop
    useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Don't allow wheel scrolling if any modal is open
      if (showComments || showSaveModal || showProfileModal || showShareModal) {
        return
      }
      e.preventDefault()
      handleScroll(e.deltaY > 0 ? 'up' : 'down')
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => container.removeEventListener('wheel', handleWheel)
    }
  }, [currentReelIndex, showComments, showSaveModal, showProfileModal, showShareModal])
  
  // Double tap to like
  const handleDoubleTab = (e: React.MouseEvent | React.TouchEvent) => {
    const currentTime = Date.now()
    const tapLength = currentTime - lastTap
    
    if (tapLength < 300 && tapLength > 0) {
      // Double tap
      setLikedReels(prev => ({ ...prev, [currentReel.id]: !prev[currentReel.id] }))
      
      // Show heart animation
      const rect = e.currentTarget.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0]?.clientX || e.changedTouches[0]?.clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0]?.clientY || e.changedTouches[0]?.clientY : e.clientY
      
      setHeartAnimation({
        show: true,
        x: clientX - rect.left,
        y: clientY - rect.top
      })
      
      setTimeout(() => setHeartAnimation({ show: false, x: 0, y: 0 }), 1000)
      e.preventDefault()
    }
    
    setLastTap(currentTime)
  }
  
  // Video click handler
  const handleVideoClick = (e: React.MouseEvent | React.TouchEvent) => {
    const currentTime = Date.now()
    const tapLength = currentTime - lastTap
    
    if (tapLength > 300) {
      const video = videoRefs.current[currentReelIndex]
      if (video) {
        if (isPlaying) {
          video.pause()
          setIsPlaying(false)
        } else {
          video.play().catch(() => {})
          setIsPlaying(true)
        }
      }
    }
    
    setLastTap(currentTime)
  }
  
  // Action handlers
  const handleLike = () => {
    setLikedReels(prev => ({ ...prev, [currentReel.id]: !prev[currentReel.id] }))
  }
  
  const handleSave = () => {
    setSavedReels(prev => ({ ...prev, [currentReel.id]: !prev[currentReel.id] }))
  }
  
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: currentReel.content.caption,
        url: window.location.href
      })
    } else {
      setShowShareModal(true)
    }
  }
  
  const handleCommentsClick = () => {
    // Mock comments for now
    const mockComments: Comment[] = [
      {
        id: '1',
        userId: '5',
        username: 'coffee_lover',
        userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        text: 'This place looks amazing! I need to check it out.',
        createdAt: new Date().toISOString(),
        likes: 12,
        likedBy: ['1', '2']
      }
    ]
    setCurrentReelComments(mockComments)
    setShowComments(true)
  }
  
  const handleUserClick = (user: any) => {
    const userObj: User & { isFollowing?: boolean } = {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      bio: 'Coffee enthusiast and content creator',
      location: 'San Francisco, CA',
      tags: ['coffee', 'lifestyle', 'travel'],
      isFollowing: followingUsers[user.id] || false
    }
    setSelectedUser(userObj)
    setShowProfileModal(true)
  }
  
  const handleFollow = (userId: string) => {
    setFollowingUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }))
  }
  
  const handleSaveClick = () => {
    setShowSaveModal(true)
  }
  
  const handleAddComment = async (text: string) => {
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
    console.log('Like comment:', commentId)
  }
  
  const handleReplyToComment = async (commentId: string, text: string) => {
    console.log('Reply to comment:', commentId, text)
  }
  
  const handlePlaceClick = () => {
    openHubModal({
      id: currentReel.place.id,
      name: currentReel.place.name,
      description: `A wonderful place in ${currentReel.place.address}`,
      tags: [],
      images: [],
      location: { address: currentReel.place.address, lat: 0, lng: 0 },
      googleMapsUrl: '',
      mainImage: '',
      posts: [],
      lists: []
    }, 'reels')
  }
  
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black overflow-hidden"
      style={{ 
        zIndex: 1000,
        overscrollBehavior: 'none'
      }}
      data-reels-page="true"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}

    >
      {/* Reels Container */}
      <div className="relative w-full h-full">
        {currentReels.map((reel, index) => (
          <div
            key={reel.id}
            className="absolute inset-0 w-full h-full transition-transform duration-300 ease-out"
            style={{
              transform: `translateY(${(index - currentReelIndex) * 100}%)`,
              zIndex: currentReels.length - index,
              backfaceVisibility: 'hidden',
              willChange: 'transform',
              contain: 'layout style paint'
            }}
          >
            {/* Blurry Background Layer */}
            <div className="absolute inset-0 w-full h-full">
              {reel.type === 'video' ? (
                <div
                  className="w-full h-full bg-cover bg-center filter blur-2xl scale-110 opacity-80"
                  style={{
                    backgroundImage: `url(${reel.content.thumbnail})`,
                    transform: 'scale(1.1) translateZ(0)',
                    filter: 'blur(40px) brightness(0.7)'
                  }}
                />
              ) : (
                <div
                  className="w-full h-full bg-cover bg-center filter blur-2xl scale-110 opacity-80"
                  style={{
                    backgroundImage: `url(${reel.content.images?.[imageIndices[reel.id] || 0]})`,
                    transform: 'scale(1.1) translateZ(0)',
                    filter: 'blur(40px) brightness(0.7)'
                  }}
                />
              )}
            </div>

            {/* Media Content */}
            <div className="relative w-full h-full z-10">
              {reel.type === 'video' ? (
                <div className="relative w-full h-full">
                  <video
                    ref={el => { videoRefs.current[index] = el }}
                    src={reel.content.video}
                    poster={reel.content.thumbnail}
                    className="w-full h-full object-cover"
                    style={{ 
                      objectFit: 'cover', 
                      width: '100%', 
                      height: '100%',
                      backfaceVisibility: 'hidden',
                      transform: 'translateZ(0)'
                    }}
                    loop
                    muted
                    playsInline
                    onClick={handleVideoClick}
                    onDoubleClick={handleDoubleTab}
                  />
                  {!isPlaying && index === currentReelIndex && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-20 h-20 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <PlayIcon className="w-10 h-10 text-white ml-1" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <ImageCarousel
                  images={reel.content.images || []}
                  className="w-full h-full"
                  currentIndex={imageIndices[reel.id] || 0}
                  onIndexChange={(newIndex) => setImageIndices(prev => ({ ...prev, [reel.id]: newIndex }))}
                  onClick={handleDoubleTab}
                />
              )}
              
              {/* Heart Animation */}
              {heartAnimation.show && index === currentReelIndex && (
                <div
                  className="absolute pointer-events-none z-50"
                  style={{
                    left: heartAnimation.x - 30,
                    top: heartAnimation.y - 30,
                    animation: 'heartPop 1s ease-out forwards'
                  }}
                >
                  <HeartIconSolid className="w-16 h-16 text-red-500" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
             {/* Progress Indicators */}
       <div className="absolute top-4 left-4 right-4 z-50">
         <div className="flex gap-1">
           {currentReels.map((_, index) => (
            <div
              key={index}
              className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${
                index === currentReelIndex ? 'bg-white' : 
                index < currentReelIndex ? 'bg-white/60' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
      
      {/* Tab Selector */}
      <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50">
        <div className="flex bg-black/40 backdrop-blur-lg rounded-full p-1 border border-white/20">
          <button
            onClick={() => setActiveTab('following')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'following'
                ? 'bg-white text-black shadow-lg'
                : 'text-white/80 hover:text-white'
            }`}
          >
            Following
          </button>
          <button
            onClick={() => setActiveTab('discovery')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'discovery'
                ? 'bg-white text-black shadow-lg'
                : 'text-white/80 hover:text-white'
            }`}
          >
            Discovery
          </button>
        </div>
      </div>
      
             {/* Action Buttons */}
       <div className="absolute right-4 bottom-32 z-50 flex flex-col items-center gap-6">
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
        >
          {likedReels[currentReel.id] ? (
            <HeartIconSolid className="w-8 h-8 text-red-500 drop-shadow-lg group-active:scale-110 transition-transform" />
          ) : (
            <HeartIcon className="w-8 h-8 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
          )}
          <span className="text-xs font-bold text-white drop-shadow-md">
            {(currentReel.stats.likes + (likedReels[currentReel.id] && !currentReel.isLiked ? 1 : 0)).toLocaleString()}
          </span>
        </button>
        
                 <button
           onClick={handleCommentsClick}
           className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
         >
           <ChatBubbleLeftIcon className="w-8 h-8 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
           <span className="text-xs font-bold text-white drop-shadow-md">{currentReel.stats.comments}</span>
         </button>
        
        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
        >
          <ShareIcon className="w-8 h-8 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-white drop-shadow-md">{currentReel.stats.shares}</span>
        </button>
        
                 <button
           onClick={handleSaveClick}
           className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
         >
          {savedReels[currentReel.id] ? (
            <BookmarkIconSolid className="w-8 h-8 text-yellow-500 drop-shadow-lg group-active:scale-110 transition-transform" />
          ) : (
            <BookmarkIcon className="w-8 h-8 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
          )}
          <span className="text-xs font-bold text-white drop-shadow-md">
            {(currentReel.stats.saves + (savedReels[currentReel.id] && !currentReel.isSaved ? 1 : 0)).toLocaleString()}
          </span>
        </button>
        
        
      </div>
      
             {/* Bottom Info */}
       <div className="absolute bottom-32 left-4 right-20 z-50">
        <div className="text-white space-y-3">
          <div className="flex items-center gap-3">
                         <img
               src={currentReel.user.avatar}
               alt={currentReel.user.name}
               className="w-10 h-10 rounded-full border-2 border-white cursor-pointer"
               onClick={() => handleUserClick(currentReel.user)}
             />
             <span
               className="font-semibold text-sm cursor-pointer"
               onClick={() => handleUserClick(currentReel.user)}
             >
               {currentReel.user.name}
             </span>
            <button className="text-xs font-semibold px-3 py-1 rounded-full bg-white text-black hover:bg-gray-100 transition-colors">
              Follow
            </button>
          </div>
          
          <p className="text-sm leading-relaxed max-w-sm">
            {currentReel.content.caption}
          </p>
          
          <button
            onClick={handlePlaceClick}
            className="flex items-center gap-2 text-white/80 text-xs hover:text-white transition-colors active:scale-95"
          >
            <MapPinIcon className="w-3 h-3" />
            <span className="underline">{currentReel.place.name}</span>
          </button>
        </div>
      </div>
      
             {/* Gradient Overlay */}
       <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none z-10" />
       
       {/* Modals */}
       <CommentsModal 
         isOpen={showComments} 
         onClose={() => setShowComments(false)}
         comments={currentReelComments}
         onAddComment={handleAddComment}
         onLikeComment={handleLikeComment}
         onReplyToComment={handleReplyToComment}
       />
       
       <SaveModal 
         isOpen={showSaveModal}
         onClose={() => setShowSaveModal(false)}
         place={{
           id: currentReel.place.id,
           name: currentReel.place.name,
           address: currentReel.place.address,
           tags: [],
           posts: [],
           savedCount: 0,
           createdAt: new Date().toISOString()
         }}
         onSave={(status, rating, listIds, note) => {
           console.log('Save place:', status, rating, listIds, note)
           setSavedReels(prev => ({ ...prev, [currentReel.id]: true }))
           setShowSaveModal(false)
         }}
         onCreateList={(listData) => {
           console.log('Create list:', listData)
           setShowSaveModal(false)
         }}
         userLists={[]}
       />
       
       {selectedUser && (
         <ProfileModal
           isOpen={showProfileModal}
           onClose={() => setShowProfileModal(false)}
           user={selectedUser}
           onFollow={handleFollow}
         />
       )}
       
       <ShareModal
         isOpen={showShareModal}
         onClose={() => setShowShareModal(false)}
         title={currentReel.place.name}
         description={currentReel.content.caption}
         url={window.location.href}
         type="post"
       />
     </div>
   )
 }
 
 export default Reels 