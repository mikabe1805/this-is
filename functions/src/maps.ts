import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import * as admin from 'firebase-admin'

const API_BASE = 'https://places.googleapis.com/v1'
const LIST_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.primaryType,places.photos.name'

function cellIdFromBounds(bounds: any): string {
  const { north, south, east, west } = bounds || {}
  const snap = (v: number) => (Math.round(v * 100) / 100).toFixed(2)
  return `${snap(north)}:${snap(south)}:${snap(east)}:${snap(west)}`
}

export const mapsNearby = onRequest({ cors: true }, async (req, res) => {
  try {
    const { bounds, types = [], clientKey } = (req.method === 'POST' ? req.body : req.query) as any
    if (!bounds || typeof bounds !== 'object') {
      res.status(400).json({ error: 'bounds required' })
      return
    }
    const key = process.env.GOOGLE_PLACES_NEW_KEY || process.env.GOOGLE_MAPS_API_KEY || (clientKey ? String(clientKey) : '')
    if (!key) {
      res.status(500).json({ error: 'Missing API key' })
      return
    }

    const cellId = cellIdFromBounds(bounds)
    const typeList: string[] = Array.isArray(types) ? types.map((t: any) => String(t).toLowerCase()).sort() : []
    const cacheKey = `map:${cellId}|${typeList.join('+')}`

    // Firestore cache (24h)
    const docRef = admin.firestore().doc(`mapsCells/${encodeURIComponent(cacheKey)}`)
    const snap = await docRef.get()
    if (snap.exists) {
      const data = snap.data() as any
      const ageMs = Date.now() - (data.createdAt?.toMillis?.() || data.createdAt)
      if (ageMs < 24 * 60 * 60 * 1000) {
        res.json(data.payload)
        return
      }
    }

    // Convert bounds to Nearby circle (approximate center + radius)
    const lat = (Number(bounds.north) + Number(bounds.south)) / 2
    const lng = (Number(bounds.east) + Number(bounds.west)) / 2
    // crude radius ~ distance from center to NE corner
    const dLat = Math.abs(Number(bounds.north) - lat)
    const dLng = Math.abs(Number(bounds.east) - lng)
    const approxKm = Math.hypot(dLat, dLng) * 111
    const radius = Math.min(Math.max(Math.round(approxKm * 1000), 500), 50000)

    const nearbyBody = {
      maxResultCount: 20,
      includedTypes: typeList.slice(0, 6),
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
    }
    const r = await fetch(`${API_BASE}/places:searchNearby`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': LIST_FIELD_MASK
      },
      body: JSON.stringify(nearbyBody)
    })
    if (!r.ok) {
      const txt = await r.text()
      res.status(r.status).json({ error: 'upstream', detail: txt })
      return
    }
    const j = await r.json()
    const payload = { places: (j.places || []).map((p: any) => ({
      id: p.id,
      name: p.displayName?.text || p.displayName,
      address: p.formattedAddress,
      primaryType: p.primaryType,
      photos: p.photos || [],
    })) }

    await docRef.set({ key: cacheKey, createdAt: admin.firestore.FieldValue.serverTimestamp(), payload }, { merge: true })
    res.json(payload)
  } catch (e: any) {
    logger.error('mapsNearby failed', e)
    res.status(500).json({ error: e?.message || 'unknown' })
  }
})

