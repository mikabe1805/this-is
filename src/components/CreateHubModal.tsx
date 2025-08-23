import React, { useEffect, useMemo, useState } from 'react'
import { XMarkIcon, MapPinIcon, PhotoIcon } from '@heroicons/react/24/outline'
import AddressAutocomplete from './AddressAutocomplete'

export interface SuggestedPlaceLite {
  id?: string
  name: string
  address?: string
  coordinates?: { lat: number; lng: number }
  images?: string[]
  mainImage?: string
  description?: string
}

interface CreateHubModalProps {
  isOpen: boolean
  onClose: () => void
  place?: SuggestedPlaceLite
  onCreate: (data: { name: string; description?: string; address: string; coordinates?: { lat: number; lng: number }; mainImage?: string }) => Promise<void> | void
}

export default function CreateHubModal({ isOpen, onClose, place, onCreate }: CreateHubModalProps) {
  const [name, setName] = useState(place?.name || '')
  const [address, setAddress] = useState(place?.address || '')
  const [coords, setCoords] = useState(place?.coordinates)
  const [description, setDescription] = useState(place?.description || '')
  const [selectedImage, setSelectedImage] = useState<string | undefined>(place?.mainImage)

  useEffect(() => {
    if (isOpen) {
      setName(place?.name || '')
      setAddress(place?.address || '')
      setCoords(place?.coordinates)
      setDescription(place?.description || '')
      setSelectedImage(place?.mainImage || (place?.images && place.images[0]) || undefined)
    }
  }, [isOpen, place])

  const images = useMemo(() => (place?.images && place.images.length > 0 ? place.images : (place?.mainImage ? [place.mainImage] : [])), [place])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-white/25"
           style={{ background: 'linear-gradient(135deg, rgba(248, 252, 255, 0.75), rgba(220, 236, 255, 0.45))', backdropFilter: 'blur(18px) saturate(1.2)' }}>
        <div className="absolute top-3 right-3 z-10">
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/60 hover:bg-white/80 border border-white/40 shadow-md flex items-center justify-center">
            <XMarkIcon className="w-5 h-5 text-blue-900" />
          </button>
        </div>

        {/* Media selector */}
        <div className="p-4">
          <div className="w-full h-40 rounded-2xl overflow-hidden bg-blue-50 relative">
            {selectedImage ? (
              <img src={selectedImage} alt={name || 'primary'} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-blue-700/70"><PhotoIcon className="w-8 h-8" /></div>
            )}
          </div>
          {images && images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {images.slice(0,10).map((img, i) => (
                <button key={i} onClick={() => setSelectedImage(img)} className={`h-14 rounded-lg overflow-hidden border ${selectedImage===img? 'border-blue-500 ring-2 ring-blue-400':'border-white/40'}`}>
                  <img src={img} alt={`img-${i}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="px-5 pb-5">
          <label className="block text-sm text-blue-900/90 mb-1">Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-white/40 bg-white/70 focus:outline-none" placeholder="Hub name" />

          <label className="block text-sm text-blue-900/90 mt-3 mb-1">Description (optional)</label>
          <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-xl border border-white/40 bg-white/70 focus:outline-none" placeholder="Short description" />

          <label className="block text-sm text-blue-900/90 mt-3 mb-1">Location</label>
          <div className="flex items-center gap-2">
            <MapPinIcon className="w-4 h-4 text-blue-800" />
            <div className="flex-1">
              <AddressAutocomplete
                value={address}
                onPlaceSelect={(formatted, details) => {
                  setAddress(formatted)
                  const lat = details?.geometry?.location?.lat?.() as number | undefined
                  const lng = details?.geometry?.location?.lng?.() as number | undefined
                  setCoords(lat && lng ? { lat, lng } : undefined)
                }}
                placeholder="Search address"
              />
            </div>
          </div>

          <button
            disabled={!name || !address}
            onClick={async () => { await onCreate({ name, description: description || undefined, address, coordinates: coords, mainImage: selectedImage }); onClose() }}
            className="mt-4 w-full py-3 rounded-xl font-semibold text-white shadow-lg disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #1ea4ff, #1d4ed8)' }}
          >
            Create Hub
          </button>
        </div>
      </div>
    </div>
  )
}

