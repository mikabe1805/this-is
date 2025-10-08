# 🚀 DEPLOYMENT CHECKLIST - Places API (New) Migration

## ⏱️ Time Estimate: 10-15 minutes

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### 1. Environment Variables Ready

**Frontend `.env` (create if not exists):**
```bash
# New Places API (New) key - browser key with HTTP referrers
VITE_PLACES_NEW_KEY=YOUR_NEW_API_KEY_HERE

# Feature flags
VITE_PLACES_ENABLED=true
VITE_PLACES_PHOTOS_ENABLED=true  # Set false for $0/day mode
VITE_DAILY_GOOGLE_PHOTO_LIMIT=10  # Max photos per user per day

# Legacy key (keep for geocoding)
VITE_GOOGLE_MAPS_API_KEY=YOUR_LEGACY_KEY_HERE
```

**Cloud Function Environment Variables:**
```bash
# In Google Cloud Console → Cloud Functions → suggestPlaces → Edit
GOOGLE_PLACES_NEW_KEY=YOUR_SERVER_API_KEY_HERE  # Server key, IP-restricted
```

### 2. API Key Restrictions (Google Cloud Console → Credentials)

**New Browser Key:**
- ✅ Application restrictions: **HTTP referrers**
  - `https://this-is-76332.web.app/*`
  - `https://this-is-76332.firebaseapp.com/*`
  - `http://localhost:*`
  - `http://127.0.0.1:*`
- ✅ API restrictions: **Restrict key**
  - Maps JavaScript API ✓
  - Places API (New) ✓
  - Geocoding API ✓

**Old Key (Legacy):**
- ❌ **Disable** Places API (old) on this key
- ✅ Keep Geocoding API only

### 3. Quotas Set (Console → Places API (New) → Quotas)

```
places.get (Details):      25/day   ← Only on-click
places.searchText:         50/day   ← Server-side search
places.searchNearby:       50/day   ← Server-side nearby
places.photos.get:         10/day   ← Budgeted client-side (or 0 for $0/day)
places:autocomplete:       1000/day ← Keep high, it's cheap with sessions
```

---

## 🚢 DEPLOYMENT ORDER (CRITICAL!)

### Step 1: Deploy Cloud Function FIRST

```bash
cd functions
npm run build

# Check for TypeScript errors
npm run build

# Deploy ONLY the Cloud Function
firebase deploy --only functions:suggestPlaces

# ✅ Wait for deployment to complete (30-60 seconds)
# ✅ Verify in Firebase Console → Functions → suggestPlaces shows "Healthy"
```

**Expected Cloud Function logs:**
```
[Places API (New)] Nearby Search { lat, lng, includedTypes, radius }
[Places API (New)] Nearby Search response { count: X }
[Places API (New)] Returning results { count: X }
```

### Step 2: Deploy Frontend

```bash
cd ..

# Build with new env vars
npm run build

# Deploy hosting
firebase deploy --only hosting

# ✅ Wait for deployment (20-30 seconds)
```

### Step 3: Verify Deployment

```bash
# Open deployed app
start https://this-is-76332.web.app

# OR
start https://this-is-76332.firebaseapp.com
```

---

## 🔍 60-MINUTE POST-DEPLOY WATCH (CRITICAL!)

### DevTools Network Monitoring

**Open:** Chrome DevTools → Network → Filter: `places.googleapis.com`

**What to check:**

#### ✅ SCROLLING (2-3 minutes on Home/Explore/Search)
```
Expected: 0 API calls
If you see calls: STOP - Something is wrong, photos are loading on scroll
```

#### ✅ CLICKING A PLACE (click 5 different cards)
```
Expected: 5× GET https://places.googleapis.com/v1/places/{placeId}
         0-5× GET https://places.googleapis.com/v1/{resourceName}/media
If more: STOP - Details being called on scroll instead of click
```

#### ✅ AUTOCOMPLETE (type in search 3 times)
```
Expected: ≤3× POST https://places.googleapis.com/v1/places:autocomplete
If more: Check session token is working
```

### Console Logs to Watch For

**✅ GOOD (Expected):**
```
[Places API (New)] searchText -> ...
[Places API (New)] searchNearby -> ...
[Places Adapter] Session started session_...
[geocodeLocation] CACHE HIT -> New Brunswick, NJ, USA
[Photo Budget] 3/10 photos used today
```

