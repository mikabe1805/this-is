/**
 * Distance calculation utilities
 * Consolidates all Haversine distance implementations into a single tested utility
 */

export interface LatLng {
  lat: number
  lng: number
}

/**
 * Calculate the distance between two geographic coordinates using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in kilometers
 */
export function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Overload accepting LatLng objects for convenience
 */
export function kmBetweenPoints(a: LatLng, b: LatLng): number {
  return kmBetween(a.lat, a.lng, b.lat, b.lng)
}

/**
 * Convert kilometers to degrees latitude (approximately)
 * 1 degree latitude ≈ 111 km
 */
export function kmToDegLat(km: number): number {
  return km / 111.0
}

/**
 * Convert kilometers to degrees longitude at a given latitude
 * Longitude degree distance varies with latitude
 */
export function kmToDegLng(km: number, lat: number): number {
  return km / (111.320 * Math.cos(lat * Math.PI / 180) || 1)
}
