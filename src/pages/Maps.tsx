import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftIcon, MapIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { firebaseDataService } from '../services/firebaseDataService'
import { firebaseListService } from '../services/firebaseListService'
import { loadGoogleMapsAPI } from '../services/google/places'
import { readCoords } from '../utils/coords'
import type { Place, List } from '../types/index.js'

/**
 * Global "all my places" map. Pulls every place the user has saved (via the
 * users/{uid}/savedPlaces mirror) plus every place across their lists, dedupes,
 * and pins them on a single Google Map. Tapping a pin opens that place's hub.
 *
 * Skips places without resolvable coordinates (handled by readCoords —
 * rejects (0,0) and supports both lat/lng and latitude/longitude shapes).
 */
const MARKER_COLOR = '#A85F2A'
const USER_COLOR = '#A85F2A'

function svgMarker(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path d="M16 1C8.27 1 2 7.27 2 15c0 9 14 24 14 24s14-15 14-24C30 7.27 23.73 1 16 1z" fill="${color}" stroke="#F4EBDA" stroke-width="2"/>
    <circle cx="16" cy="15" r="5" fill="#F4EBDA"/>
  </svg>`
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}

const Maps = () => {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [places, setPlaces] = useState<(Place & { coords: { lat: number; lng: number } })[]>([])
  const [loading, setLoading] = useState(true)
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [mapsError, setMapsError] = useState(false)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const userMarkerRef = useRef<google.maps.Marker | null>(null)

  // Load all of the user's saved places + every place across their lists, dedupe.
  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [savedPlaces, lists] = await Promise.all([
          firebaseDataService.getSavedPlaces(currentUser.id),
          firebaseDataService.getUserLists(currentUser.id),
        ])
        if (cancelled) return
        const byId = new Map<string, Place>()
        for (const p of savedPlaces) if (p?.id) byId.set(p.id, p)
        // Pull each list's place rows so user-curated lists also appear on the
        // map even when the user-side savedPlaces mirror lags behind.
        const listPlaces = await Promise.all(
          (lists || []).map(l => firebaseListService.getPlacesForList(l.id).catch(() => []))
        )
        if (cancelled) return
        for (const places of listPlaces) {
          for (const lp of places) {
            const place = (lp as { place?: Place }).place
            if (place?.id && !byId.has(place.id)) byId.set(place.id, place)
          }
        }
        const enriched = Array.from(byId.values()).map(p => {
          const c = readCoords(p)
          return c ? { ...p, coords: c } : null
        }).filter(Boolean) as (Place & { coords: { lat: number; lng: number } })[]
        if (!cancelled) setPlaces(enriched)
      } catch (e) {
        console.error('[maps] load failed', e)
        if (!cancelled) setPlaces([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [currentUser])

  // Load Google Maps SDK once.
  useEffect(() => {
    let cancelled = false
    loadGoogleMapsAPI().then(ok => {
      if (cancelled) return
      if (!ok) setMapsError(true)
      else setMapsLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  // Best-effort current location — only if permission is already granted, no
  // extra prompt. Drives the "you are here" pin and centers the empty-state map.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    let cancelled = false
    const tryGet = () => navigator.geolocation.getCurrentPosition(
      pos => { if (!cancelled) setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }) },
      () => {},
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    )
    const perms = (navigator as Navigator & { permissions?: { query: (q: { name: string }) => Promise<{ state: string }> } }).permissions
    if (perms?.query) {
      perms.query({ name: 'geolocation' }).then(s => {
        if (!cancelled && s.state === 'granted') tryGet()
      }).catch(() => {})
    } else {
      tryGet()
    }
    return () => { cancelled = true }
  }, [])

  // Initialize the map.
  useEffect(() => {
    if (!mapsLoaded || !containerRef.current || mapRef.current) return
    if (!window.google?.maps) { setMapsError(true); return }
    const center = places[0]?.coords || userPos || { lat: 37.7749, lng: -122.4194 }
    try {
      mapRef.current = new window.google.maps.Map(containerRef.current, {
        center,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'greedy',
        backgroundColor: '#F4EBDA',
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#F0E6D2' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#5A4630' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#F4EBDA' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D9C8AE' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#E8D9BE' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#D4BF9C' }] },
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#E5D6BB' }] },
        ],
      })
    } catch (e) {
      console.error('[maps] init failed', e)
      setMapsError(true)
    }
  }, [mapsLoaded, places, userPos])

  // Plot pins.
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    if (places.length === 0) return
    const bounds = new window.google.maps.LatLngBounds()
    for (const p of places) {
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: p.coords,
        title: p.name,
        icon: {
          url: svgMarker(MARKER_COLOR),
          scaledSize: new window.google.maps.Size(32, 40),
          anchor: new window.google.maps.Point(16, 40),
        },
      })
      marker.addListener('click', () => navigate(`/place/${p.id}`))
      markersRef.current.push(marker)
      bounds.extend(p.coords)
    }
    if (userPos) bounds.extend(userPos)
    if (places.length === 1 && !userPos) {
      mapRef.current.setCenter(bounds.getCenter())
      mapRef.current.setZoom(14)
    } else {
      mapRef.current.fitBounds(bounds, 64)
    }
  }, [places, userPos, navigate])

  // User-location pin.
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return
    if (userMarkerRef.current) { userMarkerRef.current.setMap(null); userMarkerRef.current = null }
    if (!userPos) return
    const youSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="14" fill="rgba(168, 95, 42, 0.18)"/>
        <circle cx="18" cy="18" r="9" fill="rgba(168, 95, 42, 0.32)"/>
        <circle cx="18" cy="18" r="6" fill="${USER_COLOR}" stroke="#F4EBDA" stroke-width="2.5"/>
      </svg>`
    )}`
    userMarkerRef.current = new window.google.maps.Marker({
      map: mapRef.current,
      position: userPos,
      title: 'You are here',
      icon: {
        url: youSvg,
        scaledSize: new window.google.maps.Size(36, 36),
        anchor: new window.google.maps.Point(18, 18),
      },
      zIndex: 1000,
    })
  }, [userPos])

  const placeCount = useMemo(() => places.length, [places])

  return (
    <div className="relative min-h-full bg-paper">
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/') }}
            aria-label="Back"
            className="h-10 w-10 rounded-full hover:bg-paper-deep flex items-center justify-center"
          >
            <ArrowLeftIcon className="w-5 h-5 text-ink" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-[22px] leading-none text-ink">Map</h1>
            {!loading && (
              <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute mt-1">
                {placeCount} {placeCount === 1 ? 'place pinned' : 'places pinned'}
              </p>
            )}
          </div>
        </div>
        <div className="border-b border-edge mx-5" />
      </header>

      <div className="relative z-10 px-5 py-5 max-w-3xl mx-auto">
        {mapsError ? (
          <div className="border border-edge rounded-[14px] px-5 py-12 text-center bg-card">
            <p className="font-display text-[22px] text-ink">Map can't load.</p>
            <p className="text-[13px] text-ink-soft mt-2">Check the Maps API key in your environment.</p>
          </div>
        ) : (
          <div className="relative rounded-2xl border border-edge overflow-hidden" style={{ height: '70vh' }}>
            <div ref={containerRef} className="absolute inset-0" />
            {(!mapsLoaded || loading) && (
              <div className="absolute inset-0 flex items-center justify-center bg-paper-deep">
                <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute">Loading map…</span>
              </div>
            )}
            {mapsLoaded && !loading && places.length === 0 && (
              <div className="absolute left-3 right-3 bottom-3 rounded-xl bg-paper/95 backdrop-blur-sm border border-edge px-3.5 py-2.5">
                <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute">Map</p>
                <p className="text-[13px] text-ink mt-0.5">No saved places yet — save a few and they'll pin here.</p>
              </div>
            )}
          </div>
        )}

        {!loading && places.length === 0 && !mapsError && (
          <div className="text-center py-8">
            <MapIcon className="w-8 h-8 text-ink-mute mx-auto mb-3" />
            <p className="font-display text-[20px] text-ink leading-tight">Nothing pinned yet.</p>
            <p className="text-[13px] text-ink-soft mt-2 max-w-sm mx-auto">
              Once you save places they'll appear here on a single map.
            </p>
            <button onClick={() => navigate('/explore')} className="btn-cta h-11 px-5 mt-5 label-eyebrow">
              Find places
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Maps
