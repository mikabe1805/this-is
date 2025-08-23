import React, { useState, useRef, useEffect } from 'react'
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
} from '@heroicons/react/24/solid'
import ImageCarousel from '../components/ImageCarousel'
import { useNavigation } from '../contexts/NavigationContext'
import CommentsModal from '../components/CommentsModal'
import SaveModal from '../components/SaveModal'
import ShareModal from '../components/ShareModal'
import type { User, Post, PostComment, Hub } from '../types/index.js'
import { useAuth } from '../contexts/AuthContext.js'
import { firebaseDataService } from '../services/firebaseDataService.js'

const Reels = () => {
  const { currentUser: authUser } = useAuth();
  const { openProfileModal, openHubModal } = useNavigation();
  const [currentReelIndex, setCurrentReelIndex] = useState(0);
  const [followingReels, setFollowingReels] = useState<Post[]>([])
  const [discoveryReels, setDiscoveryReels] = useState<Post[]>([])
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [hubs, setHubs] = useState<Record<string, Hub>>({});
  const [imageIndices, setImageIndices] = useState<Record<string, number>>({});
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeTab, setActiveTab] = useState<'following' | 'discovery'>('following')
  const [heartAnimation, setHeartAnimation] = useState({ show: false, x: 0, y: 0 });
  const [lastTap, setLastTap] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [currentReelComments, setCurrentReelComments] = useState<PostComment[]>([]);
  const [followingStatus, setFollowingStatus] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  // const touchStartY = useRef<number>(0);
  // const touchEndY = useRef<number>(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const touchStartRef = useRef({ x: 0, y: 0 })
  const isScrollingRef = useRef(false)

  useEffect(() => {
    const fetchReels = async () => {
      if (!authUser) return;
      
      setLoading(true);
      setFollowingReels([]);
      setDiscoveryReels([]);
      
      let allFollowingPosts: Post[] = [];
      // Fetch posts from users the current user is following
      const following = await firebaseDataService.getUserFollowing(authUser.id);
      const followingIds = following.map(u => u.id);
      if (followingIds.length > 0) {
        allFollowingPosts = await firebaseDataService.getPostsFromUsers(followingIds);
        setFollowingReels(allFollowingPosts);
      } else {
        // If user follows no one, default to discovery and keep Follow control disabled
        setActiveTab('discovery')
      }
      
      // Fetch popular posts for discovery
      const popularPosts = await firebaseDataService.searchPosts('', {}, 20);
      setDiscoveryReels(popularPosts);
      
      // Combine all posts to get unique users and hubs
      const allPosts = [...allFollowingPosts, ...popularPosts];
      const uniqueUserIds = [...new Set(allPosts.map(post => post.userId))];
      const uniqueHubIds = [...new Set(allPosts.map(post => post.hubId).filter(Boolean))];
      
      // Fetch user and hub data
      const userPromises = uniqueUserIds.map(id => firebaseDataService.getCurrentUser(id));
      const hubPromises = uniqueHubIds.map(id => firebaseDataService.getPlace(id));
      
      const usersData = await Promise.all(userPromises);
      const hubsData = await Promise.all(hubPromises);
      
      const usersMap: Record<string, User> = {};
      const hubsMap: Record<string, Hub> = {};
      
      usersData.forEach(user => {
        if (user) usersMap[user.id] = user;
      });
      
      hubsData.forEach(place => {
        if (place) {
          // Coerce Place into minimal Hub shape for Reels overlay use
          hubsMap[place.id] = {
            id: place.id,
            name: place.name,
            description: place.description || '',
            tags: place.tags || [],
            images: [],
            location: {
              address: place.address,
              lat: place.coordinates?.lat || 0,
              lng: place.coordinates?.lng || 0
            },
            googleMapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(place.name + ' ' + place.address)}`,
            mainImage: (place as any).hubImage,
            posts: [],
            lists: []
          } as unknown as Hub;
        }
      });
      
      setUsers(usersMap);
      setHubs(hubsMap);
      
      // Check following status for all users
      const followingStatusMap: Record<string, boolean> = {};
      for (const userId of uniqueUserIds) {
        if (userId !== authUser.id) {
          const isFollowing = following.some(user => user.id === userId);
          followingStatusMap[userId] = isFollowing;
        }
      }
      setFollowingStatus(followingStatusMap);
      
      setLoading(false);
    };
    fetchReels();
  }, [authUser])

  const handleFollow = async (userId: string) => {
    if (!authUser || userId === authUser.id) return;
    
    try {
      const currentFollowingStatus = followingStatus[userId];
      
      // Optimistically update UI
      setFollowingStatus(prev => ({
        ...prev,
        [userId]: !currentFollowingStatus
      }));
      
      // Call the follow/unfollow function
      if (currentFollowingStatus) {
        await firebaseDataService.unfollowUser(authUser.id, userId);
      } else {
        await firebaseDataService.followUser(authUser.id, userId);
      }
      
      // Refresh the actual following status from Firebase
      const following = await firebaseDataService.getUserFollowing(authUser.id);
      const isUserFollowing = following.some(user => user.id === userId);
      
      setFollowingStatus(prev => ({
        ...prev,
        [userId]: isUserFollowing
      }));
      
      console.log(`Reels: Following status updated for ${userId}: ${isUserFollowing}`);
    } catch (error) {
      console.error('Error in follow operation:', error);
      // Revert optimistic update on error
      setFollowingStatus(prev => ({
        ...prev,
        [userId]: !prev[userId]
      }));
    }
  };

  const currentReels = activeTab === 'following' ? followingReels : discoveryReels
  const currentReel = currentReels[currentReelIndex]

  const handleScroll = (direction: 'up' | 'down') => {
    if (isScrollingRef.current) return

    const newIndex = direction === 'up'
      ? Math.min(currentReelIndex + 1, currentReels.length - 1)
      : Math.max(currentReelIndex - 1, 0)

    if (newIndex === currentReelIndex) return

    isScrollingRef.current = true
    setCurrentReelIndex(newIndex)

    // shorten lockout window for more responsive swipes
    setTimeout(() => {
      isScrollingRef.current = false
    }, 300)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (showComments || showSaveModal || showShareModal) {
      return
    }

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    }

    const diffY = touchStartRef.current.y - touchEnd.y
    const diffX = Math.abs(touchStartRef.current.x - touchEnd.x)

    // Increase vertical threshold slightly and suppress accidental diagonal scrolls
    if (Math.abs(diffY) > 45 && Math.abs(diffY) > diffX + 10) {
      e.preventDefault()
      handleScroll(diffY > 0 ? 'up' : 'down')
    }
  }

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (showComments || showSaveModal || showShareModal) {
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
  }, [currentReelIndex, showComments, showSaveModal, showShareModal])

  const handleDoubleTab = (event: React.MouseEvent | React.TouchEvent) => {
    const currentTime = Date.now()
    const tapLength = currentTime - lastTap

    if (tapLength < 300 && tapLength > 0) {
      handleLike();

      const rect = event.currentTarget.getBoundingClientRect()
      const clientX = 'touches' in event ? event.touches[0]?.clientX || event.changedTouches[0]?.clientX : event.clientX
      const clientY = 'touches' in event ? event.touches[0]?.clientY || event.changedTouches[0]?.clientY : event.clientY

      setHeartAnimation({
        show: true,
        x: clientX - rect.left,
        y: clientY - rect.top
      })

      setTimeout(() => setHeartAnimation({ show: false, x: 0, y: 0 }), 1000)
      event.preventDefault()
    }

    setLastTap(currentTime)
  }

  const handleVideoClick = () => {
    const currentTime = Date.now()
    const tapLength = currentTime - lastTap

    if (tapLength > 300) {
      const video = videoRefs.current[currentReelIndex]
      if (video) {
        if (isPlaying) {
          video.pause()
          setIsPlaying(false)
        } else {
          video.play().catch(() => { })
          setIsPlaying(true)
        }
      }
    }

    setLastTap(currentTime)
  }

  const handleLike = async () => {
    if (!authUser || !currentReel) return;
    const hasLiked = (currentReel.likedBy || []).includes(authUser.id)
    await firebaseDataService.likePost(currentReel.id, authUser.id);
    const updatedReels = currentReels.map(r => {
      if (r.id !== currentReel.id) return r
      const likedByArr = r.likedBy || []
      const newLikedBy = hasLiked ? likedByArr.filter(id => id !== authUser.id) : [...likedByArr, authUser.id]
      return {
        ...r,
        likedBy: newLikedBy,
        likes: newLikedBy.length
      }
    });
    if (activeTab === 'following') setFollowingReels(updatedReels);
    else setDiscoveryReels(updatedReels);
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: currentReel.description,
        url: window.location.href
      })
    } else {
      setShowShareModal(true)
    }
  }

  const handleCommentsClick = async () => {
    if (!currentReel) return;
    const comments = await firebaseDataService.getCommentsForPost(currentReel.id);
    setCurrentReelComments(comments);
    setShowComments(true)
  }

  const handleUserClick = (userId: string) => {
    openProfileModal(userId, 'reels');
  }

  const handleSaveClick = () => {
    setShowSaveModal(true)
  }

  const handleAddComment = async (text: string) => {
    if (!authUser || !currentReel) return;
    const newComment = await firebaseDataService.postComment(currentReel.id, authUser.id, text);
    if (newComment) {
      setCurrentReelComments(prev => [newComment, ...prev]);
    }
  }

  const handleLikeComment = (commentId: string) => {
    console.log('Like comment:', commentId)
  }

  const handleReplyToComment = async (commentId: string, text: string) => {
    console.log('Reply to comment:', commentId, text)
  }

  const handlePlaceClick = async () => {
    if (!currentReel?.hubId) return;
    const hub = hubs[currentReel.hubId];
    if (hub) {
      openHubModal(hub, 'reels');
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white">Loading reels...</div>
      </div>
    );
  }

  if (!currentReel) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white">No reels to show.</div>
      </div>
    );
  }

  const postUser = users[currentReel.userId];
  const postHub = hubs[currentReel.hubId];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black overflow-hidden"
      style={{
        zIndex: 1000,
        overscrollBehavior: 'none',
        WebkitOverflowScrolling: 'auto',
        touchAction: 'manipulation'
      }}
      data-reels-page="true"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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
            <div className="absolute inset-0 w-full h-full">
              {reel.video ? (
                <div
                  className="w-full h-full bg-cover bg-center filter blur-2xl scale-110 opacity-80"
                  style={{
                    backgroundImage: `url(${reel.thumbnail})`,
                    transform: 'scale(1.1) translateZ(0)',
                    filter: 'blur(40px) brightness(0.7)'
                  }}
                />
              ) : (
                <div
                  className="w-full h-full bg-cover bg-center filter blur-2xl scale-110 opacity-80"
                  style={{
                    backgroundImage: `url(${reel.images?.[imageIndices[reel.id] || 0]})`,
                    transform: 'scale(1.1) translateZ(0)',
                    filter: 'blur(40px) brightness(0.7)'
                  }}
                />
              )}
            </div>

            <div className="relative w-full h-full z-10">
              {reel.video ? (
                <div className="relative w-full h-full">
                  <video
                    ref={el => { videoRefs.current[index] = el }}
                    src={reel.video}
                    poster={reel.thumbnail}
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
                  images={reel.images || []}
                  className="w-full h-full"
                  currentIndex={imageIndices[reel.id] || 0}
                  onIndexChange={(newIndex) => setImageIndices(prev => ({ ...prev, [reel.id]: newIndex }))}
                  onClick={handleDoubleTab}
                />
              )}

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

      <div className="absolute top-4 left-4 right-4 z-50">
        <div className="flex gap-1">
          {currentReels.map((_, index) => (
            <div
              key={index}
              className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${index === currentReelIndex ? 'bg-white' :
                  index < currentReelIndex ? 'bg-white/60' : 'bg-white/20'
                }`}
            />
          ))}
        </div>
      </div>

      <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50">
        <div className="flex bg-black/40 backdrop-blur-lg rounded-full p-1 border border-white/20">
          <button
            onClick={() => setActiveTab('following')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${activeTab === 'following'
                ? 'bg-white text-black shadow-lg'
                : 'text-white/80 hover:text-white'
              }`}
            disabled={followingReels.length === 0}
          >
            {followingReels.length === 0 ? 'Following (add some)' : 'Following'}
          </button>
          <button
            onClick={() => setActiveTab('discovery')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${activeTab === 'discovery'
                ? 'bg-white text-black shadow-lg'
                : 'text-white/80 hover:text-white'
              }`}
          >
            Discovery
          </button>
        </div>
      </div>

      <div className="absolute right-4 bottom-32 z-50 flex flex-col items-center gap-6">
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
        >
          {currentReel.likedBy?.includes(authUser?.id || '') ? (
            <HeartIconSolid className="w-8 h-8 text-red-500 drop-shadow-lg group-active:scale-110 transition-transform" />
          ) : (
            <HeartIcon className="w-8 h-8 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
          )}
          <span className="text-xs font-bold text-white drop-shadow-md">
            {currentReel.likes?.toLocaleString()}
          </span>
        </button>

        <button
          onClick={handleCommentsClick}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
        >
          <ChatBubbleLeftIcon className="w-8 h-8 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-white drop-shadow-md">{currentReel.comments?.length || 0}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
        >
          <ShareIcon className="w-8 h-8 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
        </button>

        <button
          onClick={handleSaveClick}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
        >
          <BookmarkIcon className="w-8 h-8 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
        </button>
      </div>

      <div className="absolute bottom-32 left-4 right-20 z-50">
        <div className="text-white space-y-3">
          {postUser && (
            <div className="flex items-center gap-3">
              <img
                src={postUser.avatar}
                alt={postUser.name}
                className="w-10 h-10 rounded-full border-2 border-white cursor-pointer"
                onClick={() => handleUserClick(postUser.id)}
              />
              <span
                className="font-semibold text-sm cursor-pointer"
                onClick={() => handleUserClick(postUser.id)}
              >
                {postUser.name}
              </span>
              <button 
                className="text-xs font-semibold px-3 py-1 rounded-full bg-white text-black hover:bg-gray-100 transition-colors"
                onClick={() => handleFollow(postUser.id)}
              >
                {followingStatus[postUser.id] ? 'Following' : 'Follow'}
              </button>
            </div>
          )}

          <p className="text-sm leading-relaxed max-w-sm">
            {currentReel.description}
          </p>

          {postHub &&
            <button
              onClick={handlePlaceClick}
              className="flex items-center gap-2 text-white/80 text-xs hover:text-white transition-colors active:scale-95"
            >
              <MapPinIcon className="w-3 h-3" />
              {postHub.name}
            </button>
          }
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none z-10" />

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
          id: postHub.id,
          name: postHub.name,
          address: postHub.location?.address || '',
          tags: postHub.tags,
          posts: postHub.posts,
          savedCount: 0,
          createdAt: new Date().toISOString()
        }}
        onSave={(status, rating, listIds, note) => {
          console.log('Save place:', status, rating, listIds, note)
          setShowSaveModal(false)
        }}
        onCreateList={(listData) => {
          console.log('Create list:', listData)
          setShowSaveModal(false)
        }}
        userLists={[]}
      />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={currentReel.description}
        description={currentReel.description}
        url={window.location.href}
        type="post"
      />
    </div>
  )
}

export default Reels
