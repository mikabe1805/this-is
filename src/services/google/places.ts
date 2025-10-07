/**
 * Centralized Google Places API service
 * Implements session tokens, debouncing, caching, and field restrictions
 * to minimize API costs while maintaining functionality.
 */

// Session token management - one token per input focus session
let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;

// Telemetry counters (dev only)
const telemetry = {
  autocomplete_requests: 0,
  details_requests: 0,
  photo_requests: 0,
};

export function getTelemetry() {
  return { ...telemetry };
}

export function resetTelemetry() {
  telemetry.autocomplete_requests = 0;
  telemetry.details_requests = 0;
  telemetry.photo_requests = 0;
}

/**
 * Start a new Places API session.
 * Call this when user focuses on an autocomplete input.
 */
export function beginPlacesSession() {
  if (!window.google?.maps?.places) {
    console.warn('Google Maps Places API not loaded');
    return;
  }
  sessionToken = new google.maps.places.AutocompleteSessionToken();
  console.log('[Places API] Session started');
}

/**
 * End the current Places API session.
 * Call this when user selects a place or after 5s idle.
 */
export function endPlacesSession() {
  sessionToken = null;
  console.log('[Places API] Session ended');
}

/**
 * Get autocomplete predictions with session token.
 * Note: Callers MUST also implement UI-level debouncing (600ms recommended).
 * 
 * @param input - Search query (minimum 3 characters)
 * @param opts - Optional location bias and type restrictions
 * @returns Array of predictions or empty array on error
 */
export async function getPredictions(
  input: string,
  opts?: {
    locationBias?: google.maps.LatLngLiteral;
    types?: string[];
    componentRestrictions?: google.maps.places.AutocompleteComponentRestrictions;
  }
): Promise<google.maps.places.AutocompletePrediction[]> {
  // Require minimum 3 characters to reduce noise
  if (!sessionToken || input.trim().length < 3) {
    return [];
  }

  if (!window.google?.maps?.places) {
    console.warn('Google Maps Places API not loaded');
    return [];
  }

  const service = new google.maps.places.AutocompleteService();
  
  telemetry.autocomplete_requests++;
  console.log(`[Places API] Autocomplete request #${telemetry.autocomplete_requests}: "${input}"`);

  return new Promise<google.maps.places.AutocompletePrediction[]>((resolve) => {
    service.getPlacePredictions(
      {
        input,
        sessionToken,
        types: opts?.types,
        componentRestrictions: opts?.componentRestrictions,
        ...(opts?.locationBias ? { location: opts.locationBias } : {}),
      },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          resolve(predictions);
        } else {
          if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            console.warn(`[Places API] Autocomplete error: ${status}`);
          }
          resolve([]);
        }
      }
    );
  });
}

// Simple in-memory cache for place details
const detailsCache = new Map<string, any>();

/**
 * Get place details with narrow field restrictions and caching.
 * Only call this when user explicitly selects a place from autocomplete.
 * 
 * @param placeId - The Google Place ID
 * @returns Place details or null on error
 */
export async function getPlaceDetails(placeId: string): Promise<any | null> {
  // Check cache first
  const cached = detailsCache.get(placeId);
  if (cached) {
    console.log(`[Places API] Details cache hit: ${placeId}`);
    return cached;
  }

  if (!window.google?.maps?.places) {
    console.warn('Google Maps Places API not loaded');
    return null;
  }

  // Create a dummy div for PlacesService (it requires a DOM element)
  const service = new google.maps.places.PlacesService(document.createElement('div'));

  // Request ONLY the fields we actually need - this dramatically reduces costs
  const fields: (keyof google.maps.places.PlaceResult)[] = [
    'place_id',
    'name',
    'formatted_address',
    'geometry',
    'rating',
    'user_ratings_total',
    'opening_hours',
    'price_level',
    'website',
    'formatted_phone_number',
    'photos',
  ];

  telemetry.details_requests++;
  console.log(`[Places API] Details request #${telemetry.details_requests}: ${placeId}`);

  return new Promise<any>((resolve) => {
    service.getDetails(
      {
        placeId,
        sessionToken,
        fields,
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          // Cache the result
          detailsCache.set(placeId, place);
          resolve(place);
        } else {
          console.warn(`[Places API] Details error: ${status}`);
          resolve(null);
        }
      }
    );
  });
}

/**
 * Get a small photo URL from a PlacePhoto object.
 * Use max=320 for cards, max=640 for hero images.
 * 
 * @param photo - Google PlacePhoto object
 * @param maxSize - Maximum width/height (default 320px)
 * @returns Photo URL
 */
export function getPhotoUrl(
  photo: google.maps.places.PlacePhoto,
  maxSize: number = 320
): string {
  telemetry.photo_requests++;
  console.log(`[Places API] Photo request #${telemetry.photo_requests}: ${maxSize}px`);
  
  return photo.getUrl({
    maxWidth: maxSize,
    maxHeight: maxSize,
  });
}

/**
 * Load Google Maps API script once.
 * Returns true if loaded successfully, false otherwise.
 */
let loadPromise: Promise<boolean> | null = null;

export async function loadGoogleMapsAPI(): Promise<boolean> {
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

