import { useState } from 'react'
import { HeartIcon, XMarkIcon, MinusIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid, XMarkIcon as XMarkIconSolid, MinusIcon as MinusIconSolid } from '@heroicons/react/24/solid'

interface FriendOpinion {
  id: string
  user: {
    name: string
    avatar: string
    isPublic: boolean
  }
  rating: 'loved' | 'hated' | 'mediocre'
  feedback?: string
  timestamp: string
  isCloseFriend: boolean
}

interface FriendsOpinionsProps {
  placeName: string
  placeImage?: string
  opinions: FriendOpinion[]
  totalFriends: number
  onViewMore?: () => void
  isEmbedded?: boolean
}

const FriendsOpinions = ({ 
  placeName, 
  placeImage, 
  opinions, 
  totalFriends, 
  onViewMore,
  isEmbedded = false 
}: FriendsOpinionsProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const visibleOpinions = showAll ? opinions : opinions.slice(0, 3)
  const hasMoreOpinions = opinions.length > 3

  const getRatingIcon = (rating: string, isSolid = false) => {
    const Icon = isSolid ? 
      (rating === 'loved' ? HeartIconSolid : rating === 'hated' ? XMarkIconSolid : MinusIconSolid) :
      (rating === 'loved' ? HeartIcon : rating === 'hated' ? XMarkIcon : MinusIcon)
    
    return (
      <Icon className={`w-4 h-4 ${
        rating === 'loved' ? 'text-warm-500' : 
        rating === 'hated' ? 'text-earth-500' : 
        'text-sage-500'
      }`} />
    )
  }

  const getRatingColor = (rating: string) => {
    return rating === 'loved' ? 'bg-gradient-to-r from-warm-500 to-warm-400' :
           rating === 'hated' ? 'bg-gradient-to-r from-earth-500 to-earth-400' :
           'bg-gradient-to-r from-sage-500 to-sage-400'
  }

  const getRatingText = (rating: string) => {
    return rating === 'loved' ? 'Loved It' :
           rating === 'hated' ? 'Hated It' :
           'Mediocre'
  }

  if (opinions.length === 0) {
    return (
      <div className={`bg-white/90 backdrop-blur-glass rounded-xl shadow-crystal border border-white/30 p-4 ${isEmbedded ? 'max-w-sm' : ''}`}>
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-gradient-to-br from-warm-100 to-cream-100 rounded-full mx-auto mb-3 flex items-center justify-center">
            <HeartIcon className="w-6 h-6 text-warm-400" />
          </div>
          <h3 className="font-serif font-semibold text-earth-800 mb-1">No friends have rated this yet</h3>
          <p className="text-earth-500 text-sm">Be the first to share your thoughts!</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white/90 backdrop-blur-glass rounded-xl shadow-crystal border border-white/30 overflow-hidden ${isEmbedded ? 'max-w-sm' : ''}`}>
      {/* Header */}
      <div className="p-4 border-b border-warm-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-warm-500 to-earth-500 rounded-full flex items-center justify-center">
              <HeartIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-earth-800">Friends' Opinions</h3>
              <p className="text-earth-500 text-sm">{totalFriends} friends have opinions</p>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-earth-400 hover:text-earth-600 transition-colors"
          >
            {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Place info */}
      {isExpanded && (
        <div className="px-4 py-3 bg-gradient-to-r from-warm-50 to-cream-50 border-b border-warm-100">
          <div className="flex items-center gap-3">
            {placeImage && (
              <img 
                src={placeImage} 
                alt={placeName}
                className="w-12 h-12 object-cover rounded-lg shadow-sm"
              />
            )}
            <div>
              <h4 className="font-semibold text-earth-800">{placeName}</h4>
              <p className="text-earth-500 text-sm">Recent ratings from your friends</p>
            </div>
          </div>
        </div>
      )}

      {/* Opinions list */}
      <div className="max-h-64 overflow-y-auto">
        {visibleOpinions.map((opinion) => (
          <div key={opinion.id} className="p-4 border-b border-warm-50 last:border-b-0 hover:bg-warm-50/30 transition-colors">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="relative">
                <img 
                  src={opinion.user.avatar} 
                  alt={opinion.user.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                />
                {opinion.isCloseFriend && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-warm-500 to-earth-500 rounded-full border-2 border-white flex items-center justify-center">
                    <span className="text-white text-xs font-bold">★</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-earth-800 text-sm">
                    {opinion.user.name}
                  </span>
                  {!opinion.user.isPublic && (
                    <span className="text-xs bg-earth-100 text-earth-600 px-2 py-0.5 rounded-full">
                      Private
                    </span>
                  )}
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-white ${getRatingColor(opinion.rating)}`}>
                    {getRatingIcon(opinion.rating, true)}
                    {getRatingText(opinion.rating)}
                  </div>
                  <span className="text-earth-400 text-xs">{opinion.timestamp}</span>
                </div>

                {/* Feedback */}
                {opinion.feedback && (
                  <p className="text-earth-600 text-sm leading-relaxed">
                    "{opinion.feedback}"
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show more/less */}
      {hasMoreOpinions && (
        <div className="p-4 border-t border-warm-100">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full text-center text-warm-600 hover:text-warm-700 font-medium text-sm transition-colors"
          >
            {showAll ? 'Show less' : `Show ${opinions.length - 3} more opinions`}
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-gradient-to-r from-cream-50 to-warm-50 border-t border-warm-100">
        <div className="flex items-center justify-between">
          <div className="text-xs text-earth-500">
            Powered by <span className="font-semibold text-warm-600">This Is</span>
          </div>
          {onViewMore && (
            <button
              onClick={onViewMore}
              className="text-xs text-warm-600 hover:text-warm-700 font-medium transition-colors"
            >
              View in app →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default FriendsOpinions 