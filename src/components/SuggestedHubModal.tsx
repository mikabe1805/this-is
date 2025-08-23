import React, { useEffect, useState } from 'react'
import { XMarkIcon, MapPinIcon, ArrowRightIcon, PlusIcon, GlobeAltIcon } from '@heroicons/react/24/outline'

interface SuggestedPlace {
  id: string
  name: string
  address?: string
  coordinates?: { lat: number; lng: number }
  images?: string[]
  mainImage?: string
  description?: string
  rating?: number
  userRatingsTotal?: number
  priceLevel?: number
  openNow?: boolean
  website?: string
  googleMapsUrl?: string
}

interface SuggestedHubModalProps {
  isOpen: boolean
  onClose: () => void
  place: SuggestedPlace
  onCreateHub: (place: SuggestedPlace) => Promise<void> | void
}

const priceToDollars = (p?: number) => (typeof p === 'number' ? '$'.repeat(Math.max(1, Math.min(4, p))) : undefined)

export default function SuggestedHubModal({ isOpen, onClose, place, onCreateHub }: SuggestedHubModalProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (isOpen) setIndex(0)
  }, [isOpen])

  if (!isOpen) return null

  const images = (place.images && place.images.length > 0) ? place.images : (place.mainImage ? [place.mainImage] : [])
  const price = priceToDollars(place.priceLevel)

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-white/25"
           style={{ background: 'linear-gradient(135deg, rgba(248, 252, 255, 0.6), rgba(220, 236, 255, 0.35))', backdropFilter: 'blur(18px) saturate(1.2)' }}>
        {/* Header */}
        <div className="absolute top-3 right-3 z-10">
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/60 hover:bg-white/80 border border-white/40 shadow-md flex items-center justify-center">
            <XMarkIcon className="w-5 h-5 text-blue-900" />
          </button>
        </div>

        {/* Media */}
        <div className="relative h-56 bg-gradient-to-br from-blue-200/50 to-blue-100/30">
          {images[index] && (
            <img src={images[index]} alt={place.name} className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
          {images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
              {images.slice(0, 5).map((_, i) => (
                <button key={i} onClick={() => setIndex(i)} className={`w-2 h-2 rounded-full ${i===index? 'bg-white':'bg-white/60'}`} />
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5">
          <h2 className="text-lg font-semibold text-blue-900 mb-1">{place.name}</h2>
          <div className="text-sm text-blue-800 flex items-center gap-2 mb-3">
            <MapPinIcon className="w-4 h-4" />
            <span className="line-clamp-2">{place.address}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-blue-900/90 mb-3">
            {typeof place.rating === 'number' && (
              <span>{place.rating.toFixed(1)} ★</span>
            )}
            {typeof place.userRatingsTotal === 'number' && (
              <span className="text-blue-900/70">({place.userRatingsTotal})</span>
            )}
            {price && (
              <span className="px-2 py-0.5 rounded-full bg-white/60 border border-white/40 text-xs">{price}</span>
            )}
            {place.openNow && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-700 text-xs">Open now</span>
            )}
            {place.website && (
              <a href={place.website} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-blue-700 hover:underline">
                <GlobeAltIcon className="w-4 h-4" /> Website
              </a>
            )}
          </div>
          {place.description && (
            <p className="text-sm text-blue-900/90 mb-4 line-clamp-4">{place.description}</p>
          )}

          <div className="flex gap-3">
            <a
              href={place.googleMapsUrl || (place.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.address)}` : (place.coordinates ? `https://www.google.com/maps/search/?api=1&query=${place.coordinates.lat},${place.coordinates.lng}` : '#'))}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white shadow-md border border-blue-700/30"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
            >
              <MapPinIcon className="w-4 h-4" /> Directions <ArrowRightIcon className="w-3 h-3" />
            </a>
            <button
              onClick={async () => { await onCreateHub(place) }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white shadow-md border border-blue-700/30"
              style={{ background: 'linear-gradient(135deg, #1ea4ff, #1d4ed8)' }}
            >
              <PlusIcon className="w-4 h-4" /> Create Hub
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
