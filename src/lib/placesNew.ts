/**
 * Places API (New) wrapper - v1 REST endpoints
 * Cost-optimized with field masks, session tokens, and strict budget controls.
 */

import { placesQueue } from './placesQueue';

// All Places (New) traffic goes through here.
const API = 'https://places.googleapis.com/v1';
const KEY = import.meta.env.VITE_PLACES_NEW_KEY as string;
const PHOTOS_ON = import.meta.env.VITE_PLACES_PHOTOS_ENABLED === 'true';
const PLACES_ON = import.meta.env.VITE_PLACES_ENABLED === 'true';

// Keep responses tight: list only what you actually render in lists/cards.
// For detail view we'll fetch a broader mask on demand.
// NOTE: photos.name removed to save costs - we use fallback images for suggested hubs
const LIST_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.photos.name';
const DETAIL_FIELD_MASK =
  'id,displayName,formattedAddress,location,primaryType,types,websiteUri,internationalPhoneNumber,userRatingCount,rating,photos';

function headers(fieldMask?: string): Headers {
  const h = new Headers({ 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY });
  if (fieldMask) h.set('X-Goog-FieldMask', fieldMask);
  return h;
}

export type PlaceLite = {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  types?: string[];
  primaryType?: string;
  photos?: { name: string }[]; // Places (New) format
  photoResourceName?: string; // Legacy compatibility
};

export type PlaceDetail = PlaceLite & {
  rating?: number;
  userRatingCount?: number;
  website?: string;
  phone?: string;
};

export async function searchText(
  q: string,
  opts?: { lat?: number; lng?: number; max?: number }
): Promise<PlaceLite[]> {
  if (!PLACES_ON) return [];
  
  const body: any = { textQuery: q, maxResultCount: opts?.max ?? 10, languageCode: 'en' };
  if (opts?.lat && opts?.lng) {
    body.locationBias = {
      circle: {
        center: { latitude: opts.lat, longitude: opts.lng },
        radius: 3000,
      },
    };
  }
  
  console.log('[Places (New)] searchText ->', q, opts);
  
  // Wrap fetch in queue to prevent rate limiting
  const res = await placesQueue.enqueue(async () => {
    const response = await fetch(`${API}/places:searchText`, {
      method: 'POST',
      headers: headers(LIST_FIELD_MASK),
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => 'Unknown error')}`);
    }
    
    return response;
  });
  
  if (!res.ok) {
    console.error('[Places (New)] searchText failed', res.status);
    return [];
  }
  
  const json = await res.json();
  return (json.places ?? []).map(mapLite);
}

export async function searchNearby(
  lat: number,
  lng: number,
  opts?: {
    includedTypes?: string[];
    max?: number;
    cacheBypass?: boolean;
    cacheTtlMs?: number;
    jitterMeters?: number;
    radiusMeters?: number;
  }
): Promise<PlaceLite[]> {
  if (!PLACES_ON) return [];

  const typesKey = (opts?.includedTypes || []).map(t => String(t).toLowerCase()).sort().join('+');
  const cacheKey = `places:v1:near|${lat.toFixed(3)},${lng.toFixed(3)}|${typesKey}|${opts?.max ?? 10}`;
  if (!opts?.cacheBypass) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { t, v } = JSON.parse(cached);
        const ttl =
          typeof opts?.cacheTtlMs === 'number' && opts.cacheTtlMs > 0
            ? opts.cacheTtlMs
            : 24 * 60 * 60 * 1000;
        if (Date.now() - t < ttl) {
          return v;
        }
        localStorage.removeItem(cacheKey);
      }
    } catch {}
  }

  let originLat = lat;
  let originLng = lng;
  if (opts?.cacheBypass && opts?.jitterMeters && opts.jitterMeters > 0) {
    const toDeg = (meters: number) => meters / 111_111;
    const jitter = opts.jitterMeters;
    const offsetLat = (Math.random() * 2 - 1) * toDeg(jitter);
    const offsetLng = (Math.random() * 2 - 1) * toDeg(jitter) / (Math.cos(lat * Math.PI / 180) || 1);
    originLat += offsetLat;
    originLng += offsetLng;
  }

  const radiusMeters = Math.min(Math.max(opts?.radiusMeters ?? 3000, 500), 50000);

  const body: any = {
    maxResultCount: opts?.max ?? 10,
    languageCode: 'en',
    locationRestriction: {
      circle: {
        center: { latitude: originLat, longitude: originLng },
        radius: radiusMeters,
      },
    },
  };
  if (opts?.includedTypes?.length) body.includedTypes = opts.includedTypes;

  console.log('[Places (New)] searchNearby ->', { lat: originLat, lng: originLng, radiusMeters }, opts);
  
  // Wrap fetch in queue to prevent rate limiting
  const res = await placesQueue.enqueue(async () => {
    const response = await fetch(`${API}/places:searchNearby`, {
      method: 'POST',
      headers: headers(LIST_FIELD_MASK),
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => 'Unknown error')}`);
    }
    
    return response;
  });

  if (!res.ok) {
    console.error('[Places (New)] searchNearby failed', res.status);
    return [];
  }

  const json = await res.json();
  const out = (json.places ?? []).map(mapLite);
  if (!opts?.cacheBypass) {
    try { localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), v: out })); } catch {}
  }
  return out;
}

