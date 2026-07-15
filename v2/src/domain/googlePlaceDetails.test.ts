import {
  isGooglePlaceIdSupportedForStorage,
  normalizeCapturePlaceDetails,
  normalizeGoogleAutocompleteSuggestions,
  normalizePlaceDetails,
} from './googlePlaceDetails.js'

function equal(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nexpected ${JSON.stringify(expected)}\nreceived ${JSON.stringify(actual)}`)
  }
}

const id = 'ChIJ-this-is-exact'
const providerIdOutsideStorageContract = `ChIJ${'x'.repeat(300)}`
const providerIdUnsafeForAPath = 'ChIJ/outside/current/path'

equal(isGooglePlaceIdSupportedForStorage(id), true,
  'the validator names the app storage contract rather than provider validity')
equal(isGooglePlaceIdSupportedForStorage(providerIdOutsideStorageContract), false,
  'a provider ID with no app-safe path representation is not called invalid')

const autocompleteSuggestions = normalizeGoogleAutocompleteSuggestions({
  suggestions: [
    {
      placePrediction: {
        placeId: id,
        text: { text: 'Glasshouse Studio, Cresskill' },
        structuredFormat: { mainText: { text: 'Glasshouse Studio' } },
      },
    },
    {
      placePrediction: {
        placeId: providerIdOutsideStorageContract,
        text: { text: 'Long-ID Cafe, Cresskill' },
        structuredFormat: { mainText: { text: 'Long-ID Cafe' } },
      },
    },
    {
      placePrediction: {
        placeId: providerIdUnsafeForAPath,
        text: { text: 'Path-unsafe provider result' },
      },
    },
    {
      placePrediction: {
        placeId: '',
        text: { text: 'Missing identity' },
      },
    },
  ],
})
equal(autocompleteSuggestions, [
  {
    support: 'supported',
    placeId: id,
    text: 'Glasshouse Studio, Cresskill',
    name: 'Glasshouse Studio',
  },
  {
    support: 'unsupported',
    reason: 'storage-contract',
    text: 'Long-ID Cafe, Cresskill',
    name: 'Long-ID Cafe',
  },
  {
    support: 'unsupported',
    reason: 'storage-contract',
    text: 'Path-unsafe provider result',
    name: 'Path-unsafe provider result',
  },
], 'autocomplete retains a nonempty unsupported provider ID without exposing it as a Details path')
const unsupportedSuggestion = autocompleteSuggestions.find(item => item.support === 'unsupported')
equal(Boolean(unsupportedSuggestion
  && ('placeId' in unsupportedSuggestion || 'providerPlaceId' in unsupportedSuggestion)), false,
  'unsupported suggestions discard both usable and raw provider identity')
equal(normalizeGoogleAutocompleteSuggestions({
  suggestions: [{
    placePrediction: {
      placeId: id,
      text: { text: 'x'.repeat(501) },
      structuredFormat: { mainText: { text: 'Bounded name' } },
    },
  }],
}), [], 'unbounded provider display text cannot enter render state')
equal(normalizeGoogleAutocompleteSuggestions({
  suggestions: [{
    placePrediction: {
      placeId: id,
      text: { text: 'Safe fallback label' },
      structuredFormat: { mainText: { text: 'x'.repeat(201) } },
    },
  }],
}), [{
  support: 'supported',
  placeId: id,
  text: 'Safe fallback label',
  name: 'Safe fallback label',
}], 'an unbounded main label falls back to bounded renderable text')

equal(normalizeCapturePlaceDetails({
  id,
  formattedAddress: ' 12 Union Avenue ',
  location: { latitude: 40.94, longitude: -73.95 },
  types: ['art_studio', 'point_of_interest'],
}, id, ' Glasshouse Studio '), {
  id,
  name: 'Glasshouse Studio',
  address: '12 Union Avenue',
  lat: 40.94,
  lng: -73.95,
  primaryType: 'art_studio',
}, 'capture Details keeps only bounded exact-identity fields')

equal(normalizeCapturePlaceDetails({}, id, 'Glasshouse Studio'), null,
  'missing provider ID fails closed')
equal(normalizeCapturePlaceDetails({ id: '../places/other' }, '../places/other', 'Glasshouse Studio'), null,
  'unsafe requested IDs fail before they can become a provider path')
equal(normalizeCapturePlaceDetails({ id: 'another-place' }, id, 'Glasshouse Studio'), null,
  'mismatched provider ID fails closed')
equal(normalizeCapturePlaceDetails({ id, location: { latitude: 91, longitude: 0 } }, id, 'Glasshouse Studio'), null,
  'out-of-range coordinates fail closed')
equal(normalizeCapturePlaceDetails({ id, location: { latitude: null, longitude: '-73.95' } }, id, 'Glasshouse Studio'), null,
  'coerced coordinate lookalikes fail closed')
equal(normalizeCapturePlaceDetails({ id, types: ['activity', 4] }, id, 'Glasshouse Studio'), null,
  'malformed type arrays fail closed')

equal(normalizePlaceDetails({
  id,
  displayName: { text: 'Juniper Cafe' },
  primaryType: 'cafe',
}, id), {
  id,
  name: 'Juniper Cafe',
  primaryType: 'cafe',
}, 'explicit Details accepts a bounded name without inventing absent location')
equal(normalizePlaceDetails({ id, displayName: {} }, id), null,
  'missing display name fails closed')
equal(normalizePlaceDetails({ id: 'another-place', displayName: { text: 'Juniper' } }, id), null,
  'explicit Details rejects a mismatched provider ID')
equal(normalizePlaceDetails({ id, displayName: { text: 'Juniper' }, formattedAddress: 42 }, id), null,
  'malformed optional fields fail closed')

console.log('✓ Google Details normalization is exact-identity, bounded, and fail-closed')
