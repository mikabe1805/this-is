import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import AddressAutocomplete from './AddressAutocomplete'
import { useFilters } from '../contexts/FiltersContext'

type Props = { isOpen: boolean; onClose: () => void; onApply?: () => void }

export default function AdvancedFiltersDrawer({ isOpen, onClose, onApply }: Props) {
  const { filters, setFilters } = useFilters()
  const [local, setLocal] = useState(filters)
  const [recentLocations, setRecentLocations] = useState<{ name: string; lat: number; lng: number }[]>([])

  useEffect(() => {
    if (isOpen) {
      setLocal(filters)
      try {
        const raw = localStorage.getItem('recent_locations_v1')
        if (raw) {
          const parsed = JSON.parse(raw) as { name: string; lat: number; lng: number }[]
          setRecentLocations(Array.isArray(parsed) ? parsed.slice(0, 6) : [])
        } else {
          setRecentLocations([])
        }
      } catch { setRecentLocations([]) }
    }
  }, [isOpen, filters])

  const unitsLabel = useMemo(() => (local.unit === 'mi' ? 'miles' : 'km'), [local.unit])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const originOptions = [
    { key: 'current' as const, label: 'Current' },
    { key: 'profile' as const, label: 'Profile' },
    { key: 'custom' as const, label: 'Choose' }
  ]

  return createPortal(
    <div className="fixed inset-0 z-[10040] flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-paper relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-edge max-h-[92vh] flex flex-col overflow-hidden"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-edge relative z-10">
          <p className="label-eyebrow text-ink-mute">Advanced filters</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const reset = { origin: 'profile' as const, unit: 'mi' as const, distanceKm: 80, priceLevels: [], openNow: false }
                setFilters(reset)
                setLocal({ ...local, ...reset })
                try { onApply && onApply() } catch {}
              }}
              className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute hover:text-ink h-9 px-3 rounded-full hover:bg-paper-deep transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto relative z-10 px-5 sm:px-6 py-5 space-y-5" style={{ overscrollBehavior: 'contain', touchAction: 'manipulation' }}>
          {/* Distance from */}
          <div>
            <p className="label-eyebrow text-ink-mute mb-2.5">Distance from</p>
            <div className="grid grid-cols-3 gap-2">
              {originOptions.map(({ key, label }) => {
                const active = local.origin === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLocal({ ...local, origin: key })}
                    aria-pressed={active}
                    className={`h-10 rounded-xl border text-[13px] font-medium transition-colors ${
                      active ? 'border-ink bg-paper-deep text-ink' : 'border-edge bg-card text-ink hover:border-ink/40'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {local.origin === 'custom' && (
              <div className="mt-3">
                <AddressAutocomplete
                  mode="city"
                  worldwideBias
                  value={local.location?.name || ''}
                  onPlaceSelect={(formatted, details) => {
                    const lat = details?.geometry?.location?.lat?.() as number | undefined
                    const lng = details?.geometry?.location?.lng?.() as number | undefined
                    setLocal({ ...local, location: lat && lng ? { lat, lng, name: formatted } : undefined })
                  }}
                  placeholder="Choose a place"
                />
              </div>
            )}
            {recentLocations.length > 0 && (
              <div className="mt-3">
                <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mb-2">Recent</p>
                <div className="flex flex-wrap gap-1.5">
                  {recentLocations.map((r, idx) => (
                    <button
                      key={`${r.lat},${r.lng}-${idx}`}
                      type="button"
                      onClick={() => setLocal({ ...local, origin: 'custom', location: { lat: r.lat, lng: r.lng, name: r.name } })}
                      className="h-8 px-3 rounded-full border border-edge bg-card text-[12px] text-ink hover:border-ink/40 transition-colors"
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Distance slider */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label htmlFor="adv-distance" className="label-eyebrow text-ink-mute">Max distance</label>
              <button
                type="button"
                onClick={() => setLocal({ ...local, unit: local.unit === 'mi' ? 'km' : 'mi' })}
                className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute hover:text-ink"
              >
                {local.unit === 'mi' ? 'Use km' : 'Use miles'}
              </button>
            </div>
            <input
              id="adv-distance"
              type="range"
              min={5}
              max={320}
              step={5}
              value={Math.round((local.distanceKm || 80) * (local.unit === 'mi' ? 0.621371 : 1))}
              onChange={(e) => {
                const v = Number(e.target.value)
                const km = local.unit === 'mi' ? Math.round(v / 0.621371) : v
                setLocal({ ...local, distanceKm: km })
              }}
              className="w-full accent-ink"
            />
            <div className="text-[12px] text-ink-soft mt-1">
              {local.unit === 'mi' ? Math.round((local.distanceKm || 80) * 0.621371) : (local.distanceKm || 80)} {unitsLabel}
            </div>
          </div>

          {/* Price */}
          <div>
            <p className="label-eyebrow text-ink-mute mb-2.5">Price</p>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map(p => {
                const active = (local.priceLevels || []).includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      const has = (local.priceLevels || []).includes(p)
                      const next = has ? (local.priceLevels || []).filter(x => x !== p) : [...(local.priceLevels || []), p]
                      setLocal({ ...local, priceLevels: next })
                    }}
                    aria-pressed={active}
                    className={`h-10 rounded-xl border text-[14px] font-medium transition-colors ${
                      active ? 'border-ink bg-paper-deep text-ink' : 'border-edge bg-card text-ink hover:border-ink/40'
                    }`}
                  >
                    {'$'.repeat(p)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Open now */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-edge bg-card cursor-pointer hover:border-ink/40 transition-colors">
            <input
              type="checkbox"
              checked={!!local.openNow}
              onChange={(e) => setLocal({ ...local, openNow: e.target.checked })}
              className="w-4 h-4 accent-ink rounded"
            />
            <span className="text-[14px] font-medium text-ink">Open now</span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-edge relative z-10 flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 h-12 font-semibold text-[14px]">Cancel</button>
          <button
            type="button"
            onClick={() => {
              const { origin, unit, distanceKm, priceLevels, openNow, location } = local
              setFilters({ origin, unit, distanceKm, priceLevels, openNow, location })
              try {
                if (origin === 'custom' && location && typeof location.lat === 'number' && typeof location.lng === 'number') {
                  const raw = localStorage.getItem('recent_locations_v1')
                  const arr = raw ? (JSON.parse(raw) as { name: string; lat: number; lng: number }[]) : []
                  const next = [{ name: location.name || 'Custom', lat: location.lat, lng: location.lng }, ...arr.filter(x => !(x.lat === location.lat && x.lng === location.lng))].slice(0, 6)
                  localStorage.setItem('recent_locations_v1', JSON.stringify(next))
                }
              } catch {}
              onClose()
              setTimeout(() => { try { onApply && onApply() } catch {} }, 0)
            }}
            className="btn-cta flex-1 h-12 font-semibold text-[15px]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
