import { useState, useEffect } from 'react'
import RatingPrompt from '../components/RatingPrompt'
import FriendsOpinions from '../components/FriendsOpinions'

// Simulated data
const mockOpinions = [
  {
    id: '1',
    user: {
      name: 'Emma',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
      isPublic: true
    },
    rating: 'loved' as const,
    feedback: 'The coffee here is absolutely amazing! Perfect spot for working remotely.',
    timestamp: '2 hours ago',
    isCloseFriend: true
  },
  {
    id: '2',
    user: {
      name: 'Rami',
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      isPublic: false
    },
    rating: 'mediocre' as const,
    feedback: 'Food was okay, but the service was slow. Might give it another try.',
    timestamp: '1 day ago',
    isCloseFriend: false
  },
  {
    id: '3',
    user: {
      name: 'Sophie',
      avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
      isPublic: true
    },
    rating: 'hated' as const,
    feedback: 'Way too expensive for what you get. Would not recommend.',
    timestamp: '3 days ago',
    isCloseFriend: true
  },
  {
    id: '4',
    user: {
      name: 'Jess',
      avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
      isPublic: true
    },
    rating: 'loved' as const,
    feedback: 'Great atmosphere and the staff is super friendly!',
    timestamp: '1 week ago',
    isCloseFriend: false
  }
]

const mockPlaces = [
  {
    id: '1',
    name: 'Blue Bottle Coffee',
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop',
    address: 'San Francisco, CA'
  },
  {
    id: '2',
    name: 'Tartine Bakery',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop',
    address: 'San Francisco, CA'
  },
  {
    id: '3',
    name: 'Mission Chinese Food',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
    address: 'San Francisco, CA'
  }
]

