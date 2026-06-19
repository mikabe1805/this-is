export interface User {
  id: string
  name: string
  username: string
  email?: string
  avatar?: string
  bio?: string
  location?: string
  /** Reddit-karma-style score: post likes × 2 + list likes × 5 + list saves × 10.
   *  Computed daily by functions/src/influences.ts. Surfaced on profile pages. */
  influences?: number
  tags?: string[]
  /** Cached counts that some legacy reads depend on. The Following.tsx /
   *  follower fetches are the source of truth; these are best-effort. */
  followersCount?: number
  followingCount?: number
  followers?: string[]
  following?: string[]
  createdAt: string
}

export interface Place {
  id: string
  name: string
  address: string
  description?: string
  coordinates?: {
    lat: number
    lng: number
  }
  category?: string
  tags: string[]
  /** Original Google place id (ChIJ…) when this place was sourced from Google.
   *  Lets the cover-photo picker re-fetch fresh photos for legacy docs. */
  googlePlaceId?: string | null
  /** First-saver–picked cover image (Firebase Storage URL or remote). */
  mainImage?: string | null
  hubImage?: string
  coverImage?: string
  /** Google Places (New) photo references — `{ name: "places/.../photos/..." }[]` */
  photos?: { name: string }[]
  primaryType?: string | null
  types?: string[]
  posts: Post[]
  savedCount: number
  createdAt: string
}

export interface Post {
  id: string
  hubId: string
  userId: string
  username: string
  userAvatar: string
  images: string[]
  video?: string
  thumbnail?: string
  description: string
  tags: string[]
  postType: PostType
  triedRating?: TriedRating
  createdAt: string
  privacy: Privacy
  /** Canonical list membership. A post can live in several lists. */
  listIds?: string[]
  /** @deprecated Legacy single-list field (first of listIds). Kept for old docs. */
  listId?: string
  likes: number
  likedBy: string[]
  comments: PostComment[]
}

export interface PostComment {
  id: string
  userId: string
  username: string
  userAvatar: string
  text: string
  createdAt: string
  likes: number
  likedBy: string[]
  replies?: PostComment[]
}

export interface List {
  id: string
  name: string
  listName?: string // For compatibility with seed data
  description: string
  userId: string
  isPublic: boolean
  isShared?: boolean
  privacy?: Privacy
  tags: string[]
  listTags?: string[] // For compatibility with seed data
  hubs?: Hub[]
  /** Sub-lists nested inside this list (folder-style). Array of list ids. */
  subLists?: string[]
  coverImage?: string
  createdAt?: string
  updatedAt?: string
  likes?: number
  likedBy?: string[]
  saves?: number
  savesFrom?: number
  isLiked?: boolean
  location?: { address: string; lat?: number; lng?: number }
  /** Set on the auto-maintained status collections (All Loved/Tried/Want). */
  autoStatus?: 'loved' | 'tried' | 'want'
  /** Trip mode — a list framed as a dated trip with an ordered itinerary. */
  isTrip?: boolean
  /** ISO date 'YYYY-MM-DD' (inclusive). */
  tripStart?: string
  tripEnd?: string
}

export interface ListPlace {
  id: string
  placeId: string
  place: Place
  status?: PostType // 'loved' | 'tried' | 'want'
  triedRating?: TriedRating // 'liked' | 'neutral' | 'disliked' (only for tried status)
  note?: string
  voiceMemo?: string
  addedBy: string
  addedFromList?: string
  addedAt: string
  /** Trip itinerary: 1-based day index this stop belongs to (undefined = unscheduled). */
  tripDay?: number
}

export interface Tag {
  name: string
  count: number
  isTop: boolean
}

export interface Activity {
  id: string
  type: 'save' | 'like' | 'post' | 'create_list' | 'follow'
  userId: string
  user: User
  placeId?: string
  place?: Place
  listId?: string
  list?: List
  /** Set on type==='follow' — the user that was followed. Hydrated on read. */
  targetUserId?: string
  targetUser?: User
  createdAt: string
}

export type TabType = 'friends' | 'discovery'
export type Privacy = 'public' | 'private' | 'friends'
export type PostType = 'loved' | 'tried' | 'want'
export type TriedRating = 'liked' | 'neutral' | 'disliked'

export interface Hub {
  id: string
  name: string
  description: string
  tags: string[]
  images: string[]
  location: {
    address: string
    lat: number
    lng: number
  }
  googleMapsUrl: string
  mainImage?: string
  posts: Post[]
  lists: List[]
}

export interface Reel {
  id: string
  type: 'video' | 'story' | 'post'
  user: User
  place: {
    name: string
    address: string
  }
  content: {
    video?: string
    thumbnail?: string
    images?: string[]
    image?: string
    caption: string
  }
  stats: {
    likes: number
    comments: number
    shares: number
    views: string
  }
  isLiked: boolean
  isSaved: boolean
  isFollowing: boolean
  timestamp: string
}

export interface Story {
  id: string
  userId: string
  user: User
  images: string[]
  caption?: string
  createdAt: string
  expiresAt: string
}
