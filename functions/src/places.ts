import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'

// ============================================================================
// Places API (New) - REST v1 with strict field masks
// ============================================================================

const API_BASE = 'https://places.googleapis.com/v1'

// Minimal field mask - ONLY what we render in list tiles
// Avoids Atmosphere ($0.03), Contact ($0.03), and other premium SKUs
// Note: displayName requires .text suffix for REST API
// Photos are included but client decides whether to fetch them (budgeted)
const LIST_FIELD_MASK = 'places.id,places.displayName.text,places.formattedAddress,places.location,places.primaryType,places.types,places.photos'

// Simple in-memory LRU cache to avoid duplicate API calls within same execution
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const MAX_CACHE_SIZE = 200

function getCached(key: string): any | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data
  }
  cache.delete(key)
  return null
}

function setCache(key: string, data: any) {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
  cache.set(key, { data, timestamp: Date.now() })
}

export const suggestPlaces = onRequest({ cors: true }, async (req, res) => {
  try {
    const { lat, lng, tags = [], interests = [], limit = 12, radiusKm = 20, clientKey } = (req.method === 'POST' ? req.body : req.query) as any
    
    // Validate inputs
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      logger.error('Invalid lat/lng', { lat, lng })
      res.status(400).json({ error: 'lat and lng are required numbers' })
      return
    }
    
    // Prefer server-side Places API (New) key with IP restrictions
    const key = process.env.GOOGLE_PLACES_NEW_KEY || process.env.GOOGLE_MAPS_API_KEY || (clientKey ? String(clientKey) : '')
    if (!key) {
      logger.error('Missing API key')
      res.status(500).json({ error: 'Missing GOOGLE_PLACES_NEW_KEY' })
      return
    }
    
    // Check cache first
    const cacheKey = `suggest:${lat}:${lng}:${tags.join(',')}`
    const cached = getCached(cacheKey)
    if (cached) {
      logger.info('Returning cached results', { cacheKey })
      res.json(cached)
      return
    }
    
    // Build keyword from tags + interests
    const merged = [
      ...(Array.isArray(tags) ? tags : []),
      ...(Array.isArray(interests) ? interests : [])
    ]
    const uniq = Array.from(new Set(merged.map((t: any) => String(t).toLowerCase())))
    // Convert km to meters, but cap at 50,000m (50km) - Places API (New) limit
    const radiusMeters = Number(radiusKm) && Number(radiusKm) > 0 ? Math.round(Number(radiusKm) * 1000) : 20000
    const radius = Math.min(radiusMeters, 50000) // Max 50km per API spec
    
    // Try Nearby Search first (preferred for tag-based discovery)
    const includedTypes = uniq.filter((t: string) => 
      ['restaurant', 'cafe', 'bar', 'park', 'museum', 'bookstore'].includes(t)
    )
    
    let places: any[] = []
    
    if (includedTypes.length > 0) {
      // Places API (New) - Nearby Search
      const nearbyBody = {
        includedTypes: includedTypes.slice(0, 3),
        maxResultCount: limit,
        locationRestriction: {
          circle: {
            center: { latitude: Number(lat), longitude: Number(lng) },
            radius: radius
          }
        }
      }
      
      logger.info('[Places API (New)] Nearby Search', { lat, lng, includedTypes, radius })
      
      const nearbyRes = await fetch(`${API_BASE}/places:searchNearby`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': LIST_FIELD_MASK
        },
        body: JSON.stringify(nearbyBody)
      })
      
      if (nearbyRes.ok) {
        const nearbyData = await nearbyRes.json()
        places = nearbyData.places || []
        logger.info('[Places API (New)] Nearby Search response', { count: places.length })
      } else {
        logger.warn('[Places API (New)] Nearby Search failed', { status: nearbyRes.status })
      }
    }
    
    // Fallback to Text Search if needed
    if (places.length === 0) {
      const query = uniq.length > 0 ? uniq.slice(0, 3).join(' ') : 'restaurants cafes parks'
      const textBody = {
        textQuery: query,
        maxResultCount: limit,
        locationBias: {
          circle: {
            center: { latitude: Number(lat), longitude: Number(lng) },
            radius: radius
          }
        }
      }
      
      logger.info('[Places API (New)] Text Search', { query, lat, lng })
      
      const textRes = await fetch(`${API_BASE}/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': LIST_FIELD_MASK
        },
        body: JSON.stringify(textBody)
      })
      
      if (!textRes.ok) {
        const errorText = await textRes.text()
        logger.error('[Places API (New)] Text Search failed', { 
          status: textRes.status, 
          statusText: textRes.statusText,
          body: errorText
        })
        // Forward the actual upstream error
        res.status(textRes.status).json({ 
          error: 'Places API error', 
          status: textRes.status, 
          detail: errorText 
        })
        return
      }
      
      const textData = await textRes.json()
      places = textData.places || []
      logger.info('[Places API (New)] Text Search response', { count: places.length })
    }

    // Map to our format (NO Details calls - client does that on-demand)
    const results = places.slice(0, limit).map((p: any) => {
      // Photos: Store resourceName only, client will fetch budgeted thumbnails
      const photoResourceName = p.photos?.[0]?.name || null
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=place_id:${p.id}`
      
      return {
        id: p.id,
        placeId: p.id,
        name: p.displayName?.text || 'Unknown Place',
        address: p.formattedAddress || '',
        coordinates: { 
          lat: p.location?.latitude, 
          lng: p.location?.longitude 
        },
        category: p.primaryType || p.types?.[0] || 'place',
        tags: p.types || [],
        // NO direct photo URLs - client uses PlaceVisual with photoBudget
        photoResourceName: photoResourceName,
        mainImage: '', // Deprecated
        images: [], // Deprecated
        savedCount: 0,
        source: 'google',
        rating: undefined, // Not in LIST_FIELD_MASK to save cost
        description: '', // Not in LIST_FIELD_MASK (would require premium Details call)
        website: '', // Not in LIST_FIELD_MASK (would require premium Details call)
        googleMapsUrl: mapsUrl,
        // Types for PlaceVisual component (category posters)
        types: p.types || [],
        primaryType: p.primaryType || null
      }
    })

    logger.info('[Places API (New)] Returning results', { count: results.length })
    
    const response = { places: results }
    setCache(cacheKey, response)
    res.json(response)
  } catch (e: any) {
    logger.error('[suggestPlaces] Uncaught error', e)
    res.status(500).json({ error: 'Internal error', message: e?.message || String(e) })
  }
})

