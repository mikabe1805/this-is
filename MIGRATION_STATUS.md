> **FROZEN V1 REFERENCE - NOT CURRENT PRODUCT AUTHORITY.** This file documents the retired root application and may contain obsolete costs, credentials guidance, commands, or deployment claims. Do not implement or deploy from it. Start with [README.md](README.md) and [CURRENT_STATE.md](docs/product-reset/CURRENT_STATE.md).

# Places API (New) + Low-Cost Visual Mode + Cozy Glass - Migration Status

## ✅ COMPLETED (Foundational Libraries)

### 1. Places API (New) Wrapper (`src/lib/placesNew.ts`)
- ✅ `searchText()` - Text search with field masks (LIST_FIELD_MASK for lists, DETAIL_FIELD_MASK for details)
- ✅ `searchNearby()` - Nearby search with type filters
- ✅ `autocomplete()` - Session-token based autocomplete
- ✅ `getDetails()` - Place details (call ONLY on-click, not on scroll)
- ✅ `photoUrl()` - Generate photo URLs with budget control
- ✅ Logging for all API calls (look for `[Places (New)]` in console)

### 2. Photo Budget System (`src/lib/photoBudget.ts`)
- ✅ Daily photo limit tracking (default: 10/day per user)
- ✅ `canFetchGooglePhoto()` - Check if budget allows
- ✅ `markGooglePhotoFetched()` - Increment counter
- ✅ `getRemainingBudget()` - Check remaining quota
- ✅ Automatic daily reset (localStorage based)

### 3. Dwell-Based Lazy Loading (`src/lib/useDwell.ts`)
- ✅ `useDwell()` hook - Only trigger after 400ms+ visible
- ✅ Prevents API calls during fast scrolling
- ✅ 60% intersection threshold

### 4. Intelligent Reasoning (`src/lib/reason.ts`)
- ✅ `reasonFor()` - Generate truthful "Why this?" explanations
- ✅ Tag overlap detection (strongest signal)
- ✅ Friend popularity detection
- ✅ Nearby location reasoning
- ✅ Returns `null` if no strong reason (no fake reasons!)

### 5. Category Poster System (`src/ui/posters/`)
- ✅ `PosterImage` component - Beautiful SVG category posters
- ✅ 14 categories: coffee, brunch, restaurant, dessert, bar, garden, park, museum, book, hiking, music, cinema, nightlife, default
- ✅ `categoryFromTypes()` - Map Google types to categories
- ✅ `categoryColor()` - Earthy color per category
- ✅ **100% FREE** - No API calls, pure SVG

### 6. Smart Visual Component (`src/components/ui/PlaceVisual.tsx`)
- ✅ 3-tier visual hierarchy:
  1. **Category poster** (free, always visible as base)
  2. **User photo mosaic** (free, if available)
  3. **Google photo** (budgeted + dwell-based, only after 400ms visible)
- ✅ `UserPhotoMosaic` - 1-3 photos in attractive layouts
- ✅ Google attribution badge (only when Google photo loads)
- ✅ Graceful fallbacks at every level

### 7. Enhanced Cozy Glass Tokens
- ✅ Updated `src/theme/tokens.css`:
  - `--glass-blur: 16px` (was 8px)
  - `--glass-bg: rgba(255, 255, 255, .52)` (stronger)
  - `--glass-stroke: rgba(255, 255, 255, .22)` (new border)
  - `--glass-sun-a: rgba(255, 210, 130, .20)` (warmer)
  - `--glass-sun-b: rgba(75, 143, 103, .18)` (moss glow)
- ✅ Updated `src/styles/cozy-glass.css`:
  - `.glass` now has visible border stroke
  - Stronger sun gradients (120% x 120% @ 20% 0%)

### 8. Updated Card Components
- ✅ `src/components/explore/StackCard.tsx` - Now uses `PlaceVisual`
- ✅ `src/components/home/SuggestedHubCard.tsx` - Now uses `PlaceVisual`

### 9. Geocoding Cache (BONUS - already completed)
- ✅ In-memory + localStorage caching (30-day TTL)
- ✅ Console logs show `💰 API CALL` vs `CACHE HIT`
- ✅ Dramatically reduces geocoding costs

---

## 🚧 TODO (What You Need to Do Next)

### STEP 1: Environment Setup (CRITICAL - Do This First!)

```bash
# In your .env file, add these variables:
VITE_PLACES_NEW_KEY=YOUR_NEW_API_KEY_HERE
VITE_PLACES_ENABLED=true
VITE_PLACES_PHOTOS_ENABLED=false  # Start at $0/day, enable when ready
VITE_DAILY_GOOGLE_PHOTO_LIMIT=10

# Keep legacy key for geocoding:
VITE_GOOGLE_MAPS_API_KEY=YOUR_LEGACY_KEY_HERE
```

**API Key Setup:**
1. In Google Cloud Console → Credentials → Create API Key
2. **HTTP referrer restrictions:**
   - `https://this-is-76332.web.app/*`
   - `https://this-is-76332.firebaseapp.com/*`
   - `http://localhost:*`
3. **API restrictions:**
   - Maps JavaScript API
   - Places API (New)
   - Geocoding API

**Set Quotas (Console → Places API (New) → Quotas):**
- `places.get` (details): 25/day
- `places.searchText`: 50/day
- `places.searchNearby`: 50/day
- `places.photos.get`: 10/day (or **0 for $0/day mode**)

### STEP 2: Replace Legacy Places API Calls

**What to search for:**
```typescript
// OLD (to remove):
google.maps.places.PlacesService
google.maps.places.AutocompleteService
maps.googleapis.com/maps/api/place
getPhotoUrl()

// NEW (use instead):
import { searchText, searchNearby, autocomplete, getDetails, photoUrl } from '../lib/placesNew'
```

**Key files to update:**
- `src/services/google/places.ts` (probably entire file)
- `src/components/GooglePlacesAutocomplete.tsx`
- `src/pages/Search.tsx` or `SearchV2.tsx`
- `src/pages/Explore.tsx`
- `src/pages/Home.tsx` (discovery section)
- `functions/src/places.ts` (Cloud Function - migrate to REST API calls)

**Migration rules:**
1. **Autocomplete**: Use session tokens, max 3 requests per session
2. **List views**: Use `searchText()` or `searchNearby()` with `LIST_FIELD_MASK`
3. **Details**: ONLY call `getDetails()` on-click, never on scroll
4. **Photos**: Always go through `PlaceVisual` component (never direct `photoUrl()` calls)

### STEP 3: Explore Gestures (Not Started)

**File:** `src/components/explore/StackDeck.tsx`

**Requirements:**
- Right swipe → Save (show ✓ SAVE overlay in moss green)
- Left swipe → Dismiss (show ✕ DISMISS overlay in bark)
- Up swipe → Open (show ↗ OPEN overlay)
- Overlays fade based on swipe distance
- A11y buttons below card (Save / Dismiss / Open) for non-gesture users
- Respect `prefers-reduced-motion`

### STEP 4: Cozy Glass Sweep (Not Started)

**Codemod pass needed on:**
- `src/pages/Home.tsx`
- `src/pages/Explore.tsx`
- `src/pages/Search.tsx` / `SearchV2.tsx`
- `src/pages/PlaceHub.tsx`
- `src/pages/ListView.tsx`

**Rules:**
- Hero images → `.scrim` + `.glass` toolbar for text
- Content blocks → `.panel` (solid)
- Cards → `.glass` (now with `PlaceVisual` inside)
- Never translucent body text (only on `.panel` or `.scrim` backgrounds)
- Replace ad-hoc `backdrop-blur` with `.glass` class

### STEP 5: Cloud Function Migration (CRITICAL for Cost)

**File:** `functions/src/places.ts`

The `suggestPlaces` function currently uses the old Places API. **This is likely where your billing spike came from.**

**Migration steps:**
1. Replace `@googlemaps/google-maps-services-js` with direct REST API calls to Places API (New)
2. Use `LIST_FIELD_MASK` for search results (not DETAIL_FIELD_MASK)
3. Never call `Place Details` in the loop - return search results as-is
4. If you need details, do it on-demand when user clicks "Create Hub"

