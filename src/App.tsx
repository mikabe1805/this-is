import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { NavigationProvider, useNavigation } from './contexts/NavigationContext.tsx'
import { ModalProvider, useModal } from './contexts/ModalContext.tsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'
import Navbar from './components/Navbar.tsx'
import CreatePost from './components/CreatePost.tsx'
import CreateListModal from './components/CreateListModal.tsx'
import ListModal from './components/ListModal.tsx'
import HubModal from './components/HubModal.tsx'
import SaveModal from './components/SaveModal.tsx'
import EmbedFromModal from './components/EmbedFromModal.tsx'
import Home from './pages/Home.tsx'
import Profile from './pages/Profile.tsx'
import EditProfile from './pages/EditProfile.tsx'
import Following from './pages/Following.tsx'
import Settings from './pages/Settings.tsx'
import Search from './pages/Search.tsx'
import ListView from './pages/ListView.tsx'
import ViewAllLists from './pages/ViewAllLists.tsx'
import Favorites from './pages/SavedLists.tsx'
import Reels from './pages/Reels.tsx'
import PlaceHub from './pages/PlaceHub.tsx'
import UserProfile from './pages/UserProfile.tsx'
import Demo from './pages/Demo.tsx'
import EnhancedSearchDemo from './components/EnhancedSearchDemo.tsx'
import DatabaseSeeder from './components/DatabaseSeeder.tsx'
import Auth from './pages/Auth.tsx'
import { setupViewportHandler } from './utils/viewportHandler.ts'

