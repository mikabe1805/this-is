import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, CheckIcon, PhotoIcon } from '@heroicons/react/24/outline'
import { getDetails, searchText } from '../lib/placesNew'
import { firebaseDataService } from '../services/firebaseDataService'
import { useModalDismiss } from '../hooks/useModalDismiss'
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss'

// Build the photo URL directly — the cover picker is a single intentional
// user action, not an automated background fetch, so we don't want the global
// PHOTOS_ON budget gate to silently empty it.
const PLACES_KEY = (import.meta.env.VITE_PLACES_NEW_KEY as string)
  || (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string)
  || ''
function directPhotoUrl(resourceName: string, px = 600) {
  if (!PLACES_KEY) return ''
  return `https://places.googleapis.com/v1/${resourceName}/media?maxWidthPx=${px}&key=${PLACES_KEY}`
}

interface CoverPhotoPickerProps {
  isOpen: boolean
  onClose: () => void
  hubId: string                 // firestore id of the just-materialized hub
  googlePlaceId: string         // the Google Places API id we can fetch photos from
  hubName: string
}

export default function CoverPhotoPicker({
  isOpen,
  onClose,
  hubId,
  googlePlaceId,
  hubName,
}: CoverPhotoPickerProps) {
  const [resourceNames, setResourceNames] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen || !googlePlaceId) return
    setLoading(true)
    setResourceNames([])
    setSelected(null)
    let cancelled = false

    const tryGetDetails = async () => {
      try {
        const d = await getDetails(googlePlaceId)
        const names = (d?.photos || []).map(p => p.name).filter(Boolean) as string[]
        if (cancelled) return null
        if (names.length > 0) return names
      } catch (e) {
        console.warn('[cover-picker] getDetails failed', e)
      }
      return null
    }

    // Fallback path: if the stored id is actually a Firestore id (legacy
    // place doc that predated googlePlaceId), search Google by name+address
    // to get a fresh place_id and try again. Lets users retroactively pick
    // photos for any place that has none.
    const tryByName = async () => {
      try {
        const results = await searchText(hubName, { max: 1 })
        if (cancelled) return null
        const candidate = results?.[0]
        if (candidate?.id) {
          const d = await getDetails(candidate.id)
          const names = (d?.photos || []).map(p => p.name).filter(Boolean) as string[]
          if (cancelled) return null
          if (names.length > 0) return names
        }
      } catch (e) {
        console.warn('[cover-picker] searchText fallback failed', e)
      }
      return null
    }

    void (async () => {
      const direct = await tryGetDetails()
      if (cancelled) return
      const names = direct || await tryByName()
      if (cancelled) return
      const slice = (names || []).slice(0, 6)
      setResourceNames(slice)
      setSelected(slice[0] || null)
      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [isOpen, googlePlaceId, hubName])

  useModalDismiss(isOpen, onClose)
  const sheetRef = useRef<HTMLDivElement>(null)
  useSwipeToDismiss({ ref: sheetRef, onDismiss: onClose, enabled: isOpen })

  if (!isOpen) return null

  const handleSave = async () => {
    if (!selected) { onClose(); return }
    setSaving(true)
    try {
      const url = directPhotoUrl(selected, 1200)
      if (url) await firebaseDataService.setHubMainImage(hubId, url)
    } finally {
      setSaving(false)
      onClose()
    }
  }

  const content = (
    <div className="fixed inset-0 z-[10005] flex items-end sm:items-center justify-center bg-[#1A1815]/55 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={sheetRef}
        className="modal-paper w-full sm:max-w-md max-h-[90vh] rounded-t-[24px] sm:rounded-[24px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0 touch-none" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>
        <div data-drag-handle className="flex items-center justify-between px-5 py-4 border-b border-edge">
          <p className="label-eyebrow text-ink-mute">Cover photo</p>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center" aria-label="Close">
            <XMarkIcon className="w-5 h-5 text-ink" />
          </button>
        </div>

        <div className="px-5 pt-5 pb-3">
          <p className="font-display text-[24px] leading-tight text-ink">
            You're the first to save <span className="font-display-italic">{hubName}</span>.
          </p>
          <p className="text-[13px] text-ink-soft mt-2">
            Pick a cover photo so it looks good for the next person who finds it. Or skip — you can change it later.
          </p>
        </div>

        <div className="px-5 pb-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] rounded-[10px] bg-paper-deep animate-pulse" />
              ))}
            </div>
          ) : resourceNames.length === 0 ? (
            <div className="border border-edge rounded-[14px] py-10 text-center">
              <PhotoIcon className="w-7 h-7 text-ink-faint mx-auto" />
              <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute mt-3">No photos available</p>
              <p className="text-[13px] text-ink-soft mt-1">You can add one yourself in a post.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {resourceNames.map((name) => {
                const url = directPhotoUrl(name, 600)
                const active = selected === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelected(name)}
                    className={`relative aspect-[4/3] rounded-[10px] overflow-hidden border-2 transition-colors ${
                      active ? 'border-accent' : 'border-transparent hover:border-edge'
                    }`}
                  >
                    {url ? (
                      <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="absolute inset-0 bg-paper-deep flex items-center justify-center">
                        <PhotoIcon className="w-6 h-6 text-ink-faint" />
                      </div>
                    )}
                    {active && (
                      <span className="absolute top-2 right-2 h-6 w-6 rounded-full bg-accent text-white flex items-center justify-center">
                        <CheckIcon className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-edge flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1 h-12 font-medium text-[15px]"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selected || saving}
            className="btn-cta flex-1 h-12 font-semibold text-[15px]"
          >
            {saving ? 'Saving…' : 'Use this'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