### STEP 6: Test & Verify

**Test checklist:**
- [ ] Scrolling Explore deck → 0 Details calls, ≤10 photos/day total
- [ ] Clicking a place → ≤1 getDetails call
- [ ] Re-opening same place → 0 new API calls (served from DB)
- [ ] Posters visible on all places without photos
- [ ] User photo mosaics work (if you have test data)
- [ ] Google photos only load after dwell (watch network tab)
- [ ] Console shows `[Photo Budget] X/10 photos used today`
- [ ] Console shows `[Places (New)]` logs for all API calls
- [ ] Geocoding shows `CACHE HIT` on repeated location lookups

---

## 💰 Expected Cost Savings

### Before (Legacy Places API):
- **Details calls on scroll**: $0.017 × 100 = $1.70/day
- **Premium fields** (website, editorial_summary): Extra $0.012 each
- **No caching**: Repeated calls for same data
- **No quotas**: Runaway billing possible
- **Estimated**: $3-5/day per active user

### After (Places API (New) + Low-Cost Visual Mode):
- **List views**: $0/day (posters only, 0 API calls)
- **With photos OFF**: $0/day (posters + user photos only)
- **With photos ON** (10/day limit): ~$0.07/day (10 × $0.007)
- **Details**: Only on-click, cached in DB forever
- **Geocoding**: Cached 30 days, $0.005 per unique location
- **Estimated**: **$0-0.10/day per active user**

---

## 🎯 Acceptance Criteria (from original spec)

### Cost/Calls
- [ ] Scrolling lists: 0 Details calls; ≤10/day Google photos (or 0 if disabled)
- [ ] Clicking fresh item: ≤1 places.get + 0/1 photo (if budget allows)
- [ ] Re-opening same item: 0 new Google calls

### UI
- [ ] Cards visibly glassy across Home/Explore/Search
- [ ] Posters (or user mosaics) always present
- [ ] Google thumb appears only after dwell + budget check
- [ ] Explore gestures work (R=save, L=dismiss, U=open)
- [ ] Reason chips show tag/friend/nearby logic

### A11y
- [ ] Tap targets ≥44×44px
- [ ] Icon buttons have aria-label
- [ ] Body copy contrast ≥4.5:1

---

## 📝 Console Logging Guide

**What to look for:**
- `[Places (New)] searchText ->` - Text search API call
- `[Places (New)] searchNearby ->` - Nearby search API call
- `[Places (New)] autocomplete ->` - Autocomplete API call
- `[Places (New)] 💰 getDetails ->` - **EXPENSIVE** Details call (should be rare!)
- `[Photo Budget] X/10 photos used today` - Photo budget tracking
- `[geocodeLocation] 💰 API CALL ->` - **EXPENSIVE** Geocoding call
- `[geocodeLocation] CACHE HIT ->` - Free cached geocoding
- `[PlaceVisual] Google photo failed to load` - Photo loading error

---

## 🚀 Next Steps

1. **Set up .env** with new API key and quotas (see STEP 1 above)
2. **Test locally** with `npm run dev` - verify posters appear, no API calls on scroll
3. **Gradually migrate** legacy Places API calls (see STEP 2)
4. **Deploy Cloud Function** with REST API migration (STEP 5 - critical!)
5. **Enable photos** by setting `VITE_PLACES_PHOTOS_ENABLED=true` when ready
6. **Monitor billing** in Google Cloud Console
7. **Run acceptance tests** (STEP 6)
8. **Update UI status**: `npm run status:ui` and commit screenshots

---

## ❓ Questions?

- **"Why are my hubs empty?"** → Likely old data with legacy photo URLs. Run the database cleanup script or re-seed.
- **"Photos not loading?"** → Check `VITE_PLACES_PHOTOS_ENABLED=true` and budget not exhausted.
- **"Posters look weird?"** → They're category-based, not real photos. This is intentional and free!
- **"Still seeing high costs?"** → Check Cloud Function hasn't been migrated yet (see STEP 5).
- **"How do I test at $0/day?"** → Set `VITE_PLACES_PHOTOS_ENABLED=false` and `places.photos.get` quota to 0.

