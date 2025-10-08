/**
 * Places API Adapter - Bridges legacy code to Places API (New)
 * This replaces src/services/google/places.ts with cost-optimized calls
 */

import * as placesNew from '../../lib/placesNew';
import { PLACES_ENABLED, PLACES_PHOTOS_ENABLED } from '../../lib/flags';

// ============================================================================
// SESSION MANAGEMENT (for autocomplete)
// ============================================================================

let currentSessionToken: string | null = null;
let autocompleteCallCount = 0;
const MAX_AUTOCOMPLETE_PER_SESSION = 3;

export function beginPlacesSession() {
  if (!PLACES_ENABLED) {
    console.log('🚫 Places session not started (PLACES_ENABLED=false)');
    return;
  }
  
  // Generate a simple session token (UUID v4)
  currentSessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  autocompleteCallCount = 0;
  
  console.log('[Places Adapter] Session started', currentSessionToken?.slice(0, 20));
}

export function endPlacesSession() {
  currentSessionToken = null;
  autocompleteCallCount = 0;
  console.log('[Places Adapter] Session ended');
}

// ============================================================================
// AUTOCOMPLETE (with session tokens + debouncing)
// ============================================================================

export async function getPredictions(
  input: string
): Promise<Array<{ description: string; place_id: string }>> {
  if (!PLACES_ENABLED || !input.trim()) {
    return [];
  }
  
  if (!currentSessionToken) {
    beginPlacesSession();
  }
  
  if (autocompleteCallCount >= MAX_AUTOCOMPLETE_PER_SESSION) {
    console.warn('[Places Adapter] Autocomplete limit reached for this session');
    return [];
  }
  
  autocompleteCallCount++;
  
  try {
    const results = await placesNew.autocomplete(input, currentSessionToken!);
    return results.map((r: any) => ({
      description: r.text,
      place_id: r.placeId
    }));
  } catch (error) {
    console.error('[Places Adapter] Autocomplete failed', error);
    return [];
  }
}

// ============================================================================
// PLACE DETAILS (ONLY call on-click, never on scroll!)
// ============================================================================

export async function getPlaceDetails(
  placeId: string
): Promise<any | null> {
  if (!PLACES_ENABLED) {
    console.log('🚫 Place details not fetched (PLACES_ENABLED=false)');
    return null;
  }
  
  console.log('[Places Adapter] 💰 Fetching place details', placeId);
  
  try {
    const details = await placesNew.getDetails(placeId);
    if (!details) return null;
    
    // Map to legacy format for backward compatibility
    return {
      place_id: details.id,
      name: details.name,
      formatted_address: details.address,
      geometry: {
        location: {
          lat: () => details.lat || 0,
          lng: () => details.lng || 0
        }
      },
      types: details.types || [],
      primary_type: details.primaryType,
      rating: details.rating,
      user_ratings_total: details.userRatingCount,
      website: details.website,
      formatted_phone_number: details.phone,
      // New fields for PlaceVisual
      photoResourceName: details.photoResourceName
    };
  } catch (error) {
    console.error('[Places Adapter] Details failed', error);
    return null;
  }
}

// ============================================================================
// PHOTO URL (budgeted - use through PlaceVisual component only!)
// ============================================================================

export function getPhotoUrl(
  photoResourceName: string,
  maxWidth: number = 400
): string {
  if (!PLACES_PHOTOS_ENABLED) {
    return '/assets/leaf.png';
  }
  
  return placesNew.photoUrl(photoResourceName, maxWidth);
}

// ============================================================================
// SEARCH (for internal use - most apps should use Cloud Function instead)
// ============================================================================

export async function searchText(
  query: string,
  location?: { lat: number; lng: number }
): Promise<any[]> {
  if (!PLACES_ENABLED) {
    return [];
  }
  
  try {
    const results = await placesNew.searchText(query, {
      lat: location?.lat,
      lng: location?.lng,
      max: 10
    });
    
    return results.map(r => ({
      place_id: r.id,
      name: r.name,
      formatted_address: r.address,
      geometry: {
        location: {
          lat: () => r.lat || 0,
          lng: () => r.lng || 0
        }
      },
      types: r.types,
      primary_type: r.primaryType,
      photoResourceName: r.photoResourceName
    }));
  } catch (error) {
    console.error('[Places Adapter] Search failed', error);
    return [];
  }
}

// ============================================================================
// LEGACY COMPATIBILITY (for gradual migration)
// ============================================================================

export async function loadGoogleMapsAPI(): Promise<boolean> {
  // Places API (New) doesn't need the JS Maps API for most operations
  // But some components might still check this, so we return true if enabled
  return PLACES_ENABLED;
}

export const PLACEHOLDER_IMAGE = '/assets/leaf.png';
export { PLACES_ENABLED, PLACES_PHOTOS_ENABLED };

