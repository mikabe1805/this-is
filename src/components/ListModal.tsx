import type { List, Place, Post } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, XMarkIcon, UserIcon, CalendarIcon, ArrowsPointingOutIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { firebaseListService } from '../services/firebaseListService';
import { useAuth } from '../contexts/AuthContext.tsx'
import { formatTimestamp } from '../utils/dateUtils.ts'
import ImageCarousel from './ImageCarousel.tsx'
import CommentsModal from './CommentsModal.tsx'
import { firebaseDataService } from '../services/firebaseDataService.js'

interface ListModalProps {
  list: List
  isOpen: boolean
  onClose: () => void
  onSave?: (list: List) => void
  onShare?: (list: List) => void
  onAddPost?: (list: List) => void
  onOpenFullScreen?: (list: List) => void
  onOpenHub?: (place: Place) => void
  showBackButton?: boolean
  onBack?: () => void
  onLikeChange?: (listId: string, isLiked: boolean, newLikes: number) => void
}

const ListModal = ({ list, isOpen, onClose, onSave, onShare, onAddPost, onOpenFullScreen, onOpenHub, showBackButton, onBack, onLikeChange }: ListModalProps) => {
  const { currentUser } = useAuth()
  const { openPostOverlay, openFullScreenList } = useNavigation()
  const [isLiked, setIsLiked] = useState(false)
  const [likes, setLikes] = useState(list.likes)
  const [isVisible, setIsVisible] = useState(false)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [places, setPlaces] = useState<any[]>([])
  const [creatorName, setCreatorName] = useState<string>('');

  useEffect(() => {
    if (currentUser && list) {
      const checkIfSaved = async () => {
        const isSaved = await firebaseDataService.isListSavedByUser(list.id, currentUser.id);
        setIsLiked(isSaved);
      };
      checkIfSaved();
    }
    setLikes(list.likes);
  }, [currentUser, list]);

  useEffect(() => {
    if (isOpen && currentUser) {
      const fetchPostsAndCreator = async () => {
        try {
          const listPosts = await firebaseDataService.getPostsForList(list.id);
          setPosts(listPosts);
          
          // Also fetch places saved to this list
          try {
            const listPlaces = await firebaseListService.getPlacesForList(list.id);
            setPlaces(listPlaces);
          } catch (error) {
            console.error('Error fetching places for list:', error);
            setPlaces([]); // Set empty array on error
          }
          
          if (list.userId) {
            const name = await firebaseDataService.getUserDisplayName(list.userId);
            setCreatorName(name);
          }
        } catch (error) {
          console.error('Error fetching list data:', error);
          setPosts([]);
          setPlaces([]);
        }
      };
      fetchPostsAndCreator();
    } else if (isOpen && !currentUser) {
      // If modal is open but user is not authenticated, just fetch posts
      const fetchPostsOnly = async () => {
        try {
          const listPosts = await firebaseDataService.getPostsForList(list.id);
          setPosts(listPosts);
          setPlaces([]); // No places for unauthenticated users
          
          if (list.userId) {
            const name = await firebaseDataService.getUserDisplayName(list.userId);
            setCreatorName(name);
          }
        } catch (error) {
          console.error('Error fetching list data:', error);
          setPosts([]);
          setPlaces([]);
        }
      };
      fetchPostsOnly();
    }
  }, [isOpen, list, currentUser]);
  
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is ready for animation
      setTimeout(() => setIsVisible(true), 10)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;

    const newIsLiked = !isLiked;
    const newLikes = newIsLiked ? (likes || 0) + 1 : (likes || 1) - 1;

    // Optimistic update
    setIsLiked(newIsLiked);
    setLikes(newLikes);

    // Update database in the background
    try {
      await firebaseDataService.saveList(list.id, currentUser.id);
      
      // Notify parent component of the change
      if (onLikeChange) {
        onLikeChange(list.id, newIsLiked, newLikes);
      }
    } catch (error) {
      console.error("Failed to like list:", error);
      // Revert UI on failure
      setIsLiked(!newIsLiked);
      setLikes(likes);
    }
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentUser) {
      // Save the list to user's saved lists
      firebaseDataService.saveList(list.id, currentUser.id)
        .then(() => {
          console.log('List saved successfully')
          // Update the like state
          setIsLiked(true)
          setLikes((prev) => (prev || 0) + 1)
        })
        .catch((error) => {
          console.error('Failed to save list:', error)
        })
    }
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onShare) {
      onShare(list)
    } else {
      // Fallback share functionality
      if (navigator.share) {
        navigator.share({
          title: list.name,
          text: list.description,
          url: window.location.href
        })
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(window.location.href)
        alert('Link copied to clipboard!')
      }
    }
  }

  const handleAddPost = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onAddPost) {
      onAddPost(list)
    }
  }

  const handleOpenFullScreen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onOpenFullScreen) {
      onOpenFullScreen(list)
    } else {
      // Use navigation context as fallback
      openFullScreenList(list)
    }
  }

  const handlePostClick = (post: Post) => {
    openPostOverlay(post.id);
  };

  const handleCommentsClick = () => {
    setShowCommentsModal(true)
  }

  const handleAddCommentToModal = async (text: string) => {
    // Add comment logic here
    console.log('Adding comment:', text)
  }

  const handleLikeComment = (commentId: string) => {
    // Like comment logic here
    console.log('Liked comment:', commentId)
  }

  const handleReplyToComment = async (commentId: string, text: string) => {
    // Reply to comment logic here
    console.log('Replied to comment:', commentId, text)
  }

  const handleSeeAllLists = (listType: 'popular' | 'friends') => {
    // Navigate to ViewAllLists page with appropriate filters
    window.location.href = `/lists?type=${listType}&hub=${list.id}`
  }

  const modalContent = (
    <div 
      className="modal-overlay fixed inset-0 z-[9998] flex items-center justify-center p-1 bg-black/20 backdrop-blur-md"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className={`modal-container w-full max-w-[600px] mx-1 max-h-[90vh] sm:max-h-screen bg-gradient-to-br from-[#FEF6E9] via-[#FBF0D9] to-[#F7E8CC] rounded-3xl shadow-2xl border border-[#E8D4C0]/60 overflow-hidden relative transition-all duration-500 ease-out ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 80%, rgba(232, 212, 192, 0.25) 0%, transparent 50%), 
            radial-gradient(circle at 80% 20%, rgba(251, 240, 217, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(139, 115, 85, 0.08) 0%, transparent 70%),
            radial-gradient(circle at 10% 10%, rgba(247, 232, 204, 0.2) 0%, transparent 60%),
            radial-gradient(circle at 90% 90%, rgba(232, 212, 192, 0.15) 0%, transparent 40%)
          `
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warmer, Larger Botanical Accents - Non-Overlapping and Slightly Blurred */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {/* Primary climbing vine - larger and warmer */}
          <div className="absolute bottom-0 left-0 h-full w-12 sm:w-14 md:w-16 pointer-events-none">
            <img
              src="/assets/leaf2.png"
              alt=""
              className="absolute bottom-0 left-0 h-full w-full object-contain opacity-8 sm:opacity-10 pointer-events-none blur-[0.5px] sm:blur-[0.3px]"
              style={{
                transform: 'scaleY(1.2) translateY(-12%) rotate(-5deg)',
                filter: 'brightness(0.8) contrast(0.9) saturate(1.1) hue-rotate(5deg)'
              }}
            />
          </div>
          
          {/* Secondary vine - positioned to avoid overlap */}
          <div className="absolute top-56 sm:top-64 right-0 h-[calc(100%-14rem)] sm:h-[calc(100%-16rem)] w-8 sm:w-10 md:w-12 pointer-events-none">
            <img
              src="/assets/leaf2.png"
              alt=""
              className="absolute top-0 right-0 h-full w-full object-contain opacity-6 sm:opacity-8 pointer-events-none blur-[0.4px] sm:blur-[0.2px]"
              style={{
                transform: 'scaleY(1.1) translateY(-8%) rotate(8deg)',
                filter: 'brightness(0.9) contrast(0.8) saturate(1.0) hue-rotate(-3deg)'
              }}
            />
          </div>
          
          {/* Connecting vine segment - positioned to bridge without overlap */}
          <div className="absolute top-2/3 right-6 sm:right-8 md:right-10 h-24 sm:h-28 md:h-32 w-6 sm:w-8 md:w-10 pointer-events-none">
            <img
              src="/assets/leaf2.png"
              alt=""
              className="absolute top-0 right-0 h-full w-full object-contain opacity-5 sm:opacity-7 pointer-events-none blur-[0.6px] sm:blur-[0.4px]"
              style={{
                transform: 'scaleY(0.8) translateY(-5%) rotate(25deg)',
                filter: 'brightness(1.0) contrast(0.7) saturate(0.9) hue-rotate(2deg)'
              }}
            />
          </div>
        </div>

        {/* Connected Leaf Clusters - Cozy and Intertwined for Mobile */}
        <div className="absolute inset-0 pointer-events-none z-0">
          {/* Top-left cluster - connected leaves */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-6 sm:top-8 md:top-10 left-4 sm:left-6 md:left-8 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-18 lg:h-18 opacity-15 sm:opacity-18 md:opacity-20 pointer-events-none blur-[0.3px] sm:blur-[0.2px]"
            style={{
              transform: 'rotate(-25deg) scale(0.8)',
              filter: 'brightness(0.9) contrast(0.9) saturate(1.1) hue-rotate(8deg)'
            }}
          />
          
          {/* Connected leaf - overlapping with top-left */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-8 sm:top-10 md:top-12 left-6 sm:left-8 md:left-10 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 opacity-12 sm:opacity-15 md:opacity-18 pointer-events-none blur-[0.4px] sm:blur-[0.3px]"
            style={{
              transform: 'rotate(15deg) scale(0.7)',
              filter: 'brightness(1.0) contrast(0.8) saturate(1.0) hue-rotate(-5deg)'
            }}
          />
          
          {/* Upper-middle cluster - connected leaves */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-44 sm:top-48 md:top-52 left-3 sm:left-4 w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 lg:w-20 lg:h-20 opacity-12 sm:opacity-15 md:opacity-18 pointer-events-none blur-[0.4px] sm:blur-[0.3px]"
            style={{
              transform: 'rotate(35deg) scale(0.9)',
              filter: 'brightness(1.0) contrast(0.8) saturate(1.0) hue-rotate(-5deg)'
            }}
          />
          
          {/* Connected leaf - overlapping with upper-middle */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-46 sm:top-50 md:top-54 left-5 sm:left-6 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-18 lg:h-18 opacity-10 sm:opacity-12 md:opacity-15 pointer-events-none blur-[0.5px] sm:blur-[0.4px]"
            style={{
              transform: 'rotate(55deg) scale(0.8)',
              filter: 'brightness(1.1) contrast(0.7) saturate(0.9) hue-rotate(3deg)'
            }}
          />
          
          {/* Middle-left cluster - connected leaves */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-2/3 left-2 sm:left-3 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 opacity-10 sm:opacity-12 md:opacity-15 pointer-events-none blur-[0.5px] sm:blur-[0.4px]"
            style={{
              transform: 'rotate(55deg) scale(0.8)',
              filter: 'brightness(1.1) contrast(0.7) saturate(0.9) hue-rotate(3deg)'
            }}
          />
          
          {/* Connected leaf - overlapping with middle-left */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-[calc(2/3+2rem)] sm:top-[calc(2/3+2.5rem)] left-4 sm:left-5 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 opacity-8 sm:opacity-10 md:opacity-12 pointer-events-none blur-[0.6px] sm:blur-[0.5px]"
            style={{
              transform: 'rotate(25deg) scale(0.7)',
              filter: 'brightness(0.9) contrast(0.8) saturate(1.0) hue-rotate(-2deg)'
            }}
          />
          
          {/* Lower-middle cluster - connected leaves */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute bottom-1/4 left-4 sm:left-5 md:left-6 w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 lg:w-20 lg:h-20 opacity-12 sm:opacity-14 md:opacity-16 pointer-events-none blur-[0.3px] sm:blur-[0.2px]"
            style={{
              transform: 'rotate(-15deg) scale(0.9)',
              filter: 'brightness(0.8) contrast(1.0) saturate(1.1) hue-rotate(-2deg)'
            }}
          />
          
          {/* Connected leaf - overlapping with lower-middle */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute bottom-[calc(1/4-1rem)] sm:bottom-[calc(1/4-1.5rem)] left-6 sm:left-7 md:left-8 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-18 lg:h-18 opacity-10 sm:opacity-12 md:opacity-14 pointer-events-none blur-[0.4px] sm:blur-[0.3px]"
            style={{
              transform: 'rotate(5deg) scale(0.8)',
              filter: 'brightness(1.0) contrast(0.9) saturate(1.1) hue-rotate(4deg)'
            }}
          />
          
          {/* Bottom-right cluster - connected leaves */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute bottom-4 sm:bottom-6 md:bottom-8 right-3 sm:right-4 md:right-6 w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 lg:w-22 lg:h-22 opacity-15 sm:opacity-17 md:opacity-20 pointer-events-none blur-[0.4px] sm:blur-[0.3px]"
            style={{
              transform: 'rotate(45deg) scale(1.0)',
              filter: 'brightness(0.9) contrast(0.9) saturate(1.1) hue-rotate(6deg)'
            }}
          />
          
          {/* Connected leaf - overlapping with bottom-right */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute bottom-6 sm:bottom-8 md:bottom-10 right-5 sm:right-6 md:right-8 w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 lg:w-20 lg:h-20 opacity-12 sm:opacity-14 md:opacity-16 pointer-events-none blur-[0.5px] sm:blur-[0.4px]"
            style={{
              transform: 'rotate(65deg) scale(0.9)',
              filter: 'brightness(1.0) contrast(0.8) saturate(1.0) hue-rotate(-3deg)'
            }}
          />
          
          {/* Content-aware accent - positioned to avoid interactive areas */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-80 sm:top-88 md:top-96 left-6 sm:left-8 md:left-10 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-18 lg:h-18 opacity-8 sm:opacity-10 md:opacity-12 pointer-events-none blur-[0.6px] sm:blur-[0.5px]"
            style={{
              transform: 'rotate(-40deg) scale(0.8)',
              filter: 'brightness(1.0) contrast(0.8) saturate(1.0) hue-rotate(-4deg)'
            }}
          />
          
          {/* Small connecting leaf - bridging content areas */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-82 sm:top-90 md:top-98 left-8 sm:left-10 md:left-12 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 opacity-6 sm:opacity-8 md:opacity-10 pointer-events-none blur-[0.8px] sm:blur-[0.7px]"
            style={{
              transform: 'rotate(-20deg) scale(0.6)',
              filter: 'brightness(1.1) contrast(0.7) saturate(0.9) hue-rotate(2deg)'
            }}
          />
          
          {/* Bottom content accent - positioned to avoid scroll areas */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute bottom-20 sm:bottom-24 md:bottom-28 left-3 sm:left-4 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 opacity-6 sm:opacity-8 md:opacity-10 pointer-events-none blur-[0.7px] sm:blur-[0.6px]"
            style={{
              transform: 'rotate(70deg) scale(0.7)',
              filter: 'brightness(1.1) contrast(0.6) saturate(0.8) hue-rotate(1deg)'
            }}
          />
          
          {/* Small connecting leaf - bridging bottom areas */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute bottom-22 sm:bottom-26 md:bottom-30 left-5 sm:left-6 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 opacity-5 sm:opacity-6 md:opacity-8 pointer-events-none blur-[0.9px] sm:blur-[0.8px]"
            style={{
              transform: 'rotate(85deg) scale(0.5)',
              filter: 'brightness(1.0) contrast(0.5) saturate(0.7) hue-rotate(-1deg)'
            }}
          />
        </div>

        {/* Larger background leaf - warmer and slightly blurred */}
        <img
          src="/assets/leaf.png"
          alt=""
          className="absolute bottom-0 right-0 w-24 sm:w-28 md:w-32 lg:w-36 opacity-10 sm:opacity-12 md:opacity-15 pointer-events-none z-0 blur-[1px] sm:blur-[0.8px] scale-105"
          style={{
            filter: 'brightness(0.9) contrast(0.9) saturate(1.1) hue-rotate(3deg)'
          }}
        />

        {/* Warmer Ambient Lighting - Enhanced and Cozy */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top-left light ray - warmer tones */}
          <div className="absolute top-0 left-1/4 w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 bg-gradient-to-br from-[#F7E8CC]/25 sm:from-[#F7E8CC]/30 via-transparent to-transparent transform -rotate-12 animate-pulse" style={{ animationDuration: '5s' }} />
          
          {/* Top-right light ray - warmer tones */}
          <div className="absolute top-0 right-1/4 sm:right-1/3 w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-gradient-to-bl from-[#E8D4C0]/20 sm:from-[#E8D4C0]/25 via-transparent to-transparent transform rotate-6 animate-pulse" style={{ animationDuration: '7s' }} />
          
          {/* Bottom-left light ray - warmer tones */}
          <div className="absolute bottom-0 left-1/4 sm:left-1/3 w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 bg-gradient-to-tr from-[#F7E8CC]/20 sm:from-[#F7E8CC]/25 via-transparent to-transparent transform rotate-12 animate-pulse" style={{ animationDuration: '6s' }} />
          
          {/* Middle-right light ray - warmer tones */}
          <div className="absolute top-1/2 right-0 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-l from-[#E8D4C0]/15 sm:from-[#E8D4C0]/20 via-transparent to-transparent transform -rotate-45 animate-pulse" style={{ animationDuration: '8s' }} />
        </div>

        {/* Refined grain texture - mobile-optimized */}
        <div className="absolute inset-0 pointer-events-none opacity-30 sm:opacity-35 md:opacity-40">
          <div className="w-full h-full" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E")`,
            backgroundSize: '150px 150px'
          }} />
        </div>

        {/* Mobile-optimized warm light leak overlay */}
        <div className="absolute top-0 left-0 w-full h-32 sm:h-40 md:h-48 bg-gradient-to-b from-[#F7E8CC]/45 sm:from-[#F7E8CC]/50 md:from-[#F7E8CC]/55 via-[#F7E8CC]/25 sm:via-[#F7E8CC]/30 to-transparent pointer-events-none" />
        
        {/* Responsive header blur integration */}
        <div className="absolute top-0 w-full h-12 sm:h-14 md:h-16 z-10 bg-gradient-to-b from-[#fef6e9]/75 sm:from-[#fef6e9]/80 md:from-[#fef6e9]/85 to-transparent backdrop-blur-sm pointer-events-none" />
        
        {/* Header with image */}
        <div className="relative h-48 bg-gradient-to-br from-[#D4A574] via-[#C17F59] to-[#A67C52] overflow-hidden">
          {list.coverImage && (
            <img
              src={list.coverImage}
              alt={list.name}
              className="w-full h-full object-cover"
            />
          )}
          {/* Enhanced gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
          
          {/* Top action buttons */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
            {showBackButton ? (
              <button 
                onClick={onBack}
                className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 active:scale-95 transition-all duration-200"
                title="Go back"
              >
                <ArrowLeftIcon className="w-5 h-5 text-white" />
              </button>
            ) : <div></div>}
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenFullScreen}
                className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 active:scale-95 transition-all duration-200"
              >
                <ArrowsPointingOutIcon className="w-5 h-5 text-white" />
              </button>
              <button 
                onClick={handleShare}
                className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 active:scale-95 transition-all duration-200"
              >
                <ShareIcon className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 active:scale-95 transition-all duration-200"
              >
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
          
          {/* Text overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <h1 className="text-3xl font-serif font-bold text-white mb-2 leading-tight drop-shadow-lg" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }}>{list.name}</h1>
            <div className="flex items-center text-white/90 text-sm mb-3 drop-shadow-md">
              <UserIcon className="w-4 h-4 mr-1.5" />
              Created by {creatorName}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-medium border border-white/30 shadow-sm">
                {posts.length + places.length} {posts.length + places.length === 1 ? 'place' : 'places'}
              </span>
              {list.tags.map((tag, index) => (
                <span 
                  key={tag} 
                  className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-medium border border-white/30 shadow-sm"
                  style={{ opacity: 1 - (index * 0.15) }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        
        {/* Content - Mobile-optimized scroll container */}
        <div className="modal-content flex flex-col h-[calc(90vh-12rem)] sm:h-[calc(100vh-0.5rem-12rem)] overflow-y-auto pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="p-4 space-y-5 flex-1 pb-6">
          {/* Description */}
            <div className="bg-[#E8D4C0]/20 backdrop-blur-sm rounded-3xl p-4 border border-[#E8D4C0]/40 shadow-[0_6px_30px_rgba(0,0,0,0.1)] relative overflow-hidden">
              {/* Mobile-optimized floating leaf accent */}
              <img
                src="/assets/leaf.png"
                alt=""
                className="absolute top-1 sm:top-2 right-2 sm:right-3 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 opacity-15 sm:opacity-18 md:opacity-20 pointer-events-none transition-transform duration-300"
                style={{
                  transform: 'rotate(15deg) scale(0.7)',
                  filter: 'brightness(0.9) contrast(0.8) saturate(1.1) hue-rotate(5deg)'
                }}
              />
              {/* Ambient glow shadow */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#F7E8CC]/15 via-transparent to-[#E8D4C0]/15 rounded-3xl pointer-events-none" />
              <p className="text-[#5D4A2E] text-base leading-relaxed font-serif relative z-10">{list.description}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-[#7A5D3F] relative z-10">
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                Created {formatTimestamp(list.createdAt)}
              </div>
              <div className="flex items-center gap-1">
                <HeartIcon className="w-4 h-4" />
                {likes} likes
              </div>
            </div>
          </div>

          {/* Action Buttons */}
            <div className="flex gap-2 sticky top-0 z-10 pt-2 pb-3">
            <button 
              onClick={handleLike}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#B08968] to-[#9A7B5A] text-[#FEF6E9] px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#9A7B5A]/30 active:scale-95 transition-all duration-200"
            >
              {isLiked ? (
                  <HeartIconSolid className="w-4 h-4" />
              ) : (
                  <HeartIcon className="w-4 h-4" />
              )}
              {isLiked ? 'Liked' : 'Like'}
            </button>
            {currentUser?.id === list.userId && (
              <button 
                onClick={handleAddPost}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#D4A574] to-[#B08968] text-[#FEF6E9] px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#B08968]/30 active:scale-95 transition-all duration-200"
              >
                <PlusIcon className="w-4 h-4" />
                Add Post
              </button>
            )}
            <button 
              onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#C17F59] to-[#B08968] text-[#FEF6E9] px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#B08968]/30 active:scale-95 transition-all duration-200"
            >
                <BookmarkIcon className="w-4 h-4" />
              Save
            </button>
          </div>

            {/* Combined Places and Posts */}
            <div className="bg-[#E8D4C0]/20 backdrop-blur-sm rounded-3xl p-4 border border-[#E8D4C0]/40 shadow-[0_6px_30px_rgba(0,0,0,0.1)] relative overflow-hidden">
              {/* Mobile-optimized floating leaf accent */}
              <img
                src="/assets/leaf.png"
                alt=""
                className="absolute top-1 sm:top-2 left-2 sm:left-3 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 opacity-15 sm:opacity-18 md:opacity-20 pointer-events-none transition-transform duration-300"
                style={{
                  transform: 'rotate(-15deg) scale(0.7)',
                  filter: 'brightness(0.9) contrast(0.8) saturate(1.1) hue-rotate(-3deg)'
                }}
              />
              {/* Ambient glow shadow */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#F7E8CC]/15 via-transparent to-[#E8D4C0]/15 rounded-3xl pointer-events-none" />
              <h3 className="text-lg font-serif font-semibold text-[#5D4A2E] mb-4 relative z-10">Places in this list</h3>
              <div className="space-y-3 relative z-10">
                {/* Display saved places first */}
                {places.map((place) => (
                  <div
                    key={`place-${place.id}`}
                    onClick={() => onOpenHub?.(place.place)}
                    className="flex items-center gap-3 p-3 bg-[#FEF6E9]/85 backdrop-blur-sm rounded-2xl shadow-md border border-[#E8D4C0]/40 active:scale-98 transition-all duration-200 cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-[#FEF6E9] rounded-lg flex-shrink-0 border border-[#E8D4C0] shadow-sm overflow-hidden">
                      <img 
                        src={place.place?.hubImage || '/assets/leaf.png'} 
                        alt={place.place?.name || 'Place'} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/assets/leaf.png';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif font-semibold text-[#5D4A2E] truncate line-clamp-1">{place.place?.name || 'Unknown Place'}</p>
                      <p className="text-[#7A5D3F] text-sm truncate">{place.place?.address || 'No address'}</p>
                      {place.note && (
                        <p className="text-[#7A5D3F] text-sm italic mt-1">"{place.note}"</p>
                      )}
                      {/* Status tag for saved places */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border shadow-sm ${
                          place.status === 'loved' 
                            ? 'bg-[#FF6B6B]/20 text-[#FF6B6B] border-[#FF6B6B]/30' 
                            : place.status === 'tried' 
                            ? 'bg-[#4ECDC4]/20 text-[#4ECDC4] border-[#4ECDC4]/30' 
                            : 'bg-[#45B7D1]/20 text-[#45B7D1] border-[#45B7D1]/30'
                        }`}>
                          {place.status === 'loved' ? '❤️ Loved' : 
                           place.status === 'tried' ? '🍽️ Tried' : '💭 Want'}
                        </span>
                        
                        {/* Rating for Tried Places */}
                        {place.status === 'tried' && place.triedRating && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border shadow-sm ${
                            place.triedRating === 'liked' 
                              ? 'bg-[#4CAF50]/20 text-[#4CAF50] border-[#4CAF50]/30' 
                              : place.triedRating === 'disliked' 
                              ? 'bg-[#F44336]/20 text-[#F44336] border-[#F44336]/30' 
                              : 'bg-[#FF9800]/20 text-[#FF9800] border-[#FF9800]/30'
                          }`}>
                            {place.triedRating === 'liked' ? '👍 Liked' : 
                             place.triedRating === 'disliked' ? '👎 Disliked' : '😐 Neutral'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Display posts */}
                {posts.map((post) => (
                  <div
                    key={`post-${post.id}`}
                    onClick={() => handlePostClick(post)}
                    className="flex items-center gap-3 p-3 bg-[#FEF6E9]/85 backdrop-blur-sm rounded-2xl shadow-md border border-[#E8D4C0]/40 active:scale-98 transition-all duration-200 cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-[#FEF6E9] rounded-lg flex-shrink-0 border border-[#E8D4C0] shadow-sm overflow-hidden">
                      <img 
                        src={post.images && post.images.length > 0 ? post.images[0] : '/assets/leaf.png'} 
                        alt={post.description} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/assets/leaf.png';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif font-semibold text-[#5D4A2E] truncate line-clamp-1">{post.description}</p>
                      <div className="flex items-center gap-2 text-[#7A5D3F] text-sm">
                        <span>by @{post.username || 'Unknown User'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {/* Post Type Tag */}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border shadow-sm ${
                          post.postType === 'loved' 
                            ? 'bg-[#FF6B6B]/20 text-[#FF6B6B] border-[#FF6B6B]/30' 
                            : post.postType === 'tried' 
                            ? 'bg-[#4ECDC4]/20 text-[#4ECDC4] border-[#4ECDC4]/30' 
                            : 'bg-[#45B7D1]/20 text-[#45B7D1] border-[#45B7D1]/30'
                        }`}>
                          {post.postType === 'loved' ? '❤️ Loved' : 
                           post.postType === 'tried' ? '🍽️ Tried' : '💭 Want'}
                        </span>
                        
                        {/* Rating for Tried Posts */}
                        {post.postType === 'tried' && post.triedRating && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border shadow-sm ${
                            post.triedRating === 'liked' 
                              ? 'bg-[#4CAF50]/20 text-[#4CAF50] border-[#4CAF50]/30' 
                              : post.triedRating === 'disliked' 
                              ? 'bg-[#F44336]/20 text-[#F44336] border-[#F44336]/30' 
                              : 'bg-[#FF9800]/20 text-[#FF9800] border-[#FF9800]/30'
                          }`}>
                            {post.triedRating === 'liked' ? '👍 Liked' : 
                             post.triedRating === 'disliked' ? '👎 Disliked' : '😐 Neutral'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Show empty state if no places or posts */}
                {places.length === 0 && posts.length === 0 && (
                  <div className="text-center py-8 text-[#7A5D3F]">
                    <p className="text-sm">No places or posts in this list yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}
      
      {/* Comments Modal */}
      <CommentsModal
        isOpen={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        comments={[]}
        onAddComment={handleAddCommentToModal}
        onLikeComment={handleLikeComment}
        onReplyToComment={handleReplyToComment}
      />
    </>
  )
}

export default ListModal
