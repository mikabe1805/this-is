import type { Hub, Post, List, PostComment } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, CameraIcon, ChatBubbleLeftIcon, XMarkIcon, ArrowRightIcon, ArrowLeftIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline'
import { HeartIcon as SolidHeartIcon } from '@heroicons/react/20/solid'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useAuth } from '../contexts/AuthContext.tsx'
import { formatTimestamp } from '../utils/dateUtils.ts'
import ImageCarousel from './ImageCarousel.tsx'
import CommentsModal from './CommentsModal.tsx'
import SaveToListModal from './SaveToListModal.tsx'
import SavePostToListModal from './SavePostToListModal.tsx'
import firebaseDataService from '../services/firebaseDataService.ts'

interface HubModalProps {
  hub: Hub
  isOpen: boolean
  onClose: () => void
  onAddPost?: (hub: Hub) => void
  onSave?: (hub: Hub) => void
  onShare?: (hub: Hub) => void
  onOpenFullScreen?: (hub: Hub) => void
  showBackButton?: boolean
  onBack?: () => void
  onOpenList?: (list: List) => void
  initialTab?: 'overview' | 'posts'
  initialPostId?: string
  showPostOverlay?: boolean
}

const HubModal = ({ hub, isOpen, onClose, onAddPost, onSave, onShare, onOpenFullScreen, showBackButton, onBack, onOpenList, initialTab = 'overview', initialPostId }: HubModalProps) => {
  const { currentUser } = useAuth();
  const { openListModal, openPostOverlay } = useNavigation()
  const [tab, setTab] = useState<'overview' | 'posts'>('overview')
  const [posts, setPosts] = useState<Post[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [showSaveToListModal, setShowSaveToListModal] = useState(false)
  const [showSavePostToListModal, setShowSavePostToListModal] = useState(false)
  const [selectedPostForSave, setSelectedPostForSave] = useState<Post | null>(null)
  const [selectedListForSave, setSelectedListForSave] = useState<List | null>(null)

  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [topTags, setTopTags] = useState<string[]>([]);
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  const [postComments, setPostComments] = useState<PostComment[]>([]);
  const [lists, setLists] = useState<List[]>([]);




  useEffect(() => {
    const fetchListsContainingHub = async () => {
      if (hub) {
        const fetchedLists = await firebaseDataService.getListsContainingHub(hub.id);
        setLists(fetchedLists);
      }
    };
    if (isOpen) {
      fetchListsContainingHub();
    }
  }, [isOpen, hub]);


  useEffect(() => {
    if (posts.length > 0) {
      const allTags = posts.flatMap(post => post.tags || []);
      const tagCounts = allTags.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
      setTopTags(sortedTags.slice(0, 5));
    }
  }, [posts]);

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
    if (isOpen && hub) {
      const fetchPosts = async () => {
        const hubPosts = await firebaseDataService.getPostsForHub(hub.id);
        setPosts(hubPosts);
      };
      fetchPosts();
    }
  }, [isOpen, hub]);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      if (initialTab === 'posts' && initialPostId) {
        setTimeout(() => {
          const postElement = document.getElementById(`post-${initialPostId}`);
          if (postElement) {
            postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500); // Delay to allow posts to render
      }
    }
  }, [isOpen, initialTab, initialPostId, posts]); // Rerun when posts are loaded
  
  useEffect(() => {
    console.log('HubModal: isOpen changed to:', isOpen)
    if (isOpen) {
      // Small delay to ensure DOM is ready for animation
      setTimeout(() => setIsVisible(true), 10)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])
  
  // Create a real list for Rami if this is Tartine Bakery





  if (!isOpen) {
    console.log('HubModal: Not rendering because isOpen is false')
    return null
  }



  const handleListClick = (list: List) => {
    if (onOpenList) {
      onOpenList(list)
    } else {
      // Use navigation context as fallback
      openListModal(list)
    }
  }

  const handleSeeAllLists = (listType: 'popular' | 'friends') => {
    // Navigate to ViewAllLists page with appropriate filters
    window.location.href = `/lists?type=${listType}&hub=${hub.id}`
  }



  const handleAddCommentToModal = async (text: string) => {
    if (!currentUser || !selectedPostForComments) return;
    const newComment = await firebaseDataService.postComment(selectedPostForComments.id, currentUser.id, text);
    if (newComment) {
      setPostComments(prevComments => [newComment, ...prevComments]);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!currentUser) return;
    // Implement comment like functionality
    console.log('Liking comment:', commentId);
  };

  const handleReplyToComment = async (commentId: string, text: string) => {
    if (!currentUser) return;
    // Implement reply functionality
    console.log('Replying to comment:', commentId, text);
  };

  const handleSaveList = (list: List) => {
    setSelectedListForSave(list)
    setShowSaveToListModal(true)
  }

  const handleSaveToList = async (listId: string, note?: string) => {
    if (!currentUser) return;
    await firebaseDataService.savePlaceToList(hub.id, listId, currentUser.id, note);
    setShowSaveToListModal(false)
    setSelectedListForSave(null)
  }

  const handleCreateList = async (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags: string[] }) => {
    if (!currentUser) return;
    const newListId = await firebaseDataService.createList({ ...listData, userId: currentUser.id });
    if (newListId) {
      await handleSaveToList(newListId);
    }
  }

  const handleLikePost = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (!currentUser) return;

    const newLikedState = !likedPosts[postId];
    const newLikeCount = newLikedState ? (likeCounts[postId] || 0) + 1 : (likeCounts[postId] || 0) - 1;

    setLikedPosts(prev => ({ ...prev, [postId]: newLikedState }));
    setLikeCounts(prev => ({ ...prev, [postId]: newLikeCount }));

    await firebaseDataService.likePost(postId, currentUser.id);
  };



  const handleOpenComments = async (post: Post) => {
    const fetchedComments = await firebaseDataService.getCommentsForPost(post.id);
    setPostComments(fetchedComments);
    setSelectedPostForComments(post);
    setShowCommentsModal(true);
  };

  const handleSavePostToList = async (listId: string) => {
    if (selectedPostForSave) {
      await firebaseDataService.savePostToList(selectedPostForSave.id, listId);
    }
    setShowSavePostToListModal(false);
    setSelectedPostForSave(null);
  };

  const handleCreateListForPost = async (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags: string[] }) => {
    if (currentUser) {
        const newListId = await firebaseDataService.createList({ ...listData, userId: currentUser.id });
        if (newListId && selectedPostForSave) {
            await firebaseDataService.savePostToList(selectedPostForSave.id, newListId);
        }
    }
    setShowSavePostToListModal(false);
    setSelectedPostForSave(null);
  };

  const handlePostClick = (post: Post) => {
    openPostOverlay(post.id);
  };

  const modalContent = (
    <div 
      className="modal-overlay fixed inset-0 z-[9998] flex items-center justify-center p-2 bg-black/20 backdrop-blur-md overflow-hidden"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) {
          console.log('HubModal: Backdrop clicked, closing modal')
          onClose()
        }
      }}
    >
      <div 
        className={`modal-container w-full max-w-[600px] max-h-[90vh] sm:max-h-screen bg-gradient-to-br from-[#FEF6E9] via-[#FBF0D9] to-[#F7E8CC] rounded-3xl shadow-2xl border border-[#E8D4C0]/60 overflow-hidden relative transition-all duration-500 ease-out ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{
          overflowX: 'hidden',
          backgroundImage: `
            radial-gradient(circle at 20% 80%, rgba(232, 212, 192, 0.25) 0%, transparent 50%), 
            radial-gradient(circle at 80% 20%, rgba(251, 240, 217, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(139, 115, 85, 0.08) 0%, transparent 70%),
            radial-gradient(circle at 10% 10%, rgba(247, 232, 204, 0.2) 0%, transparent 60%),
            radial-gradient(circle at 90% 90%, rgba(232, 212, 192, 0.15) 0%, transparent 40%)
          `
        }}
        onClick={(e) => {
          console.log('HubModal: Modal content clicked, stopping propagation')
          e.stopPropagation()
        }}
      >
        {/* Refined Botanical Accents - Intentional and Balanced */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Background Layer - Subtle foundation */}
          <img src="/assets/leaf3.png" alt="" className="absolute top-16 left-[-1rem] w-14 opacity-5 blur-[1.8px]" style={{ transform: 'rotate(-15deg)' }} />
          <img src="/assets/leaf.png" alt="" className="absolute top-40 right-[-0.5rem] w-12 opacity-7 blur-[1.3px]" style={{ transform: 'rotate(20deg)' }} />
          
          {/* Mid Layer - Strategic accent */}
          <img src="/assets/leaf2.png" alt="" className="absolute top-[300px] right-[-1rem] w-16 opacity-6 blur-[1.2px]" style={{ transform: 'rotate(-10deg)' }} />
          
          {/* Bottom accent - Subtle grounding */}
          <img src="/assets/leaf.png" alt="" className="absolute bottom-16 left-6 w-11 opacity-8 blur-[1px]" style={{ transform: 'rotate(18deg)' }} />
        </div>





        {/* Intentional Ambient Lighting - Accentuating Key Areas */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Header accent - highlighting the main title */}
          <div className="absolute top-0 left-1/3 w-32 h-32 bg-gradient-to-br from-[rgba(255,255,240,0.25)] via-transparent to-transparent transform -rotate-15 animate-pulse" style={{ animationDuration: '6s' }} />
          
          {/* Action buttons accent - drawing attention to key actions */}
          <div className="absolute top-[280px] right-1/4 w-24 h-24 bg-gradient-to-bl from-[rgba(255,255,240,0.2)] via-transparent to-transparent transform rotate-8 animate-pulse" style={{ animationDuration: '8s' }} />
          
          {/* Content area accent - subtle illumination */}
          <div className="absolute top-[420px] left-1/4 w-20 h-20 bg-gradient-to-r from-[rgba(255,255,240,0.15)] via-transparent to-transparent transform rotate-12 animate-pulse" style={{ animationDuration: '10s' }} />
          
          {/* Bottom corner accent - warm grounding */}
          <div className="absolute bottom-0 right-0 w-28 h-28 bg-gradient-to-tl from-[rgba(255,255,240,0.18)] via-transparent to-transparent transform rotate-45 animate-pulse" style={{ animationDuration: '12s' }} />
        </div>

        {/* Refined grain texture - mobile-optimized */}
        <div className="absolute inset-0 pointer-events-none opacity-30 sm:opacity-35 md:opacity-40">
          <div className="w-full h-full" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E")`,
            backgroundSize: '150px 150px'
          }} />
        </div>

        {/* Warmer light leak overlay */}
        <div className="absolute top-0 left-0 w-full h-32 sm:h-40 md:h-48 bg-gradient-to-b from-[#F7E8CC]/45 sm:from-[#F7E8CC]/50 md:from-[#F7E8CC]/55 via-[#F7E8CC]/25 sm:via-[#F7E8CC]/30 to-transparent pointer-events-none" />
        
        {/* Warmer header blur integration */}
        <div className="absolute top-0 w-full h-12 sm:h-14 md:h-16 z-10 bg-gradient-to-b from-[#fef6e9]/75 sm:from-[#fef6e9]/80 md:from-[#fef6e9]/85 to-transparent backdrop-blur-sm pointer-events-none" />
        
          {/* Header with image */}
        <div className="relative h-64 bg-gradient-to-br from-[#D4A574] via-[#C17F59] to-[#A67C52] overflow-hidden">
          {hub.mainImage && (
            <img
              src={hub.mainImage}
              alt={hub.name}
              className="w-full h-full object-cover"
            />
          )}
          {/* Enhanced gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          
          {/* Top action buttons */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
            {showBackButton && onBack ? (
              <button 
                onClick={onBack}
                className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 active:scale-95 hover:shadow-xl hover:scale-105 transition-all duration-200"
                title="Go back"
              >
                <ArrowLeftIcon className="w-5 h-5 text-white" />
              </button>
            ) : <div></div>}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenFullScreen?.(hub)}
                className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 active:scale-95 hover:shadow-xl hover:scale-105 transition-all duration-200"
              >
                <ArrowsPointingOutIcon className="w-5 h-5 text-white" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onShare?.(hub); }}
                className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 active:scale-95 hover:shadow-xl hover:scale-105 transition-all duration-200"
              >
                <ShareIcon className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 active:scale-95 hover:shadow-xl hover:scale-105 transition-all duration-200"
              >
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
          
          {/* Text overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <h1 className="text-3xl font-serif font-bold text-[#FAF3E3] drop-shadow-[1px_1px_2px_rgba(255,250,240,0.8)]">{hub.name}</h1>
            <div className="flex items-center text-white/90 text-sm mb-3 drop-shadow-md">
              <MapPinIcon className="w-4 h-4 mr-1.5" />
              {hub.location.address}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[#FAF3E3]/90 text-xs font-medium bg-[rgba(255,255,255,0.15)] backdrop-blur-sm px-2 py-1 rounded-lg border border-white/20">
                {posts.length} {posts.length === 1 ? 'post' : 'posts'}
              </span>
              {topTags.map((tag, index) => (
                <span 
                  key={tag} 
                  className={`px-3 py-1 backdrop-blur-sm rounded-full text-white text-xs font-medium border shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                    index === 0 ? 'bg-[rgba(255,255,255,0.2)] border-white/40' : 
                    index === 1 ? 'bg-[rgba(255,255,255,0.15)] border-white/30' : 
                    'bg-[rgba(255,255,255,0.1)] border-white/20'
                  }`}
                  style={{ opacity: 1 - (index * 0.05) }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        
        {/* Scrolling Content */}
        <div className="modal-content flex flex-col h-[calc(90vh-14rem)] sm:h-[calc(100vh-0.5rem-14rem)] overflow-y-auto overflow-x-hidden pb-4 relative" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Foreground Scrolling Leaves - Strategic and Minimal */}
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* Corner accent that scrolls with content */}
            <img src="/assets/leaf2.png" alt="" className="absolute top-16 right-[-0.5rem] w-12 opacity-7 blur-[1.1px]" style={{ transform: 'rotate(-15deg)' }} />
            
            {/* Mid-content accent with strategic overlap */}
            <img src="/assets/leaf.png" alt="" className="absolute top-[120px] left-[-0.5rem] w-14 opacity-6 blur-[1.3px]" style={{ transform: 'rotate(20deg)' }} />
            
            {/* Lower content accent */}
            <img src="/assets/leaf3.png" alt="" className="absolute top-[200px] right-2 w-10 opacity-8 blur-[0.9px]" style={{ transform: 'rotate(-18deg)' }} />
          </div>

          <div className="p-4 space-y-5 flex-1">
            {/* Action Buttons - Clean sticky positioning without background box */}
            <div className="flex gap-2 sticky top-0 z-20 pt-2 pb-3">
              <a 
                href={hub.googleMapsUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#B08968] to-[#9A7B5A] text-[#FEF6E9] px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#9A7B5A]/30 active:scale-95 transition-all duration-200 backdrop-blur-sm"
              >
                <MapPinIcon className="w-4 h-4" />
                Directions
                <ArrowRightIcon className="w-3 h-3" />
              </a>
              <button 
                onClick={(e) => { e.stopPropagation(); onAddPost?.(hub); }}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#D4A574] to-[#B08968] text-[#FEF6E9] px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#B08968]/30 active:scale-95 transition-all duration-200 backdrop-blur-sm"
              >
                <PlusIcon className="w-4 h-4" />
                Add Post
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onSave?.(hub); }}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#C17F59] to-[#B08968] text-[#FEF6E9] px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#B08968]/30 active:scale-95 transition-all duration-200 backdrop-blur-sm"
              >
                <BookmarkIcon className="w-4 h-4" />
                Save
              </button>
            </div>
            
            {/* Tabs */}
            <div className="bg-[#E8D4C0]/25 backdrop-blur-sm rounded-xl p-2 shadow-lg border border-[#E8D4C0]/50">
              <div className="flex gap-2">
                <button
                  onClick={() => setTab('overview')}
                  className={`flex-1 py-3 px-4 rounded-lg font-serif font-semibold text-sm transition-all duration-300 ${
                    tab === 'overview' 
                      ? 'bg-gradient-to-r from-[#B08968] to-[#9A7B5A] text-[#FEF6E9] shadow-lg transform scale-102' 
                      : 'text-[#7A5D3F] bg-[#fdf6e3]'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setTab('posts')}
                  className={`flex-1 py-3 px-4 rounded-lg font-serif font-semibold text-sm transition-all duration-300 ${
                    tab === 'posts' 
                      ? 'bg-gradient-to-r from-[#B08968] to-[#9A7B5A] text-[#FEF6E9] shadow-lg transform scale-102' 
                      : 'text-[#7A5D3F] bg-[#fdf6e3]'
                  }`}
                >
                  Posts ({posts.length})
                </button>
              </div>
            </div>

            {/* Tab content */}
            {tab === 'overview' && (
              <div className="space-y-4 pb-6">
                {/* Popular Lists */}
                <div className="bg-[#fdf6e3]/50 backdrop-blur-sm rounded-xl p-4 border border-[#E8D4C0]/40 shadow-lg relative">
                  {/* Subtle background leaf accent */}
                  <img
                    src="/assets/leaf3.png"
                    alt=""
                    className="absolute top-[-0.5rem] left-[-1rem] w-14 opacity-5 blur-[1.6px] pointer-events-none z-0"
                    style={{ transform: 'rotate(-20deg)' }}
                  />
                  <h3 className="text-lg font-serif font-semibold text-[#5D4A2E] mb-3">Popular Lists</h3>
                  {lists.length > 0 ? (
                    <div className="space-y-3">
                      {lists.slice(0, 3).map((list) => (
                        <div 
                          key={list.id} 
                          className="flex items-center gap-3 p-3 bg-[#fdf6e3] backdrop-blur-sm rounded-xl shadow-md border border-[#E8D4C0]/40 active:scale-98 transition-all duration-200"
                          onClick={() => handleListClick(list)}
                        >
                          {list.coverImage && (
                            <img src={list.coverImage} alt={list.name} className="w-12 h-12 rounded-lg object-cover border border-[#E8D4C0]/50 shadow-sm" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-serif font-semibold text-[#5D4A2E] truncate">{list.name}</h4>
                            <p className="text-sm text-[#7A5D3F] truncate">{list.description}</p>
                          </div>
                          <button 
                            className="p-2 rounded-lg bg-[#B08968]/25 text-[#B08968] active:scale-95 transition-all duration-200"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSaveList(list)
                            }}
                          >
                            <BookmarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-[#7A5D3F]">
                      <BookmarkIcon className="w-12 h-12 mx-auto mb-2 text-[#E8D4C0]" />
                      <p className="font-serif">No lists yet</p>
                    </div>
                  )}
                  <button 
                    className="mt-3 text-[#B08968] text-sm font-medium font-serif"
                    onClick={() => handleSeeAllLists('popular')}
                  >
                    See All
                  </button>
                </div>

                {/* Friends' Lists */}
                <div className="bg-[#fdf6e3]/50 backdrop-blur-sm rounded-xl p-4 border border-[#E8D4C0]/40 shadow-lg relative">
                  {/* Subtle foreground leaf accent */}
                  <img
                    src="/assets/leaf2.png"
                    alt=""
                    className="absolute bottom-2 right-2 w-10 opacity-7 blur-[0.8px] pointer-events-none z-10"
                    style={{ transform: 'rotate(15deg)' }}
                  />
                  <h3 className="text-lg font-serif font-semibold text-[#5D4A2E] mb-3">Friends' Lists</h3>
                  <div className="italic text-[#7A5D3F] font-serif text-sm">This feature is coming soon!</div>
                </div>

                {/* Comments Section */}
                <div className="bg-[#fdf6e3]/50 backdrop-blur-sm rounded-xl p-4 border border-[#E8D4C0]/40 shadow-lg relative">
                  {/* Subtle background leaf accent */}
                  <img
                    src="/assets/leaf.png"
                    alt=""
                    className="absolute top-[-0.5rem] left-[-0.5rem] w-12 opacity-6 blur-[1.4px] pointer-events-none z-0"
                    style={{ transform: 'rotate(-25deg)' }}
                  />
                  <h3 className="text-lg font-serif font-semibold text-[#5D4A2E] mb-4">Comments</h3>
                  <div className="space-y-3 mb-4">
                    {posts.flatMap(post => post.comments).slice(0, 2).map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3 p-3 bg-[#fdf6e3] backdrop-blur-sm rounded-xl shadow-md border border-[#E8D4C0]/40">
                        <img src={comment.userAvatar} alt={comment.username} className="w-10 h-10 rounded-lg object-cover border border-[#E8D4C0] shadow-sm flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-serif font-semibold text-[#5D4A2E] text-sm">{comment.username}</span>
                            <span className="text-xs px-2 py-1 rounded-full bg-[#B08968]/25 text-[#B08968] border border-[#B08968]/35 font-medium">{formatTimestamp(comment.createdAt)}</span>
                          </div>
                          <p className="text-sm text-[#7A5D3F] leading-relaxed">{comment.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    className="w-full p-3 bg-[#fdf6e3] backdrop-blur-sm rounded-xl border border-[#E8D4C0]/40 shadow-md text-[#5D4A2E] font-serif text-sm active:scale-98 transition-all duration-200"
                    onClick={() => {
                      // TODO: This should open a view of all comments for the hub,
                      // which is not currently implemented.
                      console.log('View all comments clicked');
                    }}
                  >
                    View all comments
                  </button>
                </div>
              </div>
            )}

            {tab === 'posts' && (
              <div className="space-y-4 pb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-serif font-semibold text-[#6B5B47]">Posts</h3>
                  <select className="text-sm font-serif bg-transparent text-[#6B5B47]">
                    <option>Sort by Most Liked</option>
                    <option>Sort by Most Recent</option>
                  </select>
                </div>
                {posts.length > 0 ? (
                  posts.map((post) => (
                    <div
                      key={post.id}
                      id={`post-${post.id}`}
                      className="bg-[#fdf6e3]/50 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-[#E4D5C7]/30 cursor-pointer"
                      onClick={() => handlePostClick(post)}
                    >
                      <div className="flex items-start space-x-3 mb-3">
                        <img
                          src={post.userAvatar}
                          alt={post.username}
                          className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-sans font-bold text-sm text-[#5D4A2E]">{post.username}</span>
                          </div>
                          <p className="text-xs text-[#8B7355] font-sans">
                            {formatTimestamp(post.createdAt)}
                          </p>
                        </div>
                      </div>
                      
                      {post.images.length > 0 && (
                        <div className="mb-3 relative overflow-hidden rounded-lg">
                          {post.images.length > 1 ? (
                            <ImageCarousel 
                              images={post.images} 
                              className="h-64"
                            />
                          ) : (
                            <img
                              src={post.images[0]}
                              alt="Post"
                              className="w-full h-64 object-cover rounded-lg shadow-md"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none"></div>
                        </div>
                      )}
                      <p className="text-[#6B5B47] mb-3 leading-relaxed font-sans text-sm">{post.description}</p>
                      
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {post.tags.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-[#E8D4C0]/60 text-[#7A5D3F] text-xs font-semibold rounded-full font-sans">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-[#8B7355]">
                          <button onClick={(e) => handleLikePost(e, post.id)} className="flex items-center space-x-1.5 active:scale-95 transition-transform duration-200 z-20 group">
                            {likedPosts[post.id] ? 
                              <SolidHeartIcon className="w-5 h-5 text-[#FF6B6B]" /> : 
                              <HeartIcon className="w-5 h-5 text-[#A67C52] group-hover:text-[#FF6B6B]" />
                            }
                            <span className="font-sans font-semibold text-sm text-[#A67C52] group-hover:text-[#FF6B6B]">{likeCounts[post.id] || 0}</span>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleOpenComments(post); }} className="flex items-center space-x-1.5 active:scale-95 transition-transform duration-200 text-sm font-medium text-[#A67C52] group">
                            <ChatBubbleLeftIcon className="w-5 h-5 text-[#A67C52] group-hover:text-[#8B7355]" />
                            <span className="font-sans font-semibold text-sm text-[#A67C52] group-hover:text-[#8B7355]">
                              {post.comments?.length || 0}
                            </span>
                          </button>
                        </div>
                        <button onClick={(e) => {
                           e.stopPropagation();
                           setSelectedPostForSave(post);
                           setShowSavePostToListModal(true);
                         }} className="flex items-center space-x-1.5 text-[#A67C52] font-medium font-sans active:scale-95 transition-transform duration-200 group">
                          <BookmarkIcon className="w-5 h-5 text-[#A67C52] group-hover:text-[#8B7355]" />
                           <span className="font-sans font-semibold text-sm text-[#A67C52] group-hover:text-[#8B7355]">Save</span>
                         </button>
                       </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#fdf6e3]/50 backdrop-blur-sm rounded-xl p-8 text-center shadow-lg border border-[#E4D5C7]/30">
                    <CameraIcon className="w-16 h-16 text-[#E4D5C7] mx-auto mb-4" />
                    <p className="text-[#8B7355] mb-2 font-serif">No posts yet</p>
                    <p className="text-sm text-[#8B7355]/80 font-serif">Be the first to share your experience!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {createPortal(modalContent, document.body)}
      

    </>
  )
}

export default HubModal