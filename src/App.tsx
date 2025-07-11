import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Navbar from './components/Navbar.tsx'
import CreatePost from './components/CreatePost.tsx'
import Home from './pages/Home.tsx'
import Profile from './pages/Profile.tsx'
import Search from './pages/Search.tsx'
import ListView from './pages/ListView.tsx'
import PlaceHub from './pages/PlaceHub.tsx'
import Demo from './pages/Demo.tsx'

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [showCreatePost, setShowCreatePost] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Update active tab based on current route
  useEffect(() => {
    const path = location.pathname
    if (path === '/' || path === '/home') {
      setActiveTab('home')
    } else if (path === '/search') {
      setActiveTab('search')
    } else if (path === '/favorites') {
      setActiveTab('favorites')
    } else if (path === '/profile') {
      setActiveTab('profile')
    } else if (path === '/demo') {
      setActiveTab('home') // Keep home active when on demo
    }
  }, [location.pathname])

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
        navigate('/favorites')
        break
      case 'profile':
        navigate('/profile')
        break
      default:
        navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-warm-50 to-sage-50">
      <div className="max-w-md mx-auto bg-white/90 backdrop-blur-glass min-h-screen shadow-crystal border border-white/30">
        <div className="flex flex-col h-screen">
          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/home" element={<Home />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/search" element={<Search />} />
              <Route path="/favorites" element={<Home />} />
              <Route path="/list/:id" element={<ListView />} />
              <Route path="/place/:id" element={<PlaceHub />} />
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
      {showCreatePost && (
        <CreatePost onClose={() => setShowCreatePost(false)} />
      )}
    </div>
  )
}

export default App