export const geocodeLocation = onRequest({ cors: true }, async (req, res) => {
  try {
    const { q, clientKey } = (req.method === 'POST' ? req.body : req.query) as any
    if (!q || String(q).trim().length === 0) {
      res.status(400).json({ error: 'q is required' })
      return
    }
    const key = process.env.GOOGLE_MAPS_API_KEY || (clientKey ? String(clientKey) : '')
    if (!key) {
      // Gracefully degrade if no key is available
      res.json({ location: null })
      return
    }
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    const qs = String(q)
    // Detect "lat,lng" pattern for reverse geocoding
    const llMatch = qs.match(/^\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/)
    if (llMatch) {
      url.searchParams.set('latlng', `${llMatch[1]},${llMatch[2]}`)
    } else {
      url.searchParams.set('address', qs)
    }
    url.searchParams.set('key', key)
    const r = await fetch(url.toString())
    if (!r.ok) throw new Error(`Geocode API error ${r.status}`)
    const data: any = await r.json()
    const first = data?.results?.[0]
    if (!first) {
      res.json({ location: null })
      return
    }
    const loc = first.geometry?.location
    const formatted = first.formatted_address
    res.json({ location: { lat: loc?.lat, lng: loc?.lng, address: formatted } })
  } catch (e: any) {
    logger.error('geocodeLocation failed', e)
    res.status(500).json({ error: e?.message || 'Unknown error' })
  }
})


