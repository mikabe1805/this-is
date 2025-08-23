import { useState, useEffect } from 'react';
import { formatTimestamp } from '../utils/dateUtils';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPinIcon, UserIcon, CalendarIcon, HeartIcon, BookmarkIcon, EyeIcon, PlusIcon, ShareIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid, BookmarkIcon as BookmarkIconSolid, EyeIcon as EyeIconSolid } from '@heroicons/react/24/solid';
import type { User, Post, List } from '../types/index.js';
import { firebaseListService } from '../services/firebaseListService.js';
import { useAuth } from '../contexts/AuthContext.js';
import firebaseDataService from '../services/firebaseDataService.js';
import SearchAndFilter from '../components/SearchAndFilter';
import TagSearchModal from '../components/TagSearchModal';

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'lists'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [likedLists, setLikedLists] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (userId) {
        const userData = await firebaseDataService.getCurrentUser(userId);
        setUser(userData);
        const userPosts = await firebaseDataService.getUserPosts(userId);
        setPosts(userPosts);
        const userLists = await firebaseDataService.getUserLists(userId);
        setLists(userLists);
        if (currentUser) {
          const following = await firebaseDataService.getUserFollowing(currentUser.id);
          setIsFollowing(following.some(u => u.id === userId));
          const liked = await firebaseDataService.getSavedPosts(currentUser.id);
          setLikedPosts(new Set(liked.map(p => p.id)));
          const likedL = await firebaseDataService.getSavedLists(currentUser.id);
          setLikedLists(new Set(likedL.map(l => l.id)));
        }
      }
    };
    fetchData();
  }, [userId, currentUser]);

  const handleFollow = async () => {
    if (currentUser && userId) {
      try {
        if (isFollowing) {
          await firebaseDataService.unfollowUser(currentUser.id, userId);
        } else {
          await firebaseDataService.followUser(currentUser.id, userId);
        }
        
        // Refetch the following status from Firebase to confirm the change
        const following = await firebaseDataService.getUserFollowing(currentUser.id);
        const isUserFollowing = following.some(user => user.id === userId);
        setIsFollowing(isUserFollowing);
        
        console.log(`Follow status updated: ${isUserFollowing ? 'following' : 'not following'}`);
      } catch (error) {
        console.error('Error updating follow status:', error);
        // Don't update local state if the operation failed
      }
    }
  };

  const handleLikePost = async (postId: string) => {
    if (currentUser) {
      await firebaseDataService.likePost(postId, currentUser.id);
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (newSet.has(postId)) {
          newSet.delete(postId);
        } else {
          newSet.add(postId);
        }
        return newSet;
      });
    }
  };

  const handleSavePost = (postId: string) => {
    setSavedPosts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }

  const handleLikeList = async (listId: string) => {
    if (!currentUser) return;

    try {
      // First, update Firebase directly
      await firebaseListService.likeList(listId, currentUser.id);
      await firebaseDataService.saveList(listId, currentUser.id);
      
      // Then refetch the lists to get the true state from Firebase
      const updatedLists = await firebaseDataService.getUserLists(userId || '');
      setLists(updatedLists);
      
    } catch (error) {
      console.error("Failed to like list:", error);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${user.name}'s Profile`,
        text: `Check out ${user.name}'s profile on this.is`,
        url: window.location.href
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Profile link copied to clipboard!')
    }
  }

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-linen-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-glass border-b border-linen-200/50 shadow-crystal sticky top-0 z-10">
        <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-linen-100 transition-colors"
          >
            <ArrowLeftIcon className="w-6 h-6 text-charcoal-600" />
          </button>
          <h1 className="text-lg font-serif font-semibold text-charcoal-800">
            {user.name}
          </h1>
          <button
            onClick={handleShare}
            className="p-2 rounded-full hover:bg-linen-100 transition-colors"
          >
            <ShareIcon className="w-6 h-6 text-charcoal-600" />
          </button>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-4">
          <form onSubmit={(e) => { e.preventDefault(); }}>
            <SearchAndFilter
              placeholder={`Search ${user.name}'s posts and lists...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sortOptions={[{ key: 'relevance', label: 'Relevance' }, { key: 'recent', label: 'Most Recent' }]}
              filterOptions={[]}
              availableTags={[]}
              sortBy={'recent'}
              setSortBy={() => {}}
              activeFilters={[]}
              setActiveFilters={() => {}}
              dropdownPosition="top-right"
              onSubmitQuery={() => { /* in-place filtering */ }}
            />
          </form>
        </div>
      </div>

      {/* Profile Header */}
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white/98 backdrop-blur-sm rounded-3xl shadow-botanical border border-linen-200 p-6 mb-6">
          <div className="flex items-start gap-6">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-24 h-24 rounded-full border-4 border-white shadow-botanical"
              loading="lazy"
            />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-serif font-bold text-charcoal-800">{user.name}</h2>
                {isFollowing && (
                  <span className="px-3 py-1 bg-sage-100 text-sage-700 text-sm rounded-full font-medium">
                    Following
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-charcoal-600 mb-2">
                <UserIcon className="w-4 h-4" />
                <span>@{user.username}</span>
              </div>
              <div className="flex items-center gap-2 text-charcoal-600 mb-3">
                <MapPinIcon className="w-4 h-4" />
                <span>{user.location}</span>
              </div>
              {user.bio && (
                <p className="text-charcoal-700 mb-4 leading-relaxed">{user.bio}</p>
              )}
              {user.tags && user.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {user.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-sage-100 text-sage-700 text-sm rounded-full border border-sage-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 text-sm text-charcoal-500">
                <div className="flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4" />
                  <span>Joined {formatTimestamp(user.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleFollow}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-200 ${
                isFollowing
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-gradient-to-r from-sage-500 to-sage-600 text-white'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-botanical hover:shadow-liquid hover:scale-102 transition-all duration-200">
              <PlusIcon className="w-5 h-5" />
              Message
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-around mt-6 pt-6 border-t border-linen-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-charcoal-800">{posts.length}</div>
              <div className="text-sm text-charcoal-600">Posts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-charcoal-800">{lists.length}</div>
              <div className="text-sm text-charcoal-600">Lists</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-charcoal-800">{user.followersCount || 0}</div>
              <div className="text-sm text-charcoal-600">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-charcoal-800">{user.followingCount || 0}</div>
              <div className="text-sm text-charcoal-600">Following</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white/80 backdrop-blur-md rounded-xl p-2 shadow-soft border border-white/40 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold text-base transition-all duration-200 ${
                activeTab === 'posts' 
                  ? 'bg-gradient-to-r from-sage-500 to-gold-500 text-white shadow-liquid transform scale-102' 
                  : 'text-sage-700 hover:text-sage-900 hover:bg-white/60'
              }`}
            >
              Posts ({posts.length})
            </button>
            <button
              onClick={() => setActiveTab('lists')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold text-base transition-all duration-200 ${
                activeTab === 'lists' 
                  ? 'bg-gradient-to-r from-sage-500 to-gold-500 text-white shadow-liquid transform scale-102' 
                  : 'text-sage-700 hover:text-sage-900 hover:bg-white/60'
              }`}
            >
              Lists ({lists.length})
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            {(() => {
              const q = searchQuery.trim().toLowerCase();
              const filtered = q ? posts.filter(p => (
                (p.description || '').toLowerCase().includes(q) ||
                (p.tags || []).some((t: string) => t.toLowerCase().includes(q))
              )) : posts;
              return filtered.length > 0 ? (
              filtered.map((post) => (
                <div
                  key={post.id}
                  className="bg-white/98 backdrop-blur-sm rounded-2xl shadow-botanical border border-linen-200 overflow-hidden"
                >
                  {/* Post Header */}
                  <div className="p-4 border-b border-linen-200">
                    <div className="flex items-center gap-3">
                      <img
                        src={post.userAvatar}
                        alt={post.username}
                        className="w-10 h-10 rounded-full border-2 border-white shadow-soft"
                        loading="lazy"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-charcoal-700">{post.username}</span>
                          <span className="text-xs text-charcoal-500">{formatTimestamp(post.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-charcoal-500">
                          {post.postType === 'loved' && (
                            <span className="flex items-center gap-1 text-red-500">
                              <HeartIconSolid className="w-3 h-3" />
                              Loved
                            </span>
                          )}
                          {post.postType === 'tried' && (
                            <span className="flex items-center gap-1 text-gold-500">
                              <BookmarkIcon className="w-3 h-3" />
                              Tried
                            </span>
                          )}
                          {post.postType === 'want' && (
                            <span className="flex items-center gap-1 text-sage-500">
                              <EyeIcon className="w-3 h-3" />
                              Want to try
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Post Image */}
                  {post.images.length > 0 && (
                    <div className="relative">
                      <img
                        src={post.images[0]}
                        alt="Post"
                        className="w-full h-64 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent"></div>
                    </div>
                  )}

                  {/* Post Content */}
                  <div className="p-4">
                    <p className="text-charcoal-700 mb-4 leading-relaxed">{post.description}</p>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-charcoal-600">
                        <button 
                          onClick={() => handleLikePost(post.id)}
                          className="flex items-center gap-1 hover:text-red-500 transition-colors"
                        >
                          {likedPosts.has(post.id) ? (
                            <HeartIconSolid className="w-5 h-5 text-red-500" />
                          ) : (
                            <HeartIcon className="w-5 h-5" />
                          )}
                          {post.likes + (likedPosts.has(post.id) ? 1 : 0) - (post.likedBy.includes(currentUser.id) && !likedPosts.has(post.id) ? 1 : 0)}
                        </button>
                        <span className="flex items-center gap-1">
                          <BookmarkIcon className="w-5 h-5" />
                          {post.comments?.length || 0}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleSavePost(post.id)}
                        className={`p-2 rounded-full transition-colors ${
                          savedPosts.has(post.id)
                            ? 'bg-sage-100 text-sage-700'
                            : 'bg-sage-50 text-sage-600 hover:bg-sage-100'
                        }`}
                      >
                        {savedPosts.has(post.id) ? (
                          <BookmarkIconSolid className="w-5 h-5" />
                        ) : (
                          <BookmarkIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))
              ) : (
                <div className="bg-white/98 backdrop-blur-sm rounded-2xl shadow-botanical border border-linen-200 p-8 text-center">
                  <UserIcon className="w-16 h-16 text-charcoal-300 mx-auto mb-4" />
                  <p className="text-charcoal-500 mb-2">No posts found</p>
                  <p className="text-sm text-charcoal-400">Try a different search.</p>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'lists' && (
          <div className="space-y-4">
            {(() => {
              const q = searchQuery.trim().toLowerCase();
              const filtered = q ? lists.filter(l => (
                (l.name || '').toLowerCase().includes(q) ||
                (l.description || '').toLowerCase().includes(q) ||
                (l.tags || []).some((t: string) => t.toLowerCase().includes(q))
              )) : lists;
              return filtered.length > 0 ? (
              filtered.map((list) => (
                <div
                  key={list.id}
                  className="bg-white/98 backdrop-blur-sm rounded-2xl shadow-botanical border border-linen-200 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-center gap-4">
                      {list.coverImage && (
                        <img 
                          src={list.coverImage} 
                          alt={list.name} 
                          className="w-20 h-20 rounded-xl object-cover shadow-soft"
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-charcoal-700 mb-1">{list.name}</h4>
                        <p className="text-sm text-charcoal-500 mb-2">{list.description}</p>
                        <div className="flex items-center gap-2 mb-2">
                          {list.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-xs px-2 py-1 bg-sage-100 text-sage-700 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm text-charcoal-500">
                            <span>{list.likes || 0} likes</span>
                            <span>Created {formatTimestamp(list.createdAt)}</span>
                          </div>
                          <button 
                            onClick={() => handleLikeList(list.id)}
                            className={`p-2 rounded-full transition-colors ${
                              list.likedBy?.includes(currentUser?.id || '')
                                ? 'bg-red-100 text-red-600'
                                : 'bg-gold-50 text-gold-600 hover:bg-gold-100'
                            }`}
                          >
                            {list.likedBy?.includes(currentUser?.id || '') ? (
                              <HeartIconSolid className="w-4 h-4" />
                            ) : (
                              <HeartIcon className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
              ) : (
                <div className="bg-white/98 backdrop-blur-sm rounded-2xl shadow-botanical border border-linen-200 p-8 text-center">
                  <BookmarkIcon className="w-16 h-16 text-charcoal-300 mx-auto mb-4" />
                  <p className="text-charcoal-500 mb-2">No lists found</p>
                  <p className="text-sm text-charcoal-400">Try a different search.</p>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserProfile 