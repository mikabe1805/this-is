import type { Hub, Post, List } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, CameraIcon, ChatBubbleLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

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
    comments: [],
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
    comments: [],
  },
]

mockHub.posts = mockPosts

const PlaceHub = () => {
  const [tab, setTab] = useState<'overview' | 'posts'>('overview')
  const hub = mockHub
  const posts = hub.posts

  return (
    <div className="min-h-full bg-gradient-to-br from-cream-50 to-coral-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-cream-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-sage-800">{hub.name}</h1>
          <div className="flex items-center space-x-2">
            <button className="w-10 h-10 bg-gradient-to-br from-coral-100 to-coral-200 rounded-full flex items-center justify-center shadow-soft">
              <ShareIcon className="w-5 h-5 text-coral-600" />
            </button>
            <a href={hub.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gradient-to-br from-sage-100 to-sage-200 rounded-full flex items-center justify-center shadow-soft">
              <ArrowRightIcon className="w-5 h-5 text-sage-600" />
            </a>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Main Images */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl overflow-hidden shadow-soft border border-cream-200">
          {hub.mainImage && (
            <div className="h-48 bg-gradient-to-br from-cream-200 to-coral-200 relative overflow-hidden">
              <img
                src={hub.mainImage}
                alt={hub.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/5 to-transparent backdrop-blur-[1px]" />
              <div className="absolute inset-0 border border-white/20" />
            </div>
          )}
          <div className="p-6">
            <h2 className="text-2xl font-bold text-sage-800 mb-2">{hub.name}</h2>
            <div className="flex items-center text-sage-600 text-sm mb-3">
              <MapPinIcon className="w-4 h-4 mr-1" />
              {hub.location.address}
            </div>
            <p className="text-sage-600 text-sm mb-4">{hub.description}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {hub.tags.map(tag => (
                <span key={tag} className="px-3 py-1 text-xs rounded-full bg-coral-100 text-coral-700 font-medium">#{tag}</span>
              ))}
            </div>
            <a href={hub.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-block bg-sage-400 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-soft hover:bg-sage-500 transition">
              Directions
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 py-2 rounded-xl font-semibold transition-all duration-200 ${tab === 'overview' ? 'bg-sage-400 text-white shadow-botanical' : 'bg-white text-sage-700 border border-sage-200'}`}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            className={`flex-1 py-2 rounded-xl font-semibold transition-all duration-200 ${tab === 'posts' ? 'bg-sage-400 text-white shadow-botanical' : 'bg-white text-sage-700 border border-sage-200'}`}
            onClick={() => setTab('posts')}
          >
            Posts
          </button>
        </div>

        {/* Tab Content */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* TODO: User comments, popular lists, friends' lists, see all/search/filter */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200">
              <h3 className="text-lg font-semibold text-sage-800 mb-3">What people are saying</h3>
              <div className="italic text-sage-700">"The cold brew here is absolutely divine!"</div>
              {/* TODO: Add real comments */}
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200">
              <h3 className="text-lg font-semibold text-sage-800 mb-3">Popular Lists</h3>
              <div className="italic text-sage-700">Book Nooks, All Loved, SF Coffee Tour...</div>
              <button className="mt-2 text-sage-700 hover:underline text-sm font-medium">See All</button>
              {/* TODO: Add real lists and see all/search/filter */}
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200">
              <h3 className="text-lg font-semibold text-sage-800 mb-3">Friends' Lists</h3>
              <div className="italic text-sage-700">Emma's Favorites, Mika's Coffee Spots...</div>
              <button className="mt-2 text-sage-700 hover:underline text-sm font-medium">See All</button>
              {/* TODO: Add real friends' lists and see all/search/filter */}
            </div>
          </div>
        )}
        {tab === 'posts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-sage-800">Posts</h3>
              <button className="bg-gradient-to-r from-coral-500 to-coral-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-coral-600 hover:to-coral-700 transition-all duration-300 shadow-soft">
                <PlusIcon className="w-4 h-4 mr-1 inline" />
                Add Post
              </button>
            </div>
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200 hover:shadow-liquid transition-all duration-300"
              >
                <div className="flex items-start space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-full border-2 border-cream-200 bg-cream-50/80 backdrop-blur-sm relative overflow-hidden">
                    <img
                      src={post.userAvatar}
                      alt={post.username}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border border-white/30 rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sage-800">{post.username}</span>
                    </div>
                    <p className="text-xs text-sage-500">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {post.images && post.images[0] && (
                  <div className="mb-3 relative overflow-hidden rounded-xl">
                    <img
                      src={post.images[0]}
                      alt="Post"
                      className="w-full h-48 object-cover rounded-xl shadow-soft"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent backdrop-blur-[1px]"></div>
                    <div className="absolute inset-0 border border-white/20 rounded-xl"></div>
                  </div>
                )}
                <p className="text-sage-700 mb-3">{post.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-sage-600">
                    <button className="flex items-center hover:text-coral-600 transition-colors">
                      <HeartIcon className="w-4 h-4 mr-1" />
                      {post.likes}
                    </button>
                    <button className="flex items-center hover:text-coral-600 transition-colors">
                      <ChatBubbleLeftIcon className="w-4 h-4 mr-1" />
                      Reply
                    </button>
                  </div>
                  <button className="text-coral-600 hover:text-coral-700 text-sm font-medium transition-colors">
                    Save
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
    </div>
  )
}

export default PlaceHub 