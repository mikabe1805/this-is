import { Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import Navbar from './components/Navbar.tsx'
import Home from './pages/Home.tsx'
import Profile from './pages/Profile.tsx'
import Search from './pages/Search.tsx'
import ListView from './pages/ListView.tsx'
import PlaceHub from './pages/PlaceHub.tsx'
import Demo from './pages/Demo.tsx'

function App() {
  const [activeTab, setActiveTab] = useState('home')

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-warm-50 to-sage-50">
      <div className="max-w-md mx-auto bg-white/90 backdrop-blur-glass min-h-screen shadow-crystal border border-white/30">
        <div className="flex flex-col h-screen">
          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/search" element={<Search />} />
              <Route path="/list/:id" element={<ListView />} />
              <Route path="/place/:id" element={<PlaceHub />} />
              <Route path="/demo" element={<Demo />} />
            </Routes>
          </main>
          {/* Bottom Navigation */}
          <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      </div>
    </div>
  )
}

export default App
