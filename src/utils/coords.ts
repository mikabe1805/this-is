/**
 * Place documents in Firestore use four different coordinate shapes
 * depending on when/how they were saved:
 *   { location: { lat, lng } }
 *   { location: { latitude, longitude } }      // Google Places (New) format
 *   { coordinates: { lat, lng } }
 *   { coordinates: { latitude, longitude } }
 * `readCoords` normalizes any of them to { lat, lng } | undefined, treating
 * (0, 0) as missing — that's the "Null Island" sentinel from bad fallbacks,
 * not a real place anyone has saved. Returning that sentinel previously made
 * every saved place show up ~5409 mi from a US viewer (great-circle distance
 * from Null Island to NJ ≈ 8700 km).
 */
export function readCoords(doc: any): { lat: number; lng: number } | undefined {
  if (!doc) return undefined
  const candidates = [doc.coordinates, doc.location, doc]
  for (const c of candidates) {
    if (!c) continue
    const lat = typeof c.lat === 'number'
      ? c.lat
      : (typeof c.latitude === 'number' ? c.latitude : undefined)
    const lng = typeof c.lng === 'number'
      ? c.lng
      : (typeof c.longitude === 'number' ? c.longitude : undefined)
    if (typeof lat === 'number' && typeof lng === 'number' && !(lat === 0 && lng === 0)) {
      return { lat, lng }
    }
  }
  return undefined
}
