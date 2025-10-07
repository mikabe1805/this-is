# Database Cleanup Guide - Stop Photo URL Leaks

## 🎯 Problem

Old Firebase data contains Google Places photo URLs like:
```
mainImage: "https://maps.googleapis.com/maps/api/place/photo?photo_reference=..."
```

When rendered in `<img>` tags, browsers load these directly, **bypassing our kill switch** and still charging you!

---

## ✅ Solution Deployed

1. **SafeImage Component** (`src/components/ui/SafeImage.tsx`)
   - Intercepts Google photo URLs when `PLACES_PHOTOS_ENABLED=false`
   - Automatically replaces with placeholder
   - Has built-in error handling

2. **Database Cleanup Scripts** (in `scripts/`)
   - `clean-firebase-photos.js` - Replaces all Google photo URLs with placeholder
   - `reset-database.js` - Complete database reset (nuclear option)

---

## 🔧 Choose Your Fix

### Option 1: Clean Existing Data (Recommended)

This keeps your data but replaces all Google photo URLs with placeholders:

```bash
cd scripts
npm run clean-photos
```

**What it does**:
- Scans: `places`, `hubs`, `lists`, `posts`, `users`
- Finds: All URLs containing `googleapis.com`
- Replaces with: `/assets/leaf.png`
- Commits changes in batches

**Time**: ~30 seconds  
**Risk**: Low (only updates photo fields)

---

### Option 2: Complete Database Reset

Since you mentioned the data is outdated anyway:

```bash
cd scripts
npm run reset-db
```

**What it does**:
- Deletes ALL documents from ALL collections
- Fresh slate for development
- Cannot be undone!

**Time**: ~10 seconds  
**Risk**: Total data loss (but you said it's okay)

---

## 🚀 After Cleanup

1. **Refresh your app** (hard reload: Ctrl+Shift+R)
2. **Check browser console** - should see NO more photo 403 errors
3. **Verify Google Cloud Metrics** - should stay at 0 requests

---

## 🎨 Future-Proofing

To ensure this never happens again, when adding images in code:

### ✅ DO THIS:
```tsx
import SafeImage from '../components/ui/SafeImage';

<SafeImage 
  src={hub.mainImage} 
  alt={hub.name}
  className="w-16 h-16 rounded-xl"
/>
```

### ❌ DON'T DO THIS:
```tsx
<img src={hub.mainImage} alt={hub.name} />
```

---

## 📊 Current Status

- ✅ Kill switches deployed (`PLACES_ENABLED=false`)
- ✅ SafeImage component created
- ✅ Build deployed to Firebase
- ⏳ **Next**: Run one of the cleanup scripts above
- ⏳ **Then**: Verify 0 photo requests in browser

---

## 🚨 Quick Reference

```bash
# Option 1: Clean photos only
cd scripts && npm run clean-photos

# Option 2: Reset everything
cd scripts && npm run reset-db

# Check what scripts are available
cd scripts && npm run
```

---

**Recommended**: Run `npm run clean-photos` first, check if photo 403s stop. If they persist, then run `reset-db` for a clean slate.

