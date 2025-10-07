# Quick Reference: Google Places API & UI Primitives

## Google Places API Service

### Basic Usage

```typescript
import {
  loadGoogleMapsAPI,
  beginPlacesSession,
  endPlacesSession,
  getPredictions,
  getPlaceDetails,
  getPhotoUrl,
  getTelemetry
} from './services/google/places'
```

### Autocomplete Flow

```typescript
// 1. Load API once (automatically handled by components)
await loadGoogleMapsAPI()

// 2. On input focus - start session
const handleFocus = () => {
  beginPlacesSession()
}

// 3. On input change - debounce and fetch predictions
const handleInputChange = useMemo(
  () => debounce(async (value: string) => {
    if (value.length >= 3) {
      const predictions = await getPredictions(value, {
        types: ['(cities)'], // or ['establishment'], etc.
      })
      setPredictions(predictions)
    }
  }, 600),
  []
)

// 4. On prediction select - fetch details and end session
const handleSelect = async (prediction) => {
  const details = await getPlaceDetails(prediction.place_id)
  onPlaceSelect(details)
  endPlacesSession() // Important!
}

// 5. On blur/idle - end session after 5s
useEffect(() => {
  const timer = setTimeout(() => {
    endPlacesSession()
  }, 5000)
  return () => clearTimeout(timer)
}, [inputValue])
```

### Monitoring (Dev Only)

```typescript
// In browser console
import { getTelemetry } from './services/google/places'

getTelemetry()
// → { 
//   autocomplete_requests: 3, 
//   details_requests: 1, 
//   photo_requests: 1 
// }
```

### Photo Optimization

```typescript
// For card thumbnails (320px)
const smallUrl = getPhotoUrl(photo, 320)

// For hero images (640px)
const mediumUrl = getPhotoUrl(photo, 640)

// For full-screen (1024px max)
const largeUrl = getPhotoUrl(photo, 1024)
```

---

## UI Primitives

### CardShell

**Solid variant (default)** - Opaque content cards
```tsx
<CardShell variant="solid" className="p-4">
  <h3>Place Name</h3>
  <p>Description</p>
</CardShell>
```

**Glass variant** - Translucent overlay cards
```tsx
<CardShell variant="glass" className="p-3">
  <h3 className="text-white">Overlay Content</h3>
</CardShell>
```

**Interactive cards**
```tsx
<CardShell 
  variant="solid" 
  onClick={() => navigate('/place/123')}
  className="p-4"
>
  {/* Auto-adds hover:scale-[1.02] */}
</CardShell>
```

### PageHeader

**With cover image**
```tsx
<PageHeader
  coverUrl="https://example.com/cover.jpg"
  title="Midori Coffee"
  subtitle="Coffee Shop · Downtown Tokyo"
  rightActions={
    <>
      <button className="glass p-2 rounded-full">
        <ShareIcon className="w-5 h-5 text-white" />
      </button>
      <button className="glass p-2 rounded-full">
        <HeartIcon className="w-5 h-5 text-white" />
      </button>
    </>
  }
/>
```

**Simple header (no cover)**
```tsx
<PageHeader
  title="My Lists"
  subtitle={`${listCount} curated collections`}
  rightActions={
    <button className="bg-moss-500 text-white px-4 py-2 rounded-xl">
      Create New
    </button>
  }
/>
```

### ActionBar

**Primary + secondary actions**
```tsx
<ActionBar
  primary={
    <button className="w-full bg-moss-500 text-white py-3 rounded-xl font-semibold">
      Save to List
    </button>
  }
  secondary={[
    <button key="post" className="bg-bark-100 text-bark-700 px-4 py-3 rounded-xl">
      <PlusIcon className="w-4 h-4" />
    </button>,
    <button key="share" className="bg-bark-100 text-bark-700 px-4 py-3 rounded-xl">
      <ShareIcon className="w-4 h-4" />
    </button>
  ]}
/>
```

---

## Design Tokens

### Colors