const Demo = () => {
  const [showRatingPrompt, setShowRatingPrompt] = useState(false)
  const [currentPlace, setCurrentPlace] = useState(mockPlaces[0])
  const [showEmbeddedWidget, setShowEmbeddedWidget] = useState(false)
  const [simulatedVisits, setSimulatedVisits] = useState<Array<{
    place: typeof mockPlaces[0]
    timestamp: Date
    duration: number
  }>>([])

  // Simulate location tracking
  useEffect(() => {
    const simulateVisit = () => {
      const randomPlace = mockPlaces[Math.floor(Math.random() * mockPlaces.length)]
      const visit = {
        place: randomPlace,
        timestamp: new Date(),
        duration: Math.floor(Math.random() * 60) + 30 // 30-90 minutes
      }
      
      setSimulatedVisits(prev => [...prev, visit])
      
      // Show rating prompt after a delay
      setTimeout(() => {
        setCurrentPlace(randomPlace)
        setShowRatingPrompt(true)
      }, 2000)
    }

    // Simulate a visit every 10 seconds for demo purposes
    const interval = setInterval(simulateVisit, 10000)
    
    return () => clearInterval(interval)
  }, [])

  const handleRate = (rating: 'loved' | 'hated' | 'mediocre', feedback?: string) => {
    console.log('Rating submitted:', { place: currentPlace.name, rating, feedback })
    setShowRatingPrompt(false)
    
    // In a real app, this would save to the backend
    alert(`Thanks for rating ${currentPlace.name}! Your feedback helps your friends discover great places.`)
  }

  const handleDismiss = () => {
    setShowRatingPrompt(false)
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-cream-50 via-warm-50 to-sage-50 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-serif font-bold text-earth-800 mb-2">
            This Is - Feature Demo
          </h1>
          <p className="text-earth-600">
            Showcasing the core features of the social discovery platform
          </p>
        </div>

        {/* Friends' Opinions Widget */}
        <div className="bg-white/80 backdrop-blur-glass rounded-2xl shadow-crystal border border-white/30 p-6">
          <h2 className="text-2xl font-serif font-semibold text-earth-800 mb-4">
            Friends' Opinions Widget
          </h2>
          <p className="text-earth-600 mb-6">
            This is how the widget would appear when embedded in other apps (like TikTok, Instagram, etc.)
          </p>
          
          <div className="flex flex-wrap gap-6">
            {/* Embedded version */}
            <div className="flex-1 min-w-80">
              <h3 className="font-semibold text-earth-700 mb-3">Embedded in App</h3>
              <FriendsOpinions
                placeName="Blue Bottle Coffee"
                placeImage="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop"
                opinions={mockOpinions}
                totalFriends={12}
                isEmbedded={true}
                onViewMore={() => alert('Opens This Is app')}
              />
            </div>

            {/* Full version */}
            <div className="flex-1 min-w-80">
              <h3 className="font-semibold text-earth-700 mb-3">Full Widget</h3>
              <FriendsOpinions
                placeName="Blue Bottle Coffee"
                placeImage="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop"
                opinions={mockOpinions}
                totalFriends={12}
              />
            </div>
          </div>
        </div>

        {/* Rating System Demo */}
        <div className="bg-white/80 backdrop-blur-glass rounded-2xl shadow-crystal border border-white/30 p-6">
          <h2 className="text-2xl font-serif font-semibold text-earth-800 mb-4">
            Rating System
          </h2>
          <p className="text-earth-600 mb-6">
            The 3-point rating system with optional feedback that appears after location tracking detects a visit.
          </p>
          
          <div className="flex flex-wrap gap-4">
            {mockPlaces.map((place) => (
              <button
                key={place.id}
                onClick={() => {
                  setCurrentPlace(place)
                  setShowRatingPrompt(true)
                }}
                className="bg-gradient-to-br from-warm-100 to-cream-100 rounded-xl p-4 hover:from-warm-200 hover:to-cream-200 transition-all duration-300 border border-warm-200 hover:border-warm-300"
              >
                <img 
                  src={place.image} 
                  alt={place.name}
                  className="w-32 h-24 object-cover rounded-lg mb-3 shadow-sm"
                />
                <h3 className="font-semibold text-earth-800 text-sm">{place.name}</h3>
                <p className="text-earth-500 text-xs">{place.address}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Location Tracking Simulation */}
        <div className="bg-white/80 backdrop-blur-glass rounded-2xl shadow-crystal border border-white/30 p-6">
          <h2 className="text-2xl font-serif font-semibold text-earth-800 mb-4">
            Location Tracking Simulation
          </h2>
          <p className="text-earth-600 mb-6">
            Simulating how the app detects visits and prompts for ratings. New visits are added every 10 seconds.
          </p>
          
          <div className="space-y-3">
            {simulatedVisits.slice(-5).reverse().map((visit, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-gradient-to-r from-warm-50 to-cream-50 rounded-xl border border-warm-100">
                <img 
                  src={visit.place.image} 
                  alt={visit.place.name}
                  className="w-12 h-12 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h4 className="font-semibold text-earth-800">{visit.place.name}</h4>
                  <p className="text-earth-500 text-sm">
                    Visited {visit.timestamp.toLocaleTimeString()} • Stayed {visit.duration} minutes
                  </p>
                </div>
                <div className="text-xs text-earth-400">
                  {visit.timestamp.toLocaleDateString()}
                </div>
              </div>
            ))}
            
            {simulatedVisits.length === 0 && (
              <div className="text-center py-8 text-earth-500">
                <p>Waiting for simulated visits...</p>
                <p className="text-sm">New visits will appear every 10 seconds</p>
              </div>
            )}
          </div>
        </div>

        {/* Privacy Controls Demo */}
        <div className="bg-white/80 backdrop-blur-glass rounded-2xl shadow-crystal border border-white/30 p-6">
          <h2 className="text-2xl font-serif font-semibold text-earth-800 mb-4">
            Privacy Controls
          </h2>
          <p className="text-earth-600 mb-6">
            Users can control who sees their ratings and reviews.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-warm-100 to-cream-100 rounded-xl p-4 border border-warm-200">
              <h3 className="font-semibold text-earth-800 mb-2">Public Profile</h3>
              <p className="text-earth-600 text-sm">All ratings visible to everyone</p>
            </div>
            <div className="bg-gradient-to-br from-sage-100 to-cream-100 rounded-xl p-4 border border-sage-200">
              <h3 className="font-semibold text-earth-800 mb-2">Private Profile</h3>
              <p className="text-earth-600 text-sm">Ratings only visible to close friends</p>
            </div>
            <div className="bg-gradient-to-br from-earth-100 to-cream-100 rounded-xl p-4 border border-earth-200">
              <h3 className="font-semibold text-earth-800 mb-2">Anonymous Ratings</h3>
              <p className="text-earth-600 text-sm">Rate places without revealing identity</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rating Prompt Modal */}
      <RatingPrompt
        placeName={currentPlace.name}
        placeImage={currentPlace.image}
        onRate={handleRate}
        onDismiss={handleDismiss}
        isVisible={showRatingPrompt}
      />
    </div>
  )
}

export default Demo 