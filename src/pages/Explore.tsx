import { useState, useEffect } from 'react';
import HubImage from '../components/HubImage';
import { HeartIcon, BookmarkIcon, ShareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import CardShell from '../components/ui/CardShell';
import { StackDeck } from '../components/explore/StackDeck';
import SegmentedTabs from '../components/ui/SegmentedTabs'
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { firebaseDataService } from '../services/firebaseDataService';
import { featureFlags } from '../config/featureFlags';
import type { Place, List, User } from '../types/index.js';

interface ExploreItem {
  id: string;
  type: 'place' | 'list' | 'user';
  title: string;
  description: string;
  image: string;
  location?: string;
  likes?: number;
  isLiked?: boolean;
  distanceKm?: number;
  item: Place | List | User;
}

const Explore = () => {
  const { currentUser } = useAuth();
  const { openHubModal, openListModal, openProfileModal } = useNavigation();
  const [activeTab, setActiveTab] = useState<'nearby' | 'following' | 'discover'>('discover');
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Simple per-tab cache (2 min TTL)
  const cacheRef = (window as any).__exploreCacheRef as React.MutableRefObject<Record<string, { t: number; items: ExploreItem[] }>> || { current: {} } as any;
  ;(window as any).__exploreCacheRef = cacheRef;
  
  // Default to deck if flag is on, otherwise use localStorage preference or "list"
  const [viewMode, setViewMode] = useState<'list' | 'deck'>(() => {
    if (featureFlags.explore_stacks) {
      const saved = localStorage.getItem('exploreMode') as 'list' | 'deck' | null;
      return saved || 'deck';
    }
    return 'list';
  });

  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem('exploreMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!currentUser) return;
    const key = `tab:${activeTab}`;
    const now = Date.now();
    const cached = cacheRef.current[key];
    if (cached && now - cached.t < 2 * 60 * 1000) {
      setItems(cached.items);
      setIsLoading(false);
      return;
    }
    // Try sessionStorage cache for resilience across soft reloads
    try {
      const raw = sessionStorage.getItem(`explore:${key}`);
      if (raw) {
        const { t, v } = JSON.parse(raw);
        if (now - t < 2 * 60 * 1000) {
          setItems(v);
          cacheRef.current[key] = { t, items: v };
          setIsLoading(false);
          return;
        }
      }
    } catch {}
    loadExploreItems();
  }, [currentUser, activeTab]);

  const loadExploreItems = async () => {
    setIsLoading(true);
    try {
      let exploreItems: ExploreItem[] = [];

      if (activeTab === 'nearby') {
        const eff = await firebaseDataService.getEffectiveLocation(currentUser?.id)
        if (eff) {
          const nearby = await firebaseDataService.getBatchedExternalRecommendations(eff.lat, eff.lng, { limit: 20 })
          exploreItems = nearby.map((place: any) => ({
            id: place.id,
            type: 'place' as const,
            title: place.name,
            description: place.address || '',
            image: place.mainImage || '/assets/leaf.png',
            // @ts-ignore
            photoResourceName: (place as any).photoResourceName,
            // @ts-ignore
            types: (place as any).types,
            // @ts-ignore
            photos: (place as any).photos,
            location: place.address,
            likes: place.savedCount || 0,
            isLiked: false,
            item: place
          }))
        }
      } else if (activeTab === 'discover') {
        const internal = await firebaseDataService.getSuggestedPlaces({ limit: 12 })
        const eff = await firebaseDataService.getEffectiveLocation(currentUser?.id)
        let external: any[] = []
        if (eff) external = await firebaseDataService.getBatchedExternalRecommendations(eff.lat, eff.lng, { limit: 12 })
        const merged = [...internal, ...external]
        const seen = new Set<string>()
        const unique = merged.filter((p: any) => {
          const key = (p.id || '') + '|' + (p.name || '')
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        exploreItems = unique.map((place: any) => ({
          id: place.id,
          type: 'place' as const,
          title: place.name,
          description: place.address || '',
          image: place.mainImage || '/assets/leaf.png',
          location: place.address,
          likes: place.savedCount || 0,
          isLiked: false,
          item: place
        }))
      } else {
        // Following branch: show followed users for now
        try {
          if (currentUser?.id) {
            const following = await firebaseDataService.getUserFollowing(currentUser.id)
            exploreItems = (following || []).map((u: any) => ({
              id: u.id,
              type: 'user' as const,
              title: u.name || u.username || 'User',
              description: u.bio || '',
              image: u.avatar || '/assets/leaf.png',
              likes: (u as any).influences || 0,
              isLiked: false,
              item: u as User
            }))
          } else {
            exploreItems = []
          }
        } catch {
          exploreItems = []
        }
      }

      // Compute distance (if we have an effective location and hub coordinates)
      try {
        const eff = await firebaseDataService.getEffectiveLocation(currentUser?.id)
        if (eff) {
          const withDistance = exploreItems.map((it) => {
            const p: any = it.item as any
            const c = p?.coordinates || p?.location || {}
            const lat = typeof c.lat === 'number' ? c.lat : (c.latitude as number | undefined)
            const lng = typeof c.lng === 'number' ? c.lng : (c.longitude as number | undefined)
            if (typeof lat === 'number' && typeof lng === 'number') {
              const km = firebaseDataService.distanceKm({ lat, lng }, { lat: eff.lat, lng: eff.lng })
              return { ...it, distanceKm: km }
            }
            return it
          })
          exploreItems = withDistance
        }
      } catch {}

      setItems(exploreItems)

      // Cache results
      const key = `tab:${activeTab}`
      const now = Date.now()
      cacheRef.current[key] = { t: now, items: exploreItems }
      try { sessionStorage.setItem(`explore:${key}`, JSON.stringify({ t: now, v: exploreItems })) } catch {}
    } catch (error) {
      console.error('Error loading explore items:', error);
      setItems([])
    } finally {
      setIsLoading(false)
    }
  };

  const handleItemClick = (item: ExploreItem) => {
    if (item.type === 'place') {
      openHubModal(item.item as Place, 'explore');
    } else if (item.type === 'list') {
      openListModal(item.item as List, 'explore');
    } else if (item.type === 'user') {
      openProfileModal((item.item as User).id, 'explore');
    }
  };

  const handleLike = (item: ExploreItem) => {
    // Toggle like state
    setItems(prev => prev.map(i => 
      i.id === item.id ? { ...i, isLiked: !i.isLiked, likes: (i.likes || 0) + (i.isLiked ? -1 : 1) } : i
    ));
  };

  const handleSave = (item: ExploreItem) => {
    // Open save modal
    console.log('Save item:', item);
  };

  const handleShare = (item: ExploreItem) => {
    // Open share modal
    console.log('Share item:', item);
  };

  const handleAddPost = (item: ExploreItem) => {
    // Open create post modal
    console.log('Add post for item:', item);
  };

  const handleQuickSave = (item: ExploreItem) => {
    // Quick save to default list
    console.log('Quick save item:', item);
  };

  return (
    <div className="min-h-full sunlight-soft">
      {/* Header */}
      <div className="sticky top-0 z-10 glass p-4 border-b border-white/20 animate-fade-slow">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-serif font-bold text-bark-900">Explore</h1>
          {featureFlags.explore_stacks && (
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'deck' : 'list')}
              className="p-2 icon-btn"
              aria-label={`Switch to ${viewMode === 'list' ? 'deck' : 'list'} view`}
            >
              <div className="w-5 h-5 bg-white/60 rounded-sm" />
            </button>
          )}
        </div>
        
        {/* Segmented Control */}
        <SegmentedTabs
          value={activeTab}
          onChange={(v)=> setActiveTab(v as any)}
          items={[
            { key: 'nearby', label: 'Nearby' },
            { key: 'following', label: 'Following' },
            { key: 'discover', label: 'Discover' },
          ]}
          className="mt-1"
        />
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardShell key={i} variant="glass" className="p-4 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-bark-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-bark-200 rounded w-3/4" />
                    <div className="h-3 bg-bark-200 rounded w-1/2" />
                    <div className="h-3 bg-bark-200 rounded w-2/3" />
                  </div>
                </div>
              </CardShell>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-bark-600">No items found for this section.</p>
          </div>
        ) : viewMode === 'deck' && featureFlags.explore_stacks ? (
          <StackDeck
            items={items}
            onItemClick={handleItemClick}
            onLike={handleLike}
            onSave={handleSave}
            onShare={handleShare}
            onAddPost={handleAddPost}
            onQuickSave={handleQuickSave}
          />
        ) : (
          <div className="space-y-4 animate-slide-up">
            {items.map((item, i) => (
              <CardShell
                key={item.id}
                variant="glass"
                onClick={() => handleItemClick(item)}
                className="p-4 cursor-pointer hover:shadow-soft transition-all duration-200 animate-rise"
                style={{ animationDelay: `${i*40}ms` }}
              >
                <div className="grid grid-rows-[auto,1fr,auto] gap-3">
                  {/* Top row: Image + Title/Meta */}
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0 w-16 h-16 rounded-xl2 overflow-hidden shadow-soft animate-fade-slow">
                      {item.type === 'place' ? (
                        <HubImage
                          // @ts-ignore
                          photos={(item as any).photos}
                          // @ts-ignore
                          primaryType={(item as any).primaryType}
                          alt={item.title}
                          load={false}
                          className="w-full h-full"
                          aspect="aspect-square"
                        />
                      ) : (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-title leading-tight mb-1">
                        {item.title}
                      </h3>
                      {/* Single one-line meta: distance • address */}
                      {(item.location || typeof item.distanceKm === 'number') && (
                        <p className="text-meta text-sm truncate flex items-center gap-2">
                          {typeof item.distanceKm === 'number' && (
                            <span className="badge text-meta">{((item.distanceKm || 0) * 0.621371).toFixed(1)} mi</span>
                          )}
                          <span className="truncate">{item.location}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Middle content - let it expand naturally */}
                  <div className="min-h-0">
                    {/* Empty for now, could show tags or additional info */}
                  </div>
                  
                  {/* Bottom row: Action buttons - aligned baseline */}
                  <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md rounded-full shadow-soft px-3 h-10 hover:brightness-105 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(item);
                      }}
                      className="pill pill--quiet flex items-center gap-1.5"
                      aria-label={item.isLiked ? 'Unlike' : 'Like'}
                    >
                      {item.isLiked ? (
                        <HeartIconSolid className="w-4 h-4 text-red-500" />
                      ) : (
                        <HeartIcon className="w-4 h-4" />
                      )}
                      <span className="text-xs font-medium">{item.likes || 0}</span>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSave(item);
                      }}
                      className="pill pill--quiet"
                      aria-label="Save to list"
                    >
                      <BookmarkIcon className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(item);
                      }}
                      className="pill pill--quiet"
                      aria-label="Share"
                    >
                      <ShareIcon className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddPost(item);
                      }}
                      className="pill pill--quiet"
                      aria-label="Add post"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardShell>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Explore;






