import type { List, Place, Post } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, XMarkIcon, UserIcon, CalendarIcon, ArrowsPointingOutIcon, ArrowLeftIcon, EllipsisHorizontalIcon, CheckCircleIcon, HandThumbUpIcon, HandThumbDownIcon, MinusCircleIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { useState, useEffect, useRef } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss'
import SearchAndFilter from './SearchAndFilter'
import { createPortal } from 'react-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { firebaseListService } from '../services/firebaseListService';
import { useAuth } from '../contexts/AuthContext.tsx'
import { formatTimestamp } from '../utils/dateUtils.ts'
import ImageCarousel from './ImageCarousel.tsx'
import CommentsModal from './CommentsModal.tsx'
import { firebaseDataService } from '../services/firebaseDataService.js'
import HubImage from './HubImage'
import ListMap from './ListMap'
import TagPill from './TagPill.tsx'

interface ListModalProps {
  list: List
  isOpen: boolean
  onClose: () => void
  onSave?: (list: List) => void
  onShare?: (list: List) => void
  onAddPost?: (list: List) => void
  onOpenFullScreen?: (list: List) => void
  onOpenHub?: (place: Place) => void
  showBackButton?: boolean
  onBack?: () => void
  onLikeChange?: (listId: string, isLiked: boolean, newLikes: number) => void
  onEditList?: (list: List) => void
  onChangePrivacy?: (list: List) => void
  onDeleteList?: (list: List) => void
}

