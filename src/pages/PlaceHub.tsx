import type { Hub, Post, List } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, CameraIcon, ChatBubbleLeftIcon, ArrowRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CreatePost from '../components/CreatePost'
import SaveModal from '../components/SaveModal'
import CommentsModal from '../components/CommentsModal'
import ReplyModal from '../components/ReplyModal'
import ShareModal from '../components/ShareModal'
import type { Place } from '../types/index.js'
import { useNavigation } from '../contexts/NavigationContext.tsx'

const mockHub: Hub = {
  id: '1',
  name: 'Blue Bottle Coffee',
  description: 'A cozy spot for coffee lovers and remote workers. Known for its oat milk lattes and minimalist decor.',
  tags: ['coffee', 'cozy', 'work-friendly', 'artisan', 'oakland'],
  images: [
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop',
  ],
  location: {
    address: '300 Webster St, Oakland, CA',
    lat: 37.7749,
    lng: -122.4194,
  },
  googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=300+Webster+St,+Oakland,+CA',
  mainImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
  posts: [], // Will fill below
  lists: [], // Will fill below
}

const mockPosts: Post[] = [
  {
    id: '1',
    hubId: '1',
    userId: '1',
    username: 'Sara Chen',
    userAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    images: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop'],
    description: 'Perfect spot for morning meetings! The oat milk latte is incredible and the atmosphere is so cozy.',
    postType: 'loved',
    createdAt: '2024-01-15T10:30:00Z',
    privacy: 'public',
    listId: '1',
    likes: 12,
    likedBy: ['2'],
    comments: [
      {
        id: '1',
        userId: '2',
        username: 'Alex Rivera',
        userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        text: 'The oat milk latte is amazing! I love the atmosphere here too.',
        createdAt: '2024-01-15T11:00:00Z',
        likes: 3,
        likedBy: ['1'],
        replies: [
          {
            id: '1-1',
            userId: '1',
            username: 'Sara Chen',
            userAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
            text: 'Right? It\'s my go-to spot now!',
            createdAt: '2024-01-15T11:30:00Z',
            likes: 1,
            likedBy: ['2']
          }
        ]
      },
      {
        id: '2',
        userId: '3',
        username: 'Emma Wilson',
        userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        text: 'I need to try this place! How\'s the wifi for working?',
        createdAt: '2024-01-15T12:00:00Z',
        likes: 2,
        likedBy: ['1']
      }
    ],
  },
  {
    id: '2',
    hubId: '1',
    userId: '2',
    username: 'Alex Rivera',
    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    images: ['https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop'],
    description: 'Love the pour-over coffee here. Great place to work remotely.',
    postType: 'tried',
    triedRating: 'liked',
    createdAt: '2024-01-14T15:20:00Z',
    privacy: 'public',
    listId: '2',
    likes: 8,
    likedBy: ['1'],
    comments: [
      {
        id: '3',
        userId: '1',
        username: 'Sara Chen',
        userAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
        text: 'The pour-over is definitely worth the wait!',
        createdAt: '2024-01-14T16:00:00Z',
        likes: 4,
        likedBy: ['2']
      }
    ],
  },
]

mockHub.posts = mockPosts

