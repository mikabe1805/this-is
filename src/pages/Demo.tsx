import { useState, useEffect } from 'react'
import RatingPrompt from '../components/RatingPrompt'
import ListCard from '../components/ListCard'
import PlaceHub from '../components/PlaceHub'

// Simulated data for personal lists
const mockLists = [
  {
    id: '1',
    title: 'All Loved',
    description: 'Places that made my heart sing',
    places: [
      {
        id: '1',
        name: 'Blue Bottle Coffee',
        image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop',
        status: 'loved' as const,
        note: 'The cold brew here is absolutely divine. Perfect spot for people watching on a Sunday morning.',
        tags: ['coffee', 'brunch', 'people-watching'],
        savedFrom: undefined
      },
      {
        id: '2',
        name: 'Tartine Bakery',
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop',
        status: 'loved' as const,
        note: 'Their morning bun is life-changing. The line is worth it every time.',
        tags: ['bakery', 'pastries', 'breakfast'],
        savedFrom: undefined
      }
    ],
    isPrivate: true,
    owner: {
      name: 'You',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg'
    },
    likes: 0,
    isLiked: false
  },
  {
    id: '2',
    title: 'All Tried',
    description: 'Places I\'ve experienced',
    places: [
      {
        id: '3',
        name: 'Mission Chinese Food',
        image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
        status: 'tried' as const,
        note: 'Interesting fusion concept, but the wait was too long for what we got.',
        tags: ['chinese', 'fusion', 'dinner'],
        savedFrom: undefined
      }
    ],
    isPrivate: true,
    owner: {
      name: 'You',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg'
    },
    likes: 0,
    isLiked: false
  },
  {
    id: '3',
    title: 'Weekend Coffee Spots',
    description: 'Cozy places to work and relax',
    places: [
      {
        id: '4',
        name: 'Ritual Coffee',
        image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
        status: 'loved' as const,
        note: 'Great for working remotely. The oat milk latte is perfect.',
        tags: ['coffee', 'work-friendly', 'quiet'],
        savedFrom: {
          user: 'Emma',
          list: 'Best Work Spots'
        }
      },
      {
        id: '5',
        name: 'Four Barrel Coffee',
        image: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=400&h=300&fit=crop',
        status: 'want' as const,
        note: '',
        tags: ['coffee', 'artisan'],
        savedFrom: {
          user: 'Rami',
          list: 'SF Coffee Tour'
        }
      }
    ],
    isPrivate: false,
    owner: {
      name: 'You',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg'
    },
    likes: 12,
    isLiked: true
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

// Mock data for PlaceHub
const mockPlaceHubData = {
  place: {
    id: '1',
    name: 'Blue Bottle Coffee',
    address: 'San Francisco, CA',
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop',
    description: 'Artisanal coffee roaster and cafe known for their meticulously crafted beverages and minimalist aesthetic.',
    tags: ['coffee', 'artisan', 'minimalist', 'brunch']
  },
  lists: [
    {
      id: '1',
      name: 'All Loved',
      owner: {
        name: 'You',
        avatar: 'https://randomuser.me/api/portraits/women/44.jpg'
      },
      status: 'loved' as const,
      note: 'The cold brew here is absolutely divine. Perfect spot for people watching on a Sunday morning.',
      isPrivate: true
    },
    {
      id: '2',
      name: 'SF Coffee Tour',
      owner: {
        name: 'Emma',
        avatar: 'https://randomuser.me/api/portraits/women/44.jpg'
      },
      status: 'loved' as const,
      note: 'Best cold brew in the city!',
      isPrivate: false
    },
    {
      id: '3',
      name: 'Weekend Spots',
      owner: {
        name: 'Rami',
        avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
      },
      status: 'tried' as const,
      note: 'Good coffee, but too crowded on weekends.',
      isPrivate: false
    }
  ]
}

const Demo = () => {
  const [showRatingPrompt, setShowRatingPrompt] = useState(false)
  const [currentPlace, setCurrentPlace] = useState(mockPlaces[0])
  const [simulatedVisits, setSimulatedVisits] = useState<Array<{
    place: typeof mockPlaces[0]
    timestamp: Date
    duration: number
  }>>([])
  const [lists, setLists] = useState(mockLists)
  const [showPlaceHub, setShowPlaceHub] = useState(false)

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

    // Simulate a visit every 15 seconds for demo purposes
    const interval = setInterval(simulateVisit, 15000)
    
    return () => clearInterval(interval)
  }, [])

  const handleSave = (status: 'loved' | 'tried', note?: string) => {
    console.log('Place saved:', { place: currentPlace.name, status, note })
    setShowRatingPrompt(false)
    
    // In a real app, this would save to the appropriate list
    const listName = status === 'loved' ? 'All Loved' : 'All Tried'
    alert(`${currentPlace.name} saved to "${listName}"! Your personal note helps you remember what made this place special.`)
  }

  const handleDismiss = () => {
    setShowRatingPrompt(false)
  }

  const handleLike = (listId: string) => {
    setLists(prev => prev.map(list => 
      list.id === listId 
        ? { ...list, isLiked: !list.isLiked, likes: list.isLiked ? list.likes - 1 : list.likes + 1 }
        : list
    ))
  }

  const handleView = (listId: string) => {
    alert(`Opening list: ${lists.find(l => l.id === listId)?.title}`)
  }

  const handleSaveToList = (listId: string, status: 'loved' | 'tried' | 'want', note?: string) => {
    alert(`Saved to ${listId} with status: ${status}${note ? ` and note: "${note}"` : ''}`)
  }

  const handleCreateList = () => {
    alert('Create new list functionality would open here')
  }

  if (showPlaceHub) {
    return (
      <PlaceHub
        place={mockPlaceHubData.place}
        lists={mockPlaceHubData.lists}
        onSaveToList={handleSaveToList}
        onCreateList={handleCreateList}
      />
    )
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-cream-50 via-warm-50 to-sage-50 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-serif font-bold text-earth-800 mb-2">
            This Is - Personal Memory Journal
          </h1>
          <p className="text-earth-600">
            A cozy platform for collecting and sharing meaningful place experiences
          </p>
        </div>

        {/* Personal Lists */}
        <div className="bg-white/80 backdrop-blur-glass rounded-2xl shadow-crystal border border-white/30 p-6">
          <h2 className="text-2xl font-serif font-semibold text-earth-800 mb-4">
            Your Personal Lists
          </h2>
          <p className="text-earth-600 mb-6">
            Lists are the heart of This Is. Every place you save goes into a list, with personal notes to help you remember what made each place special.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {lists.map((list) => (
              <ListCard
                key={list.id}
                id={list.id}
                title={list.title}
                description={list.description}
                places={list.places}
                isPrivate={list.isPrivate}
                owner={list.owner}
                likes={list.likes}
                isLiked={list.isLiked}
                onLike={() => handleLike(list.id)}
                onView={() => handleView(list.id)}
              />
            ))}
          </div>
        </div>

        {/* Place Hub Demo */}
        <div className="bg-white/80 backdrop-blur-glass rounded-2xl shadow-crystal border border-white/30 p-6">
          <h2 className="text-2xl font-serif font-semibold text-earth-800 mb-4">
            Place Hub
          </h2>
          <p className="text-earth-600 mb-6">
            Every place has a hub that shows which lists it's saved to - both yours and your friends'. This helps you see the collective memory of a place.
          </p>
          
          <div className="flex flex-wrap gap-4 mb-6">
            {mockPlaces.map((place) => (
              <button
                key={place.id}
                onClick={() => setShowPlaceHub(true)}
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
          
          <button
            onClick={() => setShowPlaceHub(true)}
            className="px-6 py-3 bg-gradient-to-r from-warm-500 to-earth-500 text-white font-semibold rounded-xl hover:from-warm-600 hover:to-earth-600 transition-all duration-300 shadow-soft hover:shadow-lg"
          >
            View Place Hub Demo
          </button>
        </div>

        {/* Memory Saving System */}
        <div className="bg-white/80 backdrop-blur-glass rounded-2xl shadow-crystal border border-white/30 p-6">
          <h2 className="text-2xl font-serif font-semibold text-earth-800 mb-4">
            Two-Step Memory Saving
          </h2>
          <p className="text-earth-600 mb-6">
            When you spend time at a place (30+ minutes), This Is first asks how you felt, then offers to save to the appropriate list based on your response.
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
            Location Memory Detection
          </h2>
          <p className="text-earth-600 mb-6">
            Simulating how the app detects meaningful visits and prompts you to save memories. New visits are detected every 15 seconds.
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
                <p>Waiting for location detection...</p>
                <p className="text-sm">New visits will be detected every 15 seconds</p>
              </div>
            )}
          </div>
        </div>

        {/* Core Philosophy */}
        <div className="bg-white/80 backdrop-blur-glass rounded-2xl shadow-crystal border border-white/30 p-6">
          <h2 className="text-2xl font-serif font-semibold text-earth-800 mb-4">
            What Makes This Is Different
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-warm-100 to-cream-100 rounded-xl p-4 border border-warm-200">
                <h3 className="font-semibold text-earth-800 mb-2">Personal Journal</h3>
                <p className="text-earth-600 text-sm">Not reviews, but memories. Every place has a personal story.</p>
              </div>
              <div className="bg-gradient-to-br from-sage-100 to-cream-100 rounded-xl p-4 border border-sage-200">
                <h3 className="font-semibold text-earth-800 mb-2">List-Centric</h3>
                <p className="text-earth-600 text-sm">Lists are the heart - everything revolves around curated collections.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-earth-100 to-cream-100 rounded-xl p-4 border border-earth-200">
                <h3 className="font-semibold text-earth-800 mb-2">Trusted Social</h3>
                <p className="text-earth-600 text-sm">Friends, not strangers. Share with people you trust.</p>
              </div>
              <div className="bg-gradient-to-br from-warm-100 to-cream-100 rounded-xl p-4 border border-warm-200">
                <h3 className="font-semibold text-earth-800 mb-2">Memory-First</h3>
                <p className="text-earth-600 text-sm">Notes and personal context help you remember what made each place special.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Memory Saving Prompt */}
      <RatingPrompt
        placeName={currentPlace.name}
        placeImage={currentPlace.image}
        onSave={handleSave}
        onDismiss={handleDismiss}
        isVisible={showRatingPrompt}
      />
    </div>
  )
}

export default Demo 