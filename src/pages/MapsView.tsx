import { useEffect, useMemo, useRef, useState } from 'react'
import HubImage from '../components/HubImage'
import { firebaseDataService } from '../services/firebaseDataService'
import { useAuth } from '../contexts/AuthContext'

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
  const { currentUser } = useAuth()
  // Default bounding box (San Francisco). Replaced on mount once we have the
  // user's effective location — without this, every user opens the map on SF.
  const [bounds, setBounds] = useState<BBox>({ north: 37.81, south: 37.70, east: -122.35, west: -122.53 })
  const [places, setPlaces] = useState<any[]>([])
  const [inflight, setInflight] = useState(0)
  const [dragging, setDragging] = useState(false)
  const lastReq = useRef(0)
  const centeredRef = useRef(false)

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
      // Was: r.json() called unconditionally on a non-OK response, then
      // setPlaces(j.places || []) silently wiped the cached results to []
      // and the user saw "Quiet patch." with no error and no log.
      if (!r.ok) {
        console.warn('[map] /mapsNearby returned', r.status)
        return
      }
      const j = await r.json()
      const next = Array.isArray(j.places) ? j.places : []
      setPlaces(next)
      try { localStorage.setItem(`map:${cellIdFromBounds(b)}`, JSON.stringify({ t: Date.now(), v: next })) } catch {
        // localStorage full or denied; not fatal
      }
    } catch (e) {
      console.warn('[map] /mapsNearby failed', e)
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
    } catch (e) {
      console.warn('[map] cache read failed', e)
    }
    fetchNearby(bounds)
  }, [bounds])

  // Center on the user's effective location once on mount. Skipped if it's
  // already been done (so panning doesn't keep snapping back) or if no
  // location is available (then the SF default stands).
  useEffect(() => {
    if (centeredRef.current) return
    let cancelled = false
    void (async () => {
      try {
        const eff = await firebaseDataService.getEffectiveLocation(currentUser?.id)
        if (cancelled || !eff) return
        // ~5km box centered on the user.
        const dLat = 0.045
        const dLng = 0.06
        setBounds({
          north: eff.lat + dLat,
          south: eff.lat - dLat,
          east:  eff.lng + dLng,
          west:  eff.lng - dLng,
        })
        centeredRef.current = true
      } catch (e) {
        console.warn('[map] center-on-user failed', e)
      }
    })()
    return () => { cancelled = true }
  }, [currentUser?.id])

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
        <div className="px-5 pt-5 pb-4">
          <p className="label-eyebrow text-ink-mute mb-2">Map view</p>
          <h1 className="font-display text-[32px] leading-[0.95] text-ink">
            Around you<span style={{ color: 'var(--bloom)' }}>.</span>
          </h1>
        </div>
        <div className="border-b border-edge mx-5" />
      </header>

      <div className="px-5 pt-4 pb-2 flex items-center gap-2">
        <button
          onClick={() => setDragging(d => !d)}
          className="btn-secondary h-9 px-4 label-eyebrow"
        >
          {dragging ? 'Resume' : 'Pause'} while dragging
        </button>
        {inflight > 0 && (
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute ml-auto">
            Loading · {inflight}
          </span>
        )}
      </div>

      <div className="px-5 pt-3 pb-12">
        {places.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-display text-[24px] text-ink leading-tight">Quiet patch.</p>
            <p className="text-[13px] text-ink-soft mt-2">Pan the map and we'll surface places nearby.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {places.map(p => (
              <div key={p.id} className="rounded-2xl bg-card border border-edge overflow-hidden hover:border-ink/20 transition-colors">
                <div className="aspect-[4/3] w-full overflow-hidden">
                  <HubImage photos={p.photos} userImage={p.mainImage || p.hubImage || p.coverImage} primaryType={p.primaryType} alt={p.name} load={false} />
                </div>
                <div className="px-3.5 py-2.5">
                  <h3 className="font-display text-[16px] leading-tight text-ink truncate">{p.name}</h3>
                  <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-1 truncate">
                    {p.address}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