**❌ BAD (Fix immediately):**
```
🚫 Places session not started (PLACES_ENABLED=false)  ← Check .env
💰 API CALL -> New Brunswick, NJ, USA (repeated)      ← Cache not working
[Photo Budget] 11/10 photos used today                ← Budget exceeded
```

### Google Cloud Console Monitoring

**Navigate to:** Cloud Console → APIs & Services → Places API (New) → Metrics

**What to check (after 30 minutes):**
```
places.get:         ≈ number of cards you clicked (should be ~10-20)
places.searchText:  ≈ number of times you loaded Home/Discovery (should be ~5-10)
places.searchNearby: ≈ number of nearby searches (should be ~5-10)
places.photos.get:  ≤ 10 (your daily limit)
```

**If any metric is unexpectedly high:**
1. Open DevTools → Network
2. Scroll/click around to identify the culprit
3. Take screenshot of network calls
4. Report in logs for debugging

### Billing Dashboard (Check after 2 hours)

**Navigate to:** Cloud Console → Billing → Reports

**Filter:**
- Product: Places API (New)
- Time range: Today
- Group by: SKU

**Expected costs (first day):**
```
Text Search:        $0.30-$0.50  (10-15 searches × $0.032)
Nearby Search:      $0.00        (Free for basic fields!)
Place Details:      $0.00        (Basic fields, no atmosphere/contact)
Place Photos:       $0.07        (10 photos × $0.007)
-----------------------------------
TOTAL:              ~$0.40/day   ✅ Target achieved!
```

**🚨 IF COSTS ARE HIGHER:**
```bash
# Emergency kill switch - redeploy with:
VITE_PLACES_PHOTOS_ENABLED=false
VITE_PLACES_ENABLED=false  # Nuclear option, shows posters only
```

---

## 🧪 REGRESSION TESTS (Copy & Paste Checklist)

### Test 1: Scroll = 0 Calls
- [ ] Open Home page
- [ ] DevTools Network → Filter `places.googleapis.com`
- [ ] Scroll for 30 seconds
- [ ] **Expected:** 0 network requests
- [ ] **Actual:** _________

### Test 2: Click = 1 Detail Call
- [ ] Click on a place card
- [ ] Check Network tab
- [ ] **Expected:** 1× GET `/v1/places/{id}`
- [ ] **Actual:** _________

### Test 3: Photo Budget Works
- [ ] Open 15 different place cards
- [ ] Check Console for `[Photo Budget]` logs
- [ ] **Expected:** Stops at 10/10 photos
- [ ] **Actual:** _________

### Test 4: Geocoding Cached
- [ ] Refresh page (goes to same location)
- [ ] Check Console
- [ ] **Expected:** `[geocodeLocation] CACHE HIT`
- [ ] **Actual:** _________

### Test 5: Posters Appear
- [ ] Find a place without user photos
- [ ] **Expected:** Category poster visible (coffee/park/museum/etc.)
- [ ] **Actual:** _________

### Test 6: Glass Effect Visible
- [ ] Check Home/Explore/Search cards
- [ ] **Expected:** Blur + warm sun gradient visible
- [ ] **Actual:** _________

### Test 7: No 403 Errors
- [ ] Open Console
- [ ] Browse app for 2 minutes
- [ ] **Expected:** No red 403 errors
- [ ] **Actual:** _________

### Test 8: A11y Check
- [ ] Run Lighthouse (Accessibility)
- [ ] **Expected:** Score ≥ 90
- [ ] **Actual:** _________

---

## 🎯 SUCCESS CRITERIA

After 60 minutes, you should see:

✅ **Daily cost:** $0.30-$0.50 (entire app, all users combined)  
✅ **Cloud Function logs:** Show `[Places API (New)]` prefix  
✅ **No legacy API calls:** No `/place/nearbysearch/json` in Network tab  
✅ **Posters visible:** On places without photos  
✅ **Glass effect obvious:** Blur + sun gradients on cards  
✅ **No console errors:** No 403s from old photo URLs  
✅ **Budget working:** `[Photo Budget] X/10` in console  
✅ **Cache working:** `[geocodeLocation] CACHE HIT` on repeated locations  

---

## 🚨 ROLLBACK PLAN (If Something Goes Wrong)

### Emergency: Costs Spiking

