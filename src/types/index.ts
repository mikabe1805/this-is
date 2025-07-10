export interface User {
  id: string
  name: string
  username: string
  avatar?: string
  bio?: string
  location?: string
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
  placeId: string
  userId: string
  user: User
  image?: string
  note?: string
  tags: string[]
  likes: number
  createdAt: string
}

export interface List {
  id: string
  name: string
  description?: string
  userId: string
  isPublic: boolean
  isShared: boolean
  tags: string[]
  places: ListPlace[]
  coverImage?: string
  createdAt: string
  updatedAt: string
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