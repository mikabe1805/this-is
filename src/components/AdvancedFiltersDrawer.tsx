import React, { useEffect, useMemo, useState } from 'react'
import AddressAutocomplete from './AddressAutocomplete'
import { useFilters } from '../contexts/FiltersContext'

type Props = { isOpen: boolean; onClose: () => void; onApply?: () => void }

export default function AdvancedFiltersDrawer({ isOpen, onClose, onApply }: Props) {
  const { filters, setFilters } = useFilters()
  const [local, setLocal] = useState(filters)
  const [mounted, setMounted] = useState(false)
  const [recentLocations, setRecentLocations] = useState<{ name: string; lat: number; lng: number }[]>([])

  useEffect(() => {
    if (isOpen) {
      setLocal(filters)
      // Load recent locations from localStorage
      try {
        const raw = localStorage.getItem('recent_locations_v1')
        if (raw) {
          const parsed = JSON.parse(raw) as { name: string; lat: number; lng: number }[]
          setRecentLocations(Array.isArray(parsed) ? parsed.slice(0, 6) : [])
        } else {
          setRecentLocations([])
        }
      } catch { setRecentLocations([]) }
      setTimeout(()=> setMounted(true), 0)
    } else {
      setMounted(false)
    }
  }, [isOpen])

  const unitsLabel = useMemo(() => (local.unit === 'mi' ? 'miles' : 'km'), [local.unit])

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[10030]">
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${mounted ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-3xl border border-white/30 shadow-xl p-4 transition-transform duration-200 ${mounted ? 'translate-y-0' : 'translate-y-4'}`}> 
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Advanced Filters</h3>
          <button
            className="text-sage-700 text-sm"
            onClick={() => {
              // Reset only advanced fields; preserve global tags
              const reset = { origin: 'profile' as const, unit: 'mi' as const, distanceKm: 80, priceLevels: [], openNow: false }
              setFilters(reset)
              setLocal({ ...local, ...reset })
              // Notify listeners (e.g., Home) to refresh relevant sections
              try { onApply && onApply() } catch {}
            }}
          >
            Reset
          </button>
        </div>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-sm text-sage-800 mb-1">Distance from</label>
            <div className="flex gap-2">
              <button onClick={() => setLocal({ ...local, origin: 'current' })} className={`px-3 py-1 rounded-full border ${local.origin==='current'? 'bg-sage-100 border-sage-300':'bg-white border-linen-300'}`}>Current location</button>
              <button onClick={() => setLocal({ ...local, origin: 'profile' })} className={`px-3 py-1 rounded-full border ${local.origin==='profile'? 'bg-sage-100 border-sage-300':'bg-white border-linen-300'}`}>Profile location</button>
              <button onClick={() => setLocal({ ...local, origin: 'custom' })} className={`px-3 py-1 rounded-full border ${local.origin==='custom'? 'bg-sage-100 border-sage-300':'bg-white border-linen-300'}`}>Choose location</button>
            </div>
            {local.origin === 'custom' && (
              <div className="mt-2">
                <AddressAutocomplete value={local.location?.name || ''} onPlaceSelect={(formatted, details) => {
                  const lat = details?.geometry?.location?.lat?.() as number | undefined
                  const lng = details?.geometry?.location?.lng?.() as number | undefined
                  setLocal({ ...local, location: lat && lng ? { lat, lng, name: formatted } : undefined })
                }} placeholder="Choose a place" />
              </div>
            )}
            {/* Recent locations */}
            {recentLocations.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-sage-800 mb-1">Recent locations</div>
                <div className="flex flex-wrap gap-2">
                  {recentLocations.map((r, idx) => (
                    <button key={`${r.lat},${r.lng}-${idx}`} onClick={()=> setLocal({ ...local, origin: 'custom', location: { lat: r.lat, lng: r.lng, name: r.name } })} className="px-2 py-1 rounded-full border border-linen-300 bg-white text-xs text-sage-800">
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-sage-800 mb-1">Max distance ({unitsLabel})</label>
            <input type="range" min={5} max={320} step={5} value={Math.round((local.distanceKm || 80) * (local.unit==='mi'? 0.621371 : 1))}
              onChange={e=>{
                const v = Number(e.target.value)
                const km = local.unit==='mi' ? Math.round(v/0.621371) : v
                setLocal({ ...local, distanceKm: km })
              }} className="w-full" />
            <div className="flex items-center justify-between text-sm text-sage-700">
              <span>{local.unit==='mi'? Math.round((local.distanceKm||80)*0.621371): (local.distanceKm||80)} {unitsLabel}</span>
              <button className="underline" onClick={()=> setLocal({ ...local, unit: local.unit==='mi'? 'km':'mi' })}>{local.unit==='mi'? 'Use km':'Use miles'}</button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-sage-800 mb-1">Price</label>
            <div className="flex gap-2">
              {[1,2,3,4].map(p => (
                <button key={p} onClick={() => {
                  const has = (local.priceLevels||[]).includes(p)
                  const next = has ? (local.priceLevels||[]).filter(x=>x!==p) : [...(local.priceLevels||[]), p]
                  setLocal({ ...local, priceLevels: next })
                }} className={`px-3 py-1 rounded-full border ${local.priceLevels?.includes(p)? 'bg-gold-100 border-gold-300':'bg-white border-linen-300'}`}>{'$'.repeat(p)}</button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-sage-800">
            <input type="checkbox" checked={!!local.openNow} onChange={e=> setLocal({ ...local, openNow: e.target.checked })} />
            Open now
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="flex-1 py-2 rounded-xl bg-linen-200" onClick={onClose}>Cancel</button>
          <button className="flex-1 py-2 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #1ea4ff, #1d4ed8)' }}
            onClick={()=>{
              // Apply only advanced fields; keep existing tags
              const { origin, unit, distanceKm, priceLevels, openNow, location } = local
              setFilters({ origin, unit, distanceKm, priceLevels, openNow, location })
              // Persist selected custom location into recents
              try {
                if (origin === 'custom' && location && typeof location.lat === 'number' && typeof location.lng === 'number') {
                  const raw = localStorage.getItem('recent_locations_v1')
                  const arr = raw ? (JSON.parse(raw) as { name: string; lat: number; lng: number }[]) : []
                  const next = [{ name: location.name || 'Custom', lat: location.lat, lng: location.lng }, ...arr.filter(x => !(x.lat===location.lat && x.lng===location.lng))].slice(0, 6)
                  localStorage.setItem('recent_locations_v1', JSON.stringify(next))
                }
              } catch {}
              onClose(); onApply && onApply()
            }}>Apply</button>
        </div>
      </div>
    </div>
  )
}




