import type { List, ListPlace, Hub } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, ShareIcon, EllipsisHorizontalIcon, ArrowLeftIcon, StarIcon, MapIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import HubModal from '../components/HubModal'
import PlusDropdown from '../components/PlusDropdown'
import HubSearchModal from '../components/HubSearchModal'
import SaveModal from '../components/SaveModal'
import CreatePost from '../components/CreatePost'

const ListView = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  // TODO: Fetch real list data by id
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null)
  const [showHubModal, setShowHubModal] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null)
  const [showHubSearchModal, setShowHubSearchModal] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [hubToSave, setHubToSave] = useState<Hub | null>(null)
  
  // Scroll to top when component mounts or when id changes
  useEffect(() => {
    // Force scroll to top with multiple methods
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      if (document.documentElement) {
        document.documentElement.scrollTop = 0
      }
      if (document.body) {
        document.body.scrollTop = 0
      }
    }
    
    // Try immediately
    scrollToTop()
    
    // Try after DOM is ready
    requestAnimationFrame(scrollToTop)
    
    // Try after a short delay
    const timer = setTimeout(scrollToTop, 100)
    
    return () => clearTimeout(timer)
  }, [id])
  
  // Mock user lists for save modal
  const userLists: List[] = [
    {
      id: '1',
      name: 'Cozy Coffee Spots',
      description: 'Perfect places to work and relax',
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
    },
    {
      id: '2',
      name: 'Book Nooks',
      description: 'Quiet places to read and study',
      userId: '1',
      isPublic: true,
      isShared: false,
      privacy: 'public',
      tags: ['books', 'quiet', 'study'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&h=200&fit=crop',
      createdAt: '2024-01-12',
      updatedAt: '2024-01-14',
      likes: 34,
      isLiked: false
    }
  ]

  // Mock list data
  const list: List = {
    id: '1',
    name: 'Cozy Coffee Spots',
    description: 'Perfect places to work and relax with great coffee and atmosphere',
    userId: '1',
    isPublic: true,
    isShared: false,
    tags: ['coffee', 'work-friendly', 'cozy', 'oakland'],
    coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=200&fit=crop',
    places: [],
    createdAt: '2024-01-10',
    updatedAt: '2024-01-15',
    likes: 67,
    isLiked: false
  }

  const listPlaces: (ListPlace & { status: 'want' | 'tried' | 'loved', feeling?: 'amazing' | 'good' | 'okay' | 'disappointing' })[] = [
    {
      id: '1',
      placeId: '1',
      place: {
        id: '1',
        name: 'Blue Bottle Coffee',
        address: '300 Webster St, Oakland, CA',
        tags: ['coffee', 'cozy', 'work-friendly'],
        posts: [],
        savedCount: 45,
        createdAt: '2024-01-15',
        hubImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop'
      },
      note: 'Perfect spot for morning meetings. Great oat milk lattes!',
      addedBy: '1',
      addedAt: '2024-01-15T10:30:00Z',
      status: 'loved',
      feeling: 'amazing'
    },
    {
      id: '2',
      placeId: '2',
      place: {
        id: '2',
        name: 'Souvenir Coffee',
        address: '1500 Webster St, Oakland, CA',
        tags: ['coffee', 'artisan', 'quiet'],
        posts: [],
        savedCount: 32,
        createdAt: '2024-01-14',
        hubImage: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=200&fit=crop'
      },
      note: 'Hidden gem with amazing pour-over coffee. Very peaceful.',
      addedBy: '1',
      addedAt: '2024-01-14T15:20:00Z',
      status: 'tried',
      feeling: 'good'
    },
    {
      id: '3',
      placeId: '3',
      place: {
        id: '3',
        name: 'Philz Coffee',
        address: '789 Castro St, San Francisco, CA',
        tags: ['coffee', 'artisan', 'cozy'],
        posts: [],
        savedCount: 34,
        createdAt: '2024-01-12',
        hubImage: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=300&h=200&fit=crop'
      },
      note: 'Want to try their famous mint mojito coffee!',
      addedBy: '1',
      addedAt: '2024-01-12T10:00:00Z',
      status: 'want'
    }
  ]

  const getStatusColor = (status: string, feeling?: string) => {
    switch (status) {
      case 'loved':
        return 'bg-gold-100 text-gold-700 border-gold-200'
      case 'tried':
        switch (feeling) {
          case 'amazing':
            return 'bg-emerald-100 text-emerald-700 border-emerald-200'
          case 'good':
            return 'bg-sage-100 text-sage-700 border-sage-200'
          case 'okay':
            return 'bg-amber-100 text-amber-700 border-amber-200'
          case 'disappointing':
            return 'bg-red-100 text-red-700 border-red-200'
          default:
            return 'bg-sage-100 text-sage-700 border-sage-200'
        }
      case 'want':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'loved':
        return <HeartIcon className="w-4 h-4 fill-current" />
      case 'tried':
        return <StarIcon className="w-4 h-4 fill-current" />
      case 'want':
        return <BookmarkIcon className="w-4 h-4" />
      default:
        return <BookmarkIcon className="w-4 h-4" />
    }
  }

  const handlePlaceClick = (listPlace: ListPlace) => {
    // Convert Place to Hub format
    const hub: Hub = {
      id: listPlace.place.id,
      name: listPlace.place.name,
      description: `A great place to visit in ${listPlace.place.address}`,
      tags: listPlace.place.tags,
      images: listPlace.place.hubImage ? [listPlace.place.hubImage] : [],
      location: {
        address: listPlace.place.address,
        lat: listPlace.place.coordinates?.lat || 37.7749,
        lng: listPlace.place.coordinates?.lng || -122.4194,
      },
      googleMapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(listPlace.place.name + ' ' + listPlace.place.address)}`,
      mainImage: listPlace.place.hubImage,
      posts: listPlace.place.posts,
      lists: [],
    }
    setSelectedHub(hub)
    setShowHubModal(true)
  }

  // Check if current user owns this list
  const isOwner = list.userId === '1' // Mock current user ID

  const handleCreatePost = () => {
    setShowCreatePost(true)
  }

  const handleSaveHub = () => {
    setShowHubSearchModal(true)
  }

  const handleHubSelected = (hub: Hub) => {
    setHubToSave(hub)
    setShowHubSearchModal(false)
    setShowSaveModal(true)
  }

  const handleSave = (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
    console.log('Saving hub:', { 
      hub: hubToSave, 
      status, 
      rating, 
      listIds, 
      note,
      // Auto-save to appropriate "All" list
      autoSaveToList: `All ${status.charAt(0).toUpperCase() + status.slice(1)}`
    })
    setShowSaveModal(false)
    setHubToSave(null)
  }

  const handleCreateList = (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => {
    console.log('Creating new list:', listData, 'and saving hub:', hubToSave)
  }

  return (
    <div className="relative min-h-full overflow-x-hidden bg-linen-50">
      {/* Enhanced background: linen texture, sunlight gradient, vignette */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-linen-texture opacity-80 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gold-50/60 via-linen-100/80 to-sage-100/70 opacity-80"></div>
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-charcoal-900/10"></div>
      </div>
      {/* Header: back arrow, cover image, toolkit, tags */}
      <div className="relative z-10">
        <div className="flex items-center px-4 pt-4 pb-2">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center text-sage-700 hover:text-sage-900 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
          <div className="flex-1 flex items-center justify-center">
            <h1 className="text-lg font-serif font-semibold text-charcoal-800 text-center w-full truncate">{list.name}</h1>
          </div>
        </div>
        {/* Cover image */}
        {list.coverImage && (
          <div className="w-full h-48 bg-gradient-to-br from-sage-200 to-gold-200 relative overflow-hidden">
            <img
              src={list.coverImage}
              alt={list.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/5 to-transparent backdrop-blur-[1px]"></div>
            <div className="absolute inset-0 border border-white/20"></div>
          </div>
        )}
        {/* Toolkit */}
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <button
            className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-sage-400 to-gold-300 text-white shadow-botanical hover:from-sage-500 hover:to-gold-400 transition-all border-2 border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300"
            onClick={() => setShowMapModal(true)}
            aria-label="View all on map"
            title="View all on map"
          >
            <MapIcon className="w-6 h-6" />
          </button>
          <button className="w-10 h-10 bg-sage-100 rounded-full flex items-center justify-center shadow-soft hover:bg-sage-200 transition">
            <ShareIcon className="w-5 h-5 text-sage-600" />
          </button>
          <button 
            onClick={() => setIsLiked(!isLiked)}
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-soft transition ${
              isLiked 
                ? 'bg-gold-100' 
                : 'bg-sage-100 hover:bg-sage-200'
            }`}
          >
            <HeartIcon className={`w-5 h-5 ${isLiked ? 'text-gold-600 fill-current' : 'text-sage-600'}`} />
          </button>
          {isOwner ? (
            <PlusDropdown onCreatePost={handleCreatePost} onSaveHub={handleSaveHub} />
          ) : (
            <button 
              onClick={() => setIsSaved(!isSaved)}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-soft transition ${
                isSaved 
                  ? 'bg-sage-100' 
                  : 'bg-sage-100 hover:bg-sage-200'
              }`}
            >
              <BookmarkIcon className={`w-5 h-5 ${isSaved ? 'text-sage-600 fill-current' : 'text-sage-600'}`} />
            </button>
          )}
        </div>
        {/* Tags */}
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {list.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-sage-100 text-sage-700 text-sm rounded-full border border-sage-200"
            >
              #{tag}
            </span>
          ))}
        </div>
        {/* List meta */}
        <div className="flex items-center gap-4 text-sm text-charcoal-500 px-4 pb-4">
          <span>{listPlaces.length} places</span>
          <span>•</span>
          <span>Updated {new Date(list.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
      {/* Main Content: places */}
      <div className="relative z-10 p-4 space-y-8">
        {listPlaces.map((listPlace) => (
          <div
            key={listPlace.id}
            className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-botanical border border-linen-200 overflow-hidden hover:shadow-cozy transition-all duration-300 flex flex-col relative"
          >
            {/* Three dots menu on image */}
            <div className="absolute top-4 right-4 z-20">
              <button
                className="bg-white/80 hover:bg-sage-100 border border-linen-200 rounded-full p-2 shadow-soft focus:outline-none"
                onClick={() => setCardMenuOpen(cardMenuOpen === listPlace.id ? null : listPlace.id)}
                aria-label="Open actions menu"
              >
                <EllipsisHorizontalIcon className="w-6 h-6 text-sage-600" />
              </button>
              {cardMenuOpen === listPlace.id && (
                <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-botanical border border-linen-200 py-2 z-30">
                  <button
                    className="block w-full text-left px-4 py-2 text-charcoal-700 hover:bg-sage-50 rounded-t-xl"
                    onClick={() => { setCardMenuOpen(null); /* TODO: Edit logic */ }}
                  >Edit</button>
                  <button
                    className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-b-xl"
                    onClick={() => { setCardMenuOpen(null); /* TODO: Remove logic */ }}
                  >Remove</button>
                </div>
              )}
            </div>
            {/* Hub Image on top */}
            <div className="w-full h-40 bg-linen-100 flex-shrink-0 relative">
              <img 
                src={listPlace.place.hubImage || 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=150&h=150&fit=crop'} 
                alt={listPlace.place.name} 
                className="w-full h-full object-cover rounded-t-3xl"
              />
            </div>
            {/* Content below image */}
            <div className="flex-1 p-6 flex flex-col gap-2">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-serif font-semibold text-charcoal-800 mb-1 text-lg">{listPlace.place.name}</h4>
                  <div className="flex items-center text-charcoal-500 text-sm mb-2">
                    <MapPinIcon className="w-4 h-4 mr-1" />
                    {listPlace.place.address}
                  </div>
                </div>
                {/* Status Badge */}
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(listPlace.status, listPlace.feeling)}`}>
                  {getStatusIcon(listPlace.status)}
                  <span className="capitalize">{listPlace.status}</span>
                  {listPlace.status === 'tried' && listPlace.feeling && (
                    <span className="ml-1">• {listPlace.feeling}</span>
                  )}
                </div>
              </div>
              {listPlace.note && (
                <p className="text-sm text-charcoal-600 mb-2 italic">"{listPlace.note}"</p>
              )}
              <div className="flex flex-wrap gap-1 mb-2">
                {listPlace.place.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-linen-100 text-charcoal-600 text-xs rounded-full border border-linen-200"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center space-x-4 text-sm text-charcoal-500">
                  <span className="flex items-center">
                    <BookmarkIcon className="w-4 h-4 mr-1" />
                    {listPlace.place.savedCount} influence
                  </span>
                  <span>•</span>
                  <span>Added {new Date(listPlace.addedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {/* Empty State */}
        {listPlaces.length === 0 && (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 text-center shadow-botanical border border-linen-200">
            <BookmarkIcon className="w-16 h-16 text-sage-300 mx-auto mb-4" />
            <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-2">No places yet</h3>
            <p className="text-charcoal-600 mb-4">Start building your list by adding your favorite places</p>
            <button className="bg-gradient-to-r from-sage-500 to-sage-600 text-white px-6 py-3 rounded-xl font-medium hover:from-sage-600 hover:to-sage-700 transition-all duration-300 shadow-soft">
              Add Your First Place
            </button>
          </div>
        )}
      </div>
      {/* Map Modal placeholder */}
      {showMapModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-3xl shadow-botanical p-8 max-w-2xl w-full relative">
            <button
              className="absolute top-4 right-4 text-sage-600 hover:text-sage-900 bg-sage-100 rounded-full p-2 shadow-soft"
              onClick={() => setShowMapModal(false)}
              aria-label="Close map"
            >
              <EllipsisHorizontalIcon className="w-6 h-6" />
            </button>
            <div className="text-center text-lg font-serif font-semibold mb-4">Map view coming soon!</div>
            {/* TODO: Add real map here */}
            <div className="h-80 bg-sage-100 rounded-2xl flex items-center justify-center text-sage-400 font-bold text-2xl">
              [Map Placeholder]
            </div>
          </div>
        </div>
      )}
      {/* Hub Modal */}
      {selectedHub && (
        <HubModal
          isOpen={showHubModal}
          onClose={() => setShowHubModal(false)}
          hub={selectedHub}
        />
      )}

      {/* Hub Search Modal */}
      <HubSearchModal
        isOpen={showHubSearchModal}
        onClose={() => setShowHubSearchModal(false)}
        onSelectHub={handleHubSelected}
      />

      {/* Save Modal */}
      {hubToSave && (
        <SaveModal
          isOpen={showSaveModal}
          onClose={() => {
            setShowSaveModal(false)
            setHubToSave(null)
          }}
          place={{
            id: hubToSave.id,
            name: hubToSave.name,
            address: hubToSave.location.address,
            tags: hubToSave.tags,
            posts: hubToSave.posts,
            savedCount: 0,
            createdAt: new Date().toISOString(),
            hubImage: hubToSave.mainImage
          }}
          userLists={userLists}
          selectedListIds={[list.id]} // Pre-select the current list
          onSave={handleSave}
          onCreateList={handleCreateList}
        />
      )}

      {/* Create Post Modal */}
      <CreatePost
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        preSelectedListIds={[list.id]} // Pre-select the current list
      />
    </div>
  )
}

export default ListView 