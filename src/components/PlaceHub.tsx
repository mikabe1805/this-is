import { useState } from 'react'
import { HeartIcon, BookmarkIcon, EyeIcon, PlusIcon, UserIcon, MapPinIcon, StarIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import TagCloud from './TagCloud'

interface ListReference {
  id: string
  name: string
  owner: {
    name: string
    avatar: string
  }
  status: 'loved' | 'tried' | 'want'
  note?: string
  isPrivate: boolean
}

interface PlaceHubProps {
  place: {
    id: string
    name: string
    address: string
    image?: string
    description?: string
    tags: string[]
  }
  lists: ListReference[]
  onSaveToList: (listId: string, status: 'loved' | 'tried' | 'want', note?: string) => void
  onCreateList: () => void
}

const PlaceHub = ({ place, lists, onSaveToList, onCreateList }: PlaceHubProps) => {
  const [selectedList, setSelectedList] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'loved' | 'tried' | 'want'>('tried')

  const myLists = lists.filter(list => list.owner.name === 'You')
  const friendsLists = lists.filter(list => list.owner.name !== 'You')

  // Convert tags to TagCloud format
  const tagCloudData = place.tags.map(tag => ({
    name: tag,
    count: lists.filter(list => list.note?.includes(tag)).length + 1 // +1 for the place itself
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

  const handleSave = () => {
    if (selectedList) {
      onSaveToList(selectedList, status, note.trim() || undefined)
      setSelectedList(null)
      setNote('')
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-cream-50 via-warm-50 to-sage-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Place Header */}
        <div className="bg-white/90 backdrop-blur-glass rounded-2xl shadow-crystal border border-white/30 overflow-hidden">
          {place.image && (
            <div className="relative h-64">
              <img 
                src={place.image} 
                alt={place.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
              
              {/* Floating action button */}
              <button
                onClick={onCreateList}
                className="absolute top-4 right-4 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-warm-600 hover:bg-white hover:text-warm-700 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <PlusIcon className="w-6 h-6" />
              </button>
            </div>
          )}
          
          <div className="p-6">
            <div className="mb-4">
              <h1 className="text-3xl font-serif font-bold text-earth-800 mb-2">
                {place.name}
              </h1>
              <div className="flex items-center gap-2 text-earth-600 mb-3">
                <MapPinIcon className="w-4 h-4" />
                <span className="text-sm">{place.address}</span>
              </div>
              {place.description && (
                <p className="text-earth-600 text-sm leading-relaxed mb-4">
                  {place.description}
                </p>
              )}
            </div>

            {/* Tags */}
            {place.tags.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-earth-700 mb-2">Popular Tags</h3>
                <TagCloud 
                  tags={tagCloudData} 
                  variant="default"
                  maxTags={6}
                  showCounts={true}
                />
              </div>
            )}
          </div>
        </div>

        {/* Lists Section */}
        <div className="bg-white/90 backdrop-blur-glass rounded-2xl shadow-crystal border border-white/30 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-serif font-semibold text-earth-800">
              Saved to Lists
            </h2>
            <div className="flex items-center gap-2 text-sm text-earth-500">
              <StarIcon className="w-4 h-4" />
              <span>{lists.length} list{lists.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* My Lists */}
          {myLists.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-earth-700 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-warm-400 to-warm-500 rounded-full"></div>
                Your Lists
              </h3>
              <div className="space-y-4">
                {myLists.map((list) => (
                  <div key={list.id} className="p-4 bg-gradient-to-r from-warm-50 to-cream-50 rounded-xl border border-warm-100 hover:bg-warm-100/50 transition-all duration-300 group">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <img 
                          src={list.owner.avatar} 
                          alt={list.owner.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                        <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${getStatusColor(list.status)} shadow-sm`}>
                          {getStatusIcon(list.status)}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-earth-800 text-lg">{list.name}</h4>
                          <span className={`text-xs px-3 py-1 rounded-full text-white font-medium ${getStatusColor(list.status)}`}>
                            {getStatusText(list.status)}
                          </span>
                          {list.isPrivate && (
                            <span className="text-xs bg-earth-100 text-earth-600 px-2 py-1 rounded-full">
                              Private
                            </span>
                          )}
                        </div>
                        
                        {list.note && (
                          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 mb-3 border border-warm-200">
                            <p className="text-earth-600 text-sm italic leading-relaxed">
                              "{list.note}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends' Lists */}
          {friendsLists.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-earth-700 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-sage-400 to-sage-500 rounded-full"></div>
                Friends' Lists
              </h3>
              <div className="space-y-4">
                {friendsLists.map((list) => (
                  <div key={list.id} className="p-4 bg-gradient-to-r from-sage-50 to-cream-50 rounded-xl border border-sage-100 hover:bg-sage-100/50 transition-all duration-300 group">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <img 
                          src={list.owner.avatar} 
                          alt={list.owner.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                        <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${getStatusColor(list.status)} shadow-sm`}>
                          {getStatusIcon(list.status)}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm text-earth-600 font-medium">by {list.owner.name}</span>
                          <span className="text-earth-400">•</span>
                          <h4 className="font-semibold text-earth-800 text-lg">{list.name}</h4>
                          <span className={`text-xs px-3 py-1 rounded-full text-white font-medium ${getStatusColor(list.status)}`}>
                            {getStatusText(list.status)}
                          </span>
                          {list.isPrivate && (
                            <span className="text-xs bg-earth-100 text-earth-600 px-2 py-1 rounded-full">
                              Private
                            </span>
                          )}
                        </div>
                        
                        {list.note && (
                          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 mb-3 border border-sage-200">
                            <p className="text-earth-600 text-sm italic leading-relaxed">
                              "{list.note}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save to List */}
          <div className="border-t border-warm-100 pt-6">
            <h3 className="text-lg font-semibold text-earth-700 mb-6 flex items-center gap-2">
              <div className="w-2 h-2 bg-gradient-to-r from-earth-400 to-earth-500 rounded-full"></div>
              Save to Your List
            </h3>
            
            <div className="space-y-6">
              {/* List Selection */}
              <div>
                <label className="block text-sm font-medium text-earth-700 mb-3">
                  Choose a list
                </label>
                <select
                  value={selectedList || ''}
                  onChange={(e) => setSelectedList(e.target.value)}
                  className="w-full px-4 py-3 border border-warm-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-white/80 backdrop-blur-sm shadow-soft"
                >
                  <option value="">Select a list...</option>
                  <option value="all-loved">All Loved</option>
                  <option value="all-tried">All Tried</option>
                  <option value="all-want">All Want</option>
                  <option value="weekend-spots">Weekend Spots</option>
                  <option value="coffee-tour">Coffee Tour</option>
                </select>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-earth-700 mb-3">
                  How do you feel about this place?
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStatus('loved')}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                      status === 'loved'
                        ? 'border-warm-500 bg-gradient-to-r from-warm-500 to-warm-400 text-white shadow-warm-200'
                        : 'border-warm-200 bg-white text-warm-600 hover:border-warm-300 hover:bg-warm-50'
                    }`}
                  >
                    <HeartIcon className="w-5 h-5" />
                    <span className="font-medium">Loved</span>
                  </button>
                  <button
                    onClick={() => setStatus('tried')}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                      status === 'tried'
                        ? 'border-sage-500 bg-gradient-to-r from-sage-500 to-sage-400 text-white shadow-sage-200'
                        : 'border-sage-200 bg-white text-sage-600 hover:border-sage-300 hover:bg-sage-50'
                    }`}
                  >
                    <BookmarkIcon className="w-5 h-5" />
                    <span className="font-medium">Tried</span>
                  </button>
                  <button
                    onClick={() => setStatus('want')}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                      status === 'want'
                        ? 'border-earth-500 bg-gradient-to-r from-earth-500 to-earth-400 text-white shadow-earth-200'
                        : 'border-earth-200 bg-white text-earth-600 hover:border-earth-300 hover:bg-earth-50'
                    }`}
                  >
                    <EyeIcon className="w-5 h-5" />
                    <span className="font-medium">Want</span>
                  </button>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-earth-700 mb-3">
                  Add a personal note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What made this place special to you? Any memories or thoughts..."
                  className="w-full px-4 py-3 border border-warm-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-white/80 backdrop-blur-sm shadow-soft"
                  rows={3}
                  maxLength={200}
                />
                <div className="text-xs text-earth-400 mt-2 text-right">
                  {note.length}/200
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={!selectedList}
                className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                  selectedList
                    ? 'bg-gradient-to-r from-warm-500 to-earth-500 text-white hover:from-warm-600 hover:to-earth-600 shadow-soft hover:shadow-lg'
                    : 'bg-earth-300 text-white cursor-not-allowed'
                }`}
              >
                Save to List
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlaceHub 