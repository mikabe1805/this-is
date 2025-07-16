export interface User {
  id: string
  name: string
  username: string
  avatar?: string
  bio?: string
  location?: string
  influences?: number // Number of items from their lists saved by others + favorited items
  tags?: string[] // User's tags/interests
}

export interface Place {
  id: string
  name: string
  address: string
  coordinates?: {
    lat: number
    lng: number
  }
  category?: string
  tags: string[]
  hubImage?: string
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
  description: string
  postType: PostType
  triedRating?: TriedRating
  createdAt: string
  privacy: Privacy
  listId?: string
  likes: number
  likedBy: string[]
  comments: Comment[]
}

export interface Comment {
  id: string
  userId: string
  username: string
  userAvatar: string
  text: string
  createdAt: string
  likes: number
  likedBy: string[]
  replies?: Comment[]
}

export interface List {
  id: string
  name: string
  description: string
  userId: string
  isPublic: boolean
  isShared: boolean
  privacy: Privacy
  tags: string[]
  hubs: Hub[]
  coverImage?: string
  createdAt: string
  updatedAt: string
  likes: number
  isLiked: boolean
}

export interface ListPlace {
  id: string
  placeId: string
  place: Place
  note?: string
  voiceMemo?: string
  addedBy: string
  addedFromList?: string
  addedAt: string
}

export interface Tag {
  name: string
  count: number
  isTop: boolean
}

export interface Activity {
  id: string
  type: 'save' | 'like' | 'post' | 'create_list'
  userId: string
  user: User
  placeId?: string
  place?: Place
  listId?: string
  list?: List
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