const PlaceHub = () => {
  const { goBack } = useNavigation()
  const [tab, setTab] = useState<'overview' | 'posts'>('overview')
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [showReplyModal, setShowReplyModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set())
  const hub = mockHub
  const posts = hub.posts
  const navigate = useNavigate()

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

  const handleCreatePost = () => {
    setShowCreatePost(true)
  }

  const handleSaveToPlace = (place: Place) => {
    setSelectedPlace(place)
    setShowSaveModal(true)
  }

  const handleSave = (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
    // In a real app, this would save the place with the selected status
    console.log('Saving place:', { 
      place: selectedPlace, 
      status, 
      rating, 
      listIds, 
      note
    })
    setShowSaveModal(false)
    setSelectedPlace(null)
  }

  const handleCreateList = (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => {
    // In a real app, this would create a new list and save the place to it
    console.log('Creating new list:', listData, 'and saving place:', selectedPlace)
    setShowSaveModal(false)
    setSelectedPlace(null)
  }

  const handleBack = () => {
    goBack()
  }

  const handleShare = () => {
    setShowShareModal(true)
  }

  const handleViewAllLists = () => {
    navigate('/search')
  }

  const handleViewAllFriendsLists = () => {
    navigate('/search')
  }

  const handleReply = (post: Post) => {
    setSelectedPost(post)
    setShowReplyModal(true)
  }

  const handleViewComments = (post: Post) => {
    setSelectedPost(post)
    setShowCommentsModal(true)
  }

  const handleAddComment = async (text: string) => {
    if (!selectedPost) return
    // In a real app, this would make an API call to add a comment
    console.log('Adding comment to post:', selectedPost.id, 'Text:', text)
  }

  const handleLikeComment = async (commentId: string) => {
    // In a real app, this would make an API call to like a comment
    console.log('Liking comment:', commentId)
  }

  const handleReplyToComment = async (commentId: string, text: string) => {
    // In a real app, this would make an API call to reply to a comment
    console.log('Replying to comment:', commentId, 'Text:', text)
  }

  const handlePostReply = async (text: string, images?: string[]) => {
    if (!selectedPost) return
    // In a real app, this would make an API call to create a reply post
    console.log('Creating reply to post:', selectedPost.id, 'Text:', text, 'Images:', images)
  }

  const handleSavePostToList = (post: Post) => {
    // Convert post to place for save modal
    const place: Place = {
      id: post.id,
      name: hub.name,
      address: hub.location.address,
      tags: hub.tags,
      posts: [],
      savedCount: post.likes,
      createdAt: post.createdAt
    }
    handleSaveToPlace(place)
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-cream-50 to-coral-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-cream-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={handleBack}
            className="w-10 h-10 bg-gradient-to-br from-sage-100 to-sage-200 rounded-full flex items-center justify-center shadow-soft hover:shadow-botanical transition"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-sage-600" />
          </button>
          <h1 className="text-xl font-semibold text-sage-800">{hub.name}</h1>
          <button 
            onClick={handleShare}
            className="w-10 h-10 bg-gradient-to-br from-coral-100 to-coral-200 rounded-full flex items-center justify-center shadow-soft hover:shadow-botanical transition"
          >
            <ShareIcon className="w-5 h-5 text-coral-600" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Main Images */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl overflow-hidden shadow-soft border border-cream-200">
          {hub.mainImage && (
            <div className="h-96 bg-gradient-to-br from-cream-200 to-coral-200 relative overflow-hidden">
              <img
                src={hub.mainImage}
                alt={hub.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent backdrop-blur-[1px]" />
              <div className="absolute inset-0 border border-white/20" />
              
              {/* Text overlay with enhanced background for better readability */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
                <h2 className="text-4xl font-bold text-white mb-4 drop-shadow-lg font-serif">{hub.name}</h2>
                <div className="flex items-center text-white text-lg mb-4">
                  <MapPinIcon className="w-6 h-6 mr-3" />
                  {hub.location.address}
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-4 py-2 bg-white/30 backdrop-blur-sm rounded-full text-white text-sm font-semibold border border-white/20">
                    {posts.length} posts
                  </span>
                  <span className="px-4 py-2 bg-white/30 backdrop-blur-sm rounded-full text-white text-sm font-semibold border border-white/20">
                    {hub.tags[0] || 'Popular'}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div className="p-6">
            <p className="text-sage-600 text-sm mb-4">{hub.description}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {hub.tags.map(tag => (
                <span key={tag} className="px-3 py-1 text-xs rounded-full bg-coral-100 text-coral-700 font-medium">#{tag}</span>
              ))}
            </div>
            
            {/* Enhanced Action Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <a 
                href={hub.googleMapsUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-sage-500 to-sage-600 text-white px-4 py-4 rounded-2xl text-sm font-bold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-300 border-2 border-sage-400/20"
              >
                <MapPinIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Directions</span>
                <ArrowRightIcon className="w-4 h-4" />
              </a>
              <button 
                onClick={handleCreatePost}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white px-4 py-4 rounded-2xl text-sm font-bold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-300 border-2 border-gold-400/20"
              >
                <PlusIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Add Post</span>
              </button>
              <button 
                onClick={() => handleSaveToPlace({
                  id: hub.id,
                  name: hub.name,
                  address: hub.location.address,
                  tags: hub.tags,
                  posts: hub.posts,
                  savedCount: 0,
                  createdAt: new Date().toISOString()
                })}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-coral-500 to-coral-600 text-white px-4 py-4 rounded-2xl text-sm font-bold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-300 border-2 border-coral-400/20"
              >
                <BookmarkIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Save</span>
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Tabs with Glass Morphism */}
        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-3 shadow-botanical border border-white/40 mb-8">
          <div className="flex gap-3">
            <button
              className={`flex-1 py-5 px-8 rounded-xl font-bold text-lg transition-all duration-300 ${
                tab === 'overview' 
                  ? 'bg-gradient-to-r from-sage-500 to-gold-500 text-white shadow-liquid transform scale-102 border-2 border-white/20' 
                  : 'text-sage-700 hover:text-sage-900 hover:bg-white/60 hover:shadow-soft border-2 border-transparent'
              }`}
              onClick={() => setTab('overview')}
            >
              Overview
            </button>
            <button
              className={`flex-1 py-5 px-8 rounded-xl font-bold text-lg transition-all duration-300 ${
                tab === 'posts' 
                  ? 'bg-gradient-to-r from-sage-500 to-gold-500 text-white shadow-liquid transform scale-102 border-2 border-white/20' 
                  : 'text-sage-700 hover:text-sage-900 hover:bg-white/60 hover:shadow-soft border-2 border-transparent'
              }`}
              onClick={() => setTab('posts')}
            >
              Posts ({posts.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200">
              <h3 className="text-lg font-semibold text-sage-800 mb-3">What people are saying</h3>
              <div className="italic text-sage-700">"The cold brew here is absolutely divine!"</div>
              {/* TODO: Add real comments */}
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200">
              <h3 className="text-lg font-semibold text-sage-800 mb-3">Popular Lists</h3>
              <div className="italic text-sage-700">Book Nooks, All Loved, SF Coffee Tour...</div>
              <button 
                onClick={handleViewAllLists}
                className="mt-2 text-sage-700 hover:underline text-sm font-medium"
              >
                See All
              </button>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200">
              <h3 className="text-lg font-semibold text-sage-800 mb-3">Friends' Lists</h3>
              <div className="italic text-sage-700">Emma's Favorites, Mika's Coffee Spots...</div>
              <button 
                onClick={handleViewAllFriendsLists}
                className="mt-2 text-sage-700 hover:underline text-sm font-medium"
              >
                See All
              </button>
            </div>
          </div>
        )}
        {tab === 'posts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-sage-800">Posts</h3>
              <button 
                onClick={handleCreatePost}
                className="bg-gradient-to-r from-coral-500 to-coral-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-coral-600 hover:to-coral-700 transition-all duration-300 shadow-soft"
              >
                <PlusIcon className="w-4 h-4 mr-1 inline" />
                Add Post
              </button>
            </div>
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-botanical border border-white/30 hover:shadow-liquid hover:scale-[1.01] transition-all duration-300"
              >
                <div className="flex items-start space-x-4 mb-4">
                  <div className="w-12 h-12 rounded-full border-3 border-white/50 bg-white/80 backdrop-blur-sm relative overflow-hidden shadow-soft">
                    <img
                      src={post.userAvatar}
                      alt={post.username}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border border-white/40 rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-1">
                      <span className="font-semibold text-sage-800 text-lg">{post.username}</span>
                      <span className="px-2 py-1 bg-sage-100 text-sage-700 text-xs rounded-full font-medium">
                        {post.postType}
                      </span>
                    </div>
                    <p className="text-sm text-sage-500">
                      {new Date(post.createdAt).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                {post.images && post.images[0] && (
                  <div className="mb-4 relative overflow-hidden rounded-2xl shadow-botanical">
                    <img
                      src={post.images[0]}
                      alt="Post"
                      className="w-full h-56 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent"></div>
                    <div className="absolute inset-0 border border-white/30 rounded-2xl"></div>
                  </div>
                )}
                <p className="text-sage-700 mb-4 text-base leading-relaxed">{post.description}</p>
                <div className="flex items-center justify-between pt-4 border-t border-sage-100">
                  <div className="flex items-center space-x-6 text-sm">
                    <button 
                      onClick={() => handleLikePost(post.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 ${
                        likedPosts.has(post.id) 
                          ? 'text-coral-600 bg-coral-50 shadow-soft' 
                          : 'text-sage-600 hover:text-coral-600 hover:bg-sage-50'
                      }`}
                    >
                      <HeartIcon className={`w-5 h-5 ${likedPosts.has(post.id) ? 'fill-current' : ''}`} />
                      <span className="font-medium">{post.likes + (likedPosts.has(post.id) ? 1 : 0)}</span>
                    </button>
                    <button 
                      onClick={() => handleViewComments(post)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sage-600 hover:text-coral-600 hover:bg-sage-50 transition-all duration-200"
                    >
                      <ChatBubbleLeftIcon className="w-5 h-5" />
                      <span className="font-medium">{post.comments?.length || 0}</span>
                    </button>
                    <button 
                      onClick={() => handleReply(post)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sage-600 hover:text-coral-600 hover:bg-sage-50 transition-all duration-200"
                    >
                      <ShareIcon className="w-5 h-5" />
                      <span className="font-medium">Reply</span>
                    </button>
                  </div>
                  <button 
                    onClick={() => handleSavePostToList(post)}
                    className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                      savedPosts.has(post.id) 
                        ? 'bg-coral-100 text-coral-700 shadow-soft' 
                        : 'text-coral-600 hover:bg-coral-50'
                    }`}
                  >
                    {savedPosts.has(post.id) ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
            {posts.length === 0 && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 text-center shadow-soft border border-cream-200">
                <CameraIcon className="w-16 h-16 text-sage-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-sage-800 mb-2">No posts yet</h3>
                <p className="text-sage-700">Be the first to share your experience at this hub!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreatePost
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        preSelectedHub={{
          id: hub.id,
          name: hub.name,
          address: hub.location.address,
          description: hub.description,
          lat: hub.location.lat,
          lng: hub.location.lng
        }}
      />

      {selectedPlace && (
        <SaveModal
          isOpen={showSaveModal}
          onClose={() => {
            setShowSaveModal(false)
            setSelectedPlace(null)
          }}
          place={selectedPlace}
          userLists={[]} // TODO: Add real user lists
          onSave={handleSave}
          onCreateList={handleCreateList}
        />
      )}

      {/* Comments Modal */}
      {selectedPost && (
        <CommentsModal
          isOpen={showCommentsModal}
          onClose={() => {
            setShowCommentsModal(false)
            setSelectedPost(null)
          }}
          postId={selectedPost.id}
          postTitle={`${selectedPost.username}'s post about ${hub.name}`}
          comments={selectedPost.comments || []}
          onAddComment={handleAddComment}
          onLikeComment={handleLikeComment}
          onReplyToComment={handleReplyToComment}
          currentUserId="1" // TODO: Get from auth context
        />
      )}

      {/* Reply Modal */}
      {selectedPost && (
        <ReplyModal
          isOpen={showReplyModal}
          onClose={() => {
            setShowReplyModal(false)
            setSelectedPost(null)
          }}
          postId={selectedPost.id}
          postAuthor={selectedPost.username}
          postContent={selectedPost.description}
          postImage={selectedPost.images?.[0]}
          onReply={handlePostReply}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={hub.name}
        description={hub.description}
        url={window.location.href}
        image={hub.mainImage}
        type="place"
      />
    </div>
  )
}

export default PlaceHub 