/**
 * Google Places API Gateway - SINGLE entry point for all Google API calls
 * CRITICAL: Controls spend through kill switches and field restrictions
 */

import { PLACES_ENABLED, PLACES_PHOTOS_ENABLED } from '../../lib/flags';

// ============================================================================
// INSTRUMENTATION - Log every API call for verification
// ============================================================================

interface PlacesLogEntry {
  route: string;
  type: 'autocomplete' | 'details' | 'photo';
  fields?: string;
  placeId?: string;
  enabledFlags: {
    PLACES_ENABLED: boolean;
    PLACES_PHOTOS_ENABLED: boolean;
  };
  timestamp: string;
  cached?: boolean;
}

function logPlacesCall(entry: PlacesLogEntry) {
  console.log('📍 Places API Call:', entry);
  
  // TODO: Send to analytics
  // analytics.track('places_api_call', entry);
}

// ============================================================================
// FIELD RESTRICTIONS - ONLY request what we absolutely need
// ============================================================================

// BASIC FIELDS ONLY - Avoid Atmosphere ($0.03) and Contact ($0.03) SKUs
const BASIC_FIELDS: (keyof google.maps.places.PlaceResult)[] = [
  'place_id',
  'name',
  'formatted_address',
  'geometry',
  'photos'
  // DO NOT ADD: opening_hours, current_opening_hours, website, 
  // formatted_phone_number, price_level, rating, user_ratings_total,
  // reviews, editorial_summary, etc.
];

// ============================================================================
// MOCK DATA - Used when PLACES_ENABLED=false
// ============================================================================

const MOCK_PREDICTIONS: google.maps.places.AutocompletePrediction[] = [];

const MOCK_PLACE_DETAILS: any = {
  place_id: 'mock-place-id',
  name: 'Mock Place (API Disabled)',
  formatted_address: '123 Mock St, Mock City',
  geometry: {
    location: { lat: () => 37.7749, lng: () => -122.4194 }
  },
  photos: []
};

// ============================================================================
// SESSION TOKEN MANAGEMENT
// ============================================================================

let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;
let autocompleteCallCount = 0;
const MAX_AUTOCOMPLETE_PER_SESSION = 3;

export function beginPlacesSession() {
  if (!PLACES_ENABLED) {
    console.log('🚫 Places session not started (PLACES_ENABLED=false)');
    return;
  }
  
  // Check if Google Maps API is loaded before creating session token
  if (!window.google?.maps?.places) {
    console.warn('⚠️ Google Maps API not loaded yet, skipping session creation');
    return;
  }
  
  sessionToken = new google.maps.places.AutocompleteSessionToken();
  autocompleteCallCount = 0;
  
  logPlacesCall({
    route: window.location.pathname,
    type: 'autocomplete',
    enabledFlags: { PLACES_ENABLED, PLACES_PHOTOS_ENABLED },
    timestamp: new Date().toISOString()
  });
}

export function endPlacesSession() {
  sessionToken = null;
  autocompleteCallCount = 0;
}

// ============================================================================
// AUTOCOMPLETE - 300ms debounce, max 3 calls per session
// ============================================================================

let autocompleteDebounceTimer: NodeJS.Timeout | null = null;

export async function getPredictions(
  input: string,
  opts?: { locationBias?: google.maps.LatLngLiteral }
): Promise<google.maps.places.AutocompletePrediction[]> {
  // Kill switch check
  if (!PLACES_ENABLED) {
    logPlacesCall({
      route: window.location.pathname,
      type: 'autocomplete',
      enabledFlags: { PLACES_ENABLED, PLACES_PHOTOS_ENABLED },
      timestamp: new Date().toISOString(),
      cached: true
    });
    return MOCK_PREDICTIONS;
  }

  // Validation
  if (!sessionToken || input.trim().length < 3) {
    return [];
  }

  // Rate limiting - max 3 per session
  if (autocompleteCallCount >= MAX_AUTOCOMPLETE_PER_SESSION) {
    console.warn(`⚠️ Autocomplete limit reached (${MAX_AUTOCOMPLETE_PER_SESSION} per session)`);
    return [];
  }

  // 300ms debounce
  return new Promise((resolve) => {
    if (autocompleteDebounceTimer) {
      clearTimeout(autocompleteDebounceTimer);
    }

    autocompleteDebounceTimer = setTimeout(async () => {
      try {
        // Check if Google Maps API is loaded
        if (!window.google?.maps?.places) {
          console.warn('⚠️ Google Maps API not loaded, cannot get predictions');
          resolve([]);
          return;
        }
        
        const svc = new google.maps.places.AutocompleteService();
        
        autocompleteCallCount++;
        
        logPlacesCall({
          route: window.location.pathname,
          type: 'autocomplete',
          enabledFlags: { PLACES_ENABLED, PLACES_PHOTOS_ENABLED },
          timestamp: new Date().toISOString()
        });

        svc.getPlacePredictions(
          { input, sessionToken, ...opts },
          (preds, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && preds) {
              resolve(preds);
            } else {
              resolve([]);
            }
          }
        );
      } catch (error) {
        console.error('Autocomplete error:', error);
        resolve([]);
      }
    }, 300);
  });
}

// ============================================================================
// PLACE DETAILS - BASIC_FIELDS only, in-memory cache
// ============================================================================

const detailsCache = new Map<string, any>();

