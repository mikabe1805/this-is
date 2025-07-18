import type { Hub, Post, List } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, CameraIcon, ChatBubbleLeftIcon, XMarkIcon, ArrowRightIcon, ArrowsPointingOutIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import ImageCarousel from './ImageCarousel.tsx'

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
  const { openFullScreenHub } = useNavigation()
  const [tab, setTab] = useState<'overview' | 'posts'>('overview')
  const [posts] = useState<Post[]>(hub.posts || [])
  
  useEffect(() => {
    console.log('HubModal: isOpen changed to:', isOpen)
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
    }
  }

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) {
          console.log('HubModal: Backdrop clicked, closing modal')
          onClose()
        }
      }}
    >
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-botanical border border-linen-200 overflow-hidden"
        onClick={(e) => {
          console.log('HubModal: Modal content clicked, stopping propagation')
          e.stopPropagation()
        }}
      >
        {/* Header with image */}
        <div className="relative h-64 bg-gradient-to-br from-cream-200 to-coral-200 overflow-hidden">
          {hub.mainImage && (
            <img
              src={hub.mainImage}
              alt={hub.name}
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
            <h1 className="text-3xl font-serif font-bold text-white mb-2 drop-shadow-lg">{hub.name}</h1>
            <div className="flex items-center text-white/95 text-base mb-3 drop-shadow-md">
              <MapPinIcon className="w-5 h-5 mr-2" />
              {hub.location.address}
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 bg-white/25 backdrop-blur-sm rounded-full text-white text-sm font-medium">
                {posts.length} posts
              </span>
              <span className="px-3 py-1.5 bg-white/25 backdrop-blur-sm rounded-full text-white text-sm font-medium">
                {hub.tags[0] || 'Popular'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-16rem)] overflow-y-auto">
          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <a 
              href={hub.googleMapsUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-sage-500 to-sage-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-200"
            >
              <MapPinIcon className="w-5 h-5" />
              Directions
              <ArrowRightIcon className="w-4 h-4" />
            </a>
            <button 
              onClick={handleAddPost}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-200"
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
          
          {/* Tabs */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl p-2 shadow-soft border border-white/40 mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setTab('overview')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-base transition-all duration-200 ${
                  tab === 'overview' 
                    ? 'bg-gradient-to-r from-sage-500 to-gold-500 text-white shadow-liquid transform scale-102' 
                    : 'text-sage-700 hover:text-sage-900 hover:bg-white/60'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setTab('posts')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-base transition-all duration-200 ${
                  tab === 'posts' 
                    ? 'bg-gradient-to-r from-sage-500 to-gold-500 text-white shadow-liquid transform scale-102' 
                    : 'text-sage-700 hover:text-sage-900 hover:bg-white/60'
                }`}
              >
                Posts ({posts.length})
              </button>
            </div>
          </div>

          {/* Tab content */}
          {tab === 'overview' && (
            <div className="space-y-4">
              {/* Popular Lists */}
              <div className="bg-linen-50 rounded-xl p-4">
                <h3 className="text-lg font-serif font-semibold text-charcoal-700 mb-3">Popular Lists</h3>
                {lists.length > 0 ? (
                  <div className="space-y-3">
                    {lists.slice(0, 3).map((list) => (
                      <div 
                        key={list.id} 
                        className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-soft cursor-pointer hover:shadow-liquid hover:scale-102 transition-all duration-200"
                        onClick={() => handleListClick(list)}
                      >
                        {list.coverImage && (
                          <img src={list.coverImage} alt={list.name} className="w-12 h-12 rounded-lg object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-charcoal-700 truncate">{list.name}</h4>
                          <p className="text-sm text-charcoal-500 truncate">{list.description}</p>
                        </div>
                        <button className="p-2 rounded-full bg-sage-50 text-sage-600 hover:bg-sage-100 transition">
                          <BookmarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-charcoal-500">
                    <BookmarkIcon className="w-12 h-12 mx-auto mb-2 text-charcoal-300" />
                    <p>No lists yet</p>
                  </div>
                )}
                <button className="mt-3 text-sage-700 hover:underline text-sm font-medium">See All</button>
              </div>

              {/* Friends' Lists */}
              <div className="bg-linen-50 rounded-xl p-4">
                <h3 className="text-lg font-serif font-semibold text-charcoal-700 mb-3">Friends' Lists</h3>
                <div className="italic text-charcoal-500">Emma's Favorites, Mika's Coffee Spots...</div>
                <button className="mt-3 text-sage-700 hover:underline text-sm font-medium">See All</button>
              </div>

              {/* Comments Section */}
              <div className="bg-linen-50 rounded-xl p-4">
                <h3 className="text-lg font-serif font-semibold text-charcoal-700 mb-4">Comments</h3>
                <div className="space-y-4 mb-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-3 p-3 bg-white rounded-lg shadow-soft">
                      <img src={comment.user.avatar} alt={comment.user.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-soft flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-serif font-semibold text-charcoal-700">{comment.user.name}</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-sage-50 text-sage-700 border border-sage-100">{comment.date}</span>
                        </div>
                        <p className="text-sm text-charcoal-600">{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddComment} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-linen-200">
                  <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face" alt="You" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-soft flex-shrink-0" />
                  <input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 rounded-full px-4 py-2 border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 shadow-soft"
                  />
                </form>
              </div>
            </div>
          )}

          {tab === 'posts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-serif font-semibold text-charcoal-700">Posts</h3>
              </div>
              {posts.length > 0 ? (
                posts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-linen-50 rounded-xl p-4 shadow-soft border border-linen-200"
                  >
                    <div className="flex items-start space-x-3 mb-3">
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-white shadow-soft relative overflow-hidden">
                        <img
                          src={post.userAvatar}
                          alt={post.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-charcoal-700">{post.username}</span>
                        </div>
                        <p className="text-xs text-charcoal-500">
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
                            className="w-full h-48 object-cover rounded-lg shadow-soft"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent pointer-events-none"></div>
                      </div>
                    )}
                    <p className="text-charcoal-700 mb-3">{post.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm text-charcoal-600">
                        <button className="flex items-center hover:text-sage-600 transition-colors">
                          <HeartIcon className="w-4 h-4 mr-1" />
                          {post.likes}
                        </button>
                        <button className="flex items-center hover:text-sage-600 transition-colors">
                          <ChatBubbleLeftIcon className="w-4 h-4 mr-1" />
                          Reply
                        </button>
                      </div>
                      <button className="text-sage-600 hover:text-sage-700 text-sm font-medium transition-colors">
                        Save
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-linen-50 rounded-xl p-8 text-center shadow-soft border border-linen-200">
                  <CameraIcon className="w-16 h-16 text-charcoal-300 mx-auto mb-4" />
                  <p className="text-charcoal-500 mb-2">No posts yet</p>
                  <p className="text-sm text-charcoal-400">Be the first to share your experience!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default HubModal 