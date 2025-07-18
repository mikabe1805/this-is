import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { NavigationProvider, useNavigation } from './contexts/NavigationContext.tsx'
import Navbar from './components/Navbar.tsx'
import CreatePost from './components/CreatePost.tsx'
import CreateListModal from './components/CreateListModal.tsx'
import ListModal from './components/ListModal.tsx'
import HubModal from './components/HubModal.tsx'
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

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [showCreateList, setShowCreateList] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

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

  return (
    <NavigationProvider>
      <div className="h-screen bg-botanical-overlay overflow-hidden">
        <div className="max-w-md mx-auto bg-white/90 backdrop-blur-glass h-screen shadow-crystal border border-white/30 overflow-hidden">
          <div className="flex flex-col h-full">
            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto">
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
                <Route path="/reels" element={<Reels />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/place/:id" element={<PlaceHub />} />
                <Route path="/user/:userId" element={<UserProfile />} />
                <Route path="/demo" element={<Demo activeTab={activeTab} />} />
              </Routes>
            </main>
            {/* Bottom Navigation */}
            <Navbar 
              activeTab={activeTab} 
              setActiveTab={handleTabChange} 
              onCreatePost={() => setShowCreatePost(true)}
            />
          </div>
        </div>

        {/* Create Post Modal */}
        <CreatePost 
          isOpen={showCreatePost} 
          onClose={() => setShowCreatePost(false)} 
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

        {/* List Modal */}
        <ListModalWrapper />

        {/* Hub Modal */}
        <HubModalWrapper />

      </div>
    </NavigationProvider>
  )
}

// Wrapper component to use navigation context
const ListModalWrapper = () => {
  const { showListModal, selectedList, closeListModal, openFullScreenList } = useNavigation()

  if (!selectedList) return null

  return (
    <ListModal
      list={selectedList}
      isOpen={showListModal}
      onClose={closeListModal}
      onOpenFullScreen={openFullScreenList}
      onSave={(list) => {
        console.log('Saving list:', list.name)
        // In a real app, this would save the list
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
        console.log('Adding post to list:', list.name)
        // In a real app, this would open create post modal
      }}
    />
  )
}

// Wrapper component to use navigation context for HubModal
const HubModalWrapper = () => {
  const { showHubModal, selectedHub, closeHubModal, openFullScreenHub, openListModal, hubModalFromList, goBackFromHubModal } = useNavigation()

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
        console.log('Saving hub:', hub.name)
        // In a real app, this would save the hub
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
        console.log('Adding post to hub:', hub.name)
        // In a real app, this would open create post modal
      }}
    />
  )
}

export default App
