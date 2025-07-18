import type { List, Place } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, XMarkIcon, UserIcon, CalendarIcon, ArrowsPointingOutIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import ImageCarousel from './ImageCarousel.tsx'

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

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-botanical border border-linen-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with cover image */}
        <div className="relative h-64 bg-gradient-to-br from-cream-200 to-coral-200 overflow-hidden">
          {list.coverImage && (
            <img
              src={list.coverImage}
              alt={list.name}
              className="w-full h-full object-cover"
            />
          )}
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          
          {/* Top action buttons */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              {(showBackButton || listModalFromList) && (
                <button 
                  onClick={handleBack}
                  className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-botanical hover:shadow-liquid hover:scale-105 transition-all duration-200"
                  title="Go back"
                >
                  <ArrowLeftIcon className="w-5 h-5 text-charcoal-600" />
                </button>
              )}
              <button 
                onClick={handleOpenFullScreen}
                className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-botanical hover:shadow-liquid hover:scale-105 transition-all duration-200"
                title="Open full screen"
              >
                <ArrowsPointingOutIcon className="w-5 h-5 text-sage-600" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleShare}
                className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-botanical hover:shadow-liquid hover:scale-105 transition-all duration-200"
              >
                <ShareIcon className="w-5 h-5 text-coral-600" />
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-botanical hover:shadow-liquid hover:scale-105 transition-all duration-200"
              >
                <XMarkIcon className="w-6 h-6 text-charcoal-600" />
              </button>
            </div>
          </div>
          
          {/* Text overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
            <h1 className="text-3xl font-serif font-bold text-white mb-2 drop-shadow-lg">{list.name}</h1>
            <div className="flex items-center text-white/95 text-base mb-3 drop-shadow-md">
              <UserIcon className="w-5 h-5 mr-2" />
              Created by {list.userId}
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 bg-white/25 backdrop-blur-sm rounded-full text-white text-sm font-medium">
                {mockPlaces.length} places
              </span>
              <span className="px-3 py-1.5 bg-white/25 backdrop-blur-sm rounded-full text-white text-sm font-medium">
                {list.tags[0] || 'Popular'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-16rem)] overflow-y-auto">
          {/* Description */}
          <div className="bg-linen-50 rounded-xl p-4">
            <p className="text-charcoal-700 text-base leading-relaxed">{list.description}</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-charcoal-500">
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
          <div className="flex gap-3 mb-6">
            <button 
              onClick={handleLike}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-200"
            >
              {isLiked ? (
                <HeartIconSolid className="w-5 h-5" />
              ) : (
                <HeartIcon className="w-5 h-5" />
              )}
              {isLiked ? 'Liked' : 'Like'}
            </button>
            <button 
              onClick={handleAddPost}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-sage-500 to-sage-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-200"
            >
              <PlusIcon className="w-5 h-5" />
              Add Post
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-coral-500 to-coral-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-200"
            >
              <BookmarkIcon className="w-5 h-5" />
              Save
            </button>
          </div>

          {/* Places */}
          <div>
            <h3 className="text-lg font-serif font-semibold text-charcoal-700 mb-4">Places in this list</h3>
            <div className="space-y-3">
              {mockPlaces.map((place) => (
                <div
                  key={place.id}
                  onClick={() => handleOpenHub(place)}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-soft cursor-pointer hover:shadow-liquid hover:scale-102 transition-all duration-200"
                >
                  <div className="w-12 h-12 bg-linen-100 rounded-lg flex-shrink-0">
                    <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=48&h=48&fit=crop" alt={place.name} className="w-full h-full object-cover rounded-lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-charcoal-700 truncate">{place.name}</h4>
                    <div className="flex items-center text-charcoal-500 text-sm">
                      <MapPinIcon className="w-4 h-4 mr-1" />
                      {place.address}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {place.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="px-2 py-1 text-xs rounded-full bg-sage-50 text-sage-700 border border-sage-100">
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
  )

  return createPortal(modalContent, document.body)
}

export default ListModal 