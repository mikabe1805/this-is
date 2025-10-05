import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { NavigationProvider } from './contexts/NavigationContext.tsx'
import { FiltersProvider } from './contexts/FiltersContext.tsx'
import { ModalProvider, useModal } from './contexts/ModalContext.tsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'
import type { List } from './types/index.js'
import Navbar from './components/Navbar.tsx'
import CreatePost from './components/CreatePost.tsx'
import CreateListModal from './components/CreateListModal.tsx'
import NavigationModals from './components/NavigationModals.tsx';
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
import EmbedFromModal from './components/EmbedFromModal.tsx'
import SaveModal from './components/SaveModal.tsx'
import { firebaseDataService } from './services/firebaseDataService.js'

// Global modals component (moved above usage)
const GlobalModals = () => {
  const { showSaveModal, showCreatePost, saveModalData, createPostData, closeSaveModal, closeCreatePostModal } = useModal()
  const { currentUser } = useAuth()
  const [userLists, setUserLists] = useState<List[]>([]);

  useEffect(() => {
    const fetchLists = async () => {
      if (currentUser) {
        const lists = await firebaseDataService.getUserLists(currentUser.id);
        setUserLists(lists);
      }
    };
    if (showSaveModal) {
      fetchLists();
    }
  }, [showSaveModal, currentUser]);


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
            address: saveModalData.hub.location?.address || 'No address available',
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
            createdAt: saveModalData.list!.createdAt || '2024-01-15'
          }}
          userLists={userLists}
          onSave={async (status, rating, listIds, note) => {
            console.log('SaveModal onSave called with:', { status, rating, listIds, note });
            if (!currentUser) return;
            const placeId = saveModalData.hub?.id || saveModalData.list!.id;
            console.log('Saving placeId:', placeId, 'to lists:', listIds);

            const owned = userLists || []
            const ids = Array.isArray(listIds) ? listIds : []

            // Check for duplicates
            const already = [] as string[]
            for (const lid of ids) {
              const exists = await firebaseDataService.isPlaceInList(lid, placeId)
              if (exists) already.push(lid)
            }
            if (already.length > 0) {
              const names = owned.filter(l=>already.includes(l.id)).map(l=>l.name).join(', ')
              const overwrite = window.confirm(`You've already saved this hub to the following lists: ${names}.\nWould you like to overwrite your previous save?`)
              if (!overwrite) {
                return
              }
            }

            // Save to selected lists
            for (const listId of ids) {
              await firebaseDataService.savePlaceToList(placeId, listId, currentUser.id, note, undefined, status, rating);
            }

            // Centralized auto-list save
            await firebaseDataService.saveToAutoList(placeId, currentUser.id, status, note, rating)
            
            // Track
            if (saveModalData.hub) {
              await firebaseDataService.trackUserInteraction(currentUser.id, 'save', { 
                placeId: saveModalData.hub.id,
                query: saveModalData.hub.name 
              });
            }
            
            console.log('Saving with status:', status, rating, listIds, note)
            closeSaveModal()
          }}
          onCreateList={async (listData) => {
            if (!currentUser) return;
            const placeId = saveModalData.hub?.id || saveModalData.list!.id;
            const newListId = await firebaseDataService.createList({ 
              ...listData, 
              userId: currentUser.id,
              tags: listData.tags || []
            });
            if (newListId) {
              await firebaseDataService.savePlaceToList(placeId, newListId, currentUser.id, undefined, undefined, 'loved'); // Default to loved status
            }
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
    <>
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
        <div className="h-dvh bg-surface">
          <div className="max-w-md mx-auto bg-white h-full shadow-crystal border border-linen-200">
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

      {/* All navigation modals */}
      <NavigationModals />
    </>
  )
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NavigationProvider>
        <FiltersProvider>
          <ModalProvider>
            {children}
          </ModalProvider>
        </FiltersProvider>
      </NavigationProvider>
    </AuthProvider>
  )
}

function App() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  )
}

export default App
