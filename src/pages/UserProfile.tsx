import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapPinIcon, UserIcon, CalendarIcon, HeartIcon, BookmarkIcon, EyeIcon, PlusIcon, ShareIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid, BookmarkIcon as BookmarkIconSolid, EyeIcon as EyeIconSolid } from '@heroicons/react/24/solid'
import type { User, Post, List } from '../types/index.js'

// Mock user data - in real app this would come from API
const mockUser: User = {
  id: '1',
  name: 'Sarah Chen',
  username: 'sarah.chen',
  avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
  bio: 'Finding cozy spots and sharing them with friends ✨',
  location: 'San Francisco, CA',
  tags: ['cozy', 'coffee', 'foodie', 'local'],
  isFollowing: false
}

const mockPosts: Post[] = [
  {
    id: '1',
    hubId: '1',
    userId: '1',
    username: 'Sarah Chen',
    userAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    images: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop'],
    description: 'Amazing coffee spot! ☕️ The atmosphere is perfect for working remotely.',
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
    userId: '1',
    username: 'Sarah Chen',
    userAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    images: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop'],
    description: 'Perfect for working remotely 💻 Great wifi and coffee!',
    postType: 'tried',
    triedRating: 'liked',
    createdAt: '2024-01-14T15:20:00Z',
    privacy: 'public',
    likes: 32,
    likedBy: ['1'],
    comments: []
  },
  {
    id: '3',
    hubId: '3',
    userId: '1',
    username: 'Sarah Chen',
    userAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    images: ['https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'],
    description: 'Best tacos in the city! 🌮 Authentic flavors and great service.',
    postType: 'loved',
    createdAt: '2024-01-13T12:00:00Z',
    privacy: 'public',
    likes: 67,
    likedBy: ['1', '2', '3'],
    comments: []
  }
]

