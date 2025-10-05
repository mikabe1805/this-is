import type { Hub, Post, List } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, CameraIcon, ChatBubbleLeftIcon, ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CreatePost from '../components/CreatePost'
import SaveModal from '../components/SaveModal'
import CommentsModal from '../components/CommentsModal'
import ReplyModal from '../components/ReplyModal'
import ShareModal from '../components/ShareModal'
import type { Place } from '../types/index.js'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useAuth } from '../contexts/AuthContext.tsx'
import { firebaseDataService } from '../services/firebaseDataService.js'
import { PageHeader } from '../components/primitives/PageHeader'
import { ActionBar } from '../components/primitives/ActionBar'
import { CardShell } from '../components/primitives/CardShell'

const PlaceHub = () => {
  const { goBack } = useNavigation()
  const { currentUser: authUser } = useAuth()
  const { id } = useParams<{ id: string }>()
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
  const [postSearch, setPostSearch] = useState('')
  
  // Real data state
  const [hub, setHub] = useState<Hub | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [userLists, setUserLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // Load real hub data from Firebase
  useEffect(() => {
    if (!id) {
      setError('No place ID provided');
      setLoading(false);
      return;
    }

    const loadHubData = async () => {
      try {
        setLoading(true)
        setError('')
        
        // Get place data from Firebase
        const place = await firebaseDataService.getPlace(id)
        if (!place) {
          setError('Place not found')
          setLoading(false)
          return
        }

        // Convert Place to Hub format for display
        const hubData: Hub = {
          id: place.id,
          name: place.name,
          description: `Discover ${place.name}, a ${place.category || 'great'} place in ${place.address}`,
          tags: place.tags,
          images: (place as any).mainImage ? [(place as any).mainImage] : [],
          location: {
            address: place.address,
            lat: place.coordinates?.lat || 0,
            lng: place.coordinates?.lng || 0,
          },
          googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.address)}`,
          mainImage: (place as any).mainImage || '',
          posts: [],
          lists: [],
        }
        
        setHub(hubData)
        setPosts(place.posts || [])
      } catch (error) {
        console.error('Error loading hub data:', error)
        setError('Failed to load place data')
      } finally {
        setLoading(false)
      }
    }

    loadHubData()
  }, [id])

  useEffect(() => {
    const fetchUserLists = async () => {
      if (authUser) {
        const lists = await firebaseDataService.getUserLists(authUser.id);
        setUserLists(lists);
      }
    };
    fetchUserLists();
  }, [authUser]);

  const handleLikePost = async (postId: string) => {
    setLikedPosts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) newSet.delete(postId)
      else newSet.add(postId)
      return newSet
    })
    try {
      if (authUser) await firebaseDataService.likePost(postId, authUser.id)
      setPosts(ps => ps.map(p => p.id === postId ? {
        ...p,
        likes: (p.likes || 0) + (likedPosts.has(postId) ? -1 : 1),
        likedBy: likedPosts.has(postId)
          ? (p.likedBy || []).filter(id => id !== authUser?.id)
          : ([...(p.likedBy || []), authUser?.id].filter(Boolean) as string[])
      } : p))
    } catch (e) {
      console.warn('Failed to like post', e)
    }
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

  const handleSave = async (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
    if (!selectedPlace || !authUser) return;

    try {
      const ids = Array.isArray(listIds) ? listIds : []
      const already: string[] = []
      for (const lid of ids) {
        if (await firebaseDataService.isPlaceInList(lid, selectedPlace.id)) already.push(lid)
      }
      if (already.length > 0) {
        const names = userLists.filter(l=>already.includes(l.id)).map(l=>l.name).join(', ')
        const overwrite = window.confirm(`You've already saved this hub to the following lists: ${names}.\nWould you like to overwrite your previous save?`)
        if (!overwrite) return
      }

      if (ids.length > 0) {
        await Promise.all(
          ids.map(listId =>
            firebaseDataService.savePlaceToList(selectedPlace.id, listId, authUser.id, note, undefined, status, rating)
          )
        )
      }

      await firebaseDataService.saveToAutoList(selectedPlace.id, authUser.id, status, note, rating)
    } catch (e) {
      console.error('Error saving place:', e)
    }

    setShowSaveModal(false)
    setSelectedPlace(null)
  }

  const handleCreateList = async (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => {
    if (!selectedPlace || !authUser) return;
    
    const newListId = await firebaseDataService.createList({
      ...listData,
      tags: listData.tags || [],
      userId: authUser.id,
    });

    if (newListId) {
      await firebaseDataService.savePlaceToList(selectedPlace.id, newListId, authUser.id, undefined, undefined, 'loved'); // Default to loved status
      // Refresh user lists
      const lists = await firebaseDataService.getUserLists(authUser.id);
      setUserLists(lists);
    }

    setShowSaveModal(false)
    setSelectedPlace(null)
  }

  const handleBack = () => {
    goBack()
  }


  const handleViewAllLists = () => {
    if (id) {
      navigate(`/lists?type=popular&hub=${encodeURIComponent(id)}`)
    } else {
      navigate('/lists?type=popular')
    }
  }

  // (friends lists navigation handler removed as unused)

  const filteredPosts = postSearch.trim()
    ? posts.filter(p => (
        (p.description || '').toLowerCase().includes(postSearch.toLowerCase()) ||
        (p.username || '').toLowerCase().includes(postSearch.toLowerCase()) ||
        (Array.isArray((p as any).tags) && ((p as any).tags as string[]).some(t => t.toLowerCase().includes(postSearch.toLowerCase())))
      ))
    : posts

  const handleReply = (post: Post) => {
    setSelectedPost(post)
    setShowReplyModal(true)
  }

  const handleViewComments = async (post: Post) => {
    setSelectedPost(post)
    setShowCommentsModal(true)
    try {
      const comments = await firebaseDataService.getCommentsForPost(post.id)
      setSelectedPost(prev => prev ? { ...prev, comments } as Post : prev)
    } catch (e) {
      console.warn('Failed to load comments', e)
    }
  }

  const handleAddComment = async (text: string) => {
    if (!selectedPost || !authUser) return
    const created = await firebaseDataService.postComment(selectedPost.id, authUser.id, text)
    if (created) {
      setSelectedPost(prev => prev ? { ...prev, comments: [created, ...(prev.comments || [])] } as Post : prev)
    }
  }

  const handleLikeComment = async (commentId: string) => {
    if (!selectedPost || !authUser) return
    await firebaseDataService.likeComment(selectedPost.id, commentId, authUser.id)
    setSelectedPost(prev => {
      if (!prev) return prev
      const updated = (prev.comments || []).map(c => c.id === commentId ? {
        ...c,
        likes: (c.likes || 0) + ((c.likedBy || []).includes(authUser.id) ? -1 : 1),
        likedBy: (c.likedBy || []).includes(authUser.id)
          ? (c.likedBy || []).filter(id => id !== authUser.id)
          : ([...(c.likedBy || []), authUser.id])
      } : c)
      return { ...prev, comments: updated } as Post
    })
  }

  const handleReplyToComment = async (commentId: string, text: string) => {
    if (!selectedPost || !authUser) return
    const reply = await firebaseDataService.addReplyToComment(selectedPost.id, commentId, authUser.id, text)
    if (reply) {
      setSelectedPost(prev => {
        if (!prev) return prev
        const updated = (prev.comments || []).map(c => c.id === commentId ? {
          ...c,
          replies: [...(c.replies || []), reply]
        } : c)
        return { ...prev, comments: updated } as Post
      })
    }
  }

  const handlePostReply = async (text: string, images?: string[]) => {
    if (!selectedPost) return
    // In a real app, this would make an API call to create a reply post
    console.log('Creating reply to post:', selectedPost.id, 'Text:', text, 'Images:', images)
  }

  // (save post to list handler removed as unused)

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FEF6E9] via-[#FBF0D9] to-[#F7E8CC] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-[#E17373] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-[#8B7355] text-lg">Loading place details...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FEF6E9] via-[#FBF0D9] to-[#F7E8CC] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <button 
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-[#E17373] text-white rounded-lg hover:bg-[#D55F5F] transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // No hub data
  if (!hub) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FEF6E9] via-[#FBF0D9] to-[#F7E8CC] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#8B7355] text-lg mb-4">Place not found</p>
          <button 
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-[#E17373] text-white rounded-lg hover:bg-[#D55F5F] transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-[#FEF6E9] via-[#FBF0D9] to-[#F7E8CC] relative overflow-hidden overflow-x-hidden">
      {/* Botanical Accents - Matching HubModal Style */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Primary climbing vine - larger and warmer */}
        <div className="absolute bottom-0 left-0 h-full w-12 sm:w-14 md:w-16 pointer-events-none">
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute bottom-0 left-0 h-full w-full object-contain opacity-8 sm:opacity-10 pointer-events-none blur-[0.5px] sm:blur-[0.3px]"
            style={{
              transform: 'scaleY(1.2) translateY(-12%) rotate(-5deg)',
              filter: 'brightness(0.8) contrast(0.9) saturate(1.1) hue-rotate(5deg)'
            }}
          />
        </div>
        
        {/* Secondary vine - positioned to avoid overlap */}
        <div className="absolute top-56 sm:top-64 right-0 h-[calc(100%-14rem)] sm:h-[calc(100%-16rem)] w-8 sm:w-10 md:w-12 pointer-events-none">
          <img
            src="/assets/leaf2.png"
            alt=""
            className="absolute top-0 right-0 h-full w-full object-contain opacity-6 sm:opacity-8 pointer-events-none blur-[0.4px] sm:blur-[0.2px]"
            style={{
              transform: 'scaleY(1.1) translateY(-8%) rotate(8deg)',
              filter: 'brightness(0.9) contrast(0.8) saturate(1.0) hue-rotate(-3deg)'
            }}
          />
        </div>
        
        {/* Connected Leaf Clusters - Cozy and Intertwined */}
        <img
          src="/assets/leaf2.png"
          alt=""
          className="absolute top-6 sm:top-8 md:top-10 left-4 sm:left-6 md:left-8 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-18 lg:h-18 opacity-15 sm:opacity-18 md:opacity-20 pointer-events-none blur-[0.3px] sm:blur-[0.2px]"
          style={{
            transform: 'rotate(-25deg) scale(0.8)',
            filter: 'brightness(0.9) contrast(0.9) saturate(1.1) hue-rotate(8deg)'
          }}
        />
        
        <img
          src="/assets/leaf2.png"
          alt=""
          className="absolute top-8 sm:top-10 md:top-12 left-6 sm:left-8 md:left-10 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 opacity-12 sm:opacity-15 md:opacity-18 pointer-events-none blur-[0.4px] sm:blur-[0.3px]"
          style={{
            transform: 'rotate(15deg) scale(0.7)',
            filter: 'brightness(1.0) contrast(0.8) saturate(1.0) hue-rotate(-5deg)'
          }}
        />
        
        <img
          src="/assets/leaf2.png"
          alt=""
          className="absolute top-44 sm:top-48 md:top-52 left-3 sm:left-4 w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 lg:w-20 lg:h-20 opacity-12 sm:opacity-15 md:opacity-18 pointer-events-none blur-[0.4px] sm:blur-[0.3px]"
          style={{
            transform: 'rotate(35deg) scale(0.9)',
            filter: 'brightness(1.0) contrast(0.8) saturate(1.0) hue-rotate(-5deg)'
          }}
        />
        
        <img
          src="/assets/leaf2.png"
          alt=""
          className="absolute bottom-4 sm:bottom-6 md:bottom-8 right-3 sm:right-4 md:right-6 w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 lg:w-22 lg:h-22 opacity-15 sm:opacity-17 md:opacity-20 pointer-events-none blur-[0.4px] sm:blur-[0.3px]"
          style={{
            transform: 'rotate(45deg) scale(1.0)',
            filter: 'brightness(0.9) contrast(0.9) saturate(1.1) hue-rotate(6deg)'
          }}
        />
      </div>
      {/* Header */}
      <PageHeader
        coverUrl={hub?.mainImage}
        title={hub?.name || ''}
        subtitle={hub?.location?.address}
        rightActions={
          <button 
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1)
              } else {
                handleBack()
              }
            }}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-white" />
          </button>
        }
      />

      <div className="relative z-10 p-4 space-y-4 max-w-2xl mx-auto pb-24">
        {/* About Section */}
        <CardShell variant="solid" className="p-6">
          <h2 className="text-2xl font-serif font-bold text-bark-900 mb-4">{hub.name}</h2>
          <p className="text-bark-600 text-sm mb-4 leading-relaxed">{hub?.description || ''}</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {(hub?.tags || []).map(tag => (
              <span key={tag} className="px-3 py-1 text-xs rounded-full bg-moss-100 text-moss-700 font-medium border border-moss-200">#{tag}</span>
            ))}
          </div>
        </CardShell>

        {/* Tabs */}
        <CardShell variant="solid" className="p-2">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('overview')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-300 ${
                tab === 'overview' 
                  ? 'bg-moss-500 text-white shadow-soft' 
                  : 'text-bark-700 bg-bark-100 hover:bg-bark-200'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setTab('posts')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-300 ${
                tab === 'posts' 
                  ? 'bg-moss-500 text-white shadow-soft' 
                  : 'text-bark-700 bg-bark-100 hover:bg-bark-200'
              }`}
            >
              Posts ({posts.length})
            </button>
          </div>
        </CardShell>

        {/* Tab Content */}
        {tab === 'overview' && (
          <div className="space-y-4 pb-6">
            {/* Popular Lists */}
            <CardShell variant="solid" className="p-4">
              <h3 className="text-lg font-semibold text-bark-900 mb-3">Lists Featuring This Place</h3>
              {hub.lists && hub.lists.length > 0 ? (
                <div className="space-y-2">
                  {hub.lists.slice(0, 3).map(list => (
                    <div key={list.id} className="text-bark-600 text-sm">- {list.name}</div>
                  ))}
                </div>
              ) : (
                <div className="italic text-bark-500 text-sm">No public lists feature this place yet.</div>
              )}
              <button 
                onClick={handleViewAllLists}
                className="mt-3 text-moss-600 text-sm font-medium hover:text-moss-700"
              >
                See All
              </button>
            </CardShell>

            {/* Comments Section */}
            <CardShell variant="solid" className="p-4">
              <h3 className="text-lg font-semibold text-bark-900 mb-4">What people are saying</h3>
              <div className="italic text-bark-600 text-sm">"The cold brew here is absolutely divine!"</div>
              {/* TODO: Add real comments */}
            </CardShell>
          </div>
        )}
        {tab === 'posts' && (
          <div className="space-y-4 pb-6">
            <div className="mb-3">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#8B7355]" />
                <input
                  type="text"
                  value={postSearch}
                  onChange={(e) => setPostSearch(e.target.value)}
                  placeholder={`Search posts in ${hub.name}...`}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#E4D5C7] bg-[#FEF6E9] text-[#6B5B47] focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300"
                />
              </div>
            </div>
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
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
                    <p className="text-xs text-[#8B7355] font-serif">{require('../utils/dateUtils').formatTimestamp(post.createdAt)}</p>
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
                <p className="text-sm text-[#7A5D3F] mb-3 leading-relaxed">{post.description}</p>
                
                {/* Post Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleLikePost(post.id)}
                      className={`flex items-center space-x-1 ${
                        likedPosts.has(post.id) ? 'text-[#C17F59]' : 'text-[#8B7355]'
                      } hover:text-[#C17F59] transition-colors`}
                    >
                      <HeartIcon className={`w-5 h-5 ${likedPosts.has(post.id) ? 'fill-current' : ''}`} />
                      <span className="text-sm font-medium">{post.likes}</span>
                    </button>
                    <button
                      onClick={() => handleViewComments(post)}
                      className="flex items-center space-x-1 text-[#8B7355] hover:text-[#7A5D3F] transition-colors"
                    >
                      <ChatBubbleLeftIcon className="w-5 h-5" />
                      <span className="text-sm font-medium">{post.comments?.length || 0}</span>
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleSavePost(post.id)}
                      className={`p-2 rounded-full ${
                        savedPosts.has(post.id) ? 'bg-[#B08968]/25 text-[#B08968]' : 'bg-[#E8D4C0]/50 text-[#8B7355]'
                      } hover:bg-[#B08968]/35 transition-colors`}
                    >
                      <BookmarkIcon className={`w-4 h-4 ${savedPosts.has(post.id) ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleReply(post)}
                      className="p-2 rounded-full bg-[#E8D4C0]/50 text-[#8B7355] hover:bg-[#E8D4C0]/70 transition-colors"
                    >
                      <ShareIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#E8D4C0]/50 flex items-center justify-center">
                  <CameraIcon className="w-8 h-8 text-[#8B7355]" />
                </div>
                <h3 className="text-lg font-serif font-semibold text-[#6B5B47] mb-2">{postSearch ? 'No posts found' : 'No posts yet'}</h3>
                <p className="text-[#7A5D3F] mb-4">{postSearch ? 'Try a different search.' : 'Be the first to share your experience!'}</p>
                <button
                  onClick={handleCreatePost}
                  className="bg-gradient-to-r from-[#D4A574] to-[#B08968] text-[#FEF6E9] px-4 py-2 rounded-xl text-sm font-semibold shadow-lg border border-[#B08968]/30 active:scale-95 transition-all duration-200"
                >
                  <PlusIcon className="w-4 h-4 mr-1 inline" />
                  Add Post
                </button>
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
          userLists={userLists}
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
          comments={selectedPost.comments || []}
          onAddComment={handleAddComment}
          onLikeComment={handleLikeComment}
          onReplyToComment={handleReplyToComment}
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

      {/* Action Bar */}
      <ActionBar
        primary={
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
            className="w-full bg-moss-500 text-white py-3 px-4 rounded-xl font-semibold hover:bg-moss-600 transition-colors"
          >
            Save
          </button>
        }
        secondary={[
          <button
            key="add-post"
            onClick={handleCreatePost}
            className="flex items-center justify-center gap-2 bg-bark-100 text-bark-700 py-3 px-4 rounded-xl font-medium hover:bg-bark-200 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Post
          </button>,
          <a
            key="directions"
            href={hub.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-bark-100 text-bark-700 py-3 px-4 rounded-xl font-medium hover:bg-bark-200 transition-colors"
          >
            <MapPinIcon className="w-4 h-4" />
            Directions
          </a>
        ]}
      />
    </div>
  )
}

export default PlaceHub 