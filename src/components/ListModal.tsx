import type { List, Place } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, XMarkIcon, UserIcon, CalendarIcon, ArrowsPointingOutIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import ImageCarousel from './ImageCarousel.tsx'
import CommentsModal from './CommentsModal.tsx'
import SaveToListModal from './SaveToListModal.tsx'

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
}

const ListModal = ({ list, isOpen, onClose, onSave, onShare, onAddPost, onOpenFullScreen, onOpenHub, showBackButton, onBack }: ListModalProps) => {
  const { listModalFromList, goBackFromListModal, openFullScreenList } = useNavigation()
  const [isLiked, setIsLiked] = useState(list.isLiked)
  const [likes, setLikes] = useState(list.likes)
  const [isVisible, setIsVisible] = useState(false)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [showSaveToListModal, setShowSaveToListModal] = useState(false)
  const [selectedListForSave, setSelectedListForSave] = useState<List | null>(null)
  
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is ready for animation
      setTimeout(() => setIsVisible(true), 10)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsLiked(!isLiked)
    setLikes(isLiked ? likes - 1 : likes + 1)
  }

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onSave) {
      onSave(list)
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

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else if (listModalFromList) {
      // Use navigation context for list-to-list back navigation
      goBackFromListModal()
    } else {
      // Default back behavior
      onClose()
    }
  }

  const handleOpenHub = (place: Place) => {
    if (onOpenHub) {
      onOpenHub(place)
    }
  }

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

  const handleSaveList = (listToSave: List) => {
    setSelectedListForSave(listToSave)
    setShowSaveToListModal(true)
  }

  const handleSaveToList = (listId: string, note?: string) => {
    // Save list logic here
    console.log('Saving list:', listId, note)
    setShowSaveToListModal(false)
    setSelectedListForSave(null)
  }

  const handleCreateList = (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags: string[] }) => {
    // Create list logic here
    console.log('Creating list:', listData)
  }

  const handleSeeAllLists = (listType: 'popular' | 'friends') => {
    // Navigate to ViewAllLists page with appropriate filters
    window.location.href = `/lists?type=${listType}&hub=${list.id}`
  }

  // Mock places for the list
  const mockPlaces: Place[] = [
    {
      id: '1',
      name: 'Blue Bottle Coffee',
      address: '300 Webster St, Oakland, CA',
      tags: ['coffee', 'cozy', 'work-friendly'],
      posts: [],
      savedCount: 45,
      createdAt: '2024-01-15'
    },
    {
      id: '2',
      name: 'Ritual Coffee',
      address: '1026 Valencia St, San Francisco, CA',
      tags: ['coffee', 'artisan', 'local'],
      posts: [],
      savedCount: 32,
      createdAt: '2024-01-14'
    },
    {
      id: '3',
      name: 'Four Barrel Coffee',
      address: '375 Valencia St, San Francisco, CA',
      tags: ['coffee', 'roaster', 'industrial'],
      posts: [],
      savedCount: 28,
      createdAt: '2024-01-13'
    }
  ]

  // Mock user lists for save functionality
  const userLists: List[] = [
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
      id: 'cozy-coffee-spots',
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
    }
  ]

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9998] flex items-center justify-center p-1 bg-black/20 backdrop-blur-md"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className={`w-full max-w-[600px] mx-1 max-h-screen bg-gradient-to-br from-[#FDF8F0] via-[#FAF3E0] to-[#F5E6D3] rounded-3xl shadow-2xl border border-[#E4D5C7]/60 overflow-hidden relative transition-all duration-500 ease-out ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 80%, rgba(228, 213, 199, 0.2) 0%, transparent 50%), 
            radial-gradient(circle at 80% 20%, rgba(250, 243, 224, 0.25) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(139, 115, 85, 0.05) 0%, transparent 70%),
            radial-gradient(circle at 10% 10%, rgba(245, 230, 211, 0.15) 0%, transparent 60%),
            radial-gradient(circle at 90% 90%, rgba(228, 213, 199, 0.1) 0%, transparent 40%)
          `
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Plant background accent - subtle and behind all content */}
        <img
          src="/assets/leaf.png"
          alt=""
          className="absolute bottom-0 right-0 w-32 opacity-12 pointer-events-none z-0 blur-sm scale-105"
        />

        {/* Climbing Vine System - continuous pattern from opposite corners */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {/* Primary vine - starts bottom-left, climbs up */}
          <div className="absolute bottom-0 left-0 h-full w-12 pointer-events-none">
            <img
              src="/assets/leaf2.png"
              alt=""
              className="absolute bottom-0 left-0 h-full w-full object-contain opacity-8 pointer-events-none"
              style={{
                transform: 'scaleY(1.2) translateY(-15%) rotate(-5deg)',
                filter: 'brightness(0.6) contrast(0.8)'
              }}
            />
          </div>
          
          {/* Secondary vine - starts top-right, trails down to connect */}
          <div className="absolute top-48 right-0 h-[calc(100%-12rem)] w-10 pointer-events-none">
            <img
              src="/assets/leaf2.png"
              alt=""
              className="absolute top-0 right-0 h-full w-full object-contain opacity-6 pointer-events-none"
              style={{
                transform: 'scaleY(1.1) translateY(-8%) rotate(8deg)',
                filter: 'brightness(0.7) contrast(0.7)'
              }}
            />
          </div>
          
          {/* Connecting vine segment - bridges the gap */}
          <div className="absolute top-1/3 right-8 h-32 w-8 pointer-events-none">
            <img
              src="/assets/leaf2.png"
              alt=""
              className="absolute top-0 right-0 h-full w-full object-contain opacity-5 pointer-events-none"
              style={{
                transform: 'scaleY(0.8) translateY(-5%) rotate(25deg)',
                filter: 'brightness(0.8) contrast(0.6)'
              }}
            />
          </div>
        </div>

        {/* Extra Leaf Accents - scattered throughout content with better spacing */}
        <div className="absolute inset-0 pointer-events-none z-0">
          {/* Top edge leaf accent - framing */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-8 left-6 w-14 h-14 opacity-18 pointer-events-none"
            style={{
              transform: 'rotate(-25deg) scale(0.75)',
              filter: 'brightness(0.7) contrast(0.8)'
            }}
          />
          
          {/* Upper-middle leaf accent */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-40 left-3 w-16 h-16 opacity-15 pointer-events-none"
            style={{
              transform: 'rotate(35deg) scale(0.85)',
              filter: 'brightness(0.8) contrast(0.7)'
            }}
          />
          
          {/* Middle-left leaf accent */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-1/2 left-2 w-12 h-12 opacity-12 pointer-events-none"
            style={{
              transform: 'rotate(55deg) scale(0.7)',
              filter: 'brightness(0.9) contrast(0.6)'
            }}
          />
          
          {/* Lower-middle leaf accent */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute bottom-1/3 left-5 w-15 h-15 opacity-14 pointer-events-none"
            style={{
              transform: 'rotate(-15deg) scale(0.8)',
              filter: 'brightness(0.6) contrast(0.9)'
            }}
          />
          
          {/* Bottom edge leaf accent - framing */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute bottom-6 right-4 w-18 h-18 opacity-16 pointer-events-none"
            style={{
              transform: 'rotate(45deg) scale(0.9)',
              filter: 'brightness(0.7) contrast(0.8)'
            }}
          />
          
          {/* Behind Description section - positioned to not block content */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-72 left-8 w-16 h-16 opacity-10 pointer-events-none"
            style={{
              transform: 'rotate(-40deg) scale(0.65)',
              filter: 'brightness(0.8) contrast(0.7)'
            }}
          />
          
          {/* Behind Places section - positioned to not block content */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute bottom-24 left-3 w-14 h-14 opacity-8 pointer-events-none"
            style={{
              transform: 'rotate(70deg) scale(0.6)',
              filter: 'brightness(0.9) contrast(0.5)'
            }}
          />
          
          {/* Behind Comments section - positioned to not block content */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute bottom-40 right-4 w-14 h-14 opacity-12 pointer-events-none"
            style={{
              transform: 'rotate(-45deg) scale(0.9)',
              filter: 'brightness(0.8) contrast(0.7)'
            }}
          />
        </div>

        {/* Enhanced dreamy light rays */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-40 h-40 bg-gradient-to-br from-[#F5E6D3]/25 via-transparent to-transparent transform -rotate-12 animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute top-0 right-1/3 w-32 h-32 bg-gradient-to-bl from-[#E4D5C7]/20 via-transparent to-transparent transform rotate-6 animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute bottom-0 left-1/3 w-36 h-36 bg-gradient-to-tr from-[#F5E6D3]/20 via-transparent to-transparent transform rotate-12 animate-pulse" style={{ animationDuration: '5s' }} />
          <div className="absolute top-1/2 right-0 w-24 h-24 bg-gradient-to-l from-[#E4D5C7]/15 via-transparent to-transparent transform -rotate-45 animate-pulse" style={{ animationDuration: '7s' }} />
        </div>

        {/* Enhanced grain texture */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="w-full h-full" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px'
          }} />
        </div>

        {/* Warm light leak overlay */}
        <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-[#F5E6D3]/50 via-[#F5E6D3]/25 to-transparent pointer-events-none" />
        
        {/* Header blur integration - cohesive fade effect */}
        <div className="absolute top-0 w-full h-16 z-10 bg-gradient-to-b from-[#fdf6ec]/80 to-transparent backdrop-blur-sm pointer-events-none" />
        
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
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              {(showBackButton || listModalFromList) && (
                <button 
                  onClick={handleBack}
                  className="w-12 h-12 bg-[#FDF8F0]/95 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-[#E4D5C7]/50 active:scale-95 transition-all duration-200"
                  title="Go back"
                >
                  <ArrowLeftIcon className="w-6 h-6 text-[#8B7355]" />
                </button>
              )}
              <button 
                onClick={handleOpenFullScreen}
                className="w-12 h-12 bg-[#FDF8F0]/95 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-[#E4D5C7]/50 active:scale-95 transition-all duration-200"
                title="Open full screen"
              >
                <ArrowsPointingOutIcon className="w-6 h-6 text-[#A67C52]" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleShare}
                className="w-12 h-12 bg-[#FDF8F0]/95 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-[#E4D5C7]/50 active:scale-95 transition-all duration-200"
              >
                <ShareIcon className="w-6 h-6 text-[#C17F59]" />
              </button>
              <button
                onClick={onClose}
                className="w-12 h-12 bg-[#FDF8F0]/95 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-[#E4D5C7]/50 active:scale-95 transition-all duration-200"
              >
                <XMarkIcon className="w-7 h-7 text-[#8B7355]" />
              </button>
            </div>
          </div>
          
          {/* Text overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            {/* Improved parchment-style background for better contrast */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#f9f2e9]/80 via-[#f9f2e9]/40 to-transparent backdrop-blur-sm rounded-t-xl">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#4a2e1e] mb-2 leading-tight drop-shadow-lg" style={{ textShadow: '1px 1px 3px rgba(255,255,255,0.8)' }}>{list.name}</h1>
              <div className="flex items-center text-[#6B5B47] text-sm sm:text-base mb-3 drop-shadow-md">
              <UserIcon className="w-5 h-5 mr-2" />
              Created by {list.userId}
            </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-[#8B7355]/20 backdrop-blur-sm rounded-xl text-[#6B5B47] text-sm font-medium border border-[#8B7355]/30 shadow-sm">
                {mockPlaces.length} places
              </span>
                <span className="px-3 py-1.5 bg-[#8B7355]/20 backdrop-blur-sm rounded-xl text-[#6B5B47] text-sm font-medium border border-[#8B7355]/30 shadow-sm">
                {list.tags[0] || 'Popular'}
              </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Content - Mobile-optimized scroll container */}
        <div className="flex flex-col h-[calc(100vh-0.5rem-12rem)] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="p-4 space-y-5 flex-1 pb-6">
          {/* Description */}
            <div className="bg-[#E4D5C7]/15 backdrop-blur-sm rounded-3xl p-4 border border-[#E4D5C7]/30 shadow-[0_6px_30px_rgba(0,0,0,0.1)] relative overflow-hidden">
              {/* Scroll-synced floating leaf */}
              <img
                src="/assets/leaf.png"
                alt=""
                className="absolute top-2 right-3 w-8 h-8 opacity-20 pointer-events-none transition-transform duration-300 hover:scale-105"
                style={{
                  transform: 'rotate(15deg) scale(0.8)',
                  filter: 'brightness(0.8) contrast(0.7)'
                }}
              />
              {/* Ambient glow shadow */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#F5E6D3]/10 via-transparent to-[#E4D5C7]/10 rounded-3xl pointer-events-none" />
              <p className="text-[#6B5B47] text-base leading-relaxed font-serif relative z-10">{list.description}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-[#8B7355] relative z-10">
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                Created {new Date(list.createdAt).toLocaleDateString()}
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
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#A67C52] to-[#8B7355] text-[#FDF8F0] px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#8B7355]/30 active:scale-95 transition-all duration-200"
            >
              {isLiked ? (
                  <HeartIconSolid className="w-4 h-4" />
              ) : (
                  <HeartIcon className="w-4 h-4" />
              )}
              {isLiked ? 'Liked' : 'Like'}
            </button>
            <button 
              onClick={handleAddPost}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#D4A574] to-[#B08968] text-[#FDF8F0] px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#B08968]/30 active:scale-95 transition-all duration-200"
            >
                <PlusIcon className="w-4 h-4" />
              Add Post
            </button>
            <button 
              onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#C17F59] to-[#A67C52] text-[#FDF8F0] px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#A67C52]/30 active:scale-95 transition-all duration-200"
            >
                <BookmarkIcon className="w-4 h-4" />
              Save
            </button>
          </div>

          {/* Places */}
            <div className="bg-[#E4D5C7]/15 backdrop-blur-sm rounded-3xl p-4 border border-[#E4D5C7]/30 shadow-[0_6px_30px_rgba(0,0,0,0.1)] relative overflow-hidden">
              {/* Scroll-synced floating leaf */}
              <img
                src="/assets/leaf.png"
                alt=""
                className="absolute top-2 left-3 w-8 h-8 opacity-20 pointer-events-none transition-transform duration-300 hover:scale-105"
                style={{
                  transform: 'rotate(-15deg) scale(0.8)',
                  filter: 'brightness(0.8) contrast(0.7)'
                }}
              />
              {/* Ambient glow shadow */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#F5E6D3]/10 via-transparent to-[#E4D5C7]/10 rounded-3xl pointer-events-none" />
              <h3 className="text-lg font-serif font-semibold text-[#6B5B47] mb-4 relative z-10">Places in this list</h3>
              <div className="space-y-3 relative z-10">
              {mockPlaces.map((place) => (
                <div
                  key={place.id}
                  onClick={() => handleOpenHub(place)}
                    className="flex items-center gap-3 p-3 bg-[#FDF8F0]/80 backdrop-blur-sm rounded-2xl shadow-md border border-[#E4D5C7]/30 active:scale-98 transition-all duration-200"
                >
                    <div className="w-12 h-12 bg-[#FDF8F0] rounded-lg flex-shrink-0 border border-[#E4D5C7] shadow-sm overflow-hidden">
                      <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=48&h=48&fit=crop" alt={place.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                      <h4 className="font-serif font-semibold text-[#6B5B47] truncate">{place.name}</h4>
                      <div className="flex items-center text-[#8B7355] text-sm">
                      <MapPinIcon className="w-4 h-4 mr-1" />
                      {place.address}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {place.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="px-2 py-1 text-xs rounded-full bg-[#A67C52]/20 text-[#A67C52] border border-[#A67C52]/30 font-medium">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {createPortal(modalContent, document.body)}
      
      {/* Comments Modal */}
      <CommentsModal
        isOpen={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        postId={list.id}
        postTitle={list.name}
        comments={[]}
        onAddComment={handleAddCommentToModal}
        onLikeComment={handleLikeComment}
        onReplyToComment={handleReplyToComment}
        currentUserId="1"
      />

      {/* Save to List Modal */}
      <SaveToListModal
        isOpen={showSaveToListModal}
        onClose={() => {
          setShowSaveToListModal(false)
          setSelectedListForSave(null)
        }}
        place={{
          id: selectedListForSave?.id || '',
          name: selectedListForSave?.name || '',
          address: '',
          tags: selectedListForSave?.tags || [],
          posts: [],
          savedCount: 0,
          createdAt: selectedListForSave?.createdAt || ''
        }}
        userLists={userLists}
        onSave={handleSaveToList}
        onCreateList={handleCreateList}
      />
    </>
  )
}

export default ListModal 