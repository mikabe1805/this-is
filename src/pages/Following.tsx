import { useState, useEffect, useMemo } from 'react'
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.js'
import { firebaseDataService } from '../services/firebaseDataService.js'
import type { User } from '../types/index.js'

const Following = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'following' | 'friends' | 'followers'>('following')

  const { currentUser: authUser } = useAuth()
  const [followingUsers, setFollowingUsers] = useState<User[]>([])
  const [followersUsers, setFollowersUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const refreshLists = async () => {
    if (!authUser) return
    const [following, followers] = await Promise.all([
      firebaseDataService.getUserFollowing(authUser.id),
      firebaseDataService.getFollowers(authUser.id),
    ])
    setFollowingUsers(following)
    setFollowersUsers(followers)
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!authUser) return
      setLoading(true)
      await refreshLists()
      setLoading(false)
    }
    fetchData()
  }, [authUser])

  // Stay in sync when follow/unfollow happens elsewhere (e.g. ProfileModal,
  // UserProfile route). Without this, the list goes stale and the user sees
  // a "Follow" button on someone they just followed.
  useEffect(() => {
    if (!authUser) return
    const onFollowed = () => { void refreshLists() }
    window.addEventListener('this-is:followed', onFollowed)
    return () => window.removeEventListener('this-is:followed', onFollowed)
  }, [authUser?.id])

  // Optimistically update local follow state, then persist. On failure, revert
  // and surface a toast so the user knows the action didn't take. Previously
  // this refetched the entire list after each tap which caused a visible
  // flicker.
  const handleUnfollow = async (userId: string) => {
    if (!authUser) return
    const prev = followingUsers
    setFollowingUsers(curr => curr.filter(u => u.id !== userId))
    try {
      await firebaseDataService.unfollowUser(authUser.id, userId)
      window.dispatchEvent(new CustomEvent('this-is:followed', { detail: { followedId: userId, delta: -1 } }))
    } catch (error) {
      console.error('Error unfollowing user:', error)
      setFollowingUsers(prev)
      window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "Couldn't unfollow. Try again.", tone: 'error' } }))
    }
  }

  const handleFollow = async (userId: string) => {
    if (!authUser) return
    // We don't have the full User object yet — fetch on success rather than
    // synthesizing one. Optimism here is just "the button changes state".
    try {
      await firebaseDataService.followUser(authUser.id, userId)
      window.dispatchEvent(new CustomEvent('this-is:followed', { detail: { followedId: userId, delta: 1 } }))
      await refreshLists()
    } catch (error) {
      console.error('Error following user:', error)
      window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "Couldn't follow. Try again.", tone: 'error' } }))
    }
  }

  // Precompute the following set so the per-row check is O(1) instead of
  // O(n) on every render of every row.
  const followingIdSet = useMemo(() => new Set(followingUsers.map(u => u.id)), [followingUsers])
  const followerIdSet = useMemo(() => new Set(followersUsers.map(u => u.id)), [followersUsers])
  const friendsUsers = useMemo(
    () => followingUsers.filter(user => followerIdSet.has(user.id)),
    [followingUsers, followerIdSet],
  )
  const followingOnlyUsers = useMemo(
    () => followingUsers.filter(user => !followerIdSet.has(user.id)),
    [followingUsers, followerIdSet],
  )

  const isFollowing = (userId: string) => followingIdSet.has(userId)

  if (loading) {
    return <div>Loading...</div>; // Or a proper loading spinner
  }

  const currentUsers =
    activeTab === 'following'
      ? followingOnlyUsers
      : activeTab === 'friends'
      ? friendsUsers
      : followersUsers
  
  const filteredUsers = currentUsers.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.bio && user.bio.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.tags && user.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
  )


  return (
    <div className="relative min-h-full overflow-x-hidden">
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/profile') }}
            className="h-10 w-10 rounded-full hover:bg-paper-deep flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-ink" />
          </button>
          <h1 className="font-display text-[22px] leading-none text-ink">Friends</h1>
          <span className="w-10" />
        </div>

        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 h-10 px-3.5 rounded-full bg-card border border-edge focus-within:border-ink/40">
            <MagnifyingGlassIcon className="w-4 h-4 text-ink-mute shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter people"
              className="flex-1 bg-transparent outline-none text-[13px] text-ink placeholder:text-ink-mute"
            />
          </div>
        </div>

        <div className="px-5 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
          {([
            ['following', `Following · ${followingOnlyUsers.length}`],
            ['friends', `Friends · ${friendsUsers.length}`],
            ['followers', `Followers · ${followersUsers.length}`],
          ] as const).map(([key, label]) => {
            const active = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`shrink-0 h-8 px-3.5 rounded-full label-eyebrow transition-colors ${
                  active ? 'bg-ink text-paper' : 'bg-transparent text-ink-soft hover:text-ink border border-edge'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div className="border-b border-edge mx-5" />
      </header>

      <div className="relative z-10 px-5 py-5 max-w-2xl mx-auto">
        {filteredUsers.length === 0 ? (
          <div className="border border-edge rounded-[14px] px-5 py-12 text-center bg-card">
            <p className="font-display text-[24px] text-ink leading-tight">
              {searchQuery ? 'No matches.' : `No ${activeTab} yet.`}
            </p>
            <p className="text-[13px] text-ink-soft mt-2">
              {searchQuery
                ? 'Try a different name.'
                : activeTab === 'following'
                  ? 'Follow someone whose taste you trust.'
                  : activeTab === 'friends'
                    ? 'When you follow each other, you\'ll appear here.'
                    : 'When people follow you, they\'ll appear here.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-edge border-y border-edge">
            {filteredUsers.map((user) => (
              <li key={user.id} className="py-4">
                <div className="flex items-start gap-3.5">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="shrink-0 w-12 h-12 rounded-full object-cover bg-paper-deep ring-1 ring-edge"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-[18px] leading-tight text-ink truncate">{user.name}</p>
                        <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-0.5 truncate">@{user.username}</p>
                      </div>
                      <button
                        onClick={() => isFollowing(user.id) ? handleUnfollow(user.id) : handleFollow(user.id)}
                        className={
                          isFollowing(user.id)
                            ? 'btn-secondary h-9 px-4 label-eyebrow shrink-0'
                            : 'btn-cta h-9 px-4 label-eyebrow shrink-0'
                        }
                      >
                        {isFollowing(user.id) ? 'Following' : 'Follow'}
                      </button>
                    </div>
                    {user.bio && (
                      <p className="text-[13px] text-ink-soft line-clamp-2 mt-1.5">{user.bio}</p>
                    )}
                    {user.tags && user.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {user.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="glass-honey px-2.5 h-6 rounded-full label-eyebrow inline-flex items-center">
                            {tag}
                          </span>
                        ))}
                        {user.tags.length > 3 && (
                          <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute self-center">
                            +{user.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default Following 
