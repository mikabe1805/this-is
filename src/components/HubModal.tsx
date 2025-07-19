import type { Hub, Post, List } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, CameraIcon, ChatBubbleLeftIcon, XMarkIcon, ArrowRightIcon, ArrowsPointingOutIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import ImageCarousel from './ImageCarousel.tsx'
import CommentsModal from './CommentsModal.tsx'
import SaveToListModal from './SaveToListModal.tsx'

interface HubModalProps {
  hub: Hub
  isOpen: boolean
  onClose: () => void
  onAddPost?: (hub: Hub) => void
  onSave?: (hub: Hub) => void
  onShare?: (hub: Hub) => void
  onOpenFullScreen?: (hub: Hub) => void
  showBackButton?: boolean
  onBack?: () => void
  onOpenList?: (list: List) => void
}

const HubModal = ({ hub, isOpen, onClose, onAddPost, onSave, onShare, onOpenFullScreen, showBackButton, onBack, onOpenList }: HubModalProps) => {
  console.log('HubModal: Rendering with isOpen:', isOpen, 'hub:', hub?.name)
  const { openFullScreenHub, openListModal } = useNavigation()
  const [tab, setTab] = useState<'overview' | 'posts'>('overview')
  const [posts] = useState<Post[]>(hub.posts || [])
  const [isVisible, setIsVisible] = useState(false)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [showSaveToListModal, setShowSaveToListModal] = useState(false)
  const [selectedListForSave, setSelectedListForSave] = useState<List | null>(null)
  
  useEffect(() => {
    console.log('HubModal: isOpen changed to:', isOpen)
    if (isOpen) {
      // Small delay to ensure DOM is ready for animation
      setTimeout(() => setIsVisible(true), 10)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])
  
  // Create a real list for Rami if this is Tartine Bakery
  const [lists] = useState<List[]>(() => {
    if (hub.name === 'Tartine Bakery') {
      return [
        {
          id: 'rami-coffee-tour',
          name: 'SF Coffee Tour',
          description: 'Exploring the best coffee spots in San Francisco',
          userId: 'rami',
          isPublic: true,
          isShared: true,
          privacy: 'public' as const,
          tags: ['coffee', 'san francisco', 'cafes'],
          hubs: [],
          coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
          createdAt: '2024-01-15',
          updatedAt: '2024-01-15',
          likes: 24,
          isLiked: false
        },
        {
          id: 'emma-favorites',
          name: 'Emma\'s Favorites',
          description: 'My go-to spots for coffee and pastries',
          userId: 'emma',
          isPublic: true,
          isShared: true,
          privacy: 'public' as const,
          tags: ['coffee', 'pastries', 'breakfast'],
          hubs: [],
          coverImage: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop',
          createdAt: '2024-01-10',
          updatedAt: '2024-01-10',
          likes: 18,
          isLiked: true
        }
      ]
    }
    return hub.lists || []
  })
  
  const [commentInput, setCommentInput] = useState('')
  const [comments, setComments] = useState([
    { id: 1, user: { name: 'Emma', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face' }, text: 'Love this spot! The atmosphere is amazing 🌟', date: '2d ago' },
    { id: 2, user: { name: 'Alex', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face' }, text: 'Perfect for working remotely. Great coffee too!', date: '5d ago' },
  ])

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

  if (!isOpen) {
    console.log('HubModal: Not rendering because isOpen is false')
    return null
  }

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentInput.trim()) return
    setComments([
      ...comments,
      {
        id: Date.now(),
        user: { name: 'You', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face' },
        text: commentInput,
        date: 'now'
      }
    ])
    setCommentInput('')
  }

  const handleAddPost = (e: React.MouseEvent) => {
    console.log('Add Post button clicked!')
    e.stopPropagation()
    console.log('Event propagation stopped')
    if (onAddPost) {
      console.log('Calling onAddPost with hub:', hub.name)
      onAddPost(hub)
    } else {
      console.log('onAddPost handler is not provided')
    }
  }

  const handleSave = (e: React.MouseEvent) => {
    console.log('Save button clicked!')
    e.stopPropagation()
    console.log('Event propagation stopped')
    if (onSave) {
      console.log('Calling onSave with hub:', hub.name)
      onSave(hub)
    } else {
      console.log('onSave handler is not provided')
    }
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onShare) {
      onShare(hub)
    } else {
      // Fallback share functionality
      if (navigator.share) {
        navigator.share({
          title: hub.name,
          text: hub.description,
          url: window.location.href
        })
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(window.location.href)
        alert('Link copied to clipboard!')
      }
    }
  }

  const handleOpenFullScreen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onOpenFullScreen) {
      onOpenFullScreen(hub)
    } else {
      // Use navigation context as fallback
      openFullScreenHub(hub)
    }
  }

  const handleListClick = (list: List) => {
    if (onOpenList) {
      onOpenList(list)
    } else {
      // Use navigation context as fallback
      openListModal(list)
    }
  }

  const handleSeeAllLists = (listType: 'popular' | 'friends') => {
    // Navigate to ViewAllLists page with appropriate filters
    window.location.href = `/lists?type=${listType}&hub=${hub.id}`
  }

  const handleCommentsClick = () => {
    setShowCommentsModal(true)
  }

  const handleAddCommentToModal = async (text: string) => {
    // Add comment logic here
    setComments([
      ...comments,
      {
        id: Date.now(),
        user: { name: 'You', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face' },
        text: text,
        date: 'now'
      }
    ])
  }

  const handleLikeComment = (commentId: string) => {
    // Like comment logic here
    console.log('Liked comment:', commentId)
  }

  const handleReplyToComment = async (commentId: string, text: string) => {
    // Reply to comment logic here
    console.log('Replied to comment:', commentId, text)
  }

  const handleSaveList = (list: List) => {
    setSelectedListForSave(list)
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

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9998] flex items-center justify-center p-1 bg-black/20 backdrop-blur-md"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) {
          console.log('HubModal: Backdrop clicked, closing modal')
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
        onClick={(e) => {
          console.log('HubModal: Modal content clicked, stopping propagation')
          e.stopPropagation()
        }}
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
          
          {/* Behind Popular Lists section - positioned to not block content */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-72 left-8 w-16 h-16 opacity-10 pointer-events-none"
            style={{
              transform: 'rotate(-40deg) scale(0.65)',
              filter: 'brightness(0.8) contrast(0.7)'
            }}
          />
          
          {/* Behind Comments section - positioned to not block content */}
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute bottom-24 left-3 w-14 h-14 opacity-8 pointer-events-none"
            style={{
              transform: 'rotate(70deg) scale(0.6)',
              filter: 'brightness(0.9) contrast(0.5)'
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
          {hub.mainImage && (
            <img
              src={hub.mainImage}
              alt={hub.name}
              className="w-full h-full object-cover"
            />
          )}
          {/* Enhanced gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
          
          {/* Top action buttons */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              {showBackButton && onBack && (
                <button 
                  onClick={onBack}
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
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#4a2e1e] mb-2 leading-tight drop-shadow-lg" style={{ textShadow: '1px 1px 3px rgba(255,255,255,0.8)' }}>{hub.name}</h1>
              <div className="flex items-center text-[#6B5B47] text-sm sm:text-base mb-3 drop-shadow-md">
                <MapPinIcon className="w-5 h-5 mr-2" />
                {hub.location.address}
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-[#8B7355]/20 backdrop-blur-sm rounded-xl text-[#6B5B47] text-sm font-medium border border-[#8B7355]/30 shadow-sm">
                  {posts.length} posts
                </span>
                <span className="px-3 py-1.5 bg-[#8B7355]/20 backdrop-blur-sm rounded-xl text-[#6B5B47] text-sm font-medium border border-[#8B7355]/30 shadow-sm">
                  {hub.tags[0] || 'Popular'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Content - Mobile-optimized scroll container */}
        <div className="flex flex-col h-[calc(100vh-0.5rem-12rem)] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="p-4 space-y-5 flex-1">
            {/* Action Buttons - Clean sticky positioning without background box */}
            <div className="flex gap-2 sticky top-0 z-10 pt-2 pb-3">
              <a 
                href={hub.googleMapsUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#A67C52] to-[#8B7355] text-[#FDF8F0] px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#8B7355]/30 active:scale-95 transition-all duration-200"
              >
                <MapPinIcon className="w-4 h-4" />
                Directions
                <ArrowRightIcon className="w-3 h-3" />
              </a>
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
            
            {/* Tabs */}
            <div className="bg-[#E4D5C7]/20 backdrop-blur-sm rounded-xl p-2 shadow-lg border border-[#E4D5C7]/40">
              <div className="flex gap-2">
                <button
                  onClick={() => setTab('overview')}
                  className={`flex-1 py-3 px-4 rounded-lg font-serif font-semibold text-sm transition-all duration-300 ${
                    tab === 'overview' 
                      ? 'bg-gradient-to-r from-[#A67C52] to-[#8B7355] text-[#FDF8F0] shadow-lg transform scale-102' 
                      : 'text-[#8B7355] bg-[#FDF8F0]/60'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setTab('posts')}
                  className={`flex-1 py-3 px-4 rounded-lg font-serif font-semibold text-sm transition-all duration-300 ${
                    tab === 'posts' 
                      ? 'bg-gradient-to-r from-[#A67C52] to-[#8B7355] text-[#FDF8F0] shadow-lg transform scale-102' 
                      : 'text-[#8B7355] bg-[#FDF8F0]/60'
                  }`}
                >
                  Posts ({posts.length})
                </button>
              </div>
            </div>

            {/* Tab content */}
            {tab === 'overview' && (
              <div className="space-y-4 pb-6">
                {/* Popular Lists */}
                <div className="bg-[#E4D5C7]/15 backdrop-blur-sm rounded-xl p-4 border border-[#E4D5C7]/30 shadow-lg relative">
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
                  <h3 className="text-lg font-serif font-semibold text-[#6B5B47] mb-3">Popular Lists</h3>
                  {lists.length > 0 ? (
                    <div className="space-y-3">
                      {lists.slice(0, 3).map((list) => (
                        <div 
                          key={list.id} 
                          className="flex items-center gap-3 p-3 bg-[#FDF8F0]/80 backdrop-blur-sm rounded-xl shadow-md border border-[#E4D5C7]/30 active:scale-98 transition-all duration-200"
                          onClick={() => handleListClick(list)}
                        >
                          {list.coverImage && (
                            <img src={list.coverImage} alt={list.name} className="w-12 h-12 rounded-lg object-cover border border-[#E4D5C7]/40 shadow-sm" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-serif font-semibold text-[#6B5B47] truncate">{list.name}</h4>
                            <p className="text-sm text-[#8B7355] truncate">{list.description}</p>
                          </div>
                          <button 
                            className="p-2 rounded-lg bg-[#A67C52]/20 text-[#A67C52] active:scale-95 transition-all duration-200"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSaveList(list)
                            }}
                          >
                            <BookmarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-[#8B7355]">
                      <BookmarkIcon className="w-12 h-12 mx-auto mb-2 text-[#E4D5C7]" />
                      <p className="font-serif">No lists yet</p>
                    </div>
                  )}
                  <button 
                    className="mt-3 text-[#A67C52] text-sm font-medium font-serif"
                    onClick={() => handleSeeAllLists('popular')}
                  >
                    See All
                  </button>
                </div>

                {/* Friends' Lists */}
                <div className="bg-[#E4D5C7]/15 backdrop-blur-sm rounded-xl p-4 border border-[#E4D5C7]/30 shadow-lg relative">
                  {/* Scroll-synced floating leaf */}
                  <img
                    src="/assets/leaf.png"
                    alt=""
                    className="absolute top-2 left-3 w-6 h-6 opacity-15 pointer-events-none transition-transform duration-300 hover:scale-105"
                    style={{
                      transform: 'rotate(-20deg) scale(0.7)',
                      filter: 'brightness(0.7) contrast(0.8)'
                    }}
                  />
                  <h3 className="text-lg font-serif font-semibold text-[#6B5B47] mb-3">Friends' Lists</h3>
                  <div className="italic text-[#8B7355] font-serif text-sm">Emma's Favorites, Mika's Coffee Spots...</div>
                  <button 
                    className="mt-3 text-[#A67C52] text-sm font-medium font-serif"
                    onClick={() => handleSeeAllLists('friends')}
                  >
                    See All
                  </button>
                </div>

                {/* Comments Section */}
                <div className="bg-[#E4D5C7]/15 backdrop-blur-sm rounded-xl p-4 border border-[#E4D5C7]/30 shadow-lg relative">
                  {/* Scroll-synced floating leaf */}
                  <img
                    src="/assets/leaf.png"
                    alt=""
                    className="absolute bottom-2 right-2 w-7 h-7 opacity-18 pointer-events-none transition-transform duration-300 hover:scale-105"
                    style={{
                      transform: 'rotate(30deg) scale(0.75)',
                      filter: 'brightness(0.6) contrast(0.9)'
                    }}
                  />
                  <h3 className="text-lg font-serif font-semibold text-[#6B5B47] mb-4">Comments</h3>
                  <div className="space-y-3 mb-4">
                    {comments.slice(0, 2).map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3 p-3 bg-[#FDF8F0]/80 backdrop-blur-sm rounded-xl shadow-md border border-[#E4D5C7]/30">
                        <img src={comment.user.avatar} alt={comment.user.name} className="w-10 h-10 rounded-lg object-cover border border-[#E4D5C7] shadow-sm flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-serif font-semibold text-[#6B5B47] text-sm">{comment.user.name}</span>
                            <span className="text-xs px-2 py-1 rounded-full bg-[#A67C52]/20 text-[#A67C52] border border-[#A67C52]/30 font-medium">{comment.date}</span>
                          </div>
                          <p className="text-sm text-[#8B7355] leading-relaxed">{comment.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    className="w-full p-3 bg-[#FDF8F0]/80 backdrop-blur-sm rounded-xl border border-[#E4D5C7]/30 shadow-md text-[#6B5B47] font-serif text-sm active:scale-98 transition-all duration-200"
                    onClick={handleCommentsClick}
                  >
                    View all {comments.length} comments
                  </button>
                </div>
              </div>
            )}

            {tab === 'posts' && (
              <div className="space-y-4 pb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-serif font-semibold text-[#6B5B47]">Posts</h3>
                </div>
                {posts.length > 0 ? (
                  posts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-[#E4D5C7]/15 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-[#E4D5C7]/30"
                    >
                      <div className="flex items-start space-x-3 mb-3">
                        <div className="w-10 h-10 rounded-lg border border-[#E4D5C7] bg-[#FDF8F0] shadow-sm relative overflow-hidden">
                          <img
                            src={post.userAvatar}
                            alt={post.username}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-serif font-semibold text-[#6B5B47] text-sm">{post.username}</span>
                          </div>
                          <p className="text-xs text-[#8B7355] font-serif">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      {post.images.length > 0 && (
                        <div className="mb-3 relative overflow-hidden rounded-lg">
                          {post.images.length > 1 ? (
                            <ImageCarousel 
                              images={post.images} 
                              className="h-48"
                              showArrows={true}
                            />
                          ) : (
                            <img
                              src={post.images[0]}
                              alt="Post"
                              className="w-full h-48 object-cover rounded-lg shadow-md"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent pointer-events-none"></div>
                        </div>
                      )}
                      <p className="text-[#6B5B47] mb-3 leading-relaxed font-serif text-sm">{post.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-[#8B7355]">
                          <button className="flex items-center active:scale-95 transition-transform duration-200">
                            <HeartIcon className="w-4 h-4 mr-1" />
                            {post.likes}
                          </button>
                          <button className="flex items-center active:scale-95 transition-transform duration-200">
                            <ChatBubbleLeftIcon className="w-4 h-4 mr-1" />
                            Reply
                          </button>
                        </div>
                        <button className="text-[#A67C52] text-sm font-medium font-serif active:scale-95 transition-transform duration-200">
                          Save
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#E4D5C7]/15 backdrop-blur-sm rounded-xl p-8 text-center shadow-lg border border-[#E4D5C7]/30">
                    <CameraIcon className="w-16 h-16 text-[#E4D5C7] mx-auto mb-4" />
                    <p className="text-[#8B7355] mb-2 font-serif">No posts yet</p>
                    <p className="text-sm text-[#8B7355]/80 font-serif">Be the first to share your experience!</p>
                  </div>
                )}
              </div>
            )}
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
        postId={hub.id}
        postTitle={hub.name}
        comments={comments.map(comment => ({
          id: comment.id.toString(),
          userId: '1',
          username: comment.user.name,
          userAvatar: comment.user.avatar,
          text: comment.text,
          createdAt: new Date().toISOString(),
          likes: 0,
          likedBy: []
        }))}
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

export default HubModal 