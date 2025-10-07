/**
 * Feature flags and kill switches
 * CRITICAL: These control Google Places API spend
 */

// Google Places API kill switches - default to FALSE for safety
export const PLACES_ENABLED = import.meta.env.VITE_PLACES_ENABLED === 'true';
export const PLACES_PHOTOS_ENABLED = import.meta.env.VITE_PLACES_PHOTOS_ENABLED === 'true';

// Log flags on startup
console.log('🚦 Places API Flags:', {
  PLACES_ENABLED,
  PLACES_PHOTOS_ENABLED,
  timestamp: new Date().toISOString()
});

// Alert if both are disabled (dev should know)
if (!PLACES_ENABLED) {
  console.warn('⚠️ PLACES_ENABLED=false - All Google Places calls will return cached/mock data');
}

if (!PLACES_PHOTOS_ENABLED) {
  console.warn('⚠️ PLACES_PHOTOS_ENABLED=false - All photos will use placeholder');
}

