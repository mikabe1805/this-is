import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'

export const suggestPlaces = onRequest({ cors: true }, async (req, res) => {
  try {
    // Check if fetch is available
    if (typeof fetch === 'undefined') {
      logger.error('fetch is not available in this environment')
      res.status(500).json({ error: 'fetch API not available' })
      return
    }

    const { lat, lng, tags = [], interests = [], limit = 12, radiusKm = 20, openNow = false, clientKey } = (req.method === 'POST' ? req.body : req.query) as any
    if (!lat || !lng) {
      res.status(400).json({ error: 'lat and lng are required' })
      return
    }
    // Prefer server secret, but allow client-provided key as fallback (frontend key is already public for Maps JS)
    const key = process.env.GOOGLE_MAPS_API_KEY || (clientKey ? String(clientKey) : '')
    if (!key) {
      res.status(500).json({ error: 'Missing GOOGLE_MAPS_API_KEY and no clientKey provided' })
      return
    }
    
    // Build keyword from tags + interests
    const merged = [
      ...(Array.isArray(tags) ? tags : []),
      ...(Array.isArray(interests) ? interests : [])
    ]
    const uniq = Array.from(new Set(merged.map((t: any) => String(t).toLowerCase())))
    const keyword = uniq.slice(0, 5).join(' ')
    
    // Nearby Search
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
    url.searchParams.set('location', `${lat},${lng}`)
    const radius = Number(radiusKm) && Number(radiusKm) > 0 ? Math.round(Number(radiusKm) * 1000) : 20000
    url.searchParams.set('radius', String(radius))
    if (keyword) url.searchParams.set('keyword', keyword)
    url.searchParams.set('key', key)
    if (openNow) url.searchParams.set('opennow', 'true')

    logger.info('Calling Google Places Nearby Search', { url: url.toString(), lat, lng, radius, keyword })
    
    let r = await fetch(url.toString())
    let data: any = null
    if (r.ok) {
      data = await r.json()
      logger.info('Nearby Search response', { status: r.status, resultsCount: data?.results?.length || 0 })
    }
    
    // Fallback to Text Search if Nearby Search fails or returns zero/invalid
    if (!r.ok || !data || !Array.isArray(data.results) || data.results.length === 0) {
      logger.info('Falling back to Text Search')
      const textUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
      const q = uniq.length > 0 ? uniq.slice(0, 3).join(' ') : 'restaurants cafes parks'
      textUrl.searchParams.set('query', q)
      textUrl.searchParams.set('location', `${lat},${lng}`)
      textUrl.searchParams.set('radius', String(radius))
      textUrl.searchParams.set('key', key)
      if (openNow) textUrl.searchParams.set('opennow', 'true')
      
      logger.info('Calling Google Places Text Search', { url: textUrl.toString(), query: q })
      r = await fetch(textUrl.toString())
      if (!r.ok) throw new Error(`Places Text Search API error ${r.status}`)
      data = await r.json()
      if (!Array.isArray(data?.results)) {
        const errMsg = data?.error_message || JSON.stringify(data)
        throw new Error(`Places Text Search invalid response: ${errMsg}`)
      }
      logger.info('Text Search response', { status: r.status, resultsCount: data?.results?.length || 0 })
    }

    const baseResults = ((data && data.results) ? data.results : []).slice(0, limit)
    // COST OPTIMIZATION: Skip Details enrichment entirely
    // Nearby/Text Search already provides: name, address, photos, rating, geometry
    // Only request Details when user clicks on a specific place (client-side)
    // Note: Removed Details calls to save $0.015 per place
    // Client can request Details on-demand with BASIC_FIELDS only ($0 cost)

    const results = baseResults.map((p: any) => {
      // Nearby/Text Search provides: name, address, photos, rating, geometry, types
      // No Details call needed - saves $0.015 per place!
      const photoRef = Array.isArray(p.photos) && p.photos[0]?.photo_reference
      const photoUrl = photoRef ? `https://maps.googleapis.com/maps/api/place/photo?maxheight=540&photo_reference=${photoRef}&sensor=false&key=${key}` : ''
      const allImages: string[] = (photoUrl ? [photoUrl] : []).filter(Boolean)
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=place_id:${p.place_id}`
      
      return {
        id: p.place_id,
        placeId: p.place_id,
        name: p.name,
        address: p.formatted_address || p.vicinity || '',
        coordinates: { lat: p.geometry?.location?.lat, lng: p.geometry?.location?.lng },
        category: Array.isArray(p.types) && p.types.length > 0 ? p.types[0] : 'place',
        tags: Array.isArray(p.types) ? p.types.slice(0, 6) : [],
        mainImage: photoUrl || '',
        images: allImages,
        savedCount: 0,
        source: 'google',
        rating: typeof p.rating === 'number' ? p.rating : undefined,
        userRatingsTotal: typeof p.user_ratings_total === 'number' ? p.user_ratings_total : undefined,
        priceLevel: typeof p.price_level === 'number' ? p.price_level : undefined,
        description: '', // Not included in Nearby/Text Search (would require premium Details call)
        website: '', // Not included in Nearby/Text Search (would require premium Details call)
        googleMapsUrl: mapsUrl,
        openNow: p.opening_hours?.open_now === true
      }
    })

    logger.info('Returning results', { count: results.length })
    res.json({ places: results })
  } catch (e: any) {
    logger.error('suggestPlaces failed', e)
    res.status(500).json({ error: e?.message || 'Unknown error' })
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