// Editorial status / rating pills — heroicon + label, no emoji.
// Colour palette comes from the design tokens (accent-deep / bloom / ink-mute)
// instead of the bright #FF6B6B etc. to match the rest of the app.
const StatusPill = ({ status }: { status?: 'loved' | 'tried' | 'want' }) => {
  if (!status) return null
  if (status === 'loved') {
    return (
      <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full font-mono text-[10px] tracking-[0.10em] uppercase border" style={{ background: 'rgba(168, 95, 42, 0.10)', color: 'var(--accent-deep)', borderColor: 'rgba(168, 95, 42, 0.25)' }}>
        <HeartIconSolid className="w-3 h-3" />
        Loved
      </span>
    )
  }
  if (status === 'tried') {
    return (
      <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full font-mono text-[10px] tracking-[0.10em] uppercase border bg-paper-deep text-ink border-edge">
        <CheckCircleIcon className="w-3 h-3" />
        Tried
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full font-mono text-[10px] tracking-[0.10em] uppercase border bg-card text-ink-soft border-edge">
      <BookmarkIcon className="w-3 h-3" />
      Want
    </span>
  )
}

const RatingPill = ({ rating }: { rating?: 'liked' | 'neutral' | 'disliked' }) => {
  if (!rating) return null
  const Icon = rating === 'liked' ? HandThumbUpIcon : rating === 'disliked' ? HandThumbDownIcon : MinusCircleIcon
  const label = rating === 'liked' ? 'Liked' : rating === 'disliked' ? 'Disliked' : 'Neutral'
  return (
    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full font-mono text-[10px] tracking-[0.10em] uppercase border bg-card text-ink-mute border-edge">
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

const ListModal = ({ list, isOpen, onClose, onSave, onShare, onAddPost, onOpenFullScreen, onOpenHub, showBackButton, onBack, onLikeChange, onEditList, onChangePrivacy, onDeleteList }: ListModalProps) => {
  const { currentUser } = useAuth()
  const { openPostOverlay, openFullScreenList } = useNavigation()
  const [isLiked, setIsLiked] = useState(false)
  const [likes, setLikes] = useState(list.likes)
  const [isVisible, setIsVisible] = useState(false)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [places, setPlaces] = useState<any[]>([])
  const [subLists, setSubLists] = useState<List[]>([])
  const [creatorName, setCreatorName] = useState<string>('');
  const [showOwnerMenu, setShowOwnerMenu] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  // Local filter/search state (does not affect parent page filters)
  const [modalSearch, setModalSearch] = useState('')
  const [modalSortBy, setModalSortBy] = useState('popular')
  const [modalActiveFilters, setModalActiveFilters] = useState<string[]>([])
  const [modalSelectedTags, setModalSelectedTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])

  useEffect(() => {
    if (currentUser && list) {
      const checkIfSaved = async () => {
        const isSaved = await firebaseDataService.isListSavedByUser(list.id, currentUser.id);
        setIsLiked(isSaved);
      };
      checkIfSaved();
    }
    setLikes(list.likes);
  }, [currentUser, list]);

  useEffect(() => {
    if (isOpen && currentUser) {
      const fetchPostsAndCreator = async () => {
        try {
          const listPosts = await firebaseDataService.getPostsForList(list.id, currentUser.id);
          setPosts(listPosts);

          // Also fetch places saved to this list
          try {
            const listPlaces = await firebaseListService.getPlacesForList(list.id);
            setPlaces(listPlaces);
          } catch (error) {
            console.error('Error fetching places for list:', error);
            setPlaces([]); // Set empty array on error
          }

          // Sub-lists nested into this list (folder-style).
          try {
            const nested = await firebaseDataService.getSubLists(list.id)
            setSubLists(nested)
          } catch (e) {
            console.warn('[list-modal] sub-list fetch failed', e)
            setSubLists([])
          }
          
          if (list.userId) {
            const name = await firebaseDataService.getUserDisplayName(list.userId);
            setCreatorName(name);
          }
          try {
            const tags = await firebaseDataService.getPopularTags(150)
            setAvailableTags(tags)
          } catch {}
        } catch (error) {
          console.error('Error fetching list data:', error);
          setPosts([]);
          setPlaces([]);
        }
      };
      fetchPostsAndCreator();
    } else if (isOpen && !currentUser) {
      // If modal is open but user is not authenticated, just fetch posts
      const fetchPostsOnly = async () => {
        try {
          const listPosts = await firebaseDataService.getPostsForList(list.id);
          setPosts(listPosts);
          setPlaces([]); // No places for unauthenticated users
          
          if (list.userId) {
            const name = await firebaseDataService.getUserDisplayName(list.userId);
            setCreatorName(name);
          }
        } catch (error) {
          console.error('Error fetching list data:', error);
          setPosts([]);
          setPlaces([]);
        }
      };
      fetchPostsOnly();
    }
  }, [isOpen, list, currentUser]);
  
  // Body scroll-lock — refcounted across stacked modals (see useBodyScrollLock).
  useBodyScrollLock(isOpen)
  const sheetRef = useRef<HTMLDivElement>(null)
  useSwipeToDismiss({ ref: sheetRef, onDismiss: onClose, enabled: isOpen })

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is ready for animation
      setTimeout(() => setIsVisible(true), 10)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('#list-modal-owner-menu')) setShowOwnerMenu(false)
    }
    if (showOwnerMenu) document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [showOwnerMenu])

  if (!isOpen) return null

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;

    const newIsLiked = !isLiked;
    const newLikes = newIsLiked ? (likes || 0) + 1 : (likes || 1) - 1;

    // Optimistic update
    setIsLiked(newIsLiked);
    setLikes(newLikes);

    // Update database in the background
    try {
      await firebaseDataService.saveList(list.id, currentUser.id);
      
      // Notify parent component of the change
      if (onLikeChange) {
        onLikeChange(list.id, newIsLiked, newLikes);
      }
    } catch (error) {
      console.error("Failed to like list:", error);
      // Revert UI on failure
      setIsLiked(!newIsLiked);
      setLikes(likes);
    }
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Defer to the parent (NavigationModals) which dispatches the
    // openSaveListToFolder event so the user can nest this list inside one
    // of their own lists. Falls back to the legacy save-as-bookmark only
    // if no onSave handler is wired.
    if (onSave) {
      onSave(list)
      return
    }
    if (currentUser) {
      firebaseDataService.saveList(list.id, currentUser.id)
        .catch((error) => console.error('Failed to save list:', error))
    }
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onShare) {
      onShare(list)
    } else {
      // Fallback share functionality
      if (navigator.share) {
        navigator.share({
          title: list.name,
          text: list.description,
          url: window.location.href
        })
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(window.location.href)
        alert('Link copied to clipboard!')
      }
    }
  }

  const handleAddPost = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onAddPost) {
      onAddPost(list)
    }
  }

  const handleOpenFullScreen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onOpenFullScreen) {
      onOpenFullScreen(list)
    } else {
      // Use navigation context as fallback
      openFullScreenList(list)
    }
  }

  const handlePostClick = (post: Post) => {
    openPostOverlay(post.id);
  };

  const handleCommentsClick = () => {
    setShowCommentsModal(true)
  }

  const handleAddCommentToModal = async (text: string) => {
    // Add comment logic here
    console.log('Adding comment:', text)
  }

  const handleLikeComment = (commentId: string) => {
    // Like comment logic here
    console.log('Liked comment:', commentId)
  }

  const handleReplyToComment = async (commentId: string, text: string) => {
    // Reply to comment logic here
    console.log('Replied to comment:', commentId, text)
  }

  const handleSeeAllLists = (listType: 'popular' | 'friends') => {
    // Navigate to ViewAllLists page with appropriate filters
    window.location.href = `/lists?type=${listType}&hub=${list.id}`
  }

  const modalContent = (
    <div 
      className="modal-overlay fixed inset-0 z-[9998] flex items-center justify-center p-1 bg-black/20 backdrop-blur-md"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={sheetRef}
        className={`modal-container modal-paper w-full max-w-[600px] mx-1 max-h-[88vh] sm:max-h-[92vh] rounded-3xl border border-edge overflow-hidden relative transition-all duration-300 ease-out ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
          boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22), 0 4px 14px rgba(46, 28, 13, 0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative leaf overlays were here — 17 of them, plus radial
            gradients, ambient lighting, grain texture, and warm light leaks.
            All stripped: they fought against the field-guide aesthetic, hurt
            performance (each leaf was a separate <img> with its own blur +
            filter), and were impossible to read against the cover image. The
            paper background + edge border match the rest of the app now. */}

        {/* Header with cover image (or paper-tone fallback) */}
        {/* Header — split into action row + title block. The dark gradient
            overlay is now scoped to ONLY when there's a cover image (was
            firing on bg-paper-deep too, producing a black smear); without
            an image the header is clean paper-deep with ink-on-paper text. */}
        <div data-drag-handle className="relative shrink-0">
          {list.coverImage ? (
            <div className="relative h-40 bg-paper-deep overflow-hidden">
              <img
                src={list.coverImage}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A1815]/55 via-[#1A1815]/15 to-transparent" />
              <ListModalActions
                showBackButton={!!showBackButton}
                onBack={onBack}
                isOwner={currentUser?.id === list.userId}
                onMenu={(e) => { e.stopPropagation(); const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setMenuPos({ top: rect.bottom + 8, left: rect.right - 176 }); setShowOwnerMenu((s) => !s) }}
                onExpand={handleOpenFullScreen}
                onShare={handleShare}
                onClose={onClose}
                tone="dark"
              />
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 z-10">
                <h1 className="font-display text-[28px] leading-tight text-white drop-shadow">
                  {list.name}
                </h1>
                <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-white/85 mt-1 drop-shadow">
                  by {creatorName}
                </p>
              </div>
            </div>
          ) : (
            <div className="px-5 pt-3 pb-4 bg-paper-deep border-b border-edge">
              <div className="relative h-9 mb-3">
                <ListModalActions
                  showBackButton={!!showBackButton}
                  onBack={onBack}
                  isOwner={currentUser?.id === list.userId}
                  onMenu={(e) => { e.stopPropagation(); const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setMenuPos({ top: rect.bottom + 8, left: rect.right - 176 }); setShowOwnerMenu((s) => !s) }}
                  onExpand={handleOpenFullScreen}
                  onShare={handleShare}
                  onClose={onClose}
                  tone="light"
                />
              </div>
              <p className="label-eyebrow text-ink-mute">A list</p>
              <h1 className="font-display text-[28px] leading-tight text-ink mt-1">{list.name}</h1>
              <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute mt-1.5">
                by {creatorName}
              </p>
            </div>
          )}

          {/* Owner action menu — same in both header variants */}
          {showOwnerMenu && createPortal(
            <div id="list-modal-owner-menu" className="fixed z-[100001]" style={{ top: (menuPos?.top || 80), left: (menuPos?.left || (window.innerWidth - 200)) }}>
              <div className="w-44 bg-card rounded-xl border border-edge overflow-hidden" style={{ boxShadow: '0 14px 30px rgba(46,28,13,0.20)' }} onClick={(e)=>e.stopPropagation()}>
                <button type="button" className="w-full text-left px-3 py-2 text-[13px] text-ink hover:bg-paper-deep" onClick={() => { setShowOwnerMenu(false); setTimeout(() => onEditList && onEditList(list), 0) }}>Edit list</button>
                <button type="button" className="w-full text-left px-3 py-2 text-[13px] text-ink hover:bg-paper-deep" onClick={() => { setShowOwnerMenu(false); setTimeout(() => onChangePrivacy && onChangePrivacy(list), 0) }}>Change privacy</button>
                <button type="button" className="w-full text-left px-3 py-2 text-[13px] text-red-700 hover:bg-red-50" onClick={() => { setShowOwnerMenu(false); setTimeout(() => onDeleteList && onDeleteList(list), 0) }}>Delete</button>
              </div>
            </div>, document.body)
          }
        </div>
        
        {/* Content - Mobile-optimized scroll container */}
        <div className="modal-content flex flex-col h-[calc(88vh-12rem)] sm:h-[calc(92vh-12rem)] overflow-y-auto pb-4" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'manipulation' }}>
          {/* Sticky search/filter inside modal content */}
          <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur-md p-3 border-b border-edge">
            <SearchAndFilter
              placeholder="Search within this list..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              sortOptions={[{ key: 'relevance', label: 'Relevance' }, { key: 'popular', label: 'Most Popular' }, { key: 'nearby', label: 'Closest to Location' }]}
              filterOptions={[]}
              availableTags={availableTags}
              sortBy={modalSortBy}
              setSortBy={setModalSortBy}
              activeFilters={modalActiveFilters}
              setActiveFilters={setModalActiveFilters}
              selectedTags={modalSelectedTags}
              setSelectedTags={setModalSelectedTags}
              dropdownPosition="center"
              onSubmitQuery={() => {}}
            />
          </div>
          <div className="p-4 space-y-5 flex-1 pb-6">
          {/* Description card — paper-card on edge border, no decorative leaves
              (the modal-paper layer below already has a soft botanical) */}
            {(list.description || list.createdAt) && (
              <div className="bg-card/85 rounded-2xl p-4 border border-edge">
                {list.description && (
                  <p className="text-[14px] text-ink-soft leading-relaxed whitespace-pre-wrap">
                    {list.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-3 font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute">
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    Created {formatTimestamp(list.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <HeartIcon className="w-3.5 h-3.5" />
                    {likes} {likes === 1 ? 'like' : 'likes'}
                  </span>
                </div>
              </div>
            )}

          {/* Action Buttons — reuse the global CTA glass pill so everything
              looks like one app. Was three near-identical bespoke gradient
              buttons that drifted from the rest of the design system. */}
            <div className="flex gap-2">
            <button
              type="button"
              onClick={handleLike}
              aria-pressed={isLiked}
              aria-label={isLiked ? 'Unlike list' : 'Like list'}
              className="btn-secondary flex-1 h-11 px-3 inline-flex items-center justify-center gap-2 text-[14px] font-medium"
            >
              {isLiked ? (
                <HeartIconSolid className="w-4 h-4" style={{ color: 'var(--bloom-deep)' }} />
              ) : (
                <HeartIcon className="w-4 h-4" />
              )}
              {isLiked ? 'Liked' : 'Like'}
            </button>
            {currentUser?.id === list.userId && (
              <button
                type="button"
                onClick={handleAddPost}
                className="btn-secondary flex-1 h-11 px-3 inline-flex items-center justify-center gap-2 text-[14px] font-medium"
              >
                <PlusIcon className="w-4 h-4" />
                Add Post
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="btn-cta flex-1 h-11 px-3 inline-flex items-center justify-center gap-2 text-[14px] font-semibold"
            >
              <BookmarkIcon className="w-4 h-4" />
              Save
            </button>
          </div>

            {/* Map view — always shown, even when places lack coordinates.
                ListMap handles the empty state itself with the user's pin
                so the map answers "where am I relative to anything?" the
                moment a place gets coords. */}
            {places.length > 0 && (
              <div className="bg-card/85 rounded-2xl p-4 border border-edge">
                <h3 className="font-display text-[20px] leading-tight text-ink mb-3">Map</h3>
                <ListMap
                  places={places as any}
                  height="280px"
                  selectedPlaceId={null}
                  onSelectPlace={(lp) => onOpenHub?.(lp.place)}
                />
                <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-2">
                  Tap a pin to open the place
                </p>
              </div>
            )}

            {/* Sub-lists (folders) nested inside this list */}
            {subLists.length > 0 && (
              <div className="bg-card/85 rounded-2xl p-4 border border-edge">
                <h3 className="font-display text-[20px] leading-tight text-ink mb-3">Folders inside</h3>
                <div className="space-y-2">
                  {subLists.map((sub) => (
                    <button
                      key={`sublist-${sub.id}`}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openFullScreenList(sub) }}
                      className="w-full text-left flex items-center gap-3 p-3 bg-paper rounded-2xl border border-edge active:scale-[0.98] hover:border-ink/30 transition-colors cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-lg bg-paper-deep ring-1 ring-edge flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {sub.coverImage ? (
                          <img src={sub.coverImage} alt={sub.name} className="w-full h-full object-cover" />
                        ) : (
                          <BookmarkIcon className="w-5 h-5 text-ink-mute" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-[16px] leading-tight text-ink truncate">{sub.name}</p>
                        <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-0.5 truncate">
                          {sub.privacy === 'private' ? 'Private' : sub.privacy === 'friends' ? 'Friends only' : 'Public'} · {(sub.hubs?.length || 0)} {sub.hubs?.length === 1 ? 'place' : 'places'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Combined Places and Posts — paper-card matching the description card */}
            <div className="bg-card/85 rounded-2xl p-4 border border-edge">
              <h3 className="font-display text-[20px] leading-tight text-ink mb-3">Places in this list</h3>
              <div className="space-y-3">
                {/* Display saved places first */}
                {places
                  .filter(p => {
                    const q = modalSearch.trim().toLowerCase()
                    if (!q && modalSelectedTags.length === 0) return true
                    const matchesQ = q
                      ? (p.place?.name?.toLowerCase().includes(q) || p.place?.address?.toLowerCase().includes(q) || (p.place?.tags||[]).some((t:string)=>t.toLowerCase().includes(q)))
                      : true
                    const matchesTags = modalSelectedTags.length > 0
                      ? modalSelectedTags.some(t => (p.place?.tags||[]).map((x:string)=>x.toLowerCase()).includes(t.toLowerCase()))
                      : true
                    return matchesQ && matchesTags
                  })
                  .map((place) => (
                  <div
                    key={`place-${place.id}`}
                    onClick={() => onOpenHub?.(place.place)}
                    className="flex items-center gap-3 p-3 bg-paper rounded-2xl border border-edge active:scale-[0.98] hover:border-ink/30 transition-colors cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-paper-deep rounded-lg flex-shrink-0 border border-edge overflow-hidden">
                      <HubImage
                        photos={(place.place as any)?.photos}
                        userImage={(place.place as any)?.mainImage || (place.place as any)?.hubImage || (place.place as any)?.coverImage}
                        primaryType={(place.place as any)?.primaryType}
                        types={(place.place as any)?.types}
                        alt={place.place?.name || 'Place'}
                        aspect=""
                        className="w-full h-full"
                        loadStrategy="load"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-[16px] leading-tight text-ink truncate line-clamp-1">{place.place?.name || 'Unknown Place'}</p>
                      <p className="text-ink-soft text-sm truncate">{place.place?.address || 'No address'}</p>
                      {place.note && (
                        <p className="text-ink-soft text-sm italic mt-1">"{place.note}"</p>
                      )}
                      {/* Status tag for saved places */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <StatusPill status={place.status} />
                        {place.status === 'tried' && place.triedRating && (
                          <RatingPill rating={place.triedRating} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Display posts */}
                {posts
                  .filter(post => {
                    const q = modalSearch.trim().toLowerCase()
                    const matchesQ = q ? ((post.description||'').toLowerCase().includes(q) || (post.tags||[] as any).some((t:string)=>t.toLowerCase().includes(q))) : true
                    const matchesTags = modalSelectedTags.length > 0 ? modalSelectedTags.some(t => ((post.tags||[] as any) as string[]).map(x=>x.toLowerCase()).includes(t.toLowerCase())) : true
                    return matchesQ && matchesTags
                  })
                  .map((post) => (
                  <div
                    key={`post-${post.id}`}
                    onClick={() => handlePostClick(post)}
                    className="flex items-center gap-3 p-3 bg-paper rounded-2xl border border-edge active:scale-[0.98] hover:border-ink/30 transition-colors cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-paper-deep rounded-lg flex-shrink-0 border border-edge overflow-hidden">
                      <img 
                        src={post.images && post.images.length > 0 ? post.images[0] : '/assets/leaf.png'} 
                        alt={post.description} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/assets/leaf.png';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-[16px] leading-tight text-ink truncate line-clamp-1">{post.description}</p>
                      <div className="flex items-center gap-2 text-ink-soft text-sm">
                        <span>by @{post.username || 'Unknown User'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <StatusPill status={post.postType} />
                        {post.postType === 'tried' && post.triedRating && (
                          <RatingPill rating={post.triedRating} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Show empty state if no places or posts */}
                {places.length === 0 && posts.length === 0 && (
                  <div className="text-center py-8 text-ink-soft">
                    <p className="text-sm">No places or posts in this list yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}
      
      {/* Comments Modal */}
      <CommentsModal
        isOpen={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        comments={[]}
        onAddComment={handleAddCommentToModal}
        onLikeComment={handleLikeComment}
        onReplyToComment={handleReplyToComment}
      />
    </>
  )
}

/**
 * Top-of-modal action row — back arrow on the left, owner menu/expand/share/
 * close on the right. Two tones: 'dark' for over-image headers (white icons
 * on a frosted-white pill), 'light' for plain paper headers (ink icons on
 * a paper-deep hover).
 */
function ListModalActions({
  showBackButton,
  onBack,
  isOwner,
  onMenu,
  onExpand,
  onShare,
  onClose,
  tone,
}: {
  showBackButton: boolean
  onBack?: () => void
  isOwner: boolean
  onMenu: (e: React.MouseEvent<HTMLButtonElement>) => void
  onExpand: () => void
  onShare: () => void
  onClose: () => void
  tone: 'dark' | 'light'
}) {
  const dark = tone === 'dark'
  const cls = dark
    ? 'h-9 w-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 flex items-center justify-center'
    : 'h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center'
  const iconCls = dark ? 'w-5 h-5 text-white' : 'w-5 h-5 text-ink'
  return (
    <div className={dark ? 'absolute top-3 left-3 right-3 flex items-center justify-between z-20' : 'absolute inset-0 flex items-center justify-between'}>
      {showBackButton ? (
        <button type="button" onClick={onBack} aria-label="Back" className={cls}>
          <ArrowLeftIcon className={iconCls} />
        </button>
      ) : <div />}
      <div className="flex items-center gap-2">
        {isOwner && (
          <button type="button" onClick={onMenu} aria-label="List actions" className={cls}>
            <EllipsisHorizontalIcon className={iconCls} />
          </button>
        )}
        <button type="button" onClick={onExpand} aria-label="Open full list" className={cls}>
          <ArrowsPointingOutIcon className={iconCls} />
        </button>
        <button type="button" onClick={onShare} aria-label="Share" className={cls}>
          <ShareIcon className={iconCls} />
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className={cls}>
          <XMarkIcon className={iconCls} />
        </button>
      </div>
    </div>
  )
}

export default ListModal