function AppContent() {
  const [activeTab, setActiveTab] = useState('home')
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [showEmbedFromModal, setShowEmbedFromModal] = useState(false)
  const [showCreateList, setShowCreateList] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useAuth()

  // Prevent scroll when touching navbar area (but allow button interactions)
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      const nav = target.closest('nav')
      if (nav && !target.closest('button')) {
        e.preventDefault()
      }
    }

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('nav')) {
        e.preventDefault()
      }
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('wheel', handleWheel)
    }
  }, [])

  // Setup viewport handler to prevent keyboard displacement
  useEffect(() => {
    const cleanup = setupViewportHandler()
    return cleanup
  }, [])

  // Update active tab based on current route
  useEffect(() => {
    const path = location.pathname
    if (path === '/' || path === '/home') {
      setActiveTab('home')
    } else if (path === '/search') {
      setActiveTab('search')
    } else if (path === '/reels') {
      setActiveTab('favorites') // 'favorites' tab is now used for reels
    } else if (path === '/favorites') {
      setActiveTab('favorites')
    } else if (path === '/profile') {
      setActiveTab('profile')
    } else if (path === '/demo') {
      setActiveTab('home') // Keep home active when on demo
    }
  }, [location.pathname])

  // Listen for create list event
  useEffect(() => {
    const handleOpenCreateList = () => {
      setShowCreateList(true)
    }

    window.addEventListener('openCreateList', handleOpenCreateList)
    return () => {
      window.removeEventListener('openCreateList', handleOpenCreateList)
    }
  }, [])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    
    // If we're on the demo page, stay on demo but show different content
    if (location.pathname === '/demo') {
      // For demo, we'll just update the active tab without navigating
      return
    }
    
    // Normal navigation for other pages
    switch (tab) {
      case 'home':
        navigate('/')
        break
      case 'search':
        navigate('/search')
        break
      case 'favorites':
        navigate('/reels') // Navigate to reels instead of favorites
        break
      case 'profile':
        navigate('/profile')
        break
      default:
        navigate('/')
    }
  }

  // If user is not authenticated, show auth page
  if (!currentUser) {
    return <Auth />
  }

  return (
    <NavigationProvider>
      <ModalProvider>
        {/* Render full-screen components outside the normal layout */}
        {location.pathname === '/reels' ? (
          <div className="relative h-screen w-screen">
            <Routes>
              <Route path="/reels" element={<Reels />} />
            </Routes>
            {/* Navbar for Reels - positioned absolutely to ensure visibility */}
            <div className="absolute bottom-0 left-0 right-0 z-[1002]">
              <Navbar 
                activeTab={activeTab} 
                setActiveTab={handleTabChange} 
                onCreatePost={() => setShowCreatePost(true)}
                onEmbedFrom={() => setShowEmbedFromModal(true)}
              />
            </div>
          </div>
        ) : location.pathname === '/search-demo' ? (
          <div className="relative h-screen w-screen">
            <Routes>
              <Route path="/search-demo" element={<EnhancedSearchDemo />} />
            </Routes>
          </div>
        ) : location.pathname === '/seed-database' ? (
          <div className="relative h-screen w-screen">
            <Routes>
              <Route path="/seed-database" element={<DatabaseSeeder />} />
            </Routes>
          </div>
        ) : (
          <div className="h-dvh bg-botanical-overlay">
            <div className="max-w-md mx-auto bg-white/90 backdrop-blur-glass h-full shadow-crystal border border-white/30">
              <div className="flex flex-col h-full">
                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto pb-28 overflow-x-hidden">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/profile/edit" element={<EditProfile />} />
                    <Route path="/profile/following" element={<Following />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/list/:id" element={<ListView />} />
                    <Route path="/lists" element={<ViewAllLists />} />
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/place/:id" element={<PlaceHub />} />
                    <Route path="/user/:userId" element={<UserProfile />} />
                    <Route path="/demo" element={<Demo activeTab={activeTab} />} />
                    <Route path="/search-demo-mobile" element={<EnhancedSearchDemo />} />
                  </Routes>
                </main>
                {/* Bottom Navigation */}
                <Navbar 
                  activeTab={activeTab} 
                  setActiveTab={handleTabChange} 
                  onCreatePost={() => setShowCreatePost(true)}
                  onEmbedFrom={() => setShowEmbedFromModal(true)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Create Post Modal */}
        <CreatePost 
          isOpen={showCreatePost} 
          onClose={() => setShowCreatePost(false)} 
        />

        {/* Embed From Modal */}
        <EmbedFromModal
          isOpen={showEmbedFromModal}
          onClose={() => setShowEmbedFromModal(false)}
          onEmbed={(embedData) => {
            console.log('Creating embed post:', embedData)
            // TODO: Implement embed post creation
            setShowEmbedFromModal(false)
          }}
        />

        {/* Create List Modal */}
        <CreateListModal
          isOpen={showCreateList}
          onClose={() => setShowCreateList(false)}
          onCreate={(listData) => {
            console.log('Creating new list:', listData)
            setShowCreateList(false)
            // In a real app, you would create the list and then navigate to it
            // navigate(`/list/${newListId}`)
          }}
        />

        {/* Global Modals */}
        <GlobalModals />

        {/* List Modal */}
        <ListModalWrapper />

        {/* Hub Modal */}
        <HubModalWrapper />
      </ModalProvider>
    </NavigationProvider>
  )
}

// Global modals component
const GlobalModals = () => {
  const { showSaveModal, showCreatePost, saveModalData, createPostData, closeSaveModal, closeCreatePostModal } = useModal()

  // Mock user lists for SaveModal
  const userLists = [
    {
      id: 'all-loved',
      name: 'All Loved',
      description: 'All the places you\'ve loved and want to visit again',
      userId: '1',
      isPublic: false,
      isShared: false,
      privacy: 'private' as const,
      tags: ['loved', 'favorites', 'auto-generated'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-15',
      likes: 0,
      isLiked: false
    },
    {
      id: 'all-tried',
      name: 'All Tried',
      description: 'All the places you\'ve tried',
      userId: '1',
      isPublic: false,
      isShared: false,
      privacy: 'private' as const,
      tags: ['tried', 'visited', 'auto-generated'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=300&h=200&fit=crop',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-15',
      likes: 0,
      isLiked: false
    },
    {
      id: '1',
      name: 'Cozy Coffee Spots',
      description: 'Perfect places to work and relax',
      userId: '1',
      isPublic: true,
      isShared: false,
      privacy: 'public' as const,
      tags: ['coffee', 'work-friendly', 'cozy'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop',
      createdAt: '2024-01-10',
      updatedAt: '2024-01-15',
      likes: 56,
      isLiked: false
    }
  ]

  return (
    <>
      {/* Save Modal */}
      {showSaveModal && saveModalData && (saveModalData.hub || saveModalData.list) && (
        <SaveModal
          isOpen={showSaveModal}
          onClose={closeSaveModal}
          place={saveModalData.hub ? {
            id: saveModalData.hub.id,
            name: saveModalData.hub.name,
            address: saveModalData.hub.location.address,
            tags: saveModalData.hub.tags,
            posts: saveModalData.hub.posts,
            savedCount: 0,
            createdAt: '2024-01-15'
          } : {
            id: saveModalData.list!.id,
            name: saveModalData.list!.name,
            address: 'List',
            tags: saveModalData.list!.tags,
            posts: [],
            savedCount: 0,
            createdAt: saveModalData.list!.createdAt
          }}
          userLists={userLists}
          onSave={(status, rating, listIds, note) => {
            console.log('Saving with status:', status, 'rating:', rating, 'listIds:', listIds, 'note:', note)
            closeSaveModal()
          }}
          onCreateList={(listData) => {
            console.log('Creating new list:', listData)
            closeSaveModal()
          }}
        />
      )}

      {/* Create Post Modal */}
      {showCreatePost && createPostData && (
        <CreatePost
          isOpen={showCreatePost}
          onClose={closeCreatePostModal}
          preSelectedHub={createPostData.hub ? {
            id: createPostData.hub.id,
            name: createPostData.hub.name,
            address: createPostData.hub.location.address,
            description: createPostData.hub.description,
            lat: createPostData.hub.location.lat,
            lng: createPostData.hub.location.lng
          } : undefined}
          preSelectedListIds={createPostData.list ? [createPostData.list.id] : undefined}
        />
      )}
    </>
  )
}

// Wrapper component to use navigation context
const ListModalWrapper = () => {
  const { showListModal, selectedList, closeListModal, openFullScreenList, openHubModal } = useNavigation()
  const { openSaveModal, openCreatePostModal } = useModal()

  if (!selectedList) return null

  return (
    <ListModal
      list={selectedList}
      isOpen={showListModal}
      onClose={closeListModal}
      onOpenFullScreen={openFullScreenList}
      onOpenHub={(place) => {
        // Convert Place to Hub and open with proper back navigation
        const hub = {
          id: place.id,
          name: place.name,
          description: `${place.category || 'Place'} located at ${place.address}`,
          tags: place.tags,
          images: place.hubImage ? [place.hubImage] : [],
          location: {
            address: place.address,
            lat: place.coordinates?.lat || 0,
            lng: place.coordinates?.lng || 0
          },
          googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(place.address)}`,
          mainImage: place.hubImage,
          posts: place.posts || [],
          lists: [] // Places don't have associated lists in this context
        }
        openHubModal(hub, 'list-modal')
      }}
      onSave={(list) => {
        openSaveModal(undefined, list)
      }}
      onShare={(list) => {
        console.log('Sharing list:', list.name)
        // In a real app, this would share the list
        if (navigator.share) {
          navigator.share({
            title: list.name,
            text: list.description,
            url: window.location.href
          })
        } else {
          navigator.clipboard.writeText(window.location.href)
          alert('Link copied to clipboard!')
        }
      }}
      onAddPost={(list) => {
        openCreatePostModal(undefined, list)
      }}
    />
  )
}

// Wrapper component to use navigation context for HubModal
const HubModalWrapper = () => {
  const { showHubModal, selectedHub, closeHubModal, openFullScreenHub, openListModal, hubModalFromList, goBackFromHubModal } = useNavigation()
  const { openSaveModal, openCreatePostModal } = useModal()

  if (!selectedHub) return null

  return (
    <HubModal
      hub={selectedHub}
      isOpen={showHubModal}
      onClose={closeHubModal}
      onOpenFullScreen={openFullScreenHub}
      onOpenList={openListModal}
      showBackButton={hubModalFromList}
      onBack={goBackFromHubModal}
      onSave={(hub) => {
        openSaveModal(hub)
      }}
      onShare={(hub) => {
        console.log('Sharing hub:', hub.name)
        // In a real app, this would share the hub
        if (navigator.share) {
          navigator.share({
            title: hub.name,
            text: hub.description,
            url: window.location.href
          })
        } else {
          navigator.clipboard.writeText(window.location.href)
          alert('Link copied to clipboard!')
        }
      }}
            onAddPost={(hub) => {
        // TODO: Implement create post modal/page
        console.log('Add post for hub:', hub);
        openCreatePostModal(hub);
      }}
    />
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
