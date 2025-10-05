# Feature Flags

## Environment Variables

### Firebase Emulator Toggle
**File:** `src/firebase/config.ts:29-41`
```typescript
const useEmulators = process.env.NODE_ENV === 'development' || process.env.REACT_APP_USE_EMULATORS === 'true'

if (useEmulators) {
  connectFirestoreEmulator(db, 'localhost', 8080)
  connectAuthEmulator(auth, 'http://localhost:9099')
  connectStorageEmulator(storage, 'localhost', 9199)
  connectFunctionsEmulator(functions, 'localhost', 5001)
}
```
- **Default**: `false` (production mode)
- **Description**: Enables Firebase emulators for development
- **Gating Logic**: Development environment or explicit flag

### OpenAI API Key
**File:** `src/services/aiSearchService.ts:1-19`
```typescript
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY

if (!OPENAI_API_KEY) {
  console.warn('OpenAI API key not found. AI search features will be disabled.')
}
```
- **Default**: `undefined`
- **Description**: Enables AI-powered search features
- **Gating Logic**: API key presence

## Implicit Feature Flags

### Google Places Integration
**File:** `src/components/GoogleMapsImportModal.tsx`
```typescript
// Conditional rendering based on Google Places API availability
const isGooglePlacesAvailable = () => {
  return typeof window.google !== 'undefined' && window.google.maps
}
```
- **Type**: Implicit
- **Description**: Enables Google Places import functionality
- **Gating Logic**: Google Maps API availability

### Geolocation Support
**File:** `src/pages/Search.tsx:115-193`
```typescript
if (!loc && 'geolocation' in navigator) {
  await new Promise<void>(resolve => navigator.geolocation.getCurrentPosition(
    p => { loc = { lat: p.coords.latitude, lng: p.coords.longitude }; resolve(); }, 
    () => resolve(), 
    { timeout: 4000 }
  ));
}
```
- **Type**: Implicit
- **Description**: Enables location-based features
- **Gating Logic**: Browser geolocation API availability

### Camera Access
**File:** `src/components/CreatePost.tsx:13-18`
```typescript
// Camera access for photo capture
const hasCameraAccess = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    stream.getTracks().forEach(track => track.stop())
    return true
  } catch {
    return false
  }
}
```
- **Type**: Implicit
- **Description**: Enables camera capture for posts
- **Gating Logic**: MediaDevices API availability

## Conditional Features

### Advanced Filters
**File:** `src/components/AdvancedFiltersDrawer.tsx`
```typescript
const showAdvancedFilters = (user: User) => {
  return user.tags && user.tags.length > 0
}
```
- **Type**: Conditional
- **Description**: Shows advanced filtering options
- **Gating Logic**: User has tags

### AI Search Features
**File:** `src/services/aiSearchService.ts:26-43`
```typescript
const isAISearchEnabled = () => {
  return process.env.REACT_APP_OPENAI_API_KEY && 
         process.env.REACT_APP_AI_SEARCH_ENABLED === 'true'
}
```
- **Type**: Conditional
- **Description**: Enables AI-powered search
- **Gating Logic**: API key and explicit flag

### Google Maps Integration
**File:** `src/components/GoogleMapsImportModal.tsx`
```typescript
const isGoogleMapsEnabled = () => {
  return process.env.REACT_APP_GOOGLE_MAPS_API_KEY && 
         typeof window.google !== 'undefined'
}
```
- **Type**: Conditional
- **Description**: Enables Google Maps import
- **Gating Logic**: API key and Google Maps availability

## User Preference Flags

### Location Services
**File:** `src/pages/Profile.tsx:117-129`
```typescript
const locationPreferences = {
  nearbyRadius: 50, // miles
  useLocation: true,
  shareLocation: false
}
```
- **Type**: User Preference
- **Description**: Controls location-based features
- **Gating Logic**: User settings

### Privacy Settings
**File:** `src/pages/Profile.tsx:1030-1044`
```typescript
const privacySettings = {
  profileVisibility: 'public' | 'private' | 'friends',
  listVisibility: 'public' | 'private' | 'friends',
  locationSharing: boolean
}
```
- **Type**: User Preference
- **Description**: Controls content visibility
- **Gating Logic**: User settings

## GAP Analysis

### Missing Feature Flags:
1. **No A/B testing flags** - Should implement experiment toggles
2. **No gradual rollout flags** - Should implement feature rollouts
3. **No admin override flags** - Should implement admin controls
4. **No user segment flags** - Should implement user-based features

### Suggested Implementations:
1. **Add feature flag service** with remote configuration
2. **Implement A/B testing** with user segmentation
3. **Add admin dashboard** for flag management
4. **Implement gradual rollouts** for new features

## Recommended Feature Flag Architecture

### Centralized Flag Service
```typescript
interface FeatureFlag {
  name: string
  enabled: boolean
  description: string
  rolloutPercentage?: number
  userSegments?: string[]
  expirationDate?: string
}

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map()
  
  async loadFlags(): Promise<void> {
    // Load from remote config or local storage
  }
  
  isEnabled(flagName: string, userId?: string): boolean {
    const flag = this.flags.get(flagName)
    if (!flag) return false
    
    // Check rollout percentage
    if (flag.rolloutPercentage && userId) {
      const hash = this.hashUserId(userId)
      return hash < flag.rolloutPercentage
    }
    
    return flag.enabled
  }
}
```

### Flag Categories:
1. **Development Flags** - Local development features
2. **Rollout Flags** - Gradual feature rollouts
3. **A/B Test Flags** - Experiment participation
4. **User Segment Flags** - User-based features
5. **Admin Flags** - Administrative controls

### Implementation Priorities:
1. **High**: Centralized flag service
2. **Medium**: A/B testing framework
3. **Low**: Admin dashboard
