import { Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import Navbar from './components/Navbar.tsx'
import Home from './pages/Home.tsx'
import Profile from './pages/Profile.tsx'
import Search from './pages/Search.tsx'
import ListView from './pages/ListView.tsx'
import PlaceHub from './pages/PlaceHub.tsx'

function App() {
  const [activeTab, setActiveTab] = useState('home')

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-coral-50">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-lg">
        <div className="flex flex-col h-screen">
          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/search" element={<Search />} />
              <Route path="/list/:id" element={<ListView />} />
              <Route path="/place/:id" element={<PlaceHub />} />
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
