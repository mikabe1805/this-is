# Audit Notes

## Understanding the Audit Results

The audit found **4 "direct usages"** - but these are **expected and correct**! They are in `src/services/google/places.ts`, which is the centralized service itself.

### Expected Direct Usage (Implementation)

These are the implementation of the centralized wrapper:
- `places.ts:75` - `new AutocompleteService()` - Creates service for predictions
- `places.ts:81` - `getPlacePredictions()` - Calls Google API with session token
- `places.ts:127` - `new PlacesService()` - Creates service for details
- `places.ts:148` - `getDetails()` - Calls Google API with narrow fields

**These should NOT be migrated** - they ARE the migration target!

### Optimized Usage (What We Want)

Components correctly using the centralized service:
- `AddressAutocomplete.tsx:127` - Calls `getPredictions()` from our service
- `AddressAutocomplete.tsx:167` - Calls `getPlaceDetails()` from our service
- `GooglePlacesAutocomplete.tsx:125` - Calls `getPredictions()` from our service
- `GooglePlacesAutocomplete.tsx:165` - Calls `getPlaceDetails()` from our service

✅ **All components are properly optimized!**

### Maps Loaders

Found 2 Maps JS loaders:
- `AddressAutocomplete.tsx` - Loads Google Maps API once
- `GooglePlacesAutocomplete.tsx` - Loads Google Maps API once

Both use the centralized `loadGoogleMapsAPI()` function which ensures single script load.

## Audit Script Improvement

The audit script could be improved to:
1. Exclude the `services/google/places.ts` file from "direct usage" warnings
2. Add a separate category for "implementation" vs "usage"
3. Check that all autocomplete components import from the centralized service

For now, manual verification confirms all components are properly optimized.

## Next Audit Run

When you run `npm run audit:places` after making changes:
1. Total findings should remain at 10 (or decrease if Maps loaders are consolidated)
2. "Direct usage" should remain at 4 (in places.ts only)
3. "Optimized usage" should increase if more components are added
4. Any "direct usage" outside of `services/google/places.ts` needs migration

---

**Last Verified:** October 6, 2025  
**Status:** ✅ All components properly optimized

