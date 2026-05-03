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

type Prediction = { description: string; place_id: string }

function splitPrediction(description: string): { main: string; secondary: string } {
  const idx = description.indexOf(',')
  if (idx === -1) return { main: description, secondary: '' }
  return { main: description.slice(0, idx).trim(), secondary: description.slice(idx + 1).trim() }
}

export default function AddressAutocomplete({
  onPlaceSelect,
  placeholder = 'Enter address…',
  value = '',
  className = '',
  mode = 'address',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortController = useRef<AbortController | null>(null)

  useEffect(() => {
    loadGoogleMapsAPI().then(setIsLoaded)
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
      if (!isLoaded && inputValue.trim()) onPlaceSelect(inputValue.trim())
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
      } catch (error) {
        console.error('[AddressAutocomplete] predictions failed', error)
        setPredictions([])
        setShowDropdown(false)
      }
    }, 600)
  }

  const handleSelectPrediction = async (prediction: Prediction) => {
    setInputValue(prediction.description)
    setShowDropdown(false)
    setPredictions([])

    try {
      const details = await getPlaceDetails(prediction.place_id)
      if (details) onPlaceSelect(prediction.description, details)
      else onPlaceSelect(prediction.description)
    } catch (error) {
      console.error('[AddressAutocomplete] details failed', error)
      onPlaceSelect(prediction.description)
    }

    endPlacesSession()
  }

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

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (idleTimer.current) clearTimeout(idleTimer.current)
      if (abortController.current) abortController.current.abort()
    }
  }, [])

  // mode='city' currently has no effect server-side since placesAdapter
  // doesn't accept a types filter — leaving it on the public API for
  // forward-compat without lint-failing the unused param.
  void mode

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

export function FallbackAddressInput({
  onAddressChange,
  placeholder = 'Enter address',
  value = '',
  className = '',
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
        className={`w-full h-11 pl-10 pr-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 ${className}`}
      />
      <MapPinIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
    </div>
  )
}
