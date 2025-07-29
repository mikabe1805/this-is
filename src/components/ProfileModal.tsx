import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { XMarkIcon, MapPinIcon, UserIcon, CalendarIcon, HeartIcon, BookmarkIcon, EyeIcon, PlusIcon, ShareIcon, ArrowsPointingOutIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid, BookmarkIcon as BookmarkIconSolid, EyeIcon as EyeIconSolid } from '@heroicons/react/24/solid'
import type { User, Post, List } from '../types/index.js'

interface ProfileModalProps {
  user: User
  isOpen: boolean
  onClose: () => void
  onFollow?: (userId: string) => void
  onShare?: (user: User) => void
  onOpenFullScreen?: (user: User) => void
  showBackButton?: boolean
  onBack?: () => void
}

const ProfileModal = ({ user, isOpen, onClose, onFollow, onShare, onOpenFullScreen, showBackButton, onBack }: ProfileModalProps) => {
  if (!isOpen || !user) return null

  const navigate = useNavigate()
  const [isFollowing, setIsFollowing] = useState(user.isFollowing || false)
  const [activeTab, setActiveTab] = useState<'posts' | 'lists'>('posts')

  if (!isOpen) return null

  // Mock data for the user
  const mockPosts: Post[] = [
    {
      id: '1',
      hubId: '1',
      userId: user.id,
      username: user.name,
      userAvatar: user.avatar,
      images: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop'],
      description: 'Amazing coffee spot! ☕️',
      postType: 'loved',
      createdAt: '2024-01-15T10:30:00Z',
      privacy: 'public',
      likes: 45,
      likedBy: ['1', '2'],
      comments: []
    },
    {
      id: '2',
      hubId: '2',
      userId: user.id,
      username: user.name,
      userAvatar: user.avatar,
      images: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop'],
      description: 'Perfect for working remotely 💻',
      postType: 'tried',
      triedRating: 'liked',
      createdAt: '2024-01-14T15:20:00Z',
      privacy: 'public',
      likes: 32,
      likedBy: ['1'],
      comments: []
    }
  ]

  const mockLists: List[] = [
    {
      id: '1',
      name: 'Coffee Adventures',
      description: 'Exploring the best coffee spots in the Bay Area',
      userId: user.id,
      isPublic: true,
      isShared: false,
      privacy: 'public',
      tags: ['coffee', 'bay-area', 'adventures'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop',
      createdAt: '2024-01-10',
      updatedAt: '2024-01-15',
      likes: 24,
      isLiked: false
    },
    {
      id: '2',
      name: 'Work-Friendly Spots',
      description: 'Great places to work and be productive',
      userId: user.id,
      isPublic: true,
      isShared: false,
      privacy: 'public',
      tags: ['work-friendly', 'productivity', 'cafes'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=200&fit=crop',
      createdAt: '2024-01-08',
      updatedAt: '2024-01-12',
      likes: 18,
      isLiked: false
    }
  ]

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsFollowing(!isFollowing)
    if (onFollow) {
      onFollow(user.id)
    }
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onShare) {
      onShare(user)
    } else {
      // Fallback share functionality
      if (navigator.share) {
        navigator.share({
          title: `${user.name}'s Profile`,
          text: `Check out ${user.name}'s profile on this.is`,
          url: window.location.href
        })
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(window.location.href)
        alert('Profile link copied to clipboard!')
      }
    }
  }

  const handleOpenFullScreen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onOpenFullScreen) {
      onOpenFullScreen(user)
    } else {
      // Navigate to full-screen profile page
      navigate(`/user/${user.id}`)
      onClose() // Close the modal
    }
  }

  const modalContent = (
    <div 
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="relative w-full max-w-md max-h-[85vh] bg-white/95 backdrop-blur-glass rounded-3xl shadow-crystal border border-white/30 overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-linen-200/50 bg-gradient-to-r from-sage-50/50 to-linen-50/50">
          <div className="flex items-center gap-3">
            {showBackButton && onBack ? (
              <button 
                onClick={onBack} 
                className="text-charcoal-500 hover:text-charcoal-700 transition-colors p-1 rounded-lg hover:bg-white/50"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
            ) : null}
            <h2 className="text-lg font-semibold text-charcoal-800">Profile</h2>
          </div>
          <div className="flex items-center gap-2">
            {onOpenFullScreen && (
              <button
                onClick={handleOpenFullScreen}
                className="text-charcoal-500 hover:text-charcoal-700 transition-colors p-1 rounded-lg hover:bg-white/50"
              >
                <ArrowsPointingOutIcon className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={handleShare}
              className="text-charcoal-500 hover:text-charcoal-700 transition-colors p-1 rounded-lg hover:bg-white/50"
            >
              <ShareIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose} 
              className="text-charcoal-500 hover:text-charcoal-700 transition-colors p-1 rounded-lg hover:bg-white/50"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Profile Header */}
        <div className="p-6 bg-gradient-to-br from-sage-50/30 to-linen-50/30">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-20 h-20 rounded-full object-cover border-4 border-white/80 shadow-soft backdrop-blur-sm"
              />
              <div className="absolute inset-0 rounded-full border border-white/30"></div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-charcoal-800">{user.name}</h3>
              <p className="text-charcoal-600">@{user.username}</p>
              {user.location && (
                <div className="flex items-center gap-1 text-charcoal-500 text-sm mt-1">
                  <MapPinIcon className="w-4 h-4" />
                  <span>{user.location}</span>
                </div>
              )}
            </div>
          </div>

          {user.bio && (
            <p className="text-charcoal-700 mb-4 leading-relaxed">{user.bio}</p>
          )}

          {/* Tags */}
          {user.tags && user.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {user.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-sage-100/70 text-sage-700 text-sm rounded-full border border-sage-200/50 backdrop-blur-sm"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleFollow}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                isFollowing
                  ? 'bg-sage-100/70 text-sage-700 hover:bg-sage-200/70 border border-sage-200/50'
                  : 'bg-gradient-to-r from-sage-600 to-sage-700 text-white hover:from-sage-700 hover:to-sage-800 shadow-soft'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
        </div>
        
                  {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-16rem)] overflow-y-auto">
          {/* Bio and Tags */}
          {user.bio && (
            <div className="bg-linen-50 rounded-xl p-4 shadow-soft border border-linen-200">
              <p className="text-charcoal-700 leading-relaxed">{user.bio}</p>
            </div>
          )}
          
          {user.tags && user.tags.length > 0 && (
            <div className="bg-linen-50 rounded-xl p-4 shadow-soft border border-linen-200">
              <h3 className="font-semibold text-charcoal-800 mb-3">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {user.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 bg-sage-100 text-sage-700 text-sm rounded-full border border-sage-200 font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Follow Button */}
          <div className="flex gap-3">
            <button
              onClick={handleFollow}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-200 ${
                isFollowing
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-gradient-to-r from-sage-500 to-sage-600 text-white'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-200">
              <PlusIcon className="w-5 h-5" />
              Message
            </button>
          </div>

          {/* Tabs */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl p-2 shadow-soft border border-white/40 mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('posts')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-base transition-all duration-200 ${
                  activeTab === 'posts' 
                    ? 'bg-gradient-to-r from-sage-500 to-gold-500 text-white shadow-liquid transform scale-102' 
                    : 'text-sage-700 hover:text-sage-900 hover:bg-white/60'
                }`}
              >
                Posts ({mockPosts.length})
              </button>
              <button
                onClick={() => setActiveTab('lists')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-base transition-all duration-200 ${
                  activeTab === 'lists' 
                    ? 'bg-gradient-to-r from-sage-500 to-gold-500 text-white shadow-liquid transform scale-102' 
                    : 'text-sage-700 hover:text-sage-900 hover:bg-white/60'
                }`}
              >
                Lists ({mockLists.length})
              </button>
            </div>
          </div>

          {/* Tab content */}
          {activeTab === 'posts' && (
            <div className="space-y-4">
              {mockPosts.length > 0 ? (
                mockPosts.map((post) => (
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
                          <span className="text-xs text-charcoal-500">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {post.images.length > 0 && (
                      <div className="mb-3 relative overflow-hidden rounded-lg">
                        <img
                          src={post.images[0]}
                          alt="Post"
                          className="w-full h-48 object-cover rounded-lg shadow-soft"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent"></div>
                      </div>
                    )}
                    <p className="text-charcoal-700 mb-3">{post.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm text-charcoal-600">
                        <button className="flex items-center hover:text-sage-600 transition-colors">
                          <HeartIcon className="w-4 h-4 mr-1" />
                          {post.likes}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-linen-50 rounded-xl p-8 text-center shadow-soft border border-linen-200">
                  <UserIcon className="w-16 h-16 text-charcoal-300 mx-auto mb-4" />
                  <p className="text-charcoal-500 mb-2">No posts yet</p>
                  <p className="text-sm text-charcoal-400">This user hasn't shared any posts yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'lists' && (
            <div className="space-y-4">
              {mockLists.length > 0 ? (
                mockLists.map((list) => (
                  <div
                    key={list.id}
                    className="bg-linen-50 rounded-xl p-4 shadow-soft border border-linen-200"
                  >
                    <div className="flex items-center gap-3">
                      {list.coverImage && (
                        <img src={list.coverImage} alt={list.name} className="w-16 h-16 rounded-lg object-cover" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-charcoal-700 mb-1">{list.name}</h4>
                        <p className="text-sm text-charcoal-500 mb-2">{list.description}</p>
                        <div className="flex items-center gap-2">
                          {list.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-xs px-2 py-1 bg-sage-100 text-sage-700 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button className="p-2 rounded-full bg-sage-50 text-sage-600 hover:bg-sage-100 transition">
                        <BookmarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-linen-50 rounded-xl p-8 text-center shadow-soft border border-linen-200">
                  <BookmarkIcon className="w-16 h-16 text-charcoal-300 mx-auto mb-4" />
                  <p className="text-charcoal-500 mb-2">No lists yet</p>
                  <p className="text-sm text-charcoal-400">This user hasn't created any lists yet.</p>
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

export default ProfileModal 