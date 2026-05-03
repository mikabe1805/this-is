import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-paper w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-edge overflow-hidden"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge relative z-10">
          <p className="label-eyebrow text-ink-mute">Select location</p>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-5 relative z-10">
          {/* Current Location */}
          <div>
            <p className="label-eyebrow text-ink-mute mb-2.5">Current location</p>
            {currentLocation ? (
              <button
                type="button"
                onClick={() => handleLocationSelect(currentLocation)}
                className="w-full p-3.5 rounded-2xl border border-accent bg-accent-soft hover:border-accent-deep transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <MapPinIcon className="w-5 h-5 text-accent-deep" />
                  <div className="min-w-0">
                    <div className="font-display text-[15px] leading-tight text-ink truncate">{currentLocation.name}</div>
                    <div className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute truncate mt-0.5">{currentLocation.address}</div>
                  </div>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={getCurrentLocation}
                disabled={isLoadingLocation}
                className="w-full p-3.5 rounded-2xl border border-edge bg-card hover:border-ink/30 transition-colors text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <MapPinIcon className="w-5 h-5 text-ink-mute" />
                  <div>
                    <div className="text-[14px] font-medium text-ink">
                      {isLoadingLocation ? 'Getting your location…' : 'Use my current location'}
                    </div>
                    <div className="text-[12px] text-ink-soft">
                      {isLoadingLocation ? 'Please allow location access' : 'Find places near you'}
                    </div>
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* Search */}
          <div>
            <label htmlFor="loc-search" className="label-eyebrow text-ink-mute mb-2 block">Search for a location</label>
            <div className="relative">
              <input
                id="loc-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter city, address, or place…"
                className="w-full h-11 pl-10 pr-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
              />
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
            </div>

            {isSearching && (
              <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-mute mt-2 text-center">
                Searching…
              </p>
            )}

            {searchResults.length > 0 && (
              <ul className="divide-y divide-edge border-y border-edge mt-3">
                {searchResults.map(location => (
                  <li key={location.id}>
                    <button
                      type="button"
                      onClick={() => handleLocationSelect(location)}
                      className="w-full flex items-center gap-3 px-1 py-3 text-left hover:bg-paper-deep transition-colors"
                    >
                      <MapPinIcon className="w-4 h-4 text-ink-mute shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium text-ink truncate">{location.name}</div>
                        <div className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute truncate mt-0.5">{location.address}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent Locations */}
          {recentLocations.length > 0 && (
            <div>
              <p className="label-eyebrow text-ink-mute mb-2">Recent</p>
              <ul className="divide-y divide-edge border-y border-edge">
                {recentLocations.map(location => (
                  <li key={location.id}>
                    <button
                      type="button"
                      onClick={() => handleLocationSelect(location)}
                      className="w-full flex items-center gap-3 px-1 py-3 text-left hover:bg-paper-deep transition-colors"
                    >
                      <MapPinIcon className="w-4 h-4 text-ink-mute shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium text-ink truncate">{location.name}</div>
                        <div className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute truncate mt-0.5">{location.address}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default LocationSelectModal 