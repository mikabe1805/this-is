import React, { useEffect, useRef, useState } from 'react'
import { MapPinIcon } from '@heroicons/react/24/outline'

interface AddressAutocompleteProps {
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

export default function AddressAutocomplete({
  onPlaceSelect,
  placeholder = "Enter address...",
  value = "",
  className = ""
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [inputValue, setInputValue] = useState(value)

  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMapsAPI = () => {
      console.log('AddressAutocomplete: Starting Google Maps API load...');
      
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log('AddressAutocomplete: Google Maps already loaded');
        setIsLoaded(true)
        return
      }

      // Check if script is already loading
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        console.log('AddressAutocomplete: Google Maps script already loading, waiting...');
        // Wait for the existing script to load
        window.initGoogleMaps = () => {
          console.log('AddressAutocomplete: Google Maps loaded via existing script');
          setIsLoaded(true)
        }
        return
      }

      // Load the Google Maps API script
      const script = document.createElement('script')
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      
      if (!apiKey) {
        console.warn('AddressAutocomplete: Google Maps API key not found. Using fallback address input.')
        setIsLoaded(false)
        return
      }

      console.log('AddressAutocomplete: Loading Google Maps API with key:', apiKey.substring(0, 10) + '...');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&language=en&callback=initGoogleMaps`
      script.async = true
      script.defer = true

      window.initGoogleMaps = () => {
        console.log('AddressAutocomplete: Google Maps API loaded successfully');
        
        // Test if the API is working by checking if we can create a basic map instance
        try {
          if (window.google && window.google.maps && window.google.maps.places) {
            console.log('AddressAutocomplete: Google Maps API is fully functional');
            setIsLoaded(true);
          } else {
            console.error('AddressAutocomplete: Google Maps API loaded but not fully functional');
            setIsLoaded(false);
          }
        } catch (error) {
          console.error('AddressAutocomplete: Error testing Google Maps API:', error);
          setIsLoaded(false);
        }
      }

      script.onerror = () => {
        console.error('AddressAutocomplete: Failed to load Google Maps API')
        setIsLoaded(false)
      }

      script.onload = () => {
        console.log('AddressAutocomplete: Google Maps script loaded');
      }

      document.head.appendChild(script)
    }

    loadGoogleMapsAPI()
  }, [])

  // Initialize autocomplete when loaded
  useEffect(() => {
    if (!isLoaded || !inputRef.current) {
      console.log('AddressAutocomplete: Not ready to initialize autocomplete', { isLoaded, hasInputRef: !!inputRef.current });
      return;
    }

    console.log('AddressAutocomplete: Initializing autocomplete...');

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

      // Create autocomplete instance for addresses with more flexible options
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ['establishment', 'geocode'], // Allow both establishments and addresses
          fields: ['formatted_address', 'name', 'place_id', 'geometry', 'address_components', 'types'],
          componentRestrictions: undefined, // Allow global results
          strictBounds: false
        }
      )

      console.log('AddressAutocomplete: Autocomplete instance created successfully');

      // Restore original console.warn
      console.warn = originalWarn

      // Add place selection listener
      autocompleteRef.current.addListener('place_changed', () => {
        console.log('AddressAutocomplete: Place selection triggered');
        const place = autocompleteRef.current?.getPlace()
        if (place && place.formatted_address) {
          console.log('AddressAutocomplete: Selected place with formatted_address:', place.formatted_address);
          setInputValue(place.formatted_address)
          onPlaceSelect(place.formatted_address, place)
        } else if (place && place.name) {
          // Fallback to name if formatted_address is not available
          console.log('AddressAutocomplete: Selected place with name:', place.name);
          setInputValue(place.name)
          onPlaceSelect(place.name, place)
        } else {
          console.log('AddressAutocomplete: No valid place data received');
        }
      })
    } catch (error) {
      console.error('AddressAutocomplete: Error initializing Google Places Autocomplete:', error)
      setIsLoaded(false) // Mark as not loaded so fallback behavior takes over
    }

    return () => {
      // Cleanup
      if (autocompleteRef.current) {
        try {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
          console.log('AddressAutocomplete: Cleaned up autocomplete listeners');
        } catch (error) {
          console.error('AddressAutocomplete: Error cleaning up autocomplete listeners:', error)
        }
      }
    }
  }, [isLoaded]) // Remove onPlaceSelect from dependencies to prevent re-initialization

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
    // If Google Maps isn't loaded and user typed something, use it as the address
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
          className={`w-full px-4 py-3 pl-10 border border-linen-200 rounded-xl focus:ring-2 focus:ring-sage-200 focus:border-transparent transition-all bg-white text-charcoal-600 ${className}`}
          style={{ zIndex: 1000 }} // Ensure input is above other elements
        />
        <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-charcoal-400" />
      </div>
      
      {/* Status indicator */}
      <div className="mt-1">
        {!isLoaded && (
          <p className="text-xs text-amber-600">
            💡 Loading enhanced address search... You can still type your address manually.
          </p>
        )}
        {isLoaded && (
          <p className="text-xs text-green-600">
            ✓ Smart address search enabled - type to see suggestions
          </p>
        )}
      </div>
      
      {/* Debug info */}
      <div className="mt-1 text-xs text-gray-500">
        <p>Debug: isLoaded={isLoaded.toString()}, hasInputRef={!!inputRef.current}</p>
        <p>Input value: "{inputValue}"</p>
      </div>
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