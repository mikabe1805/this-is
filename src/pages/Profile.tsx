import type { User, List, Activity } from '../types/index.js'
import { BookmarkIcon, HeartIcon, PlusIcon, FunnelIcon, MapPinIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import SearchBar from '../components/SearchBar'

// SVG botanical accent (e.g., eucalyptus branch)
const BotanicalAccent = () => (
  <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -top-6 -left-6 opacity-30 select-none pointer-events-none">
    <path d="M10 50 Q30 10 50 50" stroke="#A3B3A3" strokeWidth="3" fill="none"/>
    <ellipse cx="18" cy="38" rx="4" ry="8" fill="#C7D0C7"/>
    <ellipse cx="30" cy="28" rx="4" ry="8" fill="#A3B3A3"/>
    <ellipse cx="42" cy="38" rx="4" ry="8" fill="#7A927A"/>
  </svg>
)

const sortOptions = [
  { key: 'popular', label: 'Most Popular' },
  { key: 'friends', label: 'Most Liked by Friends' },
  { key: 'nearby', label: 'Closest to Location' },
]
const filterOptions = [
  { key: 'loved', label: 'Loved' },
  { key: 'tried', label: 'Tried' },
  { key: 'want', label: 'Want to' },
]
const availableTags = ['cozy', 'trendy', 'quiet', 'local', 'charming', 'authentic', 'chill']
const mockComments = [
  { id: 1, user: { name: 'Ava', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face' }, text: 'mika is so helpful with finding good vegan spots! 🌱', date: '2d ago' },
  { id: 2, user: { name: 'Leo', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face' }, text: 'Loved your Book Nooks list! 📚', date: '5d ago' },
]

const Profile = () => {
  // Mock user data
  const currentUser: User = {
    id: '1',
    name: 'Mika Chen',
    username: 'mika.chen',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    bio: 'Finding cozy spots and sharing them with friends ✨',
    location: 'San Francisco, CA'
  }
  const userLists: List[] = [
    {
      id: '1',
      name: 'Cozy Coffee Spots',
      description: 'Perfect places to work and relax',
      userId: '1',
      isPublic: true,
      isShared: false,
      tags: ['coffee', 'work-friendly', 'cozy'],
      places: [],
      coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop',
      createdAt: '2024-01-10',
      updatedAt: '2024-01-15'
    },
    {
      id: '2',
      name: 'Hidden Gems',
      description: 'Local favorites that tourists don\'t know about',
      userId: '1',
      isPublic: true,
      isShared: false,
      tags: ['local', 'hidden-gems', 'authentic'],
      places: [],
      coverImage: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=200&fit=crop',
      createdAt: '2024-01-12',
      updatedAt: '2024-01-14'
    }
  ]
  const recentActivity: Activity[] = [
    {
      id: '1',
      type: 'save',
      userId: '1',
      user: currentUser,
      placeId: '1',
      place: {
        id: '1',
        name: 'Blue Bottle Coffee',
        address: '300 Webster St, Oakland, CA',
        tags: ['coffee', 'cozy'],
        posts: [],
        savedCount: 45,
        createdAt: '2024-01-15'
      },
      listId: '1',
      list: userLists[0],
      createdAt: '2024-01-15T10:30:00Z'
    }
  ]
  const [sortBy, setSortBy] = useState('popular')
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [profileTags, setProfileTags] = useState<string[]>(['cozy', 'trendy', 'quiet'])
  const [newTag, setNewTag] = useState('')
  const [comments, setComments] = useState(mockComments)
  const [commentInput, setCommentInput] = useState('')
  let filteredLists = userLists.filter(list => {
    if (activeFilters.length === 0) return true
    return activeFilters.some(f => list.tags.includes(f))
  })
  if (sortBy === 'popular') filteredLists = filteredLists
  if (sortBy === 'friends') filteredLists = [...filteredLists].reverse()
  if (sortBy === 'nearby') filteredLists = filteredLists

  return (
    <div className="relative min-h-full overflow-x-hidden bg-linen-50">
      {/* Enhanced background: linen texture, sunlight gradient, vignette */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-linen-texture opacity-80 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gold-50/60 via-linen-100/80 to-sage-100/70 opacity-80"></div>
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-charcoal-900/10"></div>
      </div>
      {/* Top Bar */}
      <div className="relative z-10 px-4 pt-6 flex items-center gap-3">
        <div className="flex-1">
          <SearchBar placeholder="Search your lists, places, or friends..." />
        </div>
        <div className="relative">
          <button
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/90 border border-linen-200 shadow-cozy transition-all duration-300 hover:shadow-botanical hover:bg-linen-50"
            onClick={() => setShowDropdown(v => !v)}
          >
            <FunnelIcon className="w-5 h-5 text-sage-400" />
            <span className="font-semibold text-charcoal-600">Sort & Filter</span>
          </button>
        </div>
      </div>
      {/* Dropdown */}
      {showDropdown && (
        <div className="fixed inset-0 z-20 flex items-start justify-end px-4 pt-24 bg-black/10" onClick={() => setShowDropdown(false)}>
          <div className="w-80 rounded-2xl shadow-cozy border border-linen-200 bg-white/95 p-6" onClick={e => e.stopPropagation()}>
            <div className="mb-6">
              <div className="font-serif font-semibold mb-4 text-lg text-charcoal-700">Sort by</div>
              <div className="space-y-2">
                {sortOptions.map(opt => (
                  <label key={opt.key} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer border border-transparent hover:border-sage-200 hover:bg-sage-50">
                    <input
                      type="radio"
                      name="sortBy"
                      value={opt.key}
                      checked={sortBy === opt.key}
                      onChange={() => setSortBy(opt.key)}
                      className="w-5 h-5 text-sage-500 focus:ring-sage-400"
                    />
                    <span className="font-medium text-charcoal-600">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="font-serif font-semibold mb-4 text-lg text-charcoal-700">Filter by</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {filterOptions.map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-sage-50 border border-sage-100 text-sage-700 hover:bg-sage-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeFilters.includes(opt.key)}
                      onChange={() => setActiveFilters(f => f.includes(opt.key) ? f.filter(x => x !== opt.key) : [...f, opt.key])}
                      className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <label key={tag} className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-linen-100 border border-linen-200 text-charcoal-500 hover:bg-linen-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeFilters.includes(tag)}
                      onChange={() => setActiveFilters(f => f.includes(tag) ? f.filter(x => x !== tag) : [...f, tag])}
                      className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                    />
                    {tag}
                  </label>
                ))}
              </div>
            </div>
            <button
              className="mt-6 w-full py-3 rounded-full font-semibold bg-sage-400 text-white shadow-soft hover:bg-sage-500 transition"
              onClick={() => setShowDropdown(false)}
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
      {/* Profile Header with botanical accent */}
      <div className="relative z-10 p-8 mt-8 rounded-3xl shadow-botanical border border-linen-200 bg-white/95 max-w-2xl mx-auto overflow-hidden flex flex-col gap-2">
        {/* Botanical SVG accent */}
        <BotanicalAccent />
        <div className="flex items-center gap-6">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-24 h-24 rounded-2xl border-4 border-linen-100 shadow-botanical object-cover bg-linen-200"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-3xl font-serif font-extrabold text-charcoal-800 tracking-tight">{currentUser.name}</h2>
              {/* Small leaf icon accent */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="ml-1 -mt-1">
                <path d="M4 20 Q12 4 20 20" stroke="#A3B3A3" strokeWidth="2" fill="none"/>
                <ellipse cx="8" cy="15" rx="2" ry="4" fill="#C7D0C7"/>
                <ellipse cx="16" cy="15" rx="2" ry="4" fill="#A3B3A3"/>
              </svg>
            </div>
            <p className="text-base text-charcoal-500 mb-1">@{currentUser.username}</p>
            {currentUser.location && (
              <div className="flex items-center gap-2 text-sm text-sage-700 mb-1">
                <MapPinIcon className="w-5 h-5 text-sage-400" />
                {currentUser.location}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gold-600">
              <CalendarIcon className="w-5 h-5 text-gold-400" />
              <span>Member since January 2024</span>
            </div>
          </div>
        </div>
        {currentUser.bio && (
          <p className="mt-4 text-lg text-charcoal-700 italic bg-linen-100 rounded-xl p-4 shadow-soft">{currentUser.bio}</p>
        )}
        {/* Profile Tags */}
        <div className="flex flex-wrap gap-2 mt-4">
          {profileTags.map(tag => (
            <span key={tag} className="px-4 py-2 rounded-full text-sm font-medium bg-sage-50 border border-sage-100 text-sage-700 shadow-soft transition hover:bg-sage-100 hover:shadow-botanical">#{tag}</span>
          ))}
          <form
            onSubmit={e => {
              e.preventDefault()
              if (newTag.trim() && !profileTags.includes(newTag.trim())) {
                setProfileTags(tags => [...tags, newTag.trim()])
                setNewTag('')
              }
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="Add tag..."
              className="w-24 px-3 py-2 rounded-full text-sm border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 shadow-soft"
            />
            <button type="submit" className="p-2 rounded-full bg-sage-400 text-white shadow-soft hover:bg-sage-500 transition">
              <PlusIcon className="w-4 h-4" />
            </button>
          </form>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 border-t border-linen-200 pt-4">
          <div className="text-center">
            <div className="text-2xl font-serif font-bold text-charcoal-700">12</div>
            <div className="text-sm text-charcoal-400">Lists</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-serif font-bold text-charcoal-700">89</div>
            <div className="text-sm text-charcoal-400">Places</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-serif font-bold text-charcoal-700">156</div>
            <div className="text-sm text-charcoal-400">Followers</div>
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className="relative z-10 p-4 max-w-2xl mx-auto space-y-8 pb-20">
        {/* Most Popular Lists */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-serif font-semibold text-charcoal-700">Most Popular Lists</h3>
            <button className="text-sm font-medium text-sage-700 hover:underline">View All</button>
          </div>
          <div className="space-y-4">
            {filteredLists.map((list, idx) => (
              <div key={list.id} className="rounded-2xl shadow-botanical border border-linen-200 bg-white/98 flex flex-col md:flex-row gap-4 overflow-hidden transition hover:shadow-cozy hover:-translate-y-1">
                <div className="w-full md:w-40 h-28 md:h-auto flex-shrink-0 bg-linen-100">
                  <img src={list.coverImage} alt={list.name} className="w-full h-full object-cover rounded-l-2xl" />
                </div>
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <h4 className="font-serif font-semibold text-lg text-charcoal-700 mb-1">{list.name}</h4>
                    <p className="text-sm text-charcoal-500 mb-2">{list.description}</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {list.tags.map(tag => (
                        <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-sage-50 border border-sage-100 text-sage-700 transition hover:bg-sage-100 hover:shadow-botanical">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-6 h-6 rounded-full border-2 border-white shadow-soft object-cover" />
                    <span className="text-xs text-charcoal-500 font-medium">{currentUser.name}</span>
                    <span className="ml-auto flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gold-50 text-gold-700">
                      <HeartIcon className="w-4 h-4" /> {56 + idx * 10}
                    </span>
                    <button className="ml-2 px-3 py-1 rounded-full text-xs font-medium bg-sage-400 text-white hover:bg-sage-500 transition">View</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Recent Activity */}
        <div>
          <h3 className="text-xl font-serif font-semibold text-charcoal-700 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivity.map((activity, idx) => (
              <div key={activity.id} className="rounded-2xl shadow-soft border border-linen-200 bg-white/98 flex items-center gap-4 p-4 transition hover:shadow-cozy hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-sage-100 flex items-center justify-center">
                  <BookmarkIcon className="w-6 h-6 text-sage-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-charcoal-700 font-medium">
                    Saved <span className="font-semibold">{activity.place?.name}</span> to <span className="font-semibold">{activity.list?.name}</span>
                  </p>
                  <p className="text-xs text-charcoal-400 mt-1">
                    {new Date(activity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Quick Actions */}
        <div className="rounded-2xl shadow-botanical border border-linen-200 bg-white/98 p-6 flex gap-4 transition hover:shadow-cozy hover:-translate-y-1">
          <button className="flex-1 rounded-xl p-4 bg-sage-100 text-sage-700 font-semibold flex flex-col items-center gap-2 shadow-soft hover:bg-sage-200 hover:shadow-botanical transition">
            <PlusIcon className="w-6 h-6" />
            New List
          </button>
          <button className="flex-1 rounded-xl p-4 bg-gold-100 text-gold-700 font-semibold flex flex-col items-center gap-2 shadow-soft hover:bg-gold-200 hover:shadow-botanical transition">
            <HeartIcon className="w-6 h-6" />
            Saved Places
          </button>
        </div>
        {/* Comment Wall */}
        <div className="rounded-2xl shadow-botanical border border-linen-200 bg-white/98 p-6 transition hover:shadow-cozy hover:-translate-y-1">
          <h3 className="text-xl font-serif font-semibold text-charcoal-700 mb-4">Comment Wall</h3>
          <div className="space-y-4 mb-4">
            {comments.map((comment, i) => (
              <div key={comment.id} className="flex items-start gap-4 p-4 rounded-xl bg-linen-100 border border-linen-200 shadow-soft transition hover:shadow-botanical">
                <img src={comment.user.avatar} alt={comment.user.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-soft" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-serif font-semibold text-charcoal-700">{comment.user.name}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-sage-50 text-sage-700 border border-sage-100">{comment.date}</span>
                  </div>
                  <p className="text-sm text-charcoal-600">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
          <form
            onSubmit={e => {
              e.preventDefault()
              if (!commentInput.trim()) return
              setComments([
                ...comments,
                {
                  id: Date.now(),
                  user: { name: currentUser.name, avatar: currentUser.avatar || '' },
                  text: commentInput,
                  date: 'now'
                }
              ])
              setCommentInput('')
            }}
            className="flex items-center gap-4"
          >
            <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-soft" />
            <input
              type="text"
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 rounded-full px-4 py-3 border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 shadow-soft"
            />
            <button
              type="submit"
              className="font-semibold px-6 py-3 rounded-full bg-sage-400 text-white shadow-soft hover:bg-sage-500 transition"
            >
              Post
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Profile 