import type { Hub, Post, List } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, CameraIcon, ChatBubbleLeftIcon, XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { createPortal } from 'react-dom'

interface HubModalProps {
  hub: Hub
  isOpen: boolean
  onClose: () => void
}

const HubModal = ({ hub, isOpen, onClose }: HubModalProps) => {
  const [tab, setTab] = useState<'overview' | 'posts'>('overview')
  const [posts] = useState<Post[]>(hub.posts || [])
  const [lists] = useState<List[]>(hub.lists || [])
  const [commentInput, setCommentInput] = useState('')
  const [comments, setComments] = useState([
    { id: 1, user: { name: 'Emma', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face' }, text: 'Love this spot! The atmosphere is amazing 🌟', date: '2d ago' },
    { id: 2, user: { name: 'Alex', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face' }, text: 'Perfect for working remotely. Great coffee too!', date: '5d ago' },
  ])

  if (!isOpen) return null

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

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-botanical border border-linen-200 overflow-hidden">
        {/* Header with action buttons */}
        <div className="relative h-48 bg-gradient-to-br from-cream-200 to-coral-200 overflow-hidden">
          {hub.mainImage && (
            <img
              src={hub.mainImage}
              alt={hub.name}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent" />
          
          {/* Top action buttons */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-soft hover:shadow-botanical transition-all duration-200">
                <ShareIcon className="w-5 h-5 text-charcoal-600" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-soft hover:shadow-botanical transition-all duration-200"
              >
                <XMarkIcon className="w-6 h-6 text-charcoal-600" />
              </button>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-2xl font-serif font-bold text-white mb-2 drop-shadow-lg">{hub.name}</h1>
            <div className="flex items-center text-white/90 text-sm drop-shadow-md">
              <MapPinIcon className="w-4 h-4 mr-1" />
              {hub.location.address}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-12rem)] overflow-y-auto">
          {/* Description and tags */}
          <div>
            <p className="text-charcoal-700 mb-4 leading-relaxed">{hub.description}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {hub.tags.map(tag => (
                <span key={tag} className="px-3 py-1 text-xs rounded-full bg-sage-50 border border-sage-100 text-sage-700 font-medium">
                  #{tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <a 
                href={hub.googleMapsUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 bg-sage-400 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-soft hover:bg-sage-500 transition"
              >
                <MapPinIcon className="w-4 h-4" />
                Directions
                <ArrowRightIcon className="w-4 h-4" />
              </a>
              <button className="inline-flex items-center gap-2 bg-gold-400 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-soft hover:bg-gold-500 transition">
                <PlusIcon className="w-4 h-4" />
                Add Post
              </button>
              <button className="inline-flex items-center gap-2 bg-sage-400 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-soft hover:bg-sage-500 transition">
                <BookmarkIcon className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-linen-50 rounded-xl p-1">
            <button
              onClick={() => setTab('overview')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
                tab === 'overview'
                  ? 'bg-white text-sage-700 shadow-soft'
                  : 'text-charcoal-500 hover:text-sage-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setTab('posts')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
                tab === 'posts'
                  ? 'bg-white text-sage-700 shadow-soft'
                  : 'text-charcoal-500 hover:text-sage-700'
              }`}
            >
              Posts ({posts.length})
            </button>
          </div>

          {/* Tab content */}
          {tab === 'overview' && (
            <div className="space-y-4">
              {/* Popular Lists */}
              <div className="bg-linen-50 rounded-2xl p-4">
                <h3 className="text-lg font-serif font-semibold text-charcoal-700 mb-3">Popular Lists</h3>
                {lists.length > 0 ? (
                  <div className="space-y-3">
                    {lists.slice(0, 3).map((list) => (
                      <div key={list.id} className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-soft">
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
              <div className="bg-linen-50 rounded-2xl p-4">
                <h3 className="text-lg font-serif font-semibold text-charcoal-700 mb-3">Friends' Lists</h3>
                <div className="italic text-charcoal-500">Emma's Favorites, Mika's Coffee Spots...</div>
                <button className="mt-3 text-sage-700 hover:underline text-sm font-medium">See All</button>
              </div>

              {/* Comments Section */}
              <div className="bg-linen-50 rounded-2xl p-4">
                <h3 className="text-lg font-serif font-semibold text-charcoal-700 mb-4">Comments</h3>
                <div className="space-y-4 mb-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-4 p-3 bg-white rounded-xl shadow-soft">
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
                <form onSubmit={handleAddComment} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-linen-200">
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
                    className="bg-linen-50 rounded-2xl p-4 shadow-soft border border-linen-200"
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
                      <div className="mb-3 relative overflow-hidden rounded-xl">
                        <img
                          src={post.images[0]}
                          alt="Post"
                          className="w-full h-48 object-cover rounded-xl shadow-soft"
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
                <div className="bg-linen-50 rounded-2xl p-8 text-center shadow-soft border border-linen-200">
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