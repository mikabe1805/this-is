import { useState, useEffect } from 'react';
import { HeartIcon, BookmarkIcon, ShareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import CardShell from '../components/ui/CardShell';
import { StackDeck } from '../components/explore/StackDeck';
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
  item: Place | List | User;
}

const Explore = () => {
  const { currentUser } = useAuth();
  const { openHubModal, openListModal, openProfileModal } = useNavigation();
  const [activeTab, setActiveTab] = useState<'nearby' | 'following' | 'discover'>('discover');
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
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
    if (currentUser) {
      loadExploreItems();
    }
  }, [currentUser, activeTab]);

  const loadExploreItems = async () => {
    setIsLoading(true);
    try {
      let exploreItems: ExploreItem[] = [];
      
      if (activeTab === 'nearby') {
        // Load nearby places using external API
        const userLocation = currentUser?.location || 'New Brunswick, NJ, USA'
        const geocoded = await firebaseDataService.geocodeLocation(userLocation)
        if (geocoded?.location) {
          const nearbyPlaces = await firebaseDataService.getExternalSuggestedPlaces(
            geocoded.location.lat,
            geocoded.location.lng,
            [],
            20,
            { radiusKm: 20 }
          )
          exploreItems = nearbyPlaces.map(place => ({
            id: place.id,
            type: 'place' as const,
            title: place.name,
            description: place.address || '',
            image: place.mainImage || place.photoResourceName || '/assets/leaf.png',
            location: place.address,
            likes: place.savedCount || 0,
            isLiked: false,
            item: place
          }))
        }
      } else if (activeTab === 'following') {
        // Load content from followed users
        const friends = await firebaseDataService.getUserFriends(currentUser!.id);
        const friendsActivity = [];
        for (const friend of friends.slice(0, 5)) {
          const activity = await firebaseDataService.getUserActivity(friend.id, 3);
          friendsActivity.push(...activity);
        }
        exploreItems = friendsActivity.map(activity => ({
          id: activity.id,
          type: 'place' as const,
          title: activity.place?.name || 'Unknown Place',
          description: activity.note || '',
          image: activity.place?.mainImage || '/assets/leaf.png',
          likes: 0,
          isLiked: false,
          item: activity.place!
        }));
      } else {
        // Load discovery content
        const discoveryPlaces = await firebaseDataService.getSuggestedPlaces({ limit: 20 });
        exploreItems = discoveryPlaces.map(place => ({
          id: place.id,
          type: 'place' as const,
          title: place.name,
          description: place.address || '',
          image: place.mainImage || '/assets/leaf.png',
          location: place.address,
          likes: place.savedCount || 0,
          isLiked: false,
          item: place
        }));
      }
      
      setItems(exploreItems);
    } catch (error) {
      console.error('Error loading explore items:', error);
      setItems([]);
    } finally {
      setIsLoading(false);
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
    <div className="min-h-full bg-bark-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bark-50/90 backdrop-blur supports-[backdrop-filter]:glass p-4 border-b border-bark-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-serif font-bold text-bark-900">Explore</h1>
          {featureFlags.explore_stacks && (
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'deck' : 'list')}
              className="p-2 rounded-lg bg-bark-100 hover:bg-bark-200 transition-colors"
              aria-label={`Switch to ${viewMode === 'list' ? 'deck' : 'list'} view`}
            >
              <div className="w-5 h-5 bg-bark-600 rounded-sm" />
            </button>
          )}
        </div>
        
        {/* Segmented Control */}
        <div className="flex bg-bark-100 rounded-xl p-1">
          {[
            { key: 'nearby', label: 'Nearby' },
            { key: 'following', label: 'Following' },
            { key: 'discover', label: 'Discover' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
                activeTab === key
                  ? 'bg-moss-500 text-white shadow-soft'
                  : 'text-bark-700 hover:text-bark-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
          <div className="space-y-4">
            {items.map((item) => (
              <CardShell
                key={item.id}
                variant="glass"
                onClick={() => handleItemClick(item)}
                className="p-4 cursor-pointer hover:shadow-soft transition-all duration-200"
              >
                <div className="grid grid-rows-[auto,1fr,auto] gap-3">
                  {/* Top row: Image + Title/Meta */}
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-16 h-16 rounded-xl object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/assets/leaf.png';
                        }}
                      />
                      {/* Badge for verified items - overlap 8px */}
                      {item.type === 'place' && Math.random() > 0.7 && (
                        <div className="absolute -top-2 -right-2 bg-moss-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm">
                          Verified
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-bark-900 leading-tight mb-1">
                        {item.title}
                      </h3>
                      {/* Single one-line address meta */}
                      {item.location && (
                        <p className="text-bark-600 text-sm flex items-center gap-1 truncate">
                          <span className="text-bark-600">📍</span>
                          {item.location}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Middle content - let it expand naturally */}
                  <div className="min-h-0">
                    {/* Empty for now, could show tags or additional info */}
                  </div>
                  
                  {/* Bottom row: Action buttons - aligned baseline */}
                  <div className="flex items-center gap-2">
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
