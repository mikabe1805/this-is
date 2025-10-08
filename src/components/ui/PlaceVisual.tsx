import { useState, useEffect } from 'react'
import { categoryFromTypes, getPosterPath, type PosterCategory } from '../../utils/posterMapping'

interface PlaceVisualProps {
  types?: string[]
  photoResourceName?: string | null
  userPhotos?: string[]
  alt?: string
  className?: string
  fallbackSrc?: string
}

const PHOTOS_ENABLED = import.meta.env.VITE_PLACES_PHOTOS_ENABLED === 'true'
const PLACES_NEW_KEY = import.meta.env.VITE_PLACES_NEW_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

// Simple daily photo budget (move to separate file if needed)
const DAILY_LIMIT = Number(import.meta.env.VITE_DAILY_GOOGLE_PHOTO_LIMIT ?? 10)
const BUDGET_KEY = 'photoBudget:v1'

function canFetchGooglePhoto(): boolean {
  const today = new Date().toISOString().slice(0, 10)
  const state = JSON.parse(localStorage.getItem(BUDGET_KEY) || '{"date":"","used":0}')
  if (state.date !== today) {
    localStorage.setItem(BUDGET_KEY, JSON.stringify({ date: today, used: 0 }))
    return DAILY_LIMIT > 0
  }
  return state.used < DAILY_LIMIT
}

function markGooglePhotoFetched() {
  const today = new Date().toISOString().slice(0, 10)
  const state = JSON.parse(localStorage.getItem(BUDGET_KEY) || '{"date":"","used":0}')
  const used = (state.date === today ? state.used : 0) + 1
  localStorage.setItem(BUDGET_KEY, JSON.stringify({ date: today, used }))
}

function googlePhotoUrl(resourceName: string, maxWidthPx = 600): string {
  return `https://places.googleapis.com/v1/${resourceName}/media?maxWidthPx=${maxWidthPx}&key=${PLACES_NEW_KEY}`
}

export default function PlaceVisual({ 
  types = [], 
  photoResourceName, 
  userPhotos = [], 
  alt = '', 
  className = '',
  fallbackSrc
}: PlaceVisualProps) {
  const [showGooglePhoto, setShowGooglePhoto] = useState(false)
  const [googlePhotoLoaded, setGooglePhotoLoaded] = useState(false)
  
  const category = categoryFromTypes(types)
  const posterSrc = fallbackSrc || getPosterPath(category)
  const hasUserPhotos = userPhotos.length > 0
  const hasGooglePhoto = PHOTOS_ENABLED && photoResourceName && canFetchGooglePhoto()
  
  useEffect(() => {
    // Dwell-based loading: wait 400ms before showing Google photo
    if (hasGooglePhoto) {
      const timer = setTimeout(() => {
        setShowGooglePhoto(true)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [hasGooglePhoto])
  
  const handleGooglePhotoLoad = () => {
    setGooglePhotoLoaded(true)
    markGooglePhotoFetched()
  }
  
  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Tier 1: Poster (always show as base layer) */}
      <img 
        src={posterSrc} 
        alt={alt} 
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => {
          if (!fallbackSrc) {
            (e.currentTarget as HTMLImageElement).src = '/assets/leaf.png';
          }
        }}
      />
      
      {/* Tier 2: User Photos (if available) */}
      {hasUserPhotos && userPhotos[0] && (
        <img 
          src={userPhotos[0]} 
          alt={alt} 
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      
      {/* Tier 3: Google Photo (budgeted + dwelled) */}
      {!hasUserPhotos && showGooglePhoto && photoResourceName && (
        <>
          <img 
            src={googlePhotoUrl(photoResourceName, 600)} 
            alt={alt} 
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            style={{ opacity: googlePhotoLoaded ? 1 : 0 }}
            onLoad={handleGooglePhotoLoad}
            onError={() => console.warn('Failed to load Google photo')}
          />
          
          {/* Google attribution */}
          {googlePhotoLoaded && (
            <span className="absolute bottom-2 right-2 text-[11px] px-2 py-1 rounded-full glass-text-meta backdrop-blur-sm bg-white/70">
              ⓘ Google
            </span>
          )}
        </>
      )}
    </div>
  )
}
