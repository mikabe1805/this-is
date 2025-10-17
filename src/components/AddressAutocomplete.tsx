import React, { useEffect, useRef, useState } from 'react'
import { MapPinIcon } from '@heroicons/react/24/outline'
import {
  loadGoogleMapsAPI,
  beginPlacesSession,
  endPlacesSession,
  getPredictions,
  getPlaceDetails,
} from '../services/google/placesAdapter'

interface AddressAutocompleteProps {
  onPlaceSelect: (place: string, details?: google.maps.places.PlaceResult) => void
  placeholder?: string
  value?: string
  className?: string
  mode?: 'address' | 'city' | 'place'
  worldwideBias?: boolean
}

declare global {
  interface Window {
    google: typeof google
  }
}

export default function AddressAutocomplete({
  onPlaceSelect,
  placeholder = "Enter address...",
  value = "",
  className = "",
  mode = 'address',
  worldwideBias = true
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const idleTimer = useRef<NodeJS.Timeout | null>(null)
  const abortController = useRef<AbortController | null>(null)

  // Load Google Maps API once on mount
  useEffect(() => {
    loadGoogleMapsAPI().then(setIsLoaded)
  }, [])

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Handle input focus - start a new Places session
  const handleFocus = () => {
    if (isLoaded) {
      beginPlacesSession()
      console.log('[AddressAutocomplete] Session started')
    }
  }

  // Handle input blur - end session after idle period
  const handleBlur = () => {
    // Delay to allow click on dropdown
    setTimeout(() => {
      setShowDropdown(false)
      
      // If Google Maps isn't loaded and user typed something, use it as the address
      if (!isLoaded && inputValue.trim()) {
        onPlaceSelect(inputValue.trim())
      }
    }, 200)
  }

  // End session after 5s idle
  const resetIdleTimer = () => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current)
    }
    idleTimer.current = setTimeout(() => {
      endPlacesSession()
      console.log('[AddressAutocomplete] Session ended due to idle')
    }, 5000)
  }

  // Handle input change with debouncing
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setSelectedIndex(-1)
    
    // If Google Maps isn't loaded, still allow manual input
    if (!isLoaded) {
      return
    }

    // Cancel any pending request
    if (abortController.current) {
      abortController.current.abort()
    }
    abortController.current = new AbortController()

    // Clear existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    // Reset idle timer
    resetIdleTimer()

    // Require minimum 3 characters
    if (newValue.trim().length < 3) {
      setPredictions([])
      setShowDropdown(false)
      return
    }

    // Debounce for 600ms to reduce API calls
    debounceTimer.current = setTimeout(async () => {
      try {
        // Determine types by mode
        const types =
          mode === 'city' ? ['(cities)'] :
          mode === 'place' ? ['establishment'] :
          undefined // geocode + establishment

        const results = await getPredictions(newValue, {
          types,
          ...(worldwideBias ? {} : {}), // Can add locationBias here if needed
        })

        setPredictions(results)
        setShowDropdown(results.length > 0)
      } catch (error) {
        console.error('[AddressAutocomplete] Error fetching predictions:', error)
        setPredictions([])
        setShowDropdown(false)
      }
    }, 600)
  }

  // Handle prediction selection
  const handleSelectPrediction = async (prediction: google.maps.places.AutocompletePrediction) => {
    setInputValue(prediction.description)
    setShowDropdown(false)
    setPredictions([])

    // Fetch full details for the selected place
    try {
      const details = await getPlaceDetails(prediction.place_id)
      
      if (details) {
        onPlaceSelect(prediction.description, details)
      } else {
        // Fallback to just the description
        onPlaceSelect(prediction.description)
      }
    } catch (error) {
      console.error('[AddressAutocomplete] Error fetching place details:', error)
      onPlaceSelect(prediction.description)
    }

    // End the session after selection
    endPlacesSession()
    console.log('[AddressAutocomplete] Session ended after selection')
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || predictions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < predictions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < predictions.length) {
        handleSelectPrediction(predictions[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setPredictions([])
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (idleTimer.current) clearTimeout(idleTimer.current)
      if (abortController.current) abortController.current.abort()
    }
  }, [])

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full px-4 py-3 pl-10 border border-linen-200 rounded-xl focus:ring-2 focus:ring-sage-200 focus:border-transparent transition-all bg-white text-charcoal-600 ${className}`}
          autoComplete="off"
        />
        <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-charcoal-400" />
      </div>

      {/* Dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-linen-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              type="button"
              className={`w-full px-4 py-3 text-left hover:bg-sage-50 transition-colors ${
                index === selectedIndex ? 'bg-sage-100' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault() // Prevent blur
                handleSelectPrediction(prediction)
              }}
            >
              <div className="flex items-start gap-2">
                <MapPinIcon className="w-4 h-4 text-sage-600 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-charcoal-800 truncate">
                    {prediction.structured_formatting.main_text}
                  </div>
                  <div className="text-xs text-charcoal-500 truncate">
                    {prediction.structured_formatting.secondary_text}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function FallbackAddressInput({
  onAddressChange,
  placeholder = "Enter address",
  value = "",
  className = ""
}: {
  onAddressChange: (address: string) => void
  placeholder?: string
  value?: string
  className?: string
}) {
  const [inputValue, setInputValue] = useState(value)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onAddressChange(newValue)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full px-4 py-3 pl-10 border border-linen-200 rounded-xl focus:ring-2 focus:ring-sage-200 focus:border-transparent transition-all bg-white text-charcoal-600 ${className}`}
      />
      <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-charcoal-400" />
    </div>
  )
}
