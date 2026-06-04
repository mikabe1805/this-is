import React, { useEffect, useRef, useState } from 'react'
import { MapPinIcon } from '@heroicons/react/24/outline'
import {
  loadGoogleMapsAPI as loadAdapter,
  beginPlacesSession,
  endPlacesSession,
  getPredictions,
  getPlaceDetails,
} from '../services/google/placesAdapter'
import { loadGoogleMapsAPI as loadMapsJS } from '../services/google/places'

interface GooglePlacesAutocompleteProps {
  onPlaceSelect: (place: string, details?: any) => void
  placeholder?: string
  value?: string
  className?: string
}

type Prediction = { description: string; place_id: string }

function splitPrediction(description: string): { main: string; secondary: string } {
  const idx = description.indexOf(',')
  if (idx === -1) return { main: description, secondary: '' }
  return { main: description.slice(0, idx).trim(), secondary: description.slice(idx + 1).trim() }
}

export default function GooglePlacesAutocomplete({
  onPlaceSelect,
  placeholder = 'Start typing your city…',
  value = '',
  className = '',
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState<string | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortController = useRef<AbortController | null>(null)
  // True once the user has committed a value (picked a suggestion, pressed
  // Enter, or used current location). Lets blur safely commit free-text
  // WITHOUT clobbering a real selection's place details.
  const committedRef = useRef(false)

  useEffect(() => {
    loadAdapter().then(setIsLoaded)
  }, [])

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleFocus = () => {
    if (isLoaded) beginPlacesSession()
  }

  const handleBlur = () => {
    setTimeout(() => {
      setShowDropdown(false)
      // Commit whatever the user typed as free-text if they didn't pick a
      // suggestion. Previously this only fired when the API hadn't loaded, so
      // a user who typed a city but didn't tap a dropdown row left the field
      // value empty — Continue silently did nothing, a hard stop in signup.
      if (!committedRef.current && inputValue.trim()) onPlaceSelect(inputValue.trim())
    }, 200)
  }

  const resetIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => endPlacesSession(), 5000)
  }

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setSelectedIndex(-1)
    setDetectError(null)
    // Typing after a commit re-arms the free-text fallback on the next blur.
    committedRef.current = false

    if (!isLoaded) return

    if (abortController.current) abortController.current.abort()
    abortController.current = new AbortController()

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    resetIdleTimer()

    if (newValue.trim().length < 3) {
      setPredictions([])
      setShowDropdown(false)
      return
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await getPredictions(newValue)
        setPredictions(results as Prediction[])
        setShowDropdown(results.length > 0)
      } catch (err) {
        console.error('[GooglePlacesAutocomplete] predictions failed', err)
        setPredictions([])
        setShowDropdown(false)
      }
    }, 600)
  }

  const handleSelectPrediction = async (prediction: Prediction) => {
    setInputValue(prediction.description)
    setShowDropdown(false)
    setPredictions([])

    committedRef.current = true
    try {
      const details = await getPlaceDetails(prediction.place_id)
      onPlaceSelect(prediction.description, details || undefined)
    } catch (err) {
      console.error('[GooglePlacesAutocomplete] details failed', err)
      onPlaceSelect(prediction.description)
    }

    endPlacesSession()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter always commits — a highlighted suggestion if there is one,
    // otherwise the typed text — so the field is never silently empty.
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showDropdown && selectedIndex >= 0 && selectedIndex < predictions.length) {
        handleSelectPrediction(predictions[selectedIndex])
      } else if (inputValue.trim()) {
        committedRef.current = true
        setShowDropdown(false)
        onPlaceSelect(inputValue.trim())
      }
      return
    }
    if (!showDropdown || predictions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < predictions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setPredictions([])
    }
  }

  const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
    // Try Google JS Geocoder first (already authenticated via VITE_GOOGLE_MAPS_API_KEY).
    try {
      const ok = await loadMapsJS()
      if (ok && window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder()
        const result = await geocoder.geocode({ location: { lat, lng } })
        const first = result.results?.[0]
        if (first) {
          const cityComp = first.address_components?.find(c =>
            c.types.includes('locality') ||
            c.types.includes('postal_town') ||
            c.types.includes('administrative_area_level_2')
          )
          const regionComp = first.address_components?.find(c =>
            c.types.includes('administrative_area_level_1') ||
            c.types.includes('country')
          )
          if (cityComp && regionComp) return `${cityComp.long_name}, ${regionComp.short_name || regionComp.long_name}`
          if (first.formatted_address) return first.formatted_address
        }
      }
    } catch (err) {
      console.warn('[GooglePlacesAutocomplete] google reverse geocode failed', err)
    }

    // Fallback: OpenStreetMap Nominatim (free, no key). Reasonable for a one-shot.
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10`, {
        headers: { 'Accept': 'application/json' },
      })
      if (r.ok) {
        const j = await r.json()
        const a = j.address || {}
        const city = a.city || a.town || a.village || a.municipality || a.county
        const region = a.state_code || a.state || a.country_code?.toUpperCase() || a.country
        if (city && region) return `${city}, ${region}`
        if (j.display_name) return String(j.display_name).split(',').slice(0, 2).map((s: string) => s.trim()).join(', ')
      }
    } catch (err) {
      console.warn('[GooglePlacesAutocomplete] nominatim reverse geocode failed', err)
    }

    return null
  }

  const handleUseCurrentLocation = async (silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) setDetectError("Your browser doesn't support location detection")
      return
    }
    setDetecting(true)
    setDetectError(null)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60000,
        })
      )
      const { latitude: lat, longitude: lng } = pos.coords
      const label = await reverseGeocode(lat, lng) || `${lat.toFixed(3)}, ${lng.toFixed(3)}`
      setInputValue(label)
      committedRef.current = true
      onPlaceSelect(label, {
        geometry: { location: { lat: () => lat, lng: () => lng } },
        formatted_address: label,
      } as any)
    } catch (err: any) {
      if (silent) return
      const msg = err?.code === 1
        ? 'Location permission denied. Type your city instead.'
        : 'Could not detect location. Type your city instead.'
      setDetectError(msg)
    } finally {
      setDetecting(false)
    }
  }

  // Auto-attempt on mount when permission is already granted.
  useEffect(() => {
    if (value || inputValue) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    const perms = (navigator as any).permissions
    if (!perms?.query) return
    let cancelled = false
    perms.query({ name: 'geolocation' }).then((status: any) => {
      if (cancelled) return
      if (status.state === 'granted') void handleUseCurrentLocation(true)
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          className={`w-full h-11 pl-10 pr-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 ${className}`}
          autoComplete="off"
        />
        <MapPinIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
      </div>

      <button
        type="button"
        onClick={() => handleUseCurrentLocation(false)}
        disabled={detecting}
        className="font-mono text-[10px] tracking-[0.10em] uppercase mt-2 text-ink-mute hover:text-ink disabled:opacity-50 disabled:cursor-wait inline-flex items-center gap-1.5"
      >
        {detecting ? (
          <>
            <span className="h-3 w-3 rounded-full border-2 border-ink-mute border-t-transparent animate-spin" />
            Detecting…
          </>
        ) : (
          <><MapPinIcon className="w-3 h-3" /> Use my current location</>
        )}
      </button>

      {detectError && (
        <p className="text-[12px] text-red-700 mt-1.5">{detectError}</p>
      )}

      {/* Dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-2 rounded-xl bg-card border border-edge shadow-lg max-h-60 overflow-y-auto">
          {predictions.map((prediction, index) => {
            const { main, secondary } = splitPrediction(prediction.description)
            const active = index === selectedIndex
            return (
              <button
                key={prediction.place_id}
                type="button"
                className={`w-full px-4 py-3 text-left transition-colors border-b border-edge last:border-b-0 ${
                  active ? 'bg-paper-deep' : 'hover:bg-paper-deep'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelectPrediction(prediction)
                }}
              >
                <div className="flex items-start gap-2">
                  <MapPinIcon className="w-4 h-4 text-ink-mute mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-ink truncate">{main}</div>
                    {secondary && (
                      <div className="text-[12px] text-ink-soft truncate">{secondary}</div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Fallback component for when Google Maps API is not available
export function FallbackLocationInput({
  onLocationChange,
  placeholder = 'Enter your city, state or country',
  value = '',
  className = '',
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
        className={`w-full h-11 pl-10 pr-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 ${className}`}
      />
      <MapPinIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
    </div>
  )
}
