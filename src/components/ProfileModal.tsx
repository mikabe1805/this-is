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
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss'

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
  const { openPostOverlay, openListModal, showPostOverlay } = useNavigation();
  const [isFollowing, setIsFollowing] = useState(false)
  const [activeTab, setActiveTab] = useState<'posts' | 'lists'>('lists');
  const [isVisible, setIsVisible] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  useSwipeToDismiss({ ref: modalRef, onDismiss: onClose, enabled: isOpen })
  
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (posts.length > 0 && currentUser) {
      const liked: Record<string, boolean> = {};
      const counts: Record<string, number> = {};
      posts.forEach(post => {
        liked[post.id] = post.likedBy?.includes(currentUser.id) || false;
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
            // Fetch posts directly
            const userPosts = await firebaseDataService.getUserPosts(userId);
            setPosts(userPosts);

            // Fetch lists directly
            const userLists = await firebaseDataService.getUserLists(userId);
            setLists(userLists);

            // Check if current user is following this user
            if (currentUser && currentUser.id !== userId) {
              try {
                const following = await firebaseDataService.getUserFollowing(currentUser.id);
                const isUserFollowing = following.some(user => user.id === userId);
                setIsFollowing(isUserFollowing);
                console.log(`ProfileModal: Following status for ${userId}: ${isUserFollowing}`);
              } catch (error) {
                console.error('Error checking following status:', error);
                setIsFollowing(false);
              }
            } else {
              setIsFollowing(false); // Can't follow yourself
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUserData();
  }, [isOpen, userId, currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node) && !showPostOverlay) {
        if (typeof onClose === 'function') {
          onClose()
        }
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, showPostOverlay])


  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onFollow && user && currentUser) {
      try {
        // Optimistically update UI
        setIsFollowing(!isFollowing);
        
        // Call the follow function
        await onFollow(user.id);
        
        // Refresh the actual following status from Firebase
        const following = await firebaseDataService.getUserFollowing(currentUser.id);
        const isUserFollowing = following.some(user => user.id === userId);
        setIsFollowing(isUserFollowing);
        console.log(`ProfileModal: Following status updated for ${userId}: ${isUserFollowing}`);
      } catch (error) {
        console.error('Error in follow operation:', error);
        // Revert optimistic update on error
        setIsFollowing(!isFollowing);
      }
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
    openPostOverlay(postId);
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

    await firebaseDataService.likePost(postId, currentUser.id);
  };

  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div className={`fixed inset-0 z-[1002] overflow-hidden`}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      ></div>
      <div
        ref={modalRef}
        className={`modal-paper absolute bottom-0 left-0 right-0 w-full max-w-md mx-auto h-[95vh] border-t border-edge sm:border sm:rounded-3xl rounded-t-3xl transform transition-transform duration-300 ease-out flex flex-col overflow-hidden ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ boxShadow: '0 -8px 40px rgba(46, 28, 13, 0.25), 0 24px 60px rgba(46, 28, 13, 0.30)' }}
      >
        {/* Drag handle */}
        <div data-drag-handle className="flex justify-center pt-3 pb-1 shrink-0 touch-none" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>

        {/* Header — paper-deep tile if no cover, otherwise the cover image
            with a subtle ink-to-transparent gradient so the action buttons
            stay legible. Was a heavy dark-brown gradient + 4 decorative
            leaves + 3 animated light rays + a noise grain layer; all gone. */}
        <div data-drag-handle className="relative">
          <div className="h-44 bg-paper-deep overflow-hidden">
            {user?.coverPhoto && (
              <img
                src={user.coverPhoto}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A1815]/55 via-[#1A1815]/15 to-transparent" />

            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
              {showBackButton ? (
                <button onClick={onBack} aria-label="Back" className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 flex items-center justify-center">
                  <ArrowLeftIcon className="w-5 h-5 text-white" />
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button onClick={handleOpenFullScreen} aria-label="Open full profile" className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 flex items-center justify-center">
                  <ArrowsPointingOutIcon className="w-5 h-5 text-white" />
                </button>
                <button onClick={handleShare} aria-label="Share" className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 flex items-center justify-center">
                  <ShareIcon className="w-5 h-5 text-white" />
                </button>
                <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 flex items-center justify-center">
                  <XMarkIcon className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>

          <div className="absolute top-28 left-1/2 -translate-x-1/2 z-20">
            <img
              src={user?.avatar || '/assets/default-avatar.svg'}
              alt={user?.name || ''}
              className="w-28 h-28 rounded-full border-4 border-paper bg-paper-deep object-cover ring-1 ring-edge"
              style={{ boxShadow: '0 8px 24px rgba(46, 28, 13, 0.25)' }}
            />
          </div>
        </div>

        {/* Scrolling content — ink on paper, no glassy white-on-dark */}
        <div className="overflow-y-auto flex-1 pt-16 pb-6 relative z-10">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-mute">Loading…</span>
            </div>
          ) : !user ? (
            <div className="text-center py-10 text-ink-soft">User not found.</div>
          ) : (
            <div className="px-5">
              {/* User Info */}
              <div className="text-center">
                <h3 className="font-display text-[26px] leading-tight text-ink">{user.name}</h3>
                <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute mt-1">@{user.username}</p>
                {user.location && (
                  <p className="inline-flex items-center justify-center gap-1.5 mt-2 text-[13px] text-ink-soft">
                    <MapPinIcon className="w-4 h-4" />
                    <span>{user.location as any}</span>
                  </p>
                )}
                {user.bio && (
                  <p className="text-[14px] text-ink-soft leading-relaxed max-w-md mx-auto mt-3">
                    {user.bio}
                  </p>
                )}
                {user.tags && user.tags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                    {user.tags.map((tag) => (
                      <span key={tag} className="glass-honey px-3 h-7 rounded-full label-eyebrow inline-flex items-center">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action row */}
              <div className="my-6 flex gap-2">
                <button
                  type="button"
                  onClick={handleFollow}
                  aria-pressed={isFollowing}
                  className={isFollowing ? 'btn-secondary flex-1 h-11 label-eyebrow' : 'btn-cta flex-1 h-11 label-eyebrow'}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button
                  type="button"
                  className="btn-secondary flex-1 h-11 label-eyebrow inline-flex items-center justify-center gap-1.5"
                >
                  <PlusIcon className="w-4 h-4" />
                  Message
                </button>
              </div>

              {/* Tabs — same pattern as Profile.tsx route page */}
              <div className="border-b border-edge flex gap-6 mb-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('lists')}
                  aria-pressed={activeTab === 'lists'}
                  className={`pb-3 label-eyebrow transition-colors ${activeTab === 'lists' ? 'text-ink border-b-2 border-ink -mb-px' : 'text-ink-mute hover:text-ink-soft'}`}
                >
                  Lists · {lists.length}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('posts')}
                  aria-pressed={activeTab === 'posts'}
                  className={`pb-3 label-eyebrow transition-colors ${activeTab === 'posts' ? 'text-ink border-b-2 border-ink -mb-px' : 'text-ink-mute hover:text-ink-soft'}`}
                >
                  Posts · {posts.length}
                </button>
              </div>

              {/* Tab content */}
              <div className="space-y-3 pb-2">
                {activeTab === 'posts' && (
                  posts.length === 0 ? (
                    <div className="border border-edge rounded-2xl px-5 py-10 text-center bg-card">
                      <p className="font-display text-[20px] text-ink leading-tight">No posts yet.</p>
                    </div>
                  ) : (
                    posts.map(post => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => handlePostClick(post.id)}
                        className="w-full text-left bg-card border border-edge rounded-2xl p-3 hover:border-ink/30 transition-colors"
                      >
                        {post.images && post.images.length > 0 && (
                          <img src={post.images[0]} alt="" className="w-full h-56 object-cover rounded-xl mb-3" />
                        )}
                        <p className="text-[14px] text-ink-soft leading-relaxed mb-3 whitespace-pre-wrap">{post.description}</p>
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={(e) => handleLikePost(e, post.id)}
                            aria-label={likedPosts[post.id] ? 'Unlike post' : 'Like post'}
                            aria-pressed={!!likedPosts[post.id]}
                            className="inline-flex items-center gap-1.5 text-ink-mute hover:text-ink"
                          >
                            {likedPosts[post.id]
                              ? <SolidHeartIcon className="w-4 h-4" style={{ color: 'var(--bloom-deep)' }} />
                              : <HeartIcon className="w-4 h-4" />
                            }
                            <span className="font-mono text-[11px] tracking-wide">{likeCounts[post.id] || 0}</span>
                          </button>
                          <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute">{formatTimestamp(post.createdAt)}</span>
                        </div>
                      </button>
                    ))
                  )
                )}
                {activeTab === 'lists' && (
                  lists.length === 0 ? (
                    <div className="border border-edge rounded-2xl px-5 py-10 text-center bg-card">
                      <p className="font-display text-[20px] text-ink leading-tight">No lists yet.</p>
                    </div>
                  ) : (
                    lists.map(list => (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => handleListClick(list)}
                        className="w-full flex items-center gap-3 p-3 bg-card border border-edge rounded-2xl hover:border-ink/30 transition-colors text-left"
                      >
                        <div className="w-14 h-14 rounded-[12px] overflow-hidden bg-paper-deep ring-1 ring-edge shrink-0">
                          {list.coverImage ? (
                            <img src={list.coverImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-display text-[22px] text-ink-soft">
                              {(list.name || '?').slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-display text-[16px] leading-tight text-ink truncate">{list.name}</h4>
                          {list.description && (
                            <p className="text-[13px] text-ink-soft truncate">{list.description}</p>
                          )}
                        </div>
                      </button>
                    ))
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}


export default ProfileModal 