const mockLists: List[] = [
  {
    id: '1',
    name: 'Coffee Adventures',
    description: 'Exploring the best coffee spots in the Bay Area',
    userId: '1',
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
    userId: '1',
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
  },
  {
    id: '3',
    name: 'Hidden Gems',
    description: 'Local favorites that tourists don\'t know about',
    userId: '1',
    isPublic: true,
    isShared: false,
    privacy: 'public',
    tags: ['local', 'hidden-gems', 'authentic'],
    hubs: [],
    coverImage: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=300&h=200&fit=crop',
    createdAt: '2024-01-05',
    updatedAt: '2024-01-10',
    likes: 31,
    isLiked: false
  }
]

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'posts' | 'lists'>('posts')
  const [isFollowing, setIsFollowing] = useState(mockUser.isFollowing || false)
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set())
  const [likedLists, setLikedLists] = useState<Set<string>>(new Set())

  // In real app, fetch user data based on userId
  const user = mockUser
  const posts = mockPosts
  const lists = mockLists

  const handleFollow = () => {
    setIsFollowing(!isFollowing)
    // In real app, this would make an API call
    console.log(isFollowing ? 'Unfollowed' : 'Followed', user.name)
  }

  const handleLikePost = (postId: string) => {
    setLikedPosts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }

  const handleSavePost = (postId: string) => {
    setSavedPosts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }

  const handleLikeList = (listId: string) => {
    setLikedLists(prev => {
      const newSet = new Set(prev)
      if (newSet.has(listId)) {
        newSet.delete(listId)
      } else {
        newSet.add(listId)
      }
      return newSet
    })
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${user.name}'s Profile`,
        text: `Check out ${user.name}'s profile on this.is`,
        url: window.location.href
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Profile link copied to clipboard!')
    }
  }

  return (
    <div className="min-h-screen bg-linen-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-glass border-b border-linen-200/50 shadow-crystal sticky top-0 z-10">
        <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-linen-100 transition-colors"
          >
            <ArrowLeftIcon className="w-6 h-6 text-charcoal-600" />
          </button>
          <h1 className="text-lg font-serif font-semibold text-charcoal-800">
            {user.name}
          </h1>
          <button
            onClick={handleShare}
            className="p-2 rounded-full hover:bg-linen-100 transition-colors"
          >
            <ShareIcon className="w-6 h-6 text-charcoal-600" />
          </button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white/98 backdrop-blur-sm rounded-3xl shadow-botanical border border-linen-200 p-6 mb-6">
          <div className="flex items-start gap-6">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-24 h-24 rounded-full border-4 border-white shadow-botanical"
            />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-serif font-bold text-charcoal-800">{user.name}</h2>
                {isFollowing && (
                  <span className="px-3 py-1 bg-sage-100 text-sage-700 text-sm rounded-full font-medium">
                    Following
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-charcoal-600 mb-2">
                <UserIcon className="w-4 h-4" />
                <span>@{user.username}</span>
              </div>
              <div className="flex items-center gap-2 text-charcoal-600 mb-3">
                <MapPinIcon className="w-4 h-4" />
                <span>{user.location}</span>
              </div>
              {user.bio && (
                <p className="text-charcoal-700 mb-4 leading-relaxed">{user.bio}</p>
              )}
              {user.tags && user.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {user.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-sage-100 text-sage-700 text-sm rounded-full border border-sage-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 text-sm text-charcoal-500">
                <div className="flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4" />
                  <span>Joined {new Date('2024-01-01').toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
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

          {/* Stats */}
          <div className="flex items-center justify-around mt-6 pt-6 border-t border-linen-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-charcoal-800">{posts.length}</div>
              <div className="text-sm text-charcoal-600">Posts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-charcoal-800">{lists.length}</div>
              <div className="text-sm text-charcoal-600">Lists</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-charcoal-800">1.2k</div>
              <div className="text-sm text-charcoal-600">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-charcoal-800">890</div>
              <div className="text-sm text-charcoal-600">Following</div>
            </div>
          </div>
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
              Posts ({posts.length})
            </button>
            <button
              onClick={() => setActiveTab('lists')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold text-base transition-all duration-200 ${
                activeTab === 'lists' 
                  ? 'bg-gradient-to-r from-sage-500 to-gold-500 text-white shadow-liquid transform scale-102' 
                  : 'text-sage-700 hover:text-sage-900 hover:bg-white/60'
              }`}
            >
              Lists ({lists.length})
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            {posts.length > 0 ? (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white/98 backdrop-blur-sm rounded-2xl shadow-botanical border border-linen-200 overflow-hidden"
                >
                  {/* Post Header */}
                  <div className="p-4 border-b border-linen-200">
                    <div className="flex items-center gap-3">
                      <img
                        src={post.userAvatar}
                        alt={post.username}
                        className="w-10 h-10 rounded-full border-2 border-white shadow-soft"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-charcoal-700">{post.username}</span>
                          <span className="text-xs text-charcoal-500">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-charcoal-500">
                          {post.postType === 'loved' && (
                            <span className="flex items-center gap-1 text-red-500">
                              <HeartIconSolid className="w-3 h-3" />
                              Loved
                            </span>
                          )}
                          {post.postType === 'tried' && (
                            <span className="flex items-center gap-1 text-gold-500">
                              <BookmarkIcon className="w-3 h-3" />
                              Tried
                            </span>
                          )}
                          {post.postType === 'want' && (
                            <span className="flex items-center gap-1 text-sage-500">
                              <EyeIcon className="w-3 h-3" />
                              Want to try
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Post Image */}
                  {post.images.length > 0 && (
                    <div className="relative">
                      <img
                        src={post.images[0]}
                        alt="Post"
                        className="w-full h-64 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent"></div>
                    </div>
                  )}

                  {/* Post Content */}
                  <div className="p-4">
                    <p className="text-charcoal-700 mb-4 leading-relaxed">{post.description}</p>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-charcoal-600">
                        <button 
                          onClick={() => handleLikePost(post.id)}
                          className="flex items-center gap-1 hover:text-red-500 transition-colors"
                        >
                          {likedPosts.has(post.id) ? (
                            <HeartIconSolid className="w-5 h-5 text-red-500" />
                          ) : (
                            <HeartIcon className="w-5 h-5" />
                          )}
                          {post.likes + (likedPosts.has(post.id) ? 1 : 0)}
                        </button>
                        <span className="flex items-center gap-1">
                          <BookmarkIcon className="w-5 h-5" />
                          {post.comments?.length || 0}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleSavePost(post.id)}
                        className={`p-2 rounded-full transition-colors ${
                          savedPosts.has(post.id)
                            ? 'bg-sage-100 text-sage-700'
                            : 'bg-sage-50 text-sage-600 hover:bg-sage-100'
                        }`}
                      >
                        {savedPosts.has(post.id) ? (
                          <BookmarkIconSolid className="w-5 h-5" />
                        ) : (
                          <BookmarkIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white/98 backdrop-blur-sm rounded-2xl shadow-botanical border border-linen-200 p-8 text-center">
                <UserIcon className="w-16 h-16 text-charcoal-300 mx-auto mb-4" />
                <p className="text-charcoal-500 mb-2">No posts yet</p>
                <p className="text-sm text-charcoal-400">This user hasn't shared any posts yet.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'lists' && (
          <div className="space-y-4">
            {lists.length > 0 ? (
              lists.map((list) => (
                <div
                  key={list.id}
                  className="bg-white/98 backdrop-blur-sm rounded-2xl shadow-botanical border border-linen-200 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-center gap-4">
                      {list.coverImage && (
                        <img 
                          src={list.coverImage} 
                          alt={list.name} 
                          className="w-20 h-20 rounded-xl object-cover shadow-soft"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-charcoal-700 mb-1">{list.name}</h4>
                        <p className="text-sm text-charcoal-500 mb-2">{list.description}</p>
                        <div className="flex items-center gap-2 mb-2">
                          {list.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-xs px-2 py-1 bg-sage-100 text-sage-700 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm text-charcoal-500">
                            <span>{list.likes} likes</span>
                            <span>Created {new Date(list.createdAt).toLocaleDateString()}</span>
                          </div>
                          <button 
                            onClick={() => handleLikeList(list.id)}
                            className={`p-2 rounded-full transition-colors ${
                              likedLists.has(list.id)
                                ? 'bg-gold-100 text-gold-700'
                                : 'bg-gold-50 text-gold-600 hover:bg-gold-100'
                            }`}
                          >
                            {likedLists.has(list.id) ? (
                              <HeartIconSolid className="w-4 h-4" />
                            ) : (
                              <HeartIcon className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white/98 backdrop-blur-sm rounded-2xl shadow-botanical border border-linen-200 p-8 text-center">
                <BookmarkIcon className="w-16 h-16 text-charcoal-300 mx-auto mb-4" />
                <p className="text-charcoal-500 mb-2">No lists yet</p>
                <p className="text-sm text-charcoal-400">This user hasn't created any lists yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserProfile 