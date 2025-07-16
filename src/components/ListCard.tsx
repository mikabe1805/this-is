import { useState } from 'react'
import { HeartIcon, BookmarkIcon, EyeIcon, UserIcon, StarIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import TagCloud from './TagCloud'
import ListMenuDropdown from './ListMenuDropdown'

interface Place {
  id: string
  name: string
  image?: string
  status: 'loved' | 'tried' | 'want'
  note?: string
  tags: string[]
  savedFrom?: {
    user: string
    list: string
  }
}

interface ListCardProps {
  id: string
  title: string
  description?: string
  places: Place[]
  isPrivate: boolean
  owner: {
    name: string
    avatar: string
  }
  likes: number
  isLiked: boolean
  onLike: () => void
  onView: () => void
  onEditList?: () => void
  onTogglePrivacy?: () => void
  onDelete?: () => void
  isOwner?: boolean
}

const ListCard = ({ 
  title, 
  description, 
  places, 
  isPrivate, 
  owner, 
  likes, 
  isLiked, 
  onLike, 
  onView,
  onEditList,
  onTogglePrivacy,
  onDelete,
  isOwner = false
}: ListCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showListMenu, setShowListMenu] = useState(false)

  // Check if this is a default "All" list
  const isDefaultList = title === 'All Loved' || title === 'All Tried' || title === 'All Want'

  // Collect all tags from places (only for non-default lists)
  const allTags = isDefaultList ? [] : places.flatMap(place => place.tags)
  const tagCounts = allTags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const tagCloudData = Object.entries(tagCounts).map(([name, count]) => ({
    name,
    count
  }))

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'loved':
        return <HeartIconSolid className="w-4 h-4 text-warm-500" />
      case 'tried':
        return <BookmarkIcon className="w-4 h-4 text-sage-500" />
      case 'want':
        return <EyeIcon className="w-4 h-4 text-earth-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'loved':
        return 'bg-gradient-to-r from-warm-500 to-warm-400'
      case 'tried':
        return 'bg-gradient-to-r from-sage-500 to-sage-400'
      case 'want':
        return 'bg-gradient-to-r from-earth-500 to-earth-400'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'loved':
        return 'Loved'
      case 'tried':
        return 'Tried'
      case 'want':
        return 'Want'
      default:
        return status
    }
  }

  const visiblePlaces = isExpanded ? places : places.slice(0, 3)
  const hasMorePlaces = places.length > 3

  return (
    <div className="bg-white/90 backdrop-blur-glass rounded-2xl shadow-crystal border border-white/30 overflow-hidden hover:shadow-xl transition-all duration-300 group">
      {/* Header */}
      <div className="p-6 border-b border-warm-100">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-serif font-semibold text-earth-800 text-xl mb-2">
              {title}
            </h3>
            {description && (
              <p className="text-earth-600 text-sm leading-relaxed mb-3">
                {description}
              </p>
            )}
            
            {/* Tags - only show for non-default lists */}
            {!isDefaultList && tagCloudData.length > 0 && (
              <div className="mb-4">
                <TagCloud 
                  tags={tagCloudData} 
                  variant="compact"
                  maxTags={5}
                  showCounts={false}
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPrivate && (
              <div className="w-10 h-10 bg-gradient-to-br from-earth-100 to-cream-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                <UserIcon className="w-5 h-5 text-earth-500" />
              </div>
            )}
            {isOwner && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowListMenu(true)
                }}
                className="w-8 h-8 bg-linen-100 rounded-full flex items-center justify-center hover:bg-linen-200 transition-colors"
              >
                <EllipsisHorizontalIcon className="w-4 h-4 text-charcoal-600" />
              </button>
            )}
          </div>
        </div>

        {/* Owner info and actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={owner.avatar} 
              alt={owner.name}
              className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
            />
            <div>
              <span className="text-sm font-medium text-earth-700">{owner.name}</span>
              {isPrivate && (
                <span className="text-xs bg-earth-100 text-earth-600 px-2 py-0.5 rounded-full ml-2">
                  Private
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onLike}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                isLiked 
                  ? 'bg-gradient-to-r from-warm-500 to-warm-400 text-white shadow-warm-200' 
                  : 'bg-linen-100 text-sage-700 hover:bg-linen-200'
              }`}
            >
              {isLiked ? <HeartIconSolid className="w-4 h-4" /> : <HeartIcon className="w-4 h-4" />}
              <span>{likes}</span>
            </button>
            
            <button
              onClick={onView}
              className="px-4 py-1.5 bg-gradient-to-r from-earth-500 to-earth-400 text-white text-sm font-medium rounded-full hover:from-earth-600 hover:to-earth-500 transition-all duration-200 shadow-soft"
            >
              View
            </button>
          </div>
        </div>
      </div>

      {/* Places preview */}
      <div className="p-6">
        <div className="space-y-4">
          {visiblePlaces.map((place) => (
            <div key={place.id} className="p-4 bg-gradient-to-r from-linen-50 to-cream-50 rounded-xl border border-linen-100 hover:bg-linen-100/50 transition-all duration-300 group/place">
              <div className="flex items-start gap-4">
                {/* Place image */}
                <div className="relative">
                  {place.image ? (
                    <img 
                      src={place.image} 
                      alt={place.name}
                      className="w-16 h-16 object-cover rounded-lg shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-warm-200 to-cream-200 rounded-lg flex items-center justify-center shadow-sm">
                      <BookmarkIcon className="w-6 h-6 text-warm-500" />
                    </div>
                  )}
                  
                  {/* Status indicator */}
                  <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${getStatusColor(place.status)} shadow-sm`}>
                    {getStatusIcon(place.status)}
                  </div>
                </div>

                {/* Place details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-earth-800 text-base truncate">
                      {place.name}
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded-full text-white font-medium ${getStatusColor(place.status)}`}>
                      {getStatusText(place.status)}
                    </span>
                  </div>

                  {/* Note */}
                  {place.note && (
                    <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 mb-3 border border-warm-200">
                      <p className="text-earth-600 text-sm italic leading-relaxed">
                        "{place.note}"
                      </p>
                    </div>
                  )}

                  {/* Tags - only show for non-default lists */}
                  {!isDefaultList && place.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {place.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs bg-linen-100 text-sage-700 px-2 py-0.5 rounded-full">
                          #{tag}
                        </span>
                      ))}
                      {place.tags.length > 3 && (
                        <span className="text-xs text-earth-400">
                          +{place.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Saved from */}
                  {place.savedFrom && (
                    <div className="text-xs text-earth-500 flex items-center gap-1">
                      <span>Saved from {place.savedFrom.user}'s</span>
                      <span className="font-medium">"{place.savedFrom.list}"</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Show more/less */}
        {hasMorePlaces && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full text-center text-warm-600 hover:text-warm-700 font-medium text-sm mt-4 transition-colors"
          >
            {isExpanded ? 'Show less' : `Show ${places.length - 3} more places`}
          </button>
        )}

        {/* Place count */}
        <div className="text-center mt-6 pt-4 border-t border-warm-100">
          <div className="flex items-center justify-center gap-2 text-sm text-earth-500">
            <StarIcon className="w-4 h-4" />
            <span>{places.length} place{places.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <ListMenuDropdown
        isOpen={showListMenu}
        onClose={() => setShowListMenu(false)}
        onEditList={onEditList}
        onTogglePrivacy={onTogglePrivacy}
        onDelete={onDelete}
        isPublic={!isPrivate}
        isOwner={isOwner}
      />
    </div>
  )
}

export default ListCard 