export async function autocomplete(text: string, sessionToken: string) {
  if (!PLACES_ON) return [];
  
  console.log('[Places (New)] autocomplete ->', text, 'session:', sessionToken.slice(0, 8));
  
  // Wrap fetch in queue to prevent rate limiting
  const res = await placesQueue.enqueue(async () => {
    const response = await fetch(`${API}/places:autocomplete`, {
      method: 'POST',
      headers: headers('suggestions.placePrediction.placeId,suggestions.placePrediction.text'),
      body: JSON.stringify({ input: text, sessionToken, languageCode: 'en' }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => 'Unknown error')}`);
    }
    
    return response;
  });
  
  if (!res.ok) {
    console.error('[Places (New)] autocomplete failed', res.status);
    return [];
  }
  
  const json = await res.json();
  return (json.suggestions ?? [])
    .map((s: any) => ({
      placeId: s.placePrediction?.placeId,
      text: s.placePrediction?.text?.text,
    }))
    .filter((x: any) => x.placeId && x.text);
}

export async function getDetails(placeId: string): Promise<PlaceDetail | null> {
  if (!PLACES_ON) return null;
  
  console.log('[Places (New)] 📍 getDetails ->', placeId);
  
  // Wrap fetch in queue to prevent rate limiting
  const res = await placesQueue.enqueue(async () => {
    const response = await fetch(`${API}/places/${placeId}`, {
      headers: headers(DETAIL_FIELD_MASK),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => 'Unknown error')}`);
    }
    
    return response;
  });
  
  if (!res.ok) {
    console.error('[Places (New)] getDetails failed', res.status);
    return null;
  }
  
  const p = await res.json();
  return {
    id: p.id,
    name: p.displayName?.text,
    address: p.formattedAddress,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    types: p.types,
    primaryType: p.primaryType,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    website: p.websiteUri,
    phone: p.internationalPhoneNumber,
    photos: p.photos,
    // Take first photo resourceName if available ΓÇô we'll convert via /media only when allowed.
    photoResourceName: p.photos?.[0]?.name,
  };
}

export function photoUrl(resourceName: string, px = 400): string {
  // DO NOT call this unless PHOTOS_ON and budget allows.
  if (!PHOTOS_ON) return '';
  
  const u = new URL(`https://places.googleapis.com/v1/${resourceName}/media`);
  u.searchParams.set('maxWidthPx', String(px));
  u.searchParams.set('key', KEY);
  return u.toString();
}

function mapLite(p: any): PlaceLite {
  return {
    id: p.id,
    name: p.displayName?.text,
    address: p.formattedAddress,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    types: p.types,
    primaryType: p.primaryType,
    photos: p.photos,
  };
}