```bash
# Option 1: Disable photos only
# Update .env:
VITE_PLACES_PHOTOS_ENABLED=false
npm run build
firebase deploy --only hosting

# Option 2: Disable Places API entirely (show posters only)
# Update .env:
VITE_PLACES_ENABLED=false
npm run build
firebase deploy --only hosting

# Option 3: Set quotas to 0 in Google Cloud Console
# Navigate to: Places API (New) → Quotas
# Set all quotas to 0 temporarily
```

### Full Rollback (Nuclear Option)

```bash
# Revert to previous Cloud Function deployment
firebase functions:log --only suggestPlaces
# Find previous healthy version timestamp
# firebase rollback --only functions:suggestPlaces --to <timestamp>
```

---

## 📊 DEMO KNOBS (For Your Boss)

**Conservative Mode ($0/day):**
```bash
VITE_PLACES_PHOTOS_ENABLED=false
VITE_DAILY_GOOGLE_PHOTO_LIMIT=0
```
- All posters, looks intentional and designed
- Zero Google Photo API costs

**Balanced Mode ($0.07/day):**
```bash
VITE_PLACES_PHOTOS_ENABLED=true
VITE_DAILY_GOOGLE_PHOTO_LIMIT=10
```
- Posters + occasional Google photos
- Feels alive without breaking the bank

**Rich Mode ($0.14/day):**
```bash
VITE_PLACES_PHOTOS_ENABLED=true
VITE_DAILY_GOOGLE_PHOTO_LIMIT=20
```
- More Google photos for premium feel
- Still 90% cheaper than before

---

## 📝 REFUND DOCUMENTATION (Submit After 24h Success)

**What to include in Google Support ticket:**

1. **Billing spike date:** October 5-6, 2025
2. **Root cause:** Legacy Places API calling premium fields without field masks
3. **Fix implemented:** Migrated to Places API (New) v1 REST with `LIST_FIELD_MASK`
4. **Evidence:**
   - Screenshot of API key restrictions (HTTP referrers + API restrictions)
   - Screenshot of Places API (New) quotas (25/50/50/10 limits)
   - Screenshot of Oct 7 billing showing $0.30-$0.50 (proof fix works)
5. **Code changes:**
   - Removed Details enrichment loop in Cloud Function
   - Field masks restrict to basic fields only
   - Implemented photo budget (10/day)
   - Geocoding cached (30-day TTL)

**Template text:**
```
Subject: Refund Request - Unexpected Places API Charges (Oct 5-6)

Hello Google Cloud Support,

I'm requesting a refund for unexpected Places API charges on October 5-6, 2025.

ISSUE:
Our Cloud Function was inadvertently calling Place Details with premium field
bundles (Atmosphere, Contact) for every search result, resulting in charges of
$3-5/day instead of expected $0.30/day.

ROOT CAUSE:
Legacy Places API implementation did not use field masks, causing automatic
billing for all available fields including premium SKUs.

FIX IMPLEMENTED:
1. Migrated to Places API (New) v1 REST with strict field masks
2. LIST_FIELD_MASK restricts to: id, displayName, formattedAddress, location, types
3. Removed Details enrichment loop (0 Details calls on search)
4. Set hard quotas: places.get=25/day, places.photos.get=10/day
5. Implemented client-side photo budget (10/day max)

VERIFICATION:
October 7 billing shows $0.30-$0.50/day (expected rate), confirming fix works.

ATTACHED:
- API key restrictions screenshot
- Quotas configuration screenshot
- Oct 7 billing report

Thank you for your consideration.
```

---

## ✅ DEPLOYMENT COMPLETE CHECKLIST

After 60 minutes of monitoring:

- [ ] Costs show $0.30-$0.50 on Oct 7 billing dashboard
- [ ] Cloud Function logs show `[Places API (New)]` prefix
- [ ] Network tab shows 0 calls on scroll, 1 call on click
- [ ] Console shows `[Photo Budget]` tracking
- [ ] Console shows `[geocodeLocation] CACHE HIT`
- [ ] Posters visible on places without photos
- [ ] Glass effect obvious on cards
- [ ] No 403 errors in console
- [ ] Lighthouse accessibility score ≥ 90

**IF ALL GREEN:** 🎉 Migration successful! Submit refund ticket.

**IF ANY RED:** Follow rollback plan above and debug before re-deploying.

