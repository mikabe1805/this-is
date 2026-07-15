import assert from 'node:assert/strict'
import {
  canReservePlacePhoto,
  fetchGooglePlacePhoto,
  normalizePlacePhotoBudget,
  photoUsageMonth,
  validGooglePlaceId,
  type PhotoFetch,
} from './place-photo.js'

assert.deepEqual(normalizePlacePhotoBudget(null), { enabled: false, monthlyLimit: 0 })
assert.deepEqual(normalizePlacePhotoBudget({ enabled: true, monthlyLimit: 800 }), { enabled: true, monthlyLimit: 800 })
assert.deepEqual(normalizePlacePhotoBudget({ enabled: true, monthlyLimit: 1000 }), { enabled: false, monthlyLimit: 0 })
assert.equal(canReservePlacePhoto({ enabled: true, monthlyLimit: 2 }, 1), true)
assert.equal(canReservePlacePhoto({ enabled: true, monthlyLimit: 2 }, 2), false)
assert.equal(canReservePlacePhoto({ enabled: false, monthlyLimit: 0 }, 0), false)
assert.equal(photoUsageMonth(new Date('2026-01-31T23:59:59Z')), '2026-01')
assert.equal(validGooglePlaceId('ChIJabcdefghij_123'), true)
assert.equal(validGooglePlaceId('../not-a-place'), false)
console.log('✓ photo budget fails closed, remains below the free cap, and uses UTC months')

const placeId = 'ChIJabcdefghij_123'
const calls: string[] = []
const fakeFetch: PhotoFetch = async input => {
  const url = input.toString()
  calls.push(url)
  if (!url.endsWith('/media?maxWidthPx=640')) {
    return new Response(JSON.stringify({ photos: [{
      name: `places/${placeId}/photos/current-reference`,
      authorAttributions: [{ displayName: 'Owner' }],
      googleMapsUri: 'https://www.google.com/maps/place/photo',
    }] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { 'content-type': 'image/jpeg', 'content-length': '3' },
  })
}
const result = await fetchGooglePlacePhoto(placeId, 'server-secret', fakeFetch)
assert.equal(calls.length, 2)
assert.equal(result?.contentType, 'image/jpeg')
assert.equal(result?.attribution, 'Owner')
assert.equal(result?.sourceUri, 'https://www.google.com/maps/place/photo')
assert.deepEqual([...result!.bytes], [1, 2, 3])

const poisonedSource: PhotoFetch = async input => input.toString().includes('/media')
  ? new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/jpeg' } })
  : new Response(JSON.stringify({ photos: [{
    name: `places/${placeId}/photos/current-reference`,
    googleMapsUri: 'https://evil.example/photo',
  }] }), { status: 200 })
assert.equal(await fetchGooglePlacePhoto(placeId, 'server-secret', poisonedSource), null)
console.log('✓ photo proxy keeps the key server-side, validates media, and rejects non-Google sources')
