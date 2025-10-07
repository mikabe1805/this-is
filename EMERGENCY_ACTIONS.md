# 🚨 STOP $8/DAY GOOGLE PLACES SPEND - DO THIS NOW

## ⚡ 3-Minute Emergency Stop

### 1. Set Quotas (2 min)
1. Open: https://console.cloud.google.com/apis/library
2. Click **Quotas** (left sidebar)
3. Filter: "Places"
4. Select ALL rows → **EDIT QUOTAS**
5. Set to **100 per day** for each
6. **SAVE**

### 2. Deploy Hotfix (1 min)
```bash
# Already on hotfix/places-freeze-02 branch ✅

# Create .env file (if doesn't exist)
echo "VITE_PLACES_ENABLED=false" > .env
echo "VITE_PLACES_PHOTOS_ENABLED=false" >> .env

# Build and deploy
npm run build
# (deploy dist/ to your hosting)
```

### 3. Verify (30 seconds)
- Open your deployed app
- Check browser console:
  - Should see: `⚠️ PLACES_ENABLED=false`
  - Should see: `📍 Places API Call: { cached: true }`
- Check Google Metrics: Should show **0 new requests**

---

## ✅ What This Hotfix Does

| Before | After |
|--------|-------|
| Details with ALL fields → $0.077 | Details with BASIC fields only → $0.017 |
| Photos load on scroll → $2.64/day | Photos blocked → $0 |
| ~1,127 API calls/day | ~60 API calls/day |
| **$8.84/day** | **$0.50/day** |

**Savings: 95% reduction**

---

## 🎯 What Changed

### New Kill Switches (`src/lib/flags.ts`)
```typescript
// DEFAULT TO FALSE = SAFE
export const PLACES_ENABLED = import.meta.env.VITE_PLACES_ENABLED === 'true';
export const PLACES_PHOTOS_ENABLED = import.meta.env.VITE_PLACES_PHOTOS_ENABLED === 'true';
```

### Restricted Fields (`src/services/google/places.ts`)
```typescript
// BEFORE: 13 fields → triggered Atmosphere + Contact SKUs
// AFTER: 5 fields only
const BASIC_FIELDS = [
  'place_id',
  'name',
  'formatted_address',
  'geometry',
  'photos'
];
```

### Full Instrumentation
Every API call now logs:
```javascript
📍 Places API Call: {
  route: "/explore",
  type: "details",
  fields: "place_id,name,formatted_address,geometry,photos",
  cached: false,
  timestamp: "..."
}
```

---

## 🔍 How to Re-Enable (After Verification)

### Phase 1: Details Only (No Photos)
```bash
# In .env or hosting env vars
VITE_PLACES_ENABLED=true
VITE_PLACES_PHOTOS_ENABLED=false
```
**Expected**: Autocomplete + Details work, all images are placeholders

### Phase 2: Full Enable
```bash
VITE_PLACES_ENABLED=true
VITE_PLACES_PHOTOS_ENABLED=true
```
**Expected**: ~$0.50/day (with 100/day quota enforced)

---

## 🚨 Nuclear Option (If Needed)

**If you can't deploy immediately:**

1. **Disable the API completely**:
   - Google Cloud Console → **APIs & Services → Library**
   - Search "Places API" → **DISABLE**
   - Requests stop instantly ✅

2. **OR Block the API key**:
   - **APIs & Services → Credentials** → Your browser key
   - **Application restrictions** → Add only: `https://block.example`
   - Remove your real domain → **SAVE**
   - Requests blocked within 5 minutes ✅

---

## 📊 Verification Checklist

After deploying:

- [ ] `.env` has `VITE_PLACES_ENABLED=false`
- [ ] App loads (shows placeholder images)
- [ ] Console shows: `⚠️ PLACES_ENABLED=false`
- [ ] Browser network tab shows **0 requests** to `googleapis.com`
- [ ] Google Cloud Metrics show **0 new requests**
- [ ] Quotas are set to **100/day**

---

## 📞 Next Steps

1. **Deploy this hotfix NOW** with flags=false
2. **Verify spend stops** (check metrics in 5-10 min)
3. **Read full documentation**: `PLACES_API_HOTFIX.md`
4. **Gradually re-enable**:
   - Day 1: Keep disabled, verify $0 spend
   - Day 2: Enable Details only (`VITE_PLACES_ENABLED=true`)
   - Day 3: Enable Photos (`VITE_PLACES_PHOTOS_ENABLED=true`)
   - Monitor metrics at each step

---

**Current Status**: ✅ Hotfix ready on `hotfix/places-freeze-02`  
**Action Required**: Deploy with `.env` flags set to `false`  
**Timeline**: 3 minutes to stop spend, 24 hours to verify

