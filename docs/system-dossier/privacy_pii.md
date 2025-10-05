# Privacy and PII

## PII Fields Stored

### User Entity
**File:** `src/types/index.ts:1-11`
```typescript
interface User {
  uid: string; // Firebase Auth UID
  email: string; // PII - Email address
  displayName: string; // PII - Display name
  photoURL?: string; // PII - Profile photo
  bio?: string; // PII - User biography
  location?: string; // PII - User location
  website?: string; // PII - Website URL
  followersCount: number; // Non-PII - Count
  followingCount: number; // Non-PII - Count
  influenceScore: number; // Non-PII - Score
  createdAt: Date; // Non-PII - Timestamp
  updatedAt: Date; // Non-PII - Timestamp
}
```

### Post Entity
**File:** `src/types/index.ts:30-49`
```typescript
interface Post {
  id: string; // Non-PII - ID
  userId: string; // PII - User reference
  hubId: string; // Non-PII - Hub reference
  title: string; // PII - Post title
  description: string; // PII - Post content
  images: string[]; // PII - Image URLs
  location?: string; // PII - Location data
  tags: string[]; // Non-PII - Tags
  status: 'loved' | 'tried' | 'want'; // Non-PII - Status
  privacy: 'public' | 'private' | 'friends'; // Non-PII - Privacy setting
  likesCount: number; // Non-PII - Count
  commentsCount: number; // Non-PII - Count
  createdAt: Date; // Non-PII - Timestamp
  updatedAt: Date; // Non-PII - Timestamp
}
```

### List Entity
**File:** `src/types/index.ts:63-84`
```typescript
interface List {
  id: string; // Non-PII - ID
  userId: string; // PII - User reference
  name: string; // PII - List name
  description: string; // PII - List description
  imageUrl?: string; // PII - Image URL
  places: string[]; // Non-PII - Place references
  privacy: 'public' | 'private' | 'friends'; // Non-PII - Privacy setting
  followersCount: number; // Non-PII - Count
  placesCount: number; // Non-PII - Count
  createdAt: Date; // Non-PII - Timestamp
  updatedAt: Date; // Non-PII - Timestamp
}
```

## PII Usage and Access

### User Profile Data
**File:** `src/pages/Profile.tsx:100-241`
```typescript
// User profile data is loaded and displayed
const loadUserData = async () => {
  const [userProfile, lists, savedPlaces, followers] = await Promise.all([
    firebaseDataService.getCurrentUser(authUser.id),
    firebaseDataService.getUserLists(authUser.id),
    firebaseDataService.getSavedPlaces(authUser.id),
    firebaseDataService.getFollowers(authUser.id),
  ]);
}
```

### Location Data
**File:** `src/pages/Search.tsx:115-193`
```typescript
// Location data is collected and used for recommendations
if (!loc && 'geolocation' in navigator) {
  await new Promise<void>(resolve => navigator.geolocation.getCurrentPosition(
    p => { loc = { lat: p.coords.latitude, lng: p.coords.longitude }; resolve(); }, 
    () => resolve(), 
    { timeout: 4000 }
  ));
}
```

### Search History
**File:** `src/pages/Search.tsx:251-263`
```typescript
// Search history is stored and retrieved
const loadRecentSearches = async () => {
  if (currentUser) {
    try {
      const preferences = await firebaseDataService.getUserPreferences(currentUser.id);
      setSearchHistory(preferences.interactionHistory.searchHistory || []);
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  }
};
```

## Data Retention and Deletion

### User Data Deletion
**File:** `src/contexts/AuthContext.tsx:42-76`
```typescript
// User data deletion is not implemented
// GAP: No user data deletion functionality
```

### Data Retention Policy
**File:** `functions/src/analytics-cleanup.ts:6-31`
```typescript
// Analytics data cleanup
export const scheduledAnalyticsCleanup = functions.pubsub
  .schedule('0 2 * * *') // Daily at 2 AM
  .timeZone('UTC')
  .onRun(async (context) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365); // 1 year retention
    
    // Delete old analytics data
    const oldAnalytics = await admin.firestore()
      .collection('analytics')
      .where('timestamp', '<', cutoffDate)
      .get();
    
    const batch = admin.firestore().batch();
    oldAnalytics.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  });
```

## Privacy Controls

### Privacy Settings
**File:** `src/pages/Profile.tsx:1030-1044`
```typescript
// Privacy settings for lists
const privacySettings = {
  profileVisibility: 'public' | 'private' | 'friends',
  listVisibility: 'public' | 'private' | 'friends',
  locationSharing: boolean
}
```

### Data Export
**File:** `src/pages/Settings.tsx`
```typescript
// Data export functionality is not implemented
// GAP: No data export functionality
```

## GAP Analysis

### Missing Privacy Features:
1. **No data deletion** - Users cannot delete their data
2. **No data export** - Users cannot export their data
3. **No consent management** - No consent tracking
4. **No data anonymization** - No anonymization of old data
5. **No privacy dashboard** - No privacy controls UI

### Suggested Implementations:
1. **Add data deletion** with cascade delete
2. **Implement data export** in JSON/CSV format
3. **Add consent management** with tracking
4. **Implement data anonymization** for old data
5. **Add privacy dashboard** for user controls

## Privacy Recommendations

### High Priority:
1. **Implement data deletion** for user accounts
2. **Add data export** functionality
3. **Implement consent management** system
4. **Add privacy controls** UI

### Medium Priority:
1. **Add data anonymization** for old data
2. **Implement audit logging** for data access
3. **Add privacy policy** updates
4. **Implement data minimization** practices

### Low Priority:
1. **Add privacy dashboard** for users
2. **Implement data portability** features
3. **Add privacy training** for developers
4. **Implement privacy by design** principles

## Compliance Considerations

### GDPR Compliance:
- **Right to access** - Data export functionality
- **Right to rectification** - Profile editing
- **Right to erasure** - Data deletion
- **Right to portability** - Data export
- **Consent management** - Privacy settings

### CCPA Compliance:
- **Right to know** - Data collection disclosure
- **Right to delete** - Data deletion
- **Right to opt-out** - Privacy controls
- **Non-discrimination** - Equal service

### Implementation Priorities:
1. **High**: Data deletion and export
2. **Medium**: Consent management
3. **Low**: Privacy dashboard
