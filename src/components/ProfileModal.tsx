import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { XMarkIcon, MapPinIcon, UserIcon, CalendarIcon, HeartIcon, BookmarkIcon, EyeIcon, PlusIcon, ShareIcon, ArrowsPointingOutIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { HeartIcon as SolidHeartIcon } from '@heroicons/react/20/solid'
import type { User, Post, List, Hub, Activity } from '../types/index.js'
import { firebaseDataService } from '../services/firebaseDataService'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useAuth } from '../contexts/AuthContext.tsx'
import { formatTimestamp } from '../utils/dateUtils.ts'

interface ProfileModalProps {
  userId: string
  isOpen: boolean
  onClose: () => void
  onFollow?: (userId: string) => void
  onShare?: (user: User) => void
  onOpenFullScreen?: (user: User) => void
  showBackButton?: boolean
  onBack?: () => void
}

const ProfileModal = ({ userId, isOpen, onClose, onFollow, onShare, onOpenFullScreen, showBackButton, onBack }: ProfileModalProps) => {
  const { currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate()
  const { openPostModal, openListModal } = useNavigation();
  const [isFollowing, setIsFollowing] = useState(false)
  const [activeTab, setActiveTab] = useState<'posts' | 'lists'>('posts');
  const [isVisible, setIsVisible] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (posts.length > 0 && currentUser) {
      const liked: Record<string, boolean> = {};
      const counts: Record<string, number> = {};
      posts.forEach(post => {
        liked[post.id] = post.likedBy?.includes(currentUser.uid) || false;
        counts[post.id] = post.likes || 0;
      });
      setLikedPosts(liked);
      setLikeCounts(counts);
    }
  }, [posts, currentUser]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 10)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  useEffect(() => {
    const fetchUserData = async () => {
    if (isOpen && userId) {
      setLoading(true);
        setPosts([]); // Clear previous posts
        setLists([]); // Clear previous lists
        try {
          const fetchedUser = await firebaseDataService.getCurrentUser(userId);
          setUser(fetchedUser);

          if (fetchedUser) {
            const activityItems = await firebaseDataService.getUserActivity(userId);
            
            // Batch fetch posts and lists
            const { posts: fetchedPosts, lists: fetchedLists } = await firebaseDataService.getBatchPostAndListData(activityItems);

            setPosts(fetchedPosts);
            setLists(fetchedLists);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUserData();
  }, [isOpen, userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])


  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsFollowing(!isFollowing)
    if (onFollow && user) {
      onFollow(user.id)
    }
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onShare && user) {
      onShare(user)
    }
  }

  const handleOpenFullScreen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onOpenFullScreen && user) {
      onOpenFullScreen(user)
    }
  }

  const handlePostClick = (postId: string) => {
    openPostModal(postId, 'profile-modal');
  };

  const handleListClick = (list: List) => {
    openListModal(list, 'profile-modal');
  };

  const handleLikePost = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (!currentUser) return;

    const newLikedState = !likedPosts[postId];
    const newLikeCount = newLikedState ? (likeCounts[postId] || 0) + 1 : (likeCounts[postId] || 0) - 1;

    setLikedPosts(prev => ({ ...prev, [postId]: newLikedState }));
    setLikeCounts(prev => ({ ...prev, [postId]: newLikeCount }));

    await firebaseDataService.likePost(postId, currentUser.uid);
  };

  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div className={`fixed inset-0 z-50 overflow-hidden`}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      ></div>
      <div
        ref={modalRef}
        className={`absolute bottom-0 left-0 right-0 w-full max-w-md mx-auto h-[95vh] bg-gradient-to-br from-[#5a3e36] via-[#6f4e37] to-[#6d4934] rounded-t-3xl shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 80%, rgba(139, 115, 85, 0.25) 0%, transparent 50%), 
            radial-gradient(circle at 80% 20%, rgba(111, 78, 55, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(109, 73, 52, 0.08) 0%, transparent 70%),
            radial-gradient(circle at 10% 10%, rgba(139, 115, 85, 0.2) 0%, transparent 60%),
            radial-gradient(circle at 90% 90%, rgba(111, 78, 55, 0.15) 0%, transparent 40%)
          `
        }}
      >
        {/* Enhanced Botanical Accents - Layered and Scrolling */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {/* Refined background leaves - intentional and balanced */}
          <img src="/assets/leaf.png" alt="" className="absolute top-12 left-[-1rem] w-16 opacity-6 blur-[1.3px]" style={{ transform: 'rotate(-15deg)' }} />
          <img src="/assets/leaf2.png" alt="" className="absolute top-32 right-[-0.5rem] w-14 opacity-7 blur-[1.1px]" style={{ transform: 'rotate(18deg)' }} />
          
          {/* Mid accent */}
          <img src="/assets/leaf3.png" alt="" className="absolute top-1/2 right-[-1rem] w-18 opacity-5 blur-[1.5px]" style={{ transform: 'rotate(-10deg)' }} />
          
          {/* Bottom accent */}
          <img src="/assets/leaf.png" alt="" className="absolute bottom-16 left-6 w-12 opacity-8 blur-[0.9px]" style={{ transform: 'rotate(20deg)' }} />
        </div>

        {/* Intentional Light Effects - Accentuating Key Areas */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Header accent - highlighting the profile */}
          <div className="absolute top-0 left-1/3 w-28 h-28 bg-gradient-to-br from-[rgba(255,255,240,0.25)] via-transparent to-transparent transform -rotate-15 animate-pulse" style={{ animationDuration: '6s' }} />
          
          {/* Action buttons accent */}
          <div className="absolute top-[280px] right-1/4 w-20 h-20 bg-gradient-to-bl from-[rgba(255,255,240,0.2)] via-transparent to-transparent transform rotate-8 animate-pulse" style={{ animationDuration: '8s' }} />
          
          {/* Content area accent */}
          <div className="absolute top-[320px] left-1/4 w-16 h-16 bg-gradient-to-r from-[rgba(255,255,240,0.15)] via-transparent to-transparent transform rotate-12 animate-pulse" style={{ animationDuration: '10s' }} />
        </div>

        {/* Grain texture for warmth */}
        <div className="absolute inset-0 pointer-events-none opacity-25">
          <div className="w-full h-full" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E")`,
            backgroundSize: '150px 150px'
          }} />
        </div>
        
        {/* Header */}
            <div className="relative">
          <div className="h-48 bg-gradient-to-br from-[#D4A574] via-[#C17F59] to-[#A67C52] overflow-hidden">
            <img 
              src={user?.coverPhoto || '/assets/default-banner.jpg'} 
              alt="Cover" 
              className="w-full h-full object-cover opacity-80" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div 
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(255,250,240,0.15), transparent 60%)'
              }}
            />
            
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              {showBackButton ? (
                <button onClick={onBack} className="p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-white/10 transition-colors">
                  <ArrowLeftIcon className="w-6 h-6 text-white" />
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button onClick={handleOpenFullScreen} className="p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-white/10 transition-colors">
                  <ArrowsPointingOutIcon className="w-6 h-6 text-white" />
                </button>
                <button onClick={handleShare} className="p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-white/10 transition-colors">
                  <ShareIcon className="w-6 h-6 text-white" />
                </button>
                <button onClick={onClose} className="p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-white/10 transition-colors">
                  <XMarkIcon className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          </div>

          <div className="absolute top-28 left-1/2 -translate-x-1/2 z-20">
             <img
              src={user?.avatar || '/assets/default-avatar.png'}
              alt={user?.name}
              className="w-32 h-32 rounded-full border-4 border-[#F8F4EF] shadow-lg"
            />
          </div>
        </div>
        
        {/* Scrolling Content with Refined Botanical Accents */}
        <div className="overflow-y-auto flex-1 pt-16 relative bg-[rgba(255,255,255,0.05)] backdrop-blur-[10px]">
          {/* Strategic scrolling leaf accents */}
          <img src="/assets/leaf3.png" alt="" className="absolute top-16 right-[-1rem] w-16 opacity-8 pointer-events-none blur-[1px]" style={{ transform: 'rotate(-12deg)' }} />
          <img src="/assets/leaf.png" alt="" className="absolute top-48 left-[-0.5rem] w-14 opacity-7 pointer-events-none blur-[1.2px]" style={{ transform: 'rotate(20deg)' }} />
          <img src="/assets/leaf2.png" alt="" className="absolute top-96 right-2 w-12 opacity-6 pointer-events-none blur-[1.3px]" style={{ transform: 'rotate(-18deg)' }} />
          <img src="/assets/leaf.png" alt="" className="absolute top-[140px] left-[-1rem] w-10 opacity-8 pointer-events-none blur-[0.9px]" style={{ transform: 'rotate(15deg)' }} />
          
          <div className="text-white">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/50"></div>
              </div>
            ) : !user ? (
              <div className="text-center py-10 text-white/70">User not found.</div>
            ) : (
              <div className="p-6">
                {/* User Info */}
                <div className="text-center">
                  <h3 className="text-3xl font-bold font-serif text-[#FAF3E3] drop-shadow-[1px_1px_2px_rgba(255,250,240,0.8)]">{user.name}</h3>
                  <p className="text-sm text-[#FAF3E3]/80 mb-1">@{user.username}</p>
                  {user.location && (
                    <div className="flex items-center justify-center gap-1 text-sm text-[#FAF3E3]/80 mb-2">
                      <MapPinIcon className="w-4 h-4" />
                      <span>{user.location as any}</span>
                    </div>
                  )}
                  {user.bio && <p className="leading-relaxed font-serif max-w-md mx-auto my-4 text-[#FAF3E3]/90">{user.bio}</p>}
          {user.tags && user.tags.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mb-4">
                {user.tags.map((tag) => (
                        <span key={tag} className="px-3 py-1.5 bg-[rgba(255,255,255,0.1)] backdrop-blur-sm rounded-xl text-sm font-medium border border-white/20 shadow-sm">
                    #{tag}
                  </span>
                ))}
              </div>
                  )}
            </div>

                {/* Action Buttons */}
                <div className="my-6 flex gap-3">
            <button
              onClick={handleFollow}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg border transition-all duration-200 backdrop-blur-sm hover:shadow-xl hover:scale-[1.02] ${
                isFollowing
                        ? 'bg-[rgba(255,255,255,0.15)] text-[#fdf6e3] border-white/30' 
                        : 'bg-[#8B5E3C]/80 text-[#fdf6e3] border-[#8B5E3C]/50'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
                  <button className="flex-1 flex items-center justify-center gap-2 bg-[rgba(255,255,255,0.15)] backdrop-blur-sm text-[#fdf6e3] px-4 py-3 rounded-xl text-sm font-semibold shadow-lg border border-white/20 hover:shadow-xl hover:scale-[1.02] transition-all duration-200">
                    <PlusIcon className="w-4 h-4" />
              Message
            </button>
          </div>

          {/* Tabs */}
                <div className="bg-[rgba(255,255,255,0.15)] backdrop-blur-sm rounded-xl p-1 shadow-lg border border-white/10">
                  <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('posts')}
                      className={`flex-1 py-2 px-3 rounded-lg font-serif font-semibold text-sm transition-all duration-300 ${
                  activeTab === 'posts' 
                          ? 'bg-[rgba(255,255,255,0.25)] text-[#fdf6e3] shadow-md' 
                          : 'text-[#fdf6e3]/70'
                }`}
              >
                      Posts ({posts.length})
              </button>
              <button
                onClick={() => setActiveTab('lists')}
                      className={`flex-1 py-2 px-3 rounded-lg font-serif font-semibold text-sm transition-all duration-300 ${
                  activeTab === 'lists' 
                          ? 'bg-[rgba(255,255,255,0.25)] text-[#fdf6e3] shadow-md' 
                          : 'text-[#fdf6e3]/70'
                }`}
              >
                      Lists ({lists.length})
              </button>
            </div>
          </div>

                {/* Tab Content */}
                <div className="pt-6 space-y-4">
          {activeTab === 'posts' && (
                    posts.length === 0 ? (
                      <div className="text-center py-10">
                        <UserIcon className="w-16 h-16 text-white/20 mx-auto mb-2" />
                        <p className="text-[#fdf6e3]/70">No posts yet.</p>
                      </div>
                    ) : (
                      posts.map(post => (
                        <div key={post.id} onClick={() => handlePostClick(post.id)} className="bg-[rgba(255,255,255,0.1)] backdrop-blur-md rounded-2xl p-4 shadow-md border border-white/10 cursor-pointer group relative overflow-hidden">
                          {post.images && post.images.length > 0 && (
                            <img src={post.images[0]} alt="Post" className="w-full h-48 object-cover rounded-xl shadow-inner mb-3 transition-transform duration-300 group-hover:scale-105" />
                          )}
                          <p className="mb-3 leading-relaxed text-sm font-serif text-[#fdf6e3]/90">{post.description}</p>
                          <div className="flex items-center justify-between text-sm text-[#fdf6e3]/70">
                            <button onClick={(e) => handleLikePost(e, post.id)} className="flex items-center z-20">
                              {likedPosts[post.id] ? <SolidHeartIcon className="w-5 h-5 mr-1 text-red-500" /> : <HeartIcon className="w-5 h-5 mr-1 text-[#fdf6e3]/70" />}
                              <span className="font-semibold">{likeCounts[post.id] || 0}</span>
                        </button>
                            <span className="font-serif">{formatTimestamp(post.createdAt)}</span>
                    </div>
                  </div>
                ))
                    )
                  )}
          {activeTab === 'lists' && (
                    lists.length === 0 ? (
                      <div className="text-center py-10">
                        <BookmarkIcon className="w-16 h-16 text-white/20 mx-auto mb-2" />
                        <p className="text-[#fdf6e3]/70">No lists yet.</p>
                      </div>
                    ) : (
                      lists.map(list => (
                        <div key={list.id} onClick={() => handleListClick(list)} className="flex items-center gap-3 p-3 bg-[rgba(255,255,255,0.1)] backdrop-blur-md rounded-xl shadow-md border border-white/10 cursor-pointer hover:bg-[rgba(255,255,255,0.2)] transition-colors">
                          <img src={list.coverImage} alt={list.name} className="w-14 h-14 rounded-lg object-cover border-2 border-white/10 shadow-sm" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-serif font-semibold truncate text-[#fdf6e3]">{list.name}</h4>
                            <p className="text-sm text-[#fdf6e3]/70 truncate">{list.description}</p>
                    </div>
                  </div>
                ))
                    )
                  )}
                </div>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}


export default ProfileModal 