export async function getPlaceDetails(placeId: string): Promise<any> {
  // Kill switch check
  if (!PLACES_ENABLED) {
    logPlacesCall({
      route: window.location.pathname,
      type: 'details',
      placeId,
      fields: 'MOCK',
      enabledFlags: { PLACES_ENABLED, PLACES_PHOTOS_ENABLED },
      timestamp: new Date().toISOString(),
      cached: true
    });
    return MOCK_PLACE_DETAILS;
  }

  // Check cache first
  const cached = detailsCache.get(placeId);
  if (cached) {
    logPlacesCall({
      route: window.location.pathname,
      type: 'details',
      placeId,
      fields: BASIC_FIELDS.join(','),
      enabledFlags: { PLACES_ENABLED, PLACES_PHOTOS_ENABLED },
      timestamp: new Date().toISOString(),
      cached: true
    });
    return cached;
  }

  // Check if Google Maps API is loaded
  if (!window.google?.maps?.places) {
    console.warn('⚠️ Google Maps API not loaded, cannot get place details');
    return MOCK_PLACE_DETAILS;
  }

  // Make API call with BASIC_FIELDS only
  const svc = new google.maps.places.PlacesService(document.createElement('div'));

  return new Promise((resolve) => {
    logPlacesCall({
      route: window.location.pathname,
      type: 'details',
      placeId,
      fields: BASIC_FIELDS.join(','),
      enabledFlags: { PLACES_ENABLED, PLACES_PHOTOS_ENABLED },
      timestamp: new Date().toISOString()
    });

    svc.getDetails(
      {
        placeId,
        sessionToken,
        fields: BASIC_FIELDS
      },
      (result, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && result) {
          detailsCache.set(placeId, result);
          resolve(result);
        } else {
          resolve(null);
        }
      }
    );
  });
}

// ============================================================================
// PHOTOS - Lazy load with IntersectionObserver, respect kill switch
// ============================================================================

const PLACEHOLDER_IMAGE = '/assets/leaf.png';

export function getPhotoUrl(
  photo: google.maps.places.PlacePhoto,
  maxWidth: number = 400
): string {
  // Kill switch check
  if (!PLACES_PHOTOS_ENABLED) {
    logPlacesCall({
      route: window.location.pathname,
      type: 'photo',
      enabledFlags: { PLACES_ENABLED, PLACES_PHOTOS_ENABLED },
      timestamp: new Date().toISOString(),
      cached: true
    });
    return PLACEHOLDER_IMAGE;
  }

  if (!photo || !photo.getUrl) {
    return PLACEHOLDER_IMAGE;
  }

  logPlacesCall({
    route: window.location.pathname,
    type: 'photo',
    enabledFlags: { PLACES_ENABLED, PLACES_PHOTOS_ENABLED },
    timestamp: new Date().toISOString()
  });

  // Use small size to minimize cost
  return photo.getUrl({ maxWidth, maxHeight: maxWidth });
}

/**
 * Lazy load photos only when card is visible for 600ms+
 * Use this for lists/carousels to prevent scroll-triggered photo fetches
 */
export function setupLazyPhotoLoading(
  containerRef: HTMLElement,
  onPhotoVisible: (img: HTMLImageElement) => void
) {
  if (!PLACES_PHOTOS_ENABLED) {
    return () => {}; // No-op cleanup
  }

  const visibilityTimers = new Map<HTMLImageElement, NodeJS.Timeout>();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const img = entry.target as HTMLImageElement;

        if (entry.isIntersecting) {
          // Start 600ms timer
          const timer = setTimeout(() => {
            onPhotoVisible(img);
            visibilityTimers.delete(img);
          }, 600);
          visibilityTimers.set(img, timer);
        } else {
          // Cancel timer if scrolled out of view
          const timer = visibilityTimers.get(img);
          if (timer) {
            clearTimeout(timer);
            visibilityTimers.delete(img);
          }
        }
      });
    },
    {
      rootMargin: '50px',
      threshold: 0.5
    }
  );

  // Observe all images with data-photo-ref attribute
  const images = containerRef.querySelectorAll('img[data-photo-ref]');
  images.forEach((img) => observer.observe(img));

  // Cleanup function
  return () => {
    visibilityTimers.forEach((timer) => clearTimeout(timer));
    visibilityTimers.clear();
    observer.disconnect();
  };
}

// ============================================================================
// GOOGLE MAPS API LOADER
// ============================================================================

let loadPromise: Promise<boolean> | null = null;

/**
 * Load Google Maps API script once.
 * Returns true if loaded successfully, false otherwise.
 */
export async function loadGoogleMapsAPI(): Promise<boolean> {
  // Kill switch check - if Places disabled, still load API but warn
  if (!PLACES_ENABLED) {
    console.warn('⚠️ Loading Google Maps API but PLACES_ENABLED=false');
  }

  // Return existing promise if already loading
  if (loadPromise) {
    return loadPromise;
  }

  // Check if already loaded
  if (window.google?.maps?.places) {
    console.log('[Places API] Already loaded');
    return true;
  }

  // Check if script is already in DOM
  const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
  if (existingScript) {
    console.log('[Places API] Script loading in progress...');
    loadPromise = new Promise<boolean>((resolve) => {
      const checkLoaded = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(checkLoaded);
          resolve(true);
        }
      }, 100);
      
      // Timeout after 10s
      setTimeout(() => {
        clearInterval(checkLoaded);
        resolve(false);
      }, 10000);
    });
    return loadPromise;
  }

  // Load the API
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('[Places API] Missing API key');
    return false;
  }

  console.log('[Places API] Loading Google Maps API...');

  loadPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&language=en`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('[Places API] Loaded successfully');
      resolve(true);
    };

    script.onerror = () => {
      console.error('[Places API] Failed to load');
      loadPromise = null;
      resolve(false);
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Clear the details cache (useful for testing or memory management)
 */
export function clearDetailsCache() {
  detailsCache.clear();
  console.log('[Places API] Details cache cleared');
}

// ============================================================================
// EXPORTS
// ============================================================================

export { PLACEHOLDER_IMAGE, PLACES_PHOTOS_ENABLED };
