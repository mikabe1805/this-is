import { useState, useEffect } from 'react'
import PlacePoster from './PlacePoster'

interface PlaceVisualProps {
  types?: string[]
  photoResourceName?: string | null
  userPhotos?: string[]
  alt?: string
  className?: string
  fallbackSrc?: string
}

const PHOTOS_ENABLED = import.meta.env.VITE_PLACES_PHOTOS_ENABLED === 'true'
// Photos must bill against the dedicated Places key only. Falling back to the
// Maps key (as before) routed Photo SKU charges through a key outside the
// photo-budget discipline; if it's unset we degrade to the poster instead.
const PLACES_NEW_KEY = import.meta.env.VITE_PLACES_NEW_KEY || ''

// Simple daily photo budget (move to separate file if needed). Default raised
// from 10 → 200 because the prior cap was getting hit within minutes of test
// sessions, after which the page looked half-broken (only posters, no photos).
// Set VITE_DAILY_GOOGLE_PHOTO_LIMIT in .env.local to override per environment.
const DAILY_LIMIT = Number(import.meta.env.VITE_DAILY_GOOGLE_PHOTO_LIMIT ?? 200)
const BUDGET_KEY = 'photoBudget:v1'
const FETCHED_KEY = 'photoFetched:v1'
const fetchedThisSession = new Set<string>()

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
  
  const hasUserPhotos = userPhotos.length > 0
  // Also require a configured Places key — without it the media URL 403s, so
  // we'd rather show the poster than a broken image.
  const hasGooglePhoto = PHOTOS_ENABLED && !!PLACES_NEW_KEY && !!photoResourceName && canFetchGooglePhoto()

  useEffect(() => {
    // Brief dwell before swapping in the Google photo (lets the poster paint
    // and avoids fetching photos for cards scrolled past instantly).
    if (hasGooglePhoto) {
      const timer = setTimeout(() => {
        setShowGooglePhoto(true)
      }, 180)
      return () => clearTimeout(timer)
    }
  }, [hasGooglePhoto])

  const handleGooglePhotoLoad = () => {
    setGooglePhotoLoaded(true)
    // Count this photo against the daily budget AT MOST ONCE per unique URL.
    // onLoad fires on every (re)mount, so the old code double-counted
    // re-renders. The in-memory `fetchedThisSession` set is the source of
    // truth for "already counted" so a failing sessionStorage write can never
    // cause a second increment.
    const url = googlePhotoUrl(photoResourceName!, 600)
    if (fetchedThisSession.has(url)) return

    let persistedSeen = false
    try {
      const raw = sessionStorage.getItem(FETCHED_KEY)
      persistedSeen = !!raw && (JSON.parse(raw) as string[]).includes(url)
    } catch {
      // sessionStorage unreadable — rely on the in-memory guard only.
    }

    fetchedThisSession.add(url)
    if (persistedSeen) return // counted on a previous page load today

    markGooglePhotoFetched()
    // Persisting is best-effort; a failure here must NOT re-count.
    try {
      const raw = sessionStorage.getItem(FETCHED_KEY)
      const set = new Set<string>(raw ? JSON.parse(raw) : [])
      set.add(url)
      sessionStorage.setItem(FETCHED_KEY, JSON.stringify(Array.from(set)))
    } catch {
      // ignore — in-memory guard prevents same-session double counting
    }
  }
  
  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Tier 1: CSS-painted poster (always show as base layer) */}
      {fallbackSrc ? (
        <img
          src={fallbackSrc}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <PlacePoster
          types={types}
          name={alt}
          className="absolute inset-0 w-full h-full"
        />
      )}

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
