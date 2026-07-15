> **HISTORICAL V1 AUDIT - NOT CURRENT PRODUCT AUTHORITY.** This file analyzes the retired root application. Preserve it as evidence, but do not use its goals, backlog, architecture, styling, or completion claims for canonical v2 work. See the repository documentation map at `docs/README.md`.

# Firebase Database Structure for "this-is" App

## Collection Overview

```
📁 users/
  📄 {userId}
    ├── 📁 friends/
    ├── 📁 following/
    ├── 📁 savedPlaces/
    ├── 📁 likedPosts/
    └── 📁 activity/

📁 places/
  📄 {placeId}

📁 lists/
  📄 {listId}
    └── 📁 places/

📁 posts/
  📄 {postId}

📁 userPreferences/
  📄 {userId}

📁 analytics/
  ├── 📁 userInteractions/
  └── 📁 searchMetrics/
```

## Detailed Schema

### 🙋‍♀️ users/{userId}
```typescript
{
  id: string
  name: string
  username: string
  email: string
  avatar?: string
  bio?: string
  location?: string
  influences: number // Calculated field
  tags: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
  settings: {
    privacy: 'public' | 'friends' | 'private'
    notifications: boolean
    locationSharing: boolean
  }
}
```

**Subcollections:**
- `friends/{friendId}` - User's friends
- `following/{userId}` - Users they follow
- `savedPlaces/{placeId}` - Places they've saved
- `likedPosts/{postId}` - Posts they've liked
- `activity/{activityId}` - User activity log

### 🏢 places/{placeId}
```typescript
{
  id: string
  name: string
  address: string
  coordinates: {
    lat: number
    lng: number
  }
  category: string
  tags: string[]
  hubImage?: string
  description?: string
  priceRange?: '$' | '$$' | '$$$' | '$$$$'
  savedCount: number
  averageRating?: number
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
  isVerified: boolean
}
```

### 📝 lists/{listId}
```typescript
{
  id: string
  name: string
  description: string
  userId: string
  privacy: 'public' | 'friends' | 'private'
  tags: string[]
  coverImage?: string
  likes: number
  saves: number
  createdAt: Timestamp
  updatedAt: Timestamp
  isShared: boolean
  collaborators?: string[]
}
```

**Subcollection:**
- `places/{placeId}` - Places in this list with notes

### 📸 posts/{postId}
```typescript
{
  id: string
  hubId: string
  userId: string
  username: string
  userAvatar: string
  images: string[]
  description: string
  postType: 'loved' | 'tried' | 'want'
  triedRating?: 'liked' | 'neutral' | 'disliked'
  privacy: 'public' | 'friends' | 'private'
  listId?: string
  likes: number
  likedBy: string[]
  comments: Comment[]
  location?: {
    lat: number
    lng: number
  }
  createdAt: Timestamp
  tags: string[]
}
```

### ⚙️ userPreferences/{userId}
```typescript
{
  favoriteCategories: string[]
  preferredPriceRange: string[]
  socialPreferences: {
    exploreNew: number
    followFriends: number
    trendingContent: number
  }
  locationPreferences: {
    nearbyRadius: number
    preferredAreas: string[]
  }
  interactionHistory: {
    savedPlaces: string[]
    likedPosts: string[]
    visitedLists: string[]
    searchHistory: string[]
  }
  updatedAt: Timestamp
}
```

### 📊 analytics/userInteractions/{eventId}
```typescript
{
  userId: string
  action: 'search' | 'save' | 'like' | 'visit' | 'share'
  data: {
    query?: string
    placeId?: string
    listId?: string
    postId?: string
    duration?: number
  }
  timestamp: Timestamp
  sessionId?: string
}
```

## Indexes Required

### Composite Indexes
1. **places**: `category` ASC, `savedCount` DESC
2. **places**: `tags` ARRAY, `savedCount` DESC
3. **lists**: `privacy` ASC, `likes` DESC
4. **lists**: `tags` ARRAY, `likes` DESC
5. **posts**: `privacy` ASC, `likes` DESC
6. **posts**: `hubId` ASC, `createdAt` DESC
7. **users**: `influences` DESC
8. **analytics/userInteractions**: `userId` ASC, `timestamp` DESC

### Single Field Indexes (Auto-created)
- All timestamp fields
- All ID references
- All numeric fields used in queries

## Security Considerations

- Users can only read/write their own data
- Public content is readable by all authenticated users
- Friends-only content requires friendship verification
- Analytics data is write-only for users, read-only for admins 