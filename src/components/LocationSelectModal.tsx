import { useState, useEffect } from 'react'
import { XMarkIcon, MapPinIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface Location {
  id: string
  name: string
  address: string
  coordinates: {
    lat: number
    lng: number
  }
}

interface LocationSelectModalProps {
  isOpen: boolean
  onClose: () => void
  onLocationSelect: (location: Location) => void
}

const LocationSelectModal: React.FC<LocationSelectModalProps> = ({
  isOpen,
  onClose,
  onLocationSelect
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [searchResults, setSearchResults] = useState<Location[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Mock recent locations
  const recentLocations: Location[] = [
    {
      id: '1',
      name: 'San Francisco, CA',
      address: 'San Francisco, California, USA',
      coordinates: { lat: 37.7749, lng: -122.4194 }
    },
    {
      id: '2',
      name: 'Oakland, CA',
      address: 'Oakland, California, USA',
      coordinates: { lat: 37.8044, lng: -122.2711 }
    },
    {
      id: '3',
      name: 'Berkeley, CA',
      address: 'Berkeley, California, USA',
      coordinates: { lat: 37.8715, lng: -122.2730 }
    }
  ]

  // Mock search results
  const mockSearchResults: Location[] = [
    {
      id: '4',
      name: 'San Jose, CA',
      address: 'San Jose, California, USA',
      coordinates: { lat: 37.3382, lng: -121.8863 }
    },
    {
      id: '5',
      name: 'Palo Alto, CA',
      address: 'Palo Alto, California, USA',
      coordinates: { lat: 37.4419, lng: -122.1430 }
    },
    {
      id: '6',
      name: 'Mountain View, CA',
      address: 'Mountain View, California, USA',
      coordinates: { lat: 37.3861, lng: -122.0839 }
    }
  ]

  const getCurrentLocation = () => {
    setIsLoadingLocation(true)
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          
          // In a real app, you'd reverse geocode these coordinates
          // For now, we'll create a mock location
          const location: Location = {
            id: 'current',
            name: 'Current Location',
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            coordinates: { lat: latitude, lng: longitude }
          }
          
          setCurrentLocation(location)
          setIsLoadingLocation(false)
        },
        (error) => {
          console.error('Error getting location:', error)
          setIsLoadingLocation(false)
          // Show error message to user
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      )
    } else {
      setIsLoadingLocation(false)
      // Show error message that geolocation is not supported
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // In a real app, this would be an API call to a geocoding service
    const filteredResults = mockSearchResults.filter(location =>
      location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.address.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    setSearchResults(filteredResults)
    setIsSearching(false)
  }

  const handleLocationSelect = (location: Location) => {
    onLocationSelect(location)
    onClose()
  }

  useEffect(() => {
    if (searchQuery) {
      const timeoutId = setTimeout(handleSearch, 500)
      return () => clearTimeout(timeoutId)
    } else {
      setSearchResults([])
    }
  }, [searchQuery])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl shadow-botanical border border-linen-200 bg-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-linen-200">
          <h2 className="text-xl font-serif font-semibold text-charcoal-700">Select Location</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-linen-100 transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-charcoal-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Current Location */}
          <div className="mb-6">
            <h3 className="font-medium text-charcoal-700 mb-3">Current Location</h3>
            {currentLocation ? (
              <button
                onClick={() => handleLocationSelect(currentLocation)}
                className="w-full p-4 rounded-xl border border-sage-200 bg-sage-50 hover:bg-sage-100 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <MapPinIcon className="w-5 h-5 text-sage-600" />
                  <div>
                    <div className="font-medium text-charcoal-700">{currentLocation.name}</div>
                    <div className="text-sm text-charcoal-500">{currentLocation.address}</div>
                  </div>
                </div>
              </button>
            ) : (
              <button
                onClick={getCurrentLocation}
                disabled={isLoadingLocation}
                className="w-full p-4 rounded-xl border border-linen-200 hover:border-sage-200 hover:bg-sage-25 transition-all text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <MapPinIcon className="w-5 h-5 text-charcoal-500" />
                  <div>
                    <div className="font-medium text-charcoal-700">
                      {isLoadingLocation ? 'Getting your location...' : 'Use my current location'}
                    </div>
                    <div className="text-sm text-charcoal-500">
                      {isLoadingLocation ? 'Please allow location access' : 'Find places near you'}
                    </div>
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* Search */}
          <div className="mb-6">
            <h3 className="font-medium text-charcoal-700 mb-3">Search for a location</h3>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter city, address, or place name..."
                className="w-full p-3 pl-10 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-charcoal-400" />
            </div>
            
            {isSearching && (
              <div className="mt-3 text-center text-sm text-charcoal-500">
                Searching...
              </div>
            )}
            
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map(location => (
                  <button
                    key={location.id}
                    onClick={() => handleLocationSelect(location)}
                    className="w-full p-3 rounded-lg border border-linen-200 hover:border-sage-200 hover:bg-sage-25 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <MapPinIcon className="w-5 h-5 text-charcoal-500" />
                      <div>
                        <div className="font-medium text-charcoal-700">{location.name}</div>
                        <div className="text-sm text-charcoal-500">{location.address}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Locations */}
          <div>
            <h3 className="font-medium text-charcoal-700 mb-3">Recent Locations</h3>
            <div className="space-y-2">
              {recentLocations.map(location => (
                <button
                  key={location.id}
                  onClick={() => handleLocationSelect(location)}
                  className="w-full p-3 rounded-lg border border-linen-200 hover:border-sage-200 hover:bg-sage-25 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <MapPinIcon className="w-5 h-5 text-charcoal-500" />
                    <div>
                      <div className="font-medium text-charcoal-700">{location.name}</div>
                      <div className="text-sm text-charcoal-500">{location.address}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LocationSelectModal 