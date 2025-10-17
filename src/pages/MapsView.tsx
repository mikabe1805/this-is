import { useEffect, useMemo, useRef, useState } from 'react'
import HubImage from '../components/HubImage'

type BBox = { north: number; south: number; east: number; west: number }

function throttle<T extends (...a: any[]) => any>(fn: T, ms: number) {
  let last = 0; let timer: any
  return (...args: any[]) => {
    const now = Date.now()
    if (now - last >= ms) { last = now; return fn(...args) }
    clearTimeout(timer)
    timer = setTimeout(() => { last = Date.now(); fn(...args) }, ms - (now - last))
  }
}

function cellIdFromBounds(b: BBox): string {
  const f = (v: number) => (Math.round(v * 100) / 100).toFixed(2)
  return `${f(b.north)}:${f(b.south)}:${f(b.east)}:${f(b.west)}`
}

export default function MapsView() {
  const [bounds, setBounds] = useState<BBox>({ north: 37.81, south: 37.70, east: -122.35, west: -122.53 })
  const [places, setPlaces] = useState<any[]>([])
  const [inflight, setInflight] = useState(0)
  const [dragging, setDragging] = useState(false)
  const lastReq = useRef(0)

  const fetchNearby = useMemo(() => throttle(async (b: BBox) => {
    if (dragging) return
    if (inflight >= 2) return
    const now = Date.now()
    if (now - lastReq.current < 750) return
    lastReq.current = now
    setInflight(v => v + 1)
    try {
      const key = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || ''
      const r = await fetch('/mapsNearby', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bounds: b, clientKey: key }) })
      const j = await r.json()
      setPlaces(j.places || [])
      try { localStorage.setItem(`map:${cellIdFromBounds(b)}`, JSON.stringify({ t: Date.now(), v: j.places || [] })) } catch {}
    } finally {
      setInflight(v => Math.max(0, v - 1))
    }
  }, 750), [dragging, inflight])

  useEffect(() => {
    // try local cache first
    const key = `map:${cellIdFromBounds(bounds)}`
    try {
      const c = localStorage.getItem(key)
      if (c) {
        const { t, v } = JSON.parse(c)
        if (Date.now() - t < 24 * 60 * 60 * 1000) setPlaces(v)
      }
    } catch {}
    fetchNearby(bounds)
  }, [bounds])

  // Skeleton UI; replace with actual map implementation later
  return (
    <div className='p-4'>
      <div className='mb-3 flex items-center gap-2'>
        <button className='pill px-3 py-1.5' onClick={() => setDragging(d => !d)}>{dragging ? 'Resume' : 'Pause'} while dragging</button>
        <span className='text-bark-700/80 text-sm'>In flight: {inflight}</span>
      </div>
      <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
        {places.map(p => (
          <div key={p.id} className='glass rounded-xl2 p-3'>
            <div className='flex gap-3'>
              <div className='w-24 h-20 rounded-xl2 overflow-hidden'>
                <HubImage photos={p.photos} primaryType={p.primaryType} alt={p.name} load={false} />
              </div>
              <div className='min-w-0'>
                <div className='font-semibold text-bark-900 line-clamp-1'>{p.name}</div>
                <div className='text-bark-700/80 text-sm line-clamp-2'>{p.address}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
