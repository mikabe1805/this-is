import { useState, useEffect } from 'react'
import { ArrowLeftIcon, MagnifyingGlassIcon, UserIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.js'
import { firebaseDataService } from '../services/firebaseDataService.js'
import type { User } from '../types/index.js'

const Followers = () => {
  const navigate = useNavigate()
  const { currentUser: authUser } = useAuth()
  const [followers, setFollowers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (authUser) {
        setLoading(true)
        const list = await firebaseDataService.getFollowers(authUser.id)
        setFollowers(list)
        setLoading(false)
      }
    }
    fetchData()
  }, [authUser])

  if (loading) return <div className="p-6">Loading...</div>

  const filtered = followers.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.bio || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="relative min-h-full overflow-x-hidden bg-linen-50">
      <div className="relative z-10 p-4 border-b border-linen-200 bg-white/95 backdrop-blur-glass">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/profile')}
            className="p-2 rounded-xl bg-linen-100 text-charcoal-600 hover:bg-linen-200 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-serif font-semibold text-charcoal-800">Followers</h1>
          <div className="w-10" />
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-charcoal-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search followers..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300 transition-colors"
          />
        </div>
      </div>
      <div className="relative z-10 p-4 space-y-4 max-w-2xl mx-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-linen-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserIcon className="w-8 h-8 text-charcoal-400" />
            </div>
            <h3 className="text-lg font-serif font-semibold text-charcoal-700 mb-2">{searchQuery ? 'No users found' : 'No followers yet'}</h3>
            <p className="text-charcoal-500">{searchQuery ? 'Try adjusting your search terms' : 'When people follow you, they\'ll appear here'}</p>
          </div>
        ) : (
          filtered.map(u => (
            <div key={u.id} className="relative rounded-2xl shadow-botanical border border-linen-200 bg-white/95 p-4 flex items-center gap-4">
              <img src={u.avatar} alt={u.name} className="w-12 h-12 rounded-xl object-cover border border-linen-200" loading="lazy" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <h3 className="font-serif font-semibold text-charcoal-800 truncate">{u.name}</h3>
                    <p className="text-sm text-charcoal-500 truncate">@{u.username}</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Followers
