import { useState, useEffect, useRef } from 'react'
import { HeartIcon, ChatBubbleLeftIcon, ShareIcon, BookmarkIcon, PlayIcon, PauseIcon, UserIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid, BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import type { User, Post, Story, Reel } from '../types/index.js'

// Mock data for reels content
const mockReels: Reel[] = [
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
    isFollowing: false,
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
  },
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
    isFollowing: true,
    timestamp: '3 days ago'
  }
]

const Reels = () => {
  const [currentReelIndex, setCurrentReelIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set(['2', '4']))
  const [savedReels, setSavedReels] = useState<Set<string>>(new Set(['3', '4']))
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set(['2', '4']))
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionDirection, setTransitionDirection] = useState<'up' | 'down' | null>(null)
  const [nextReelIndex, setNextReelIndex] = useState<number | null>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const currentReel = mockReels[currentReelIndex]

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
  }

  const handleSave = (reelId: string) => {
    setSavedReels(prev => {
      const newSet = new Set(prev)
      if (newSet.has(reelId)) {
        newSet.delete(reelId)
      } else {
        newSet.add(reelId)
      }
      return newSet
    })
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

  const handleScroll = (direction: 'up' | 'down') => {
    if (isTransitioning) return // Prevent multiple transitions at once
    
    if (direction === 'up' && currentReelIndex > 0) {
      const newIndex = currentReelIndex - 1
      setNextReelIndex(newIndex)
      setIsTransitioning(true)
      setTransitionDirection('up')
      setTimeout(() => {
        setCurrentReelIndex(newIndex)
        setNextReelIndex(null)
        setIsTransitioning(false)
        setTransitionDirection(null)
      }, 300) // Match the CSS transition duration
    } else if (direction === 'down' && currentReelIndex < mockReels.length - 1) {
      const newIndex = currentReelIndex + 1
      setNextReelIndex(newIndex)
      setIsTransitioning(true)
      setTransitionDirection('down')
      setTimeout(() => {
        setCurrentReelIndex(newIndex)
        setNextReelIndex(null)
        setIsTransitioning(false)
        setTransitionDirection(null)
      }, 300) // Match the CSS transition duration
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY > 0) {
      handleScroll('up') // Scroll wheel down = go to next reel (current slides up)
    } else {
      handleScroll('down') // Scroll wheel up = go to previous reel (current slides down)
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    const startY = touch.clientY
    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0]
      const endY = touch.clientY
      const diff = startY - endY
      
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          handleScroll('up') // Swipe up = go to next reel (current slides up)
        } else {
          handleScroll('down') // Swipe down = go to previous reel (current slides down)
        }
      }
      
      document.removeEventListener('touchend', handleTouchEnd)
    }
    document.addEventListener('touchend', handleTouchEnd)
  }

  return (
    <div 
      ref={containerRef}
      className="h-full bg-black relative overflow-hidden"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
    >


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
              <img
                src={currentReel.content.images?.[0] || ''}
                alt="Story"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>
          ) : (
            <div className="relative h-full">
              <img
                src={currentReel.content.image}
                alt="Post"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>
          )}

        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          {/* User Info */}
          <div className="flex items-center gap-3 mb-4">
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
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <MapPinIcon className="w-4 h-4" />
                <span>{currentReel.place.name}</span>
              </div>
            </div>
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
        <div className="absolute right-4 bottom-20 flex flex-col items-center gap-6 z-10">
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

          <button className="flex flex-col items-center gap-1">
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
            {mockReels[nextReelIndex].type === 'video' ? (
              <div className="relative h-full">
                <video
                  src={mockReels[nextReelIndex].content.video}
                  poster={mockReels[nextReelIndex].content.thumbnail}
                  className="w-full h-full object-cover"
                  loop
                  muted
                />
              </div>
            ) : mockReels[nextReelIndex].type === 'story' ? (
              <div className="relative h-full">
                <img
                  src={mockReels[nextReelIndex].content.images?.[0] || ''}
                  alt="Story"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              </div>
            ) : (
              <div className="relative h-full">
                <img
                  src={mockReels[nextReelIndex].content.image}
                  alt="Post"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              </div>
            )}
          </div>
        )}
      </div>


    </div>
  )
}

export default Reels 