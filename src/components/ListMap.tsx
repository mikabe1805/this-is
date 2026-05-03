import { useEffect, useRef, useState } from 'react'
import { loadGoogleMapsAPI } from '../services/google/places'
import type { ListPlace } from '../types'

interface ListMapProps {
  places: (ListPlace & { status?: 'want' | 'tried' | 'loved' })[]
  height?: string
  onSelectPlace?: (lp: ListPlace) => void
  selectedPlaceId?: string | null
}

const STATUS_COLOR: Record<string, string> = {
  loved: '#A85F2A',
  tried: '#7A6240',
  want:  '#B8995E',
  default: '#4A3520',
}

function svgMarker(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <defs>
      <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.2" result="b"/>
        <feOffset dx="0" dy="1" in="b" result="o"/>
        <feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <path filter="url(#s)" d="M16 1C8.27 1 2 7.27 2 15c0 9 14 24 14 24s14-15 14-24C30 7.27 23.73 1 16 1z" fill="${color}" stroke="#F4EBDA" stroke-width="2"/>
    <circle cx="16" cy="15" r="5" fill="#F4EBDA"/>
  </svg>`
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}

export default function ListMap({ places, height = '60vh', onSelectPlace, selectedPlaceId }: ListMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const placesWithCoords = places.filter(p => p.place.coordinates?.lat && p.place.coordinates?.lng)

  useEffect(() => {
    let cancelled = false
    loadGoogleMapsAPI().then(ok => {
      if (cancelled) return
      if (!ok) { setLoadError(true); return }
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!loaded || !containerRef.current || mapRef.current) return
    if (!window.google?.maps) { setLoadError(true); return }

    const center = placesWithCoords.length > 0
      ? { lat: placesWithCoords[0].place.coordinates!.lat, lng: placesWithCoords[0].place.coordinates!.lng }
      : { lat: 37.7749, lng: -122.4194 }

    mapRef.current = new window.google.maps.Map(containerRef.current, {
      center,
      zoom: 13,
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
        { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#C7B391' }] },
      ],
    })
  }, [loaded, placesWithCoords])

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    if (placesWithCoords.length === 0) return

    const bounds = new window.google.maps.LatLngBounds()
    placesWithCoords.forEach(lp => {
      const pos = { lat: lp.place.coordinates!.lat, lng: lp.place.coordinates!.lng }
      const status = lp.status || 'default'
      const isSelected = selectedPlaceId === lp.place.id
      const marker = new window.google.maps.Marker({
        map: mapRef.current!,
        position: pos,
        title: lp.place.name,
        icon: {
          url: svgMarker(STATUS_COLOR[status] || STATUS_COLOR.default),
          scaledSize: new window.google.maps.Size(isSelected ? 40 : 32, isSelected ? 50 : 40),
          anchor: new window.google.maps.Point(isSelected ? 20 : 16, isSelected ? 50 : 40),
        },
        zIndex: isSelected ? 999 : 1,
      })
      marker.addListener('click', () => onSelectPlace?.(lp))
      markersRef.current.push(marker)
      bounds.extend(pos)
    })

    if (placesWithCoords.length === 1) {
      mapRef.current.setCenter(bounds.getCenter())
      mapRef.current.setZoom(14)
    } else {
      mapRef.current.fitBounds(bounds, 64)
    }
  }, [loaded, placesWithCoords, selectedPlaceId, onSelectPlace])

  if (loadError) {
    return (
      <div className="rounded-2xl border border-edge bg-card flex items-center justify-center text-center px-6" style={{ height }}>
        <div>
          <p className="font-display text-[20px] text-ink">Map can't load</p>
          <p className="text-[13px] text-ink-soft mt-1">Check the Maps API key in your environment.</p>
        </div>
      </div>
    )
  }

  if (placesWithCoords.length === 0) {
    return (
      <div className="rounded-2xl border border-edge bg-card flex items-center justify-center text-center px-6" style={{ height }}>
        <div>
          <p className="font-display text-[20px] text-ink">No locations yet</p>
          <p className="text-[13px] text-ink-soft mt-1">Places need coordinates to show on the map.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl border border-edge overflow-hidden" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-paper-deep">
          <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute">Loading map…</span>
        </div>
      )}
    </div>
  )
}
