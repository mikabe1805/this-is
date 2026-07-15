import { parseGoogleMapsUrl, sharedPlaceInput } from './mapsUrl.js'

function equal(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nexpected ${JSON.stringify(expected)}\nreceived ${JSON.stringify(actual)}`)
  }
}

function test(name: string, run: () => void) {
  run()
  console.log(`✓ ${name}`)
}

test('official search URL preserves exact place identity', () => {
  equal(parseGoogleMapsUrl(
    'https://www.google.com/maps/search/?api=1&query=Lumen+Field&query_place_id=ChIJKxjxuaNqkFQR3CK6O1HNNqY'
  ), {
    kind: 'place-id',
    placeId: 'ChIJKxjxuaNqkFQR3CK6O1HNNqY',
    query: 'Lumen Field',
  }, 'official URL')
})

test('long Maps share URL preserves exact identity and an editable path label', () => {
  equal(parseGoogleMapsUrl(
    'https://www.google.com/maps/place/Glasshouse+Studio/data=!4m2!3m1!1sChIJ1234567890abcdef'
  ), {
    kind: 'place-id',
    placeId: 'ChIJ1234567890abcdef',
    query: 'Glasshouse Studio',
  }, 'long share URL')
})

test('malformed path encoding fails closed instead of throwing', () => {
  equal(parseGoogleMapsUrl(
    'https://www.google.com/maps/place/%E0%A4%A/data=!4m2!3m1!1sChIJ1234567890abcdef'
  ), {
    kind: 'place-id',
    placeId: 'ChIJ1234567890abcdef',
  }, 'malformed path label')
})

test('directions destination can become a bounded search', () => {
  equal(parseGoogleMapsUrl(
    'https://www.google.com/maps/dir/?api=1&destination=Radio+Bakery%2C+Brooklyn'
  ), { kind: 'search', query: 'Radio Bakery, Brooklyn' }, 'destination search')
})

test('human-readable place path can become a bounded search', () => {
  equal(parseGoogleMapsUrl(
    'https://www.google.com/maps/place/Cafe+Mogador/@40.7,-73.9,15z'
  ), { kind: 'search', query: 'Cafe Mogador' }, 'place path')
})

test('short Maps links are explicitly resolved by the authenticated endpoint', () => {
  const url = 'https://maps.app.goo.gl/AbCdEf123456'
  equal(parseGoogleMapsUrl(url), { kind: 'short-link', url }, 'short URL')
})

test('coordinates alone never become a guessed place', () => {
  equal(parseGoogleMapsUrl(
    'https://www.google.com/maps/search/?api=1&query=40.7%2C-73.9'
  ), { kind: 'invalid', reason: 'no-place-identity' }, 'coordinate rejection')
})

test('lookalike and credential-bearing URLs are rejected', () => {
  equal(parseGoogleMapsUrl('https://google.com.evil.example/maps/place/Secret'), {
    kind: 'invalid', reason: 'not-google-maps',
  }, 'lookalike host')
  equal(parseGoogleMapsUrl('https://user:pass@google.com/maps/place/Secret'), {
    kind: 'invalid', reason: 'not-google-maps',
  }, 'credentials')
})

test('share target prefers one valid Google Maps URL without resolving it', () => {
  equal(sharedPlaceInput({
    title: 'Cafe Mogador',
    text: 'Cafe Mogador https://maps.app.goo.gl/AbCdEf123456',
    url: 'https://example.com/tracking',
  }), 'https://maps.app.goo.gl/AbCdEf123456', 'embedded Maps URL')
})

test('share target falls back to bounded human text and rejects lookalike URLs', () => {
  equal(sharedPlaceInput({
    title: 'Cafe Mogador, Williamsburg',
    text: 'https://google.com.evil.example/maps/place/Secret',
  }), 'Cafe Mogador, Williamsburg', 'human title')
  equal(sharedPlaceInput({ text: 'x'.repeat(800) }).length, 160, 'bounded fallback')
})
