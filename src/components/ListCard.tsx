import { useState, useRef } from 'react'
import { HeartIcon, BookmarkIcon, EyeIcon, UserIcon, StarIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import TagCloud from './TagCloud'
import ListMenuDropdown from './ListMenuDropdown'
import { useNavigate } from 'react-router-dom'
import TagPill from './TagPill'

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
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()

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
    <div className="glass-card sun-edge rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 group">
      {/* Header */}
      <div className="p-5 border-b border-white/20">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-title text-[18px] mb-2">
              {title}
            </h3>
            {description && (
              <p className="text-meta text-[13px] leading-relaxed mb-3">
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
                  onTagClick={(tag) => navigate(`/search?tag=${tag}`)}
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPrivate && (
              <div className="w-9 h-9 bg-moss-soft rounded-full flex items-center justify-center border border-moss/20">
                <UserIcon className="w-4 h-4 accent-moss" />
              </div>
            )}
            {isOwner && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowListMenu(true)
                }}
                ref={menuButtonRef}
                className="w-8 h-8 bg-white/25 rounded-full flex items-center justify-center hover:bg-white/35 transition-colors backdrop-blur-sm"
              >
                <EllipsisHorizontalIcon className="w-4 h-4 text-bark-700" />
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
              <span className="text-[13px] font-medium text-body">{owner.name}</span>
              {isPrivate && (
                <span className="text-[11px] badge-moss ml-2">
                  Private
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onLike}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                isLiked
                  ? 'bg-moss-600 text-white'
                  : 'bg-white/25 text-bark-700 hover:bg-white/35 backdrop-blur-sm'
              }`}
            >
              {isLiked ? <HeartIconSolid className="w-3.5 h-3.5" /> : <HeartIcon className="w-3.5 h-3.5" />}
              <span>{likes}</span>
            </button>

            <button
              onClick={onView}
              className="px-4 py-1.5 btn-primary text-[13px] font-medium"
            >
              View
            </button>
          </div>
        </div>
      </div>

      {/* Places preview */}
      <div className="p-5">
        <div className="space-y-3">
          {visiblePlaces.map((place) => (
            <div key={place.id} className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/25 hover:bg-white/30 transition-all duration-200 group/place">
              <div className="flex items-start gap-4">
                {/* Place image */}
                <div className="relative">
                  {place.image ? (
                    <img
                      src={place.image}
                      alt={place.name}
                      className="w-14 h-14 object-cover rounded-xl shadow-sm"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-moss-soft rounded-xl flex items-center justify-center shadow-sm border border-moss/15">
                      <BookmarkIcon className="w-5 h-5 accent-moss" />
                    </div>
                  )}

                  {/* Status indicator */}
                  <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                    place.status === 'loved' ? 'bg-moss-600' :
                    place.status === 'tried' ? 'bg-aurum-300' :
                    'bg-bark-700'
                  }`}>
                    {getStatusIcon(place.status)}
                  </div>
                </div>

                {/* Place details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h4 className="text-title text-[14px] truncate">
                      {place.name}
                    </h4>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium ${
                      place.status === 'loved' ? 'bg-moss-600' :
                      place.status === 'tried' ? 'bg-aurum-300 text-bark-900' :
                      'bg-bark-700'
                    }`}>
                      {getStatusText(place.status)}
                    </span>
                  </div>

                  {/* Note */}
                  {place.note && (
                    <div className="bg-white/30 backdrop-blur-sm rounded-lg p-2 mb-2 border border-white/20">
                      <p className="text-meta text-[12px] italic leading-relaxed">
                        "{place.note}"
                      </p>
                    </div>
                  )}

                  {/* Tags - only show for non-default lists */}
                  {!isDefaultList && place.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {place.tags.slice(0, 3).map((tag) => (
                        <TagPill key={tag} label={tag} size="sm" />
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
                    <div className="text-[11px] text-muted flex items-center gap-1">
                      <span>Saved from {place.savedFrom.user}'s</span>
                      <span className="font-medium accent-moss">"{place.savedFrom.list}"</span>
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
            className="w-full text-center accent-moss hover:brightness-110 font-medium text-[13px] mt-3 transition-all"
          >
            {isExpanded ? 'Show less' : `Show ${places.length - 3} more places`}
          </button>
        )}

        {/* Place count */}
        <div className="text-center mt-4 pt-4 border-t border-white/20">
          <div className="flex items-center justify-center gap-2 text-[13px] text-meta">
            <StarIcon className="w-4 h-4" />
            <span>{places.length} place{places.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <ListMenuDropdown
        isOpen={showListMenu}
        onClose={() => setShowListMenu(false)}
        onEditList={onEditList}
        onChangePrivacy={onTogglePrivacy}
        onDeleteList={onDelete}
        buttonRef={menuButtonRef}
        isPublic={!isPrivate}
        isOwner={isOwner}
      />
    </div>
  )
}

export default ListCard 
