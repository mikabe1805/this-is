import type { List, Place } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, XMarkIcon, UserIcon, CalendarIcon, ArrowsPointingOutIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { useState } from 'react'
import { createPortal } from 'react-dom'

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
  const [isLiked, setIsLiked] = useState(list.isLiked)
  const [likes, setLikes] = useState(list.likes)

  if (!isOpen) return null

  const handleLike = () => {
    setIsLiked(!isLiked)
    setLikes(isLiked ? likes - 1 : likes + 1)
  }

  const handleSave = () => {
    if (onSave) {
      onSave(list)
    }
  }

  const handleShare = () => {
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

  const handleAddPost = () => {
    if (onAddPost) {
      onAddPost(list)
    }
  }

  const handleOpenFullScreen = () => {
    if (onOpenFullScreen) {
      onOpenFullScreen(list)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-botanical border border-linen-200 overflow-hidden">
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
              {showBackButton && onBack && (
                <button 
                  onClick={onBack}
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
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-200 ${
                isLiked 
                  ? 'bg-gradient-to-r from-coral-500 to-coral-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isLiked ? <HeartIconSolid className="w-5 h-5" /> : <HeartIcon className="w-5 h-5" />}
              {isLiked ? 'Liked' : 'Like'}
            </button>
            <button 
              onClick={handleAddPost}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-200"
            >
              <PlusIcon className="w-5 h-5" />
              Add Post
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-sage-500 to-sage-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-200"
            >
              <BookmarkIcon className="w-5 h-5" />
              Save
            </button>
          </div>

          {/* Places in the list */}
          <div className="space-y-4">
            <h3 className="text-lg font-serif font-semibold text-charcoal-700">Places in this list</h3>
            {mockPlaces.length > 0 ? (
              <div className="space-y-3">
                {mockPlaces.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => handleOpenHub(place)}
                    className="w-full flex items-center gap-3 p-3 bg-linen-50 rounded-lg shadow-soft border border-linen-200 hover:shadow-liquid hover:scale-102 transition-all duration-200 text-left"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-sage-200 to-gold-200 rounded-lg flex items-center justify-center">
                      <MapPinIcon className="w-6 h-6 text-sage-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-charcoal-700 truncate">{place.name}</h4>
                      <p className="text-sm text-charcoal-500 truncate">{place.address}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {place.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-xs px-2 py-1 bg-sage-100 text-sage-700 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="p-2 rounded-full bg-sage-50 text-sage-600">
                      <BookmarkIcon className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-charcoal-500">
                <MapPinIcon className="w-16 h-16 mx-auto mb-4 text-charcoal-300" />
                <p>No places added yet</p>
                <p className="text-sm text-charcoal-400">Start exploring and add places to this list!</p>
              </div>
            )}
          </div>

          {/* Tags */}
          {list.tags.length > 0 && (
            <div className="bg-linen-50 rounded-xl p-4">
              <h3 className="text-lg font-serif font-semibold text-charcoal-700 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {list.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1.5 bg-white text-sage-700 rounded-full text-sm font-medium border border-sage-200">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default ListModal 