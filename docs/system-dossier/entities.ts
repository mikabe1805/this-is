// Entity interfaces extracted from this.is codebase
// All field citations include file path and [start..end] line ranges

export interface User {
  uid: string; // src/types/index.ts:1-11
  email: string; // src/types/index.ts:1-11
  displayName: string; // src/types/index.ts:1-11
  photoURL?: string; // src/types/index.ts:1-11
  bio?: string; // src/types/index.ts:1-11
  location?: string; // src/types/index.ts:1-11
  website?: string; // src/types/index.ts:1-11
  followersCount: number; // src/types/index.ts:1-11
  followingCount: number; // src/types/index.ts:1-11
  influenceScore: number; // src/types/index.ts:1-11
  createdAt: Date; // src/types/index.ts:1-11
  updatedAt: Date; // src/types/index.ts:1-11
}

export interface Place {
  id: string; // src/types/index.ts:13-28
  name: string; // src/types/index.ts:13-28
  address: string; // src/types/index.ts:13-28
  coordinates: { lat: number; lng: number }; // src/types/index.ts:13-28
  googlePlaceId?: string; // src/types/index.ts:13-28
  category?: string; // src/types/index.ts:13-28
  phoneNumber?: string; // src/types/index.ts:13-28
  website?: string; // src/types/index.ts:13-28
  rating?: number; // src/types/index.ts:13-28
  priceLevel?: number; // src/types/index.ts:13-28
  photos?: string[]; // src/types/index.ts:13-28
  createdAt: Date; // src/types/index.ts:13-28
  updatedAt: Date; // src/types/index.ts:13-28
}

export interface Post {
  id: string; // src/types/index.ts:30-49
  userId: string; // src/types/index.ts:30-49
  hubId: string; // src/types/index.ts:30-49
  title: string; // src/types/index.ts:30-49
  description: string; // src/types/index.ts:30-49
  images: string[]; // src/types/index.ts:30-49
  location?: string; // src/types/index.ts:30-49
  tags: string[]; // src/types/index.ts:30-49
  status: 'loved' | 'tried' | 'want'; // src/types/index.ts:30-49
  privacy: 'public' | 'private' | 'friends'; // src/types/index.ts:30-49
  likesCount: number; // src/types/index.ts:30-49
  commentsCount: number; // src/types/index.ts:30-49
  createdAt: Date; // src/types/index.ts:30-49
  updatedAt: Date; // src/types/index.ts:30-49
}

export interface List {
  id: string; // src/types/index.ts:63-84
  userId: string; // src/types/index.ts:63-84
  name: string; // src/types/index.ts:63-84
  description: string; // src/types/index.ts:63-84
  imageUrl?: string; // src/types/index.ts:63-84
  places: string[]; // src/types/index.ts:63-84 (place IDs)
  privacy: 'public' | 'private' | 'friends'; // src/types/index.ts:63-84
  followersCount: number; // src/types/index.ts:63-84
  placesCount: number; // src/types/index.ts:63-84
  createdAt: Date; // src/types/index.ts:63-84
  updatedAt: Date; // src/types/index.ts:63-84
}

export interface Hub {
  id: string; // src/types/index.ts:122-137
  name: string; // src/types/index.ts:122-137
  description: string; // src/types/index.ts:122-137
  address: string; // src/types/index.ts:122-137
  coordinates: { lat: number; lng: number }; // src/types/index.ts:122-137
  googlePlaceId?: string; // src/types/index.ts:122-137
  imageUrl?: string; // src/types/index.ts:122-137
  category?: string; // src/types/index.ts:122-137
  phoneNumber?: string; // src/types/index.ts:122-137
  website?: string; // src/types/index.ts:122-137
  rating?: number; // src/types/index.ts:122-137
  priceLevel?: number; // src/types/index.ts:122-137
  postsCount: number; // src/types/index.ts:122-137
  followersCount: number; // src/types/index.ts:122-137
  createdAt: Date; // src/types/index.ts:122-137
  updatedAt: Date; // src/types/index.ts:122-137
}

export interface Tag {
  id: string; // src/types/index.ts:139-150
  name: string; // src/types/index.ts:139-150
  color: string; // src/types/index.ts:139-150
  postsCount: number; // src/types/index.ts:139-150
  createdAt: Date; // src/types/index.ts:139-150
}

export interface PlaceSuggestion {
  place_id: string; // functions/src/places.ts:4-130
  name: string; // functions/src/places.ts:4-130
  formatted_address: string; // functions/src/places.ts:4-130
  geometry: { location: { lat: number; lng: number } }; // functions/src/places.ts:4-130
  types: string[]; // functions/src/places.ts:4-130
  rating?: number; // functions/src/places.ts:4-130
  price_level?: number; // functions/src/places.ts:4-130
  photos?: Array<{ photo_reference: string }>; // functions/src/places.ts:4-130
}

export interface Save {
  id: string; // src/services/firebaseDataService.ts:1544-1612
  userId: string; // src/services/firebaseDataService.ts:1544-1612
  listId: string; // src/services/firebaseDataService.ts:1544-1612
  placeId: string; // src/services/firebaseDataService.ts:1544-1612
  status: 'loved' | 'tried' | 'want'; // src/services/firebaseDataService.ts:1544-1612
  note?: string; // src/services/firebaseDataService.ts:1544-1612
  createdAt: Date; // src/services/firebaseDataService.ts:1544-1612
}

export interface Follow {
  id: string; // src/contexts/AuthContext.tsx:42-76
  followerId: string; // src/contexts/AuthContext.tsx:42-76
  followingId: string; // src/contexts/AuthContext.tsx:42-76
  createdAt: Date; // src/contexts/AuthContext.tsx:42-76
}

export interface Like {
  id: string; // src/services/firebasePostService.ts:14-52
  userId: string; // src/services/firebasePostService.ts:14-52
  postId: string; // src/services/firebasePostService.ts:14-52
  createdAt: Date; // src/services/firebasePostService.ts:14-52
}

// GAP: Comment entity not found in types/index.ts
// Should be defined in src/types/index.ts with fields: id, userId, postId, content, createdAt, updatedAt

// GAP: Notification entity not found in types/index.ts  
// Should be defined in src/types/index.ts with fields: id, userId, type, data, read, createdAt
