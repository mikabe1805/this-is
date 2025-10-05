import type { Hub, Post, List } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, CameraIcon, XMarkIcon, ArrowRightIcon, ArrowLeftIcon, ArrowsPointingOutIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { HeartIcon as SolidHeartIcon } from '@heroicons/react/20/solid'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useAuth } from '../contexts/AuthContext.tsx'
import { formatTimestamp } from '../utils/dateUtils.ts'
import ImageCarousel from './ImageCarousel.tsx'
import { firebaseDataService } from '../services/firebaseDataService.ts'
import TagPill from './TagPill'

interface HubModalProps {
  hub: Hub
  isOpen: boolean
  onClose: () => void
  onAddPost?: (hub: Hub) => void
  onSave?: (hub: Hub, savedFromListId?: string) => void
  onShare?: (hub: Hub) => void
  onOpenFullScreen?: (hub: Hub) => void
  showBackButton?: boolean
  onBack?: () => void
  onOpenList?: (list: List) => void
  initialTab?: 'overview' | 'posts'
  initialPostId?: string
  showPostOverlay?: boolean
  savedFromListId?: string
}

const HubModal = ({ hub, isOpen, onClose, onAddPost, onSave, onShare, onOpenFullScreen, showBackButton, onBack, onOpenList, initialTab = 'overview', initialPostId, savedFromListId }: HubModalProps) => {
  const { currentUser } = useAuth();
  const { openListModal, openPostOverlay, openHubModal } = useNavigation()
  const [tab, setTab] = useState<'overview' | 'posts'>('overview')
  const [posts, setPosts] = useState<Post[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [topTags, setTopTags] = useState<string[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [friendsLists, setFriendsLists] = useState<List[]>([]);
  const [sortBy, setSortBy] = useState<'likes' | 'recent'>('likes');
  const isGoogleSuggestion = (hub as any)?.source === 'google'

  useEffect(() => {
    const fetchListsContainingHub = async () => {
      if (hub?.id) {
        const fetchedLists = await firebaseDataService.getListsContainingHub(hub.id);
        // Exclude private lists from Popular Lists section
        setLists(fetchedLists.filter(l => (l as any).privacy === 'public' || (l as any).isPublic === true));
        
        // Also fetch friends' lists if user is logged in
        if (currentUser) {
          const fetchedFriendsLists = await firebaseDataService.getFriendsListsContainingHub(hub.id, currentUser.id);
          setFriendsLists(fetchedFriendsLists);
        }
      }
    };
    if (isOpen) {
      fetchListsContainingHub();
    }
  }, [isOpen, hub, currentUser]);

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
    if (isOpen && hub?.id) {
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
      // Lock background scroll while modal is open
      const prevOverflow = document.body.style.overflow
      const prevPadding = document.body.style.paddingRight
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = 'env(safe-area-inset-right)'
      // Small delay to ensure DOM is ready for animation
      setTimeout(() => setIsVisible(true), 10)
      return () => {
        document.body.style.overflow = prevOverflow
        document.body.style.paddingRight = prevPadding
      }
    } else {
      setIsVisible(false)
    }
  }, [isOpen])
  
  if (!isOpen) {
    console.log('HubModal: Not rendering because isOpen is false')
    return null
  }

  // Safety check for hub data
  if (!hub) {
    console.log('HubModal: Not rendering because hub is undefined')
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
    window.location.href = `/lists?type=${listType}&hub=${hub?.id || ''}`
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

  const handlePostClick = (post: Post) => {
    if (post?.id) {
      openPostOverlay(post.id);
    }
  };

  const handleSavePost = (e: React.MouseEvent, post: Post) => {
    e.stopPropagation();
    if (onSave) {
      // Convert post to hub format for saving
      const hubToSave: Hub = {
        id: post.hubId,
        name: hub?.name || 'Unknown Hub',
        description: hub?.description || '',
        tags: hub?.tags || [],
        images: hub?.images || [],
        location: hub?.location || { address: '', lat: 0, lng: 0 },
        googleMapsUrl: hub?.googleMapsUrl || '',
        mainImage: hub?.mainImage,
        posts: [],
        lists: []
      };
      onSave(hubToSave);
    }
  };

  // Sort posts based on current sort criteria
  const sortedPosts = posts.sort((a, b) => {
    if (sortBy === 'likes') {
      return (b.likes || 0) - (a.likes || 0);
    } else {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

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
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
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
          <img
            src={hub?.mainImage || '/assets/leaf.png'}
            alt={hub?.name || 'Hub'}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/leaf.png' }}
          />
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
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-[1.6rem] sm:text-3xl font-serif font-bold text-[#FAF3E3] drop-shadow-[1px_1px_2px_rgba(255,250,240,0.8)]">{hub?.name || 'Unknown Hub'}</h1>
              {isGoogleSuggestion && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1d4ed8] bg-white/80 px-2 py-1 rounded-full border border-white/60">
                  <SparklesIcon className="w-3 h-3" /> Suggested
                </span>
              )}
            </div>
            <div className="flex items-center text-white/90 text-sm mb-3 drop-shadow-md">
              <MapPinIcon className="w-4 h-4 mr-1.5" />
              {hub?.location?.address || 'No address available'}
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
                href={(function(){
                  const direct = (hub as any)?.googleMapsUrl
                  if (direct) return direct
                  const addr = (hub as any)?.location?.address || (hub as any)?.address
                  const name = (hub as any)?.name
                  if (addr || name) {
                    const q = encodeURIComponent([name, addr].filter(Boolean).join(' '))
                    return `https://www.google.com/maps/search/?api=1&query=${q}`
                  }
                  const placeId = (hub as any)?.placeId
                  if (placeId) return `https://www.google.com/maps/search/?api=1&query=place_id:${placeId}`
                  const lat = (hub as any)?.location?.lat || (hub as any)?.coordinates?.lat
                  const lng = (hub as any)?.location?.lng || (hub as any)?.coordinates?.lng
                  if (typeof lat === 'number' && typeof lng === 'number') {
                    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                  }
                  return '#'
                })()}
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#B08968] to-[#9A7B5A] text-[#FEF6E9] px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#9A7B5A]/30 active:scale-95 transition-all duration-200 backdrop-blur-sm"
              >
                <MapPinIcon className="w-4 h-4" />
                Directions
                <ArrowRightIcon className="w-3 h-3" />
              </a>
              {isGoogleSuggestion ? (
                <button 
                  onClick={async (e) => { 
                    e.stopPropagation(); 
                    try {
                      const coords = (hub as any)?.location ? { lat: (hub as any).location.lat || 0, lng: (hub as any).location.lng || 0 } : { lat: 0, lng: 0 }
                      const hubId = await firebaseDataService.createHub({ name: hub.name, address: (hub as any)?.location?.address || (hub as any)?.address || '', description: '', coordinates: coords })
                      const mapsUrl = coords.lat && coords.lng ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}` : ((hub as any)?.location?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((hub as any).location.address)}` : '')
                      const newHub: any = { ...hub, id: hubId, source: undefined, googleMapsUrl: mapsUrl }
                      onClose()
                      setTimeout(()=> openHubModal(newHub, 'converted-google-suggestion'), 0)
                    } catch (err) { console.error('Create hub from suggestion failed', err) }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#1d4ed8]/30 active:scale-95 transition-all duration-200 backdrop-blur-sm"
                >
                  <PlusIcon className="w-4 h-4" />
                  Create Hub
                </button>
              ) : (
                <button 
                  onClick={(e) => { e.stopPropagation(); onAddPost?.(hub); }}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#D4A574] to-[#B08968] text-[#FEF6E9] px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#B08968]/30 active:scale-95 transition-all duration-200 backdrop-blur-sm"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add Post
                </button>
              )}
              <button 
                onClick={(e) => { e.stopPropagation(); onSave?.(hub, savedFromListId); }}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#C17F59] to-[#B08968] text-[#FEF6E9] px-3 py-3 rounded-xl text-sm font-semibold shadow-lg border border-[#B08968]/30 active:scale-95 transition-all duration-200 backdrop-blur-sm"
              >
                <BookmarkIcon className="w-4 h-4" />
                Save
              </button>
            </div>
            
            {/* Hub Description */}
            {hub?.description && (
              <div className="bg-[#fdf6e3]/50 backdrop-blur-sm rounded-xl p-4 border border-[#E8D4C0]/40 shadow-lg relative">
                {/* Subtle background leaf accent */}
                <img
                  src="/assets/leaf2.png"
                  alt=""
                  className="absolute top-[-0.5rem] right-[-0.5rem] w-12 opacity-6 blur-[1.4px] pointer-events-none z-0"
                  style={{ transform: 'rotate(15deg)' }}
                />
                <h3 className="text-lg font-serif font-semibold text-[#5D4A2E] mb-3">About this place</h3>
                <p className="text-[#7A5D3F] leading-relaxed font-serif text-sm">
                  {hub.description}
                </p>
              </div>
            )}
            
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
                {isGoogleSuggestion && (
                  <div className="bg-white/80 border border-blue-100 text-blue-700 rounded-xl p-3 flex items-start gap-2 shadow-soft">
                    <SparklesIcon className="w-5 h-5 mt-0.5" />
                    <div className="text-sm">
                      This place is suggested from Google. Create a hub to start adding posts, comments, and lists.
                    </div>
                  </div>
                )}
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
                  {friendsLists.length > 0 ? (
                    <div className="space-y-3">
                      {friendsLists.slice(0, 3).map((list) => (
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
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-[#7A5D3F]">
                      <BookmarkIcon className="w-12 h-12 mx-auto mb-2 text-[#E8D4C0]" />
                      <p className="font-serif">No friends' lists yet</p>
                    </div>
                  )}
                  <button 
                    className="mt-3 text-[#B08968] text-sm font-medium font-serif"
                    onClick={() => handleSeeAllLists('friends')}
                  >
                    See All
                  </button>
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
                    {posts.flatMap(post => post?.comments || []).filter(comment => comment).slice(0, 2).map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3 p-3 bg-[#fdf6e3] backdrop-blur-sm rounded-xl shadow-md border border-[#E8D4C0]/40">
                        <img 
                          src={comment?.userAvatar || '/assets/default-avatar.svg'} 
                          alt={comment?.username || 'User'} 
                          className="w-10 h-10 rounded-lg object-cover border border-[#E8D4C0] shadow-sm flex-shrink-0" 
                          onError={(e) => {
                            e.currentTarget.src = '/assets/default-avatar.svg';
                          }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-serif font-semibold text-[#5D4A2E] text-sm">{comment?.username || 'Anonymous'}</span>
                            <span className="text-xs px-2 py-1 rounded-full bg-[#B08968]/25 text-[#B08968] border border-[#B08968]/35 font-medium">{formatTimestamp(comment?.createdAt)}</span>
                          </div>
                          <p className="text-sm text-[#7A5D3F] leading-relaxed">{comment?.text || ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    className="w-full p-3 bg-[#fdf6e3] backdrop-blur-sm rounded-xl border border-[#E8D4C0]/40 shadow-md text-[#5D4A2E] font-serif text-sm active:scale-98 transition-all duration-200"
                    onClick={() => {
                      // Show all comments in a simple alert for now
                      const allComments = posts.flatMap(post => post?.comments || []).filter(comment => comment);
                      if (allComments.length === 0) {
                        alert('No comments yet for this hub.');
                      } else {
                        const commentsText = allComments.map(comment => 
                          `${comment.username || 'Anonymous'}: ${comment.text}`
                        ).join('\n\n');
                        alert(`All Comments for ${hub?.name || 'this hub'}:\n\n${commentsText}`);
                      }
                    }}
                  >
                    View all comments ({posts.flatMap(post => post?.comments || []).filter(comment => comment).length})
                  </button>
                </div>
              </div>
            )}

            {tab === 'posts' && (
              <div className="space-y-4 pb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-serif font-semibold text-[#6B5B47]">Posts</h3>
                  <select 
                    className="text-sm font-serif bg-transparent text-[#6B5B47] border border-[#E8D4C0] rounded-lg px-2 py-1"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'likes' | 'recent')}
                  >
                    <option value="likes">Sort by Most Liked</option>
                    <option value="recent">Sort by Most Recent</option>
                  </select>
                </div>
                {posts && posts.length > 0 ? (
                  sortedPosts.filter(post => post).map((post) => (
                    <div
                      key={post.id}
                      id={`post-${post.id}`}
                      className="bg-[#fdf6e3]/50 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-[#E4D5C7]/30 cursor-pointer"
                      onClick={() => handlePostClick(post)}
                    >
                      <div className="flex items-start space-x-3 mb-3">
                        <img
                          src={post?.userAvatar || '/assets/default-avatar.svg'}
                          alt={post?.username || 'User'}
                          className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                          onError={(e) => {
                            e.currentTarget.src = '/assets/default-avatar.svg';
                          }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-sans font-bold text-sm text-[#5D4A2E]">{post?.username || 'Anonymous'}</span>
                          </div>
                          <p className="text-xs text-[#8B7355] font-sans">
                            {formatTimestamp(post?.createdAt)}
                          </p>
                        </div>
                      </div>
                      
                      {post?.images && post.images.length > 0 && (
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
                      <p className="text-[#6B5B47] mb-3 leading-relaxed font-sans text-sm">{post?.description || ''}</p>
                      
                      {post?.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {post.tags.map(tag => (
                            <TagPill key={tag} label={tag} size="sm" />
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
                        </div>
                        <button onClick={(e) => handleSavePost(e, post)} className="flex items-center space-x-1.5 text-[#A67C52] font-medium font-sans active:scale-95 transition-transform duration-200 group">
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