**Primary palette (bark)**
```tsx
className="bg-bark-50"    // #F7F5F2 - lightest
className="bg-bark-500"   // #6F6356 - medium
className="bg-bark-900"   // #1F1C1A - darkest

className="text-bark-700" // Body text
className="text-bark-900" // Headings
```

**Accent palette (moss)**
```tsx
className="bg-moss-500"   // #4B8F67 - Primary green
className="text-moss-600" // Links

// Buttons
className="bg-moss-500 hover:bg-moss-600 text-white"

// Tags
className="bg-moss-100 text-moss-700 border-moss-200"
```

**Neutral palette (stone)**
```tsx
className="bg-stone-50"   // #FAFAFA - Very light gray
className="border-stone-200" // #E4E4E7 - Light borders
className="text-stone-600"   // #52525B - Muted text
```

**Warm accents (sand)**
```tsx
className="bg-sand-50"    // #FFF9F1 - Warm light
className="text-sand-500" // #C49A5E - Gold accent
```

### Shadows

```tsx
className="shadow-soft"   // 0 8px 24px rgba(0,0,0,.08)
className="shadow-inset"  // inset 0 0 0 1px rgba(0,0,0,.06)
```

### Border Radius

```tsx
className="rounded-lg"    // 12px - Small cards
className="rounded-xl"    // 16px - Standard cards
className="rounded-2xl"   // 24px - Large containers
```

### Glass Effects

```tsx
// CSS classes
className="panel"         // Solid opaque card
className="glass"         // Translucent glass effect
className="glass-strong"  // More opaque
className="glass-subtle"  // More transparent
className="scrim"         // Dark gradient over images
```

---

## Patterns & Best Practices

### List Items with Actions

```tsx
<CardShell variant="glass" className="p-4">
  <div className="flex items-start gap-4">
    {/* Image */}
    <img 
      src={place.mainImage} 
      alt={place.name}
      className="w-16 h-16 rounded-xl object-cover"
    />
    
    {/* Content */}
    <div className="flex-1 min-w-0">
      <h3 className="font-semibold text-bark-900 truncate">{place.name}</h3>
      <p className="text-bark-600 text-sm line-clamp-2">{place.description}</p>
      
      {/* Inline actions */}
      <div className="flex items-center gap-2 mt-2">
        <button className="flex items-center gap-1 px-2 py-1 rounded-lg bg-bark-100 hover:bg-bark-200">
          <HeartIcon className="w-4 h-4 text-bark-600" />
          <span className="text-xs">{place.likes}</span>
        </button>
        <button className="p-1.5 rounded-lg bg-bark-100 hover:bg-bark-200">
          <BookmarkIcon className="w-4 h-4 text-bark-600" />
        </button>
      </div>
    </div>
  </div>
</CardShell>
```

### Hero Section with Cover

```tsx
<div className="relative h-44 w-full overflow-hidden rounded-b-2xl">
  <img src={coverUrl} className="h-full w-full object-cover" />
  <div className="scrim absolute inset-0" />
  
  {/* Content over image */}
  <div className="absolute bottom-3 left-3 right-3 glass p-3">
    <h1 className="text-lg font-semibold text-white">{title}</h1>
    <p className="text-white/90 text-sm">{subtitle}</p>
  </div>
</div>
```

### Segmented Control (Tabs)

```tsx
<div className="flex bg-bark-100 rounded-xl p-1">
  {['Nearby', 'Following', 'Discover'].map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
        activeTab === tab
          ? 'bg-moss-500 text-white shadow-soft'
          : 'text-bark-700 hover:text-bark-900'
      }`}
    >
      {tab}
    </button>
  ))}
</div>
```

### Loading Skeleton

```tsx
<CardShell variant="glass" className="p-4 animate-pulse">
  <div className="flex items-start gap-4">
    <div className="w-16 h-16 rounded-xl bg-bark-200" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-bark-200 rounded w-3/4" />
      <div className="h-3 bg-bark-200 rounded w-1/2" />
    </div>
  </div>
