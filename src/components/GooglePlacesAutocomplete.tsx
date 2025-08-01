import React, { useEffect, useRef, useState } from 'react'
import { MapPinIcon } from '@heroicons/react/24/outline'

interface GooglePlacesAutocompleteProps {
  onPlaceSelect: (place: string, details?: google.maps.places.PlaceResult) => void
  placeholder?: string
  value?: string
  className?: string
}

declare global {
  interface Window {
    google: typeof google
    initGoogleMaps: () => void
  }
}

export default function GooglePlacesAutocomplete({
  onPlaceSelect,
  placeholder = "Start typing your city...",
  value = "",
  className = ""
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [inputValue, setInputValue] = useState(value)

  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMapsAPI = () => {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps && window.google.maps.places) {
        setIsLoaded(true)
        return
      }

      // Check if script is already loading
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        // Wait for the existing script to load
        window.initGoogleMaps = () => {
          setIsLoaded(true)
        }
        return
      }

      // Load the Google Maps API script
      const script = document.createElement('script')
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      
      if (!apiKey) {
        console.warn('Google Maps API key not found. Using fallback location input.')
        setIsLoaded(false)
        return
      }

      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&language=en&callback=initGoogleMaps`
      script.async = true
      script.defer = true

      window.initGoogleMaps = () => {
        setIsLoaded(true)
      }

      script.onerror = () => {
        console.error('Failed to load Google Maps API')
        setIsLoaded(false)
      }

      document.head.appendChild(script)
    }

    loadGoogleMapsAPI()
  }, [])

  // Initialize autocomplete when loaded
  useEffect(() => {
    if (!isLoaded || !inputRef.current) return

    try {
      // Note: google.maps.places.Autocomplete is deprecated as of March 2025
      // Google recommends migrating to PlaceAutocompleteElement, but this requires 
      // a significant API rewrite. For now, suppress the deprecation warning.
      const originalWarn = console.warn
      console.warn = (message, ...args) => {
        if (typeof message === 'string' && message.includes('google.maps.places.Autocomplete')) {
          return // Suppress the deprecation warning
        }
        originalWarn(message, ...args)
      }

      // Create autocomplete instance
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ['(cities)'], // Only cities and localities
          fields: ['formatted_address', 'name', 'place_id', 'geometry'],
          componentRestrictions: undefined, // Allow global results
          strictBounds: false
        }
      )

      // Restore original console.warn
      console.warn = originalWarn

      // Add place selection listener
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace()
        if (place && place.formatted_address) {
          setInputValue(place.formatted_address)
          onPlaceSelect(place.formatted_address, place)
        }
      })
    } catch (error) {
      console.error('Error initializing Google Places Autocomplete:', error)
    }

    return () => {
      // Cleanup
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [isLoaded, onPlaceSelect])

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    
    // If Google Maps isn't loaded, still allow manual input
    if (!isLoaded) {
      onPlaceSelect(newValue)
    }
  }

  const handleInputBlur = () => {
    // If Google Maps isn't loaded and user typed something, use it as the location
    if (!isLoaded && inputValue.trim()) {
      onPlaceSelect(inputValue.trim())
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className={`w-full px-4 py-3 pl-10 border border-warmGray-300 rounded-xl focus:ring-2 focus:ring-[#E17373] focus:border-transparent transition-all bg-white ${className}`}
        />
        <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-brown-400" />
      </div>
      
      {!isLoaded && (
        <p className="text-xs text-amber-600 mt-1">
          💡 Enhanced location search loading... You can still type your city manually.
        </p>
      )}
      
      {isLoaded && (
        <p className="text-xs text-green-600 mt-1">
          ✓ Smart location search enabled - type to see suggestions
        </p>
      )}
    </div>
  )
}

// Fallback component for when Google Maps API is not available
export function FallbackLocationInput({
  onLocationChange,
  placeholder = "Enter your city, state or country",
  value = "",
  className = ""
}: {
  onLocationChange: (location: string) => void
  placeholder?: string
  value?: string
  className?: string
}) {
  const [inputValue, setInputValue] = useState(value)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onLocationChange(newValue)
  }

  useEffect(() => {
    setInputValue(value)
  }, [value])

  return (
    <div className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full px-4 py-3 pl-10 border border-warmGray-300 rounded-xl focus:ring-2 focus:ring-[#E17373] focus:border-transparent transition-all bg-white ${className}`}
      />
      <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-brown-400" />
    </div>
  )
} 