</CardShell>
```

### Empty State

```tsx
<div className="text-center py-12">
  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bark-100 flex items-center justify-center">
    <MapPinIcon className="w-8 h-8 text-bark-500" />
  </div>
  <h3 className="text-lg font-serif font-semibold text-bark-900 mb-2">
    No places yet
  </h3>
  <p className="text-bark-600 mb-4">
    Be the first to add a place to this list!
  </p>
  <button className="bg-moss-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-moss-600">
    Add Place
  </button>
</div>
```

---

## Accessibility Checklist

### Interactive Elements
- ✅ All buttons have `aria-label` when icon-only
- ✅ Focus states use `:focus-visible` (moss-500 ring)
- ✅ Color contrast ≥ 4.5:1 (7:1 for body text)
- ✅ Keyboard navigation (Tab, Enter, Escape, Arrow keys)

### Example
```tsx
<button
  onClick={handleSave}
  className="p-2 rounded-lg bg-bark-100 hover:bg-bark-200 focus-visible:outline-moss-500"
  aria-label="Save to list"
>
  <BookmarkIcon className="w-5 h-5 text-bark-700" />
</button>
```

---

## Migration from Old Patterns

### Replace Inline Hex Colors
```tsx
// ❌ Old
className="bg-[#F7F5F2] text-[#6B5B47] border-[#E4D5C7]"

// ✅ New
className="bg-bark-50 text-bark-700 border-bark-200"
```

### Replace Custom Cards
```tsx
// ❌ Old
<div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
  {children}
</div>

// ✅ New
<CardShell variant="solid" className="p-4">
  {children}
</CardShell>
```

### Replace Raw Google API Calls
```tsx
// ❌ Old
const service = new google.maps.places.AutocompleteService()
service.getPlacePredictions({ input: value }, (predictions) => {
  setPredictions(predictions)
})

// ✅ New
import { getPredictions } from '@/services/google/places'

const predictions = await getPredictions(value)
setPredictions(predictions)
```

---

## Troubleshooting

### Google Places API not loading
```typescript
// Check if API loaded
if (!window.google?.maps?.places) {
  const loaded = await loadGoogleMapsAPI()
  if (!loaded) {
    console.error('Failed to load Google Maps API')
    // Show fallback UI
  }
}
```

### Session token not working
```typescript
// Ensure session lifecycle
onFocus={() => beginPlacesSession()}
onBlur={() => {
  setTimeout(() => endPlacesSession(), 5000)
}}
```

### Excessive API calls
```typescript
// Check telemetry in console
import { getTelemetry } from '@/services/google/places'
console.log(getTelemetry())

// Reset counters
import { resetTelemetry } from '@/services/google/places'
resetTelemetry()
```

### Debounce not working
```typescript
// Use useCallback with deps
const debouncedFetch = useCallback(
  debounce(async (value: string) => {
    const predictions = await getPredictions(value)
    setPredictions(predictions)
  }, 600),
  [] // Empty deps
)

// Cleanup on unmount
useEffect(() => {
  return () => {
    debouncedFetch.cancel?.()
  }
}, [debouncedFetch])
```

---

## Cost Monitoring

### Set Up Budget Alerts (Google Cloud Console)

1. Go to **Billing** → **Budgets & alerts**
2. Create budget:
   - Name: "Places API Daily Limit"
   - Amount: $10/day
   - Alert at: 50%, 90%, 100%
3. Set up email notifications

### Monitor Usage (Google Cloud Console)

1. Go to **APIs & Services** → **Dashboard**
2. Select "Places API"
3. View metrics:
   - Autocomplete requests
   - Place Details requests
   - Place Photos requests

### Expected Daily Costs (After Optimization)

| Action | Requests/Day | Cost/Request | Daily Cost |
|--------|-------------|--------------|------------|
| Autocomplete | ~5,000 | $0.00283 | $14.15 |
| Place Details | ~500 | $0.017 | $8.50 |
| Photos | ~1,000 | $0.007 | $7.00 |
| **Total** | | | **~$30/day** |

With optimization: **~$8-10/day**

---

## Resources

- [Google Places API Pricing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
- [Session Tokens Documentation](https://developers.google.com/maps/documentation/places/web-service/session-tokens)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Heroicons](https://heroicons.com/)

