import { useState, useEffect } from 'react';
import { MapIcon, BookmarkIcon, UserIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useLocation } from 'react-router-dom';
import AdvancedFiltersDrawer from '../components/AdvancedFiltersDrawer';
import SearchAndFilter from '../components/SearchAndFilter';
import type { Hub, Place, List, User } from '../types/index.js';
import { useNavigation } from '../contexts/NavigationContext.tsx';
import ImageCarousel from '../components/ImageCarousel';
import { useSearch } from '../hooks/useSearch';
import { useAuth } from '../contexts/AuthContext';
import { firebaseDataService } from '../services/firebaseDataService';
import Card from '../components/Card';
import TagPill from '../components/TagPill';
import CreateHubModal from '../components/CreateHubModal';
import QuickViewModal from '../components/QuickViewModal';
import SaveModal from '../components/SaveModal';

const Search = () => {
  const { openHubModal, openListModal, openProfileModal } = useNavigation();
  const { currentUser } = useAuth();
  const location = useLocation();
  // const navigate = useNavigate();
  const {
    searchQuery,
    setSearchQuery,
    displayResults,
    isSearching,
    error,
    performSearch,
    contextLoading
  } = useSearch();

  // Focus the search scopes to reduce overload
  const [activeFilter, setActiveFilter] = useState<'places' | 'lists' | 'users'>('places');
  const [showSearchHistory, setShowSearchHistory] = useState(true);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchTimeoutId, setSearchTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [sortBy, setSortBy] = useState('relevant');
  // Start with fewer noisy filters by default
  const [activeFilters, setActiveFiltersState] = useState<string[]>([]);
  const [recentFinds, setRecentFinds] = useState<{ type: 'place' | 'list' | 'user', item: any, timestamp: Date }[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [recommendedHubs, setRecommendedHubs] = useState<Place[]>([]);
  const [externalHubs, setExternalHubs] = useState<Place[]>([]);
  const [googleQueryHubs, setGoogleQueryHubs] = useState<Place[]>([]);
  const [usedLocation, setUsedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestedTag, setSuggestedTag] = useState<string | null>(null);
  const [recsRefreshTick, setRecsRefreshTick] = useState(0);
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await firebaseDataService.getPopularTags(200);
        setAvailableTags(tags);
      } catch {
        setAvailableTags(['cozy','trendy','quiet','local','charming','authentic','chill']);
      }
    };
    loadTags();
  }, []);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCreateHubModal, setShowCreateHubModal] = useState(false);
  const [createHubSeed, setCreateHubSeed] = useState<any>(null);
  const [quickView, setQuickView] = useState<{ title: string; subtitle?: string; image?: string; meta?: string; type: 'place' | 'external_place' | 'list' | 'user'; place?: any; list?: any; user?: any } | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [userOwnedLists, setUserOwnedLists] = useState<List[]>([]);

  useEffect(() => {
    const loadLists = async () => {
      try {
        if (!currentUser) return;
        const lists = await firebaseDataService.getUserLists(currentUser.id);
        setUserOwnedLists(Array.isArray(lists) ? lists.filter((l:any)=> l.userId === currentUser.id) : []);
      } catch { setUserOwnedLists([]) }
    };
    loadLists();
  }, [currentUser]);

  // Normalize external tags (Google) to friendly app tags and filter out generic ones
  const normalizeExternalTags = (rawTags: string[] = []): string[] => {
    const EXCLUDED = new Set([
      'point_of_interest','establishment','food','store','atm','finance','health','place_of_worship','political','postal_code',
      'postal_town','route','street_address','locality','sublocality','premise','plus_code','general_contractor'
    ])
    const MAP: Record<string,string> = {
      cafe: 'coffee', coffee_shop: 'coffee', bakery: 'bakery', bar: 'bar', restaurant: 'restaurant',
      park: 'park', museum: 'museum', art_gallery: 'art', book_store: 'books', library: 'library',
      movie_theater: 'movies', night_club: 'nightlife', shopping_mall: 'shopping', clothing_store: 'fashion',
      gym: 'fitness', spa: 'spa', beach: 'beach', tourist_attraction: 'attraction', music_venue: 'music',
      ice_cream_shop: 'ice cream', amusement_park: 'amusement', aquarium: 'aquarium', zoo: 'zoo'
    }
    const cleaned = rawTags
      .map(t => String(t || '').toLowerCase())
      .filter(t => !!t && !EXCLUDED.has(t))
      .map(t => MAP[t] || t.replace(/_/g, ' '))
    const seen = new Set<string>()
    const out: string[] = []
    for (const t of cleaned) { const k = t.trim(); if (!seen.has(k)) { seen.add(k); out.push(k) } }
    return out.slice(0, 6)
  }

  const isExternalPlace = (obj: any): boolean => !!(obj && (obj.source === 'google' || obj.googlePlaceId || obj.provider === 'google'))

  const distanceFromUserKm = (lat?: number, lng?: number): number | null => {
    if (!usedLocation || typeof lat !== 'number' || typeof lng !== 'number') return null
    const toRad = (v:number)=> v*Math.PI/180
    const R = 6371
    const dLat = toRad(lat - usedLocation.lat)
    const dLon = toRad(lng - usedLocation.lng)
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(usedLocation.lat)) * Math.cos(toRad(lat)) * Math.sin(dLon/2)**2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Lightweight hub recommendations when query is empty
  useEffect(() => {
    const loadRecommended = async () => {
      try {
        const prefs = currentUser ? await firebaseDataService.getUserPreferences(currentUser.id) : null;
        const tags = prefs?.favoriteCategories?.slice(0, 6) || availableTags.slice(0, 6);
        // Try to determine a location: prefs.homeLocation -> geolocation -> profile.location geocoded
        let loc: { lat: number; lng: number } | null = usedLocation || null;
        try { if (typeof (prefs as any)?.homeLocation === 'object') loc = (prefs as any).homeLocation; } catch {}
        if (!loc && 'geolocation' in navigator) {
          await new Promise<void>(resolve => navigator.geolocation.getCurrentPosition(p => { loc = { lat: p.coords.latitude, lng: p.coords.longitude }; resolve(); }, () => resolve(), { timeout: 4000 }));
        }
        if (!loc && currentUser) {
          try {
            const profile = await firebaseDataService.getCurrentUser(currentUser.id);
            const locStr = (profile as any)?.location;
            if (typeof locStr === 'string' && locStr.trim().length > 0) {
              const geo = await firebaseDataService.geocodeLocation(locStr.trim());
              if (geo) loc = { lat: geo.lat, lng: geo.lng };
            }
          } catch {}
        }

        // Internal recs
        let recs = await firebaseDataService.getSuggestedPlaces({ tags, limit: 32 });
        // Filter internal by proximity when we have a location
        if (loc) {
          const radiusKmPref = (prefs as any)?.locationPreferences?.nearbyRadius;
          const radiusKm = typeof radiusKmPref === 'number' && radiusKmPref > 0 ? Math.min(radiusKmPref * 1.60934, 120) : 80;
          recs = recs.filter(p => {
            const plat = (p as any)?.coordinates?.lat;
            const plng = (p as any)?.coordinates?.lng;
            if (typeof plat !== 'number' || typeof plng !== 'number') return false;
            const d = Math.hypot(plat - loc!.lat, plng - loc!.lng) * 111;
            return d <= radiusKm;
          });
          // Sort by proximity
          recs = recs.sort((a,b)=>{
            const aLat = (a as any)?.coordinates?.lat, aLng = (a as any)?.coordinates?.lng;
            const bLat = (b as any)?.coordinates?.lat, bLng = (b as any)?.coordinates?.lng;
            const da = Math.hypot((aLat||0) - loc!.lat, (aLng||0) - loc!.lng);
            const db = Math.hypot((bLat||0) - loc!.lat, (bLng||0) - loc!.lng);
            return da - db;
          })
        }
        setRecommendedHubs((recs || []).slice(0, 12));

        // If still thin, fetch external Google suggestions and filter by radius
        if ((recs?.length || 0) < 6 && loc) {
          const radiusKmPref = (prefs as any)?.locationPreferences?.nearbyRadius;
          const radiusKm = typeof radiusKmPref === 'number' && radiusKmPref > 0 ? Math.min(radiusKmPref * 1.60934, 120) : 50;
          const ext = await firebaseDataService.getExternalSuggestedPlaces(loc.lat, loc.lng, tags, 12, { radiusKm, openNow: false });
          setExternalHubs(ext || []);
        } else {
          setExternalHubs([]);
        }

        setUsedLocation(loc);

        // Compute a simple auto-suggest tag from shown items if not in user's tags
        try {
          const items = [...(recs || []), ...externalHubs].slice(0, 16);
          const freq: Record<string, number> = {};
          items.forEach(p => normalizeExternalTags((p as any).tags || []).forEach(t => { const k = t.toLowerCase(); freq[k] = (freq[k] || 0) + 1; }));
          const ranked = Object.entries(freq).filter(([k]) => k && k.length >= 3)
            .sort((a,b)=> b[1]-a[1]);
          const top = ranked[0]?.[0];
          if (top && prefs && !(prefs as any)?.userTags?.map((x:string)=>x.toLowerCase()).includes(top.toLowerCase())) {
            setSuggestedTag(top);
          } else {
            setSuggestedTag(null);
          }
        } catch { setSuggestedTag(null); }
      } catch {
        setRecommendedHubs([]); setExternalHubs([]);
      }
    };
    if (!searchQuery.trim()) loadRecommended();
  }, [searchQuery, currentUser, availableTags, recsRefreshTick, usedLocation]);

  // Load Google recommendations tied to the current query when internal matches are sparse
  useEffect(() => {
    const fetchGoogleForQuery = async () => {
      try {
        if (isSearching) return;
        const q = searchQuery.trim();
        if (!q) { setGoogleQueryHubs([]); return; }
        const internalPlaces = Array.isArray((displayResults as any)?.places) ? (displayResults as any).places as Place[] : [];
        if ((internalPlaces?.length || 0) >= 8) { setGoogleQueryHubs([]); return; }

        // Resolve location (prefer already resolved)
        let loc = usedLocation;
        if (!loc && 'geolocation' in navigator) {
          await new Promise<void>(resolve => navigator.geolocation.getCurrentPosition(p => { loc = { lat: p.coords.latitude, lng: p.coords.longitude }; resolve(); }, () => resolve(), { timeout: 4000 }));
        }
        if (!loc && currentUser) {
          try {
            const profile = await firebaseDataService.getCurrentUser(currentUser.id);
            const locStr = (profile as any)?.location;
            if (typeof locStr === 'string' && locStr.trim().length > 0) {
              const geo = await firebaseDataService.geocodeLocation(locStr.trim());
              if (geo) loc = { lat: geo.lat, lng: geo.lng };
            }
          } catch {}
        }
        if (!loc) { setGoogleQueryHubs([]); return; }

        // Build tags from the query tokens (simple split)
        const tokens = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
        const radiusKm = 50;
        const ext = await firebaseDataService.getExternalSuggestedPlaces(loc.lat, loc.lng, tokens, 12, { radiusKm, openNow: false });

        // De-duplicate vs internal places
        const keyFor = (p: any) => `${String(p.name||'').toLowerCase()}|${String(p.address||'').toLowerCase()}`;
        const coordKey = (p: any) => (p.coordinates && typeof p.coordinates.lat==='number' && typeof p.coordinates.lng==='number') ? `${p.coordinates.lat.toFixed(5)},${p.coordinates.lng.toFixed(5)}` : '';
        const seenComposite = new Set([
          ...internalPlaces.map(p => keyFor(p as any)),
          ...internalPlaces.map(p => coordKey(p as any)).filter(Boolean)
        ]);
        let filtered = (ext||[]).filter(p => !seenComposite.has(keyFor(p)) && (!coordKey(p) || !seenComposite.has(coordKey(p))));
        // Enforce radius and coordinates requirement
        filtered = filtered.filter(p => typeof (p as any)?.coordinates?.lat === 'number' && typeof (p as any)?.coordinates?.lng === 'number');
        filtered = filtered.filter(p => {
          const plat = (p as any).coordinates.lat, plng = (p as any).coordinates.lng;
          const d = Math.hypot(plat - loc!.lat, plng - loc!.lng) * 111;
          return d <= radiusKm;
        }).slice(0, 8);
        setGoogleQueryHubs(filtered);
      } catch {
        setGoogleQueryHubs([]);
      }
    };
    fetchGoogleForQuery();
  }, [searchQuery, isSearching, displayResults, usedLocation]);

  // Load recent searches from user preferences
  useEffect(() => {
    const loadRecentSearches = async () => {
      if (currentUser) {
        try {
          const preferences = await firebaseDataService.getUserPreferences(currentUser.id);
          setSearchHistory(preferences.interactionHistory.searchHistory || []);
        } catch (error) {
          console.error('Error loading recent searches:', error);
        }
      }
    };
    loadRecentSearches();
  }, [currentUser]);

  // Handle URL parameters for tag filtering
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const qParam = urlParams.get('q');
    const tagParam = urlParams.get('tag');
    if (qParam && qParam.trim()) {
      setSearchQuery(qParam);
      performSearch(qParam, { sortBy, tags: activeFilters });
      setShowSearchHistory(false);
    } else if (tagParam) {
      setActiveFiltersState([tagParam]);
      // Perform an empty search with the tag filter
      performSearch('', { sortBy, tags: [tagParam] });
    }
  }, [location.search, performSearch, sortBy]);


  useEffect(() => {
    if (searchTimeoutId) clearTimeout(searchTimeoutId);
    if (searchQuery.trim()) {
      setSearchTimeoutId(setTimeout(() => performSearch(searchQuery, { sortBy, tags: activeFilters }), 500));
    }
  }, [activeFilters, sortBy]);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (searchTimeoutId) clearTimeout(searchTimeoutId);
    if (!value.trim()) {
      setShowSearchHistory(true);
    } else {
      setShowSearchHistory(false);
      setSearchTimeoutId(setTimeout(() => performSearch(value, { sortBy, tags: activeFilters }), 500));
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeoutId) clearTimeout(searchTimeoutId);
    if (searchQuery.trim()) {
      // Update local search history
      if (!searchHistory.includes(searchQuery)) {
        const newHistory = [searchQuery, ...searchHistory.slice(0, 9)];
        setSearchHistory(newHistory);
      }
      
      performSearch(searchQuery, { sortBy, tags: activeFilters });
    }
  };
  
  const handlePlaceClick = (place: Place) => {
    // Track the interaction
    if (currentUser) {
      firebaseDataService.trackUserInteraction(currentUser.id, 'visit', { placeId: place.id });
    }
    
    // Add to recent finds (prevent duplicates)
    const newFind = { type: 'place' as const, item: place, timestamp: new Date() };
    setRecentFinds(prev => {
      // Remove existing item if it exists
      const filtered = prev.filter(find => !(find.type === 'place' && find.item.id === place.id));
      // Add new item at the beginning
      return [newFind, ...filtered.slice(0, 9)];
    });
    
    // Save to search history
    if (currentUser && searchQuery.trim()) {
      const newHistory = [searchQuery, ...searchHistory.filter(q => q !== searchQuery)].slice(0, 10);
      setSearchHistory(newHistory);
      // Save to Firebase
      firebaseDataService.getUserPreferences(currentUser.id).then(preferences => {
        const updatedPreferences = {
          ...preferences,
          interactionHistory: {
            ...preferences.interactionHistory,
            searchHistory: newHistory
          }
        };
        firebaseDataService.saveUserPreferences(currentUser.id, updatedPreferences);
      });
    }
    
    const hub: Hub = { id: place.id, name: place.name, description: ``, tags: place.tags, images: [], location: { address: place.address, lat: 0, lng: 0 }, googleMapsUrl: '', mainImage: '', posts: [], lists: [] };
    openHubModal(hub, 'search');
  };

  const handleListClick = (list: List) => {
    // Track the interaction
    if (currentUser) {
      firebaseDataService.trackUserInteraction(currentUser.id, 'visit', { listId: list.id });
    }
    
    // Add to recent finds (prevent duplicates)
    const newFind = { type: 'list' as const, item: list, timestamp: new Date() };
    setRecentFinds(prev => {
      // Remove existing item if it exists
      const filtered = prev.filter(find => !(find.type === 'list' && find.item.id === list.id));
      // Add new item at the beginning
      return [newFind, ...filtered.slice(0, 9)];
    });
    
    // Save to search history
    if (currentUser && searchQuery.trim()) {
      const newHistory = [searchQuery, ...searchHistory.filter(q => q !== searchQuery)].slice(0, 10);
      setSearchHistory(newHistory);
      // Save to Firebase
      firebaseDataService.getUserPreferences(currentUser.id).then(preferences => {
        const updatedPreferences = {
          ...preferences,
          interactionHistory: {
            ...preferences.interactionHistory,
            searchHistory: newHistory
          }
        };
        firebaseDataService.saveUserPreferences(currentUser.id, updatedPreferences);
      });
    }
    
    openListModal(list, 'search');
  };
  
  const handleUserClick = (user: User) => {
    // Track the interaction
    if (currentUser) {
      firebaseDataService.trackUserInteraction(currentUser.id, 'visit', { userId: user.id });
    }
    
    // Add to recent finds (prevent duplicates)
    const newFind = { type: 'user' as const, item: user, timestamp: new Date() };
    setRecentFinds(prev => {
      // Remove existing item if it exists
      const filtered = prev.filter(find => !(find.type === 'user' && find.item.id === user.id));
      // Add new item at the beginning
      return [newFind, ...filtered.slice(0, 9)];
    });
    
    // Save to search history
    if (currentUser && searchQuery.trim()) {
      const newHistory = [searchQuery, ...searchHistory.filter(q => q !== searchQuery)].slice(0, 10);
      setSearchHistory(newHistory);
      // Save to Firebase
      firebaseDataService.getUserPreferences(currentUser.id).then(preferences => {
        const updatedPreferences = {
          ...preferences,
          interactionHistory: {
            ...preferences.interactionHistory,
            searchHistory: newHistory
          }
        };
        firebaseDataService.saveUserPreferences(currentUser.id, updatedPreferences);
      });
    }
    
    openProfileModal(user.id, 'search');
  };


  if (contextLoading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <>
    <div className="relative min-h-full overflow-x-hidden bg-surface">
      <div className="relative z-10 bg-white border-b px-5 py-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
          <SearchAndFilter 
            placeholder="Search..." 
            value={searchQuery} 
            onChange={handleSearchInputChange} 
            onFocus={() => !searchQuery && setShowSearchHistory(true)} 
            sortOptions={[
              { key: 'relevant', label: 'Most Relevant' },
              { key: 'popular', label: 'Most Popular' },
              { key: 'friends', label: 'Most Liked by Friends' },
              { key: 'nearby', label: 'Closest to Location' },
            ]}
            filterOptions={[]}
            availableTags={availableTags}
            sortBy={sortBy}
            setSortBy={setSortBy}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFiltersState}
            filterCount={activeFilters.length}
            onApplyFilters={() => performSearch(searchQuery, { sortBy, tags: activeFilters })}
            onOpenAdvanced={() => setShowAdvanced(true)}
          />
          <button type="button" onClick={() => console.log('Map view - coming soon!')} className="btn-primary text-sm">
            <MapIcon className="w-4 h-4" /><span>Map</span>
          </button>
        </form>
        {/* Quick tags row for discovery without clutter */}
        {availableTags.length > 0 && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {availableTags.slice(0, 12).map((t) => (
              <TagPill
                key={`quick-${t}`}
                label={t}
                size="sm"
                selected={activeFilters.includes(t)}
                onClick={() => {
                  setActiveFiltersState(prev => {
                    const next = prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                    if (searchQuery.trim()) {
                      performSearch(searchQuery, { sortBy, tags: next })
                    }
                    return next
                  })
                }}
              />
            ))}
          </div>
        )}
      </div>
      <AdvancedFiltersDrawer isOpen={showAdvanced} onClose={()=>setShowAdvanced(false)} onApply={()=>{ if (searchQuery.trim()) performSearch(searchQuery, { sortBy, tags: activeFilters }); }} />

      <div className="relative z-10 p-4 max-w-2xl mx-auto">
        {/* Active filters row */}
        {activeFilters.length > 0 && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            {activeFilters.map((t) => (
              <TagPill
                key={`active-${t}`}
                label={t}
                size="sm"
                selected
                removable
                onRemove={() => setActiveFiltersState(prev => prev.filter(x => x !== t))}
                onClick={() => setActiveFiltersState(prev => prev.filter(x => x !== t))}
              />
            ))}
            <button className="btn-secondary btn-sm" onClick={() => setActiveFiltersState([])}>Clear</button>
          </div>
        )}
        {isSearching ? (
          <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-moss-600 mx-auto"></div><p className="mt-2">Searching...</p></div>
        ) : (
          <>
            {!searchQuery.trim() && (recommendedHubs.length > 0 || externalHubs.length > 0) && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <SparklesIcon className="w-5 h-5 text-sage-600" />
                  <h3 className="text-lg font-serif font-semibold text-charcoal-800">Recommended hubs for you</h3>
                </div>
                {!usedLocation && (
                  <div className="mb-3 text-sm text-charcoal-600">
                    Improve recommendations by using your location.
                    <button
                      className="ml-2 btn-secondary btn-sm"
                      onClick={async () => {
                        try {
                          if ('geolocation' in navigator) {
                            await new Promise<void>((resolve) => navigator.geolocation.getCurrentPosition(
                              async (p) => { setUsedLocation({ lat: p.coords.latitude, lng: p.coords.longitude }); resolve(); },
                              () => resolve(),
                              { timeout: 5000 }
                            ));
                            setRecsRefreshTick(t=>t+1)
                          }
                        } catch {}
                      }}
                    >Use my location</button>
                  </div>
                )}
                {suggestedTag && currentUser && (
                  <div className="mb-3 text-sm flex items-center gap-2 bg-linen-50 border border-linen-200 rounded-xl p-2">
                    <span>You often like “{suggestedTag}”.</span>
                    <button
                      className="px-3 py-1.5 rounded-full bg-gold-100 text-gold-700 hover:bg-gold-200 border border-gold-200"
                      onClick={async () => {
                        try {
                          const prefs = await firebaseDataService.getUserPreferences(currentUser!.id);
                          const userTags = Array.isArray((prefs as any)?.userTags) ? (prefs as any).userTags as string[] : []
                          const next = [...new Set([...userTags, suggestedTag!])]
                          await firebaseDataService.updateUserTags(currentUser!.id, next)
                          setSuggestedTag(null)
                        } catch {}
                      }}
                    >Add {suggestedTag} to my tags</button>
                  </div>
                )}
                <div className="space-y-2">
                  {isSearching ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_,i)=> (
                        <div key={i} className="p-4 rounded-xl border border-linen-200 bg-white animate-pulse">
                          <div className="flex items-start gap-3">
                            <div className="w-14 h-14 rounded-lg bg-linen-200" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-linen-200 rounded w-1/2" />
                              <div className="h-3 bg-linen-200 rounded w-2/3" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (() => {
                    const items = [...recommendedHubs, ...externalHubs]
                    const loc = usedLocation
                    const within = (p: any) => {
                      if (!loc) return true
                      const plat = p?.coordinates?.lat, plng = p?.coordinates?.lng
                      if (typeof plat !== 'number' || typeof plng !== 'number') return false
                      const d = Math.hypot(plat - loc.lat, plng - loc.lng) * 111
                      const maxKm =  (/* default */ 80)
                      return d <= maxKm
                    }
                    return items.filter(within).map(p => (
                    <Card key={p.id} className="p-4" interactive onClick={()=>{
                      const isExternal = ((p as any).source === 'google');
                      const d = distanceFromUserKm((p as any)?.coordinates?.lat, (p as any)?.coordinates?.lng)
                      const metaLine = [
                        (p.tags||[]).slice(0,2).map((t:string)=>`#${t}`).join(' '),
                        typeof d === 'number' ? `${d < 1 ? (d*1000).toFixed(0)+' m' : d.toFixed(1)+' km'}` : ''
                      ].filter(Boolean).join(' · ')
                      setQuickView({ title: p.name, subtitle: (p as any).address, image: (p as any).mainImage, meta: metaLine, type: isExternal ? 'external_place' : 'place', place: p })
                    }}>
                      <div className="flex items-start gap-3">
                        <img src={(p as any).mainImage || '/assets/leaf.png'} alt={p.name} className="w-14 h-14 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-charcoal-800 truncate">{p.name}</h4>
                            <span className="text-xs text-charcoal-500">{(p.tags||[]).slice(0,2).map(t=>`#${t}`).join(' ')}</span>
                          </div>
                          <div className="text-sm text-charcoal-600 line-clamp-1">{p.address}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-3">
                        <button onClick={() => handlePlaceClick(p)} className="btn-primary text-sm">View</button>
                        {currentUser && (
                          <button onClick={async (e) => { e.stopPropagation(); await firebaseDataService.markPlaceNotInterested(currentUser.id, p.id); setRecommendedHubs(prev=>prev.filter(x=>x.id!==p.id)); setExternalHubs(prev=>prev.filter(x=>x.id!==p.id)); }} className="btn-secondary text-sm">Not interested</button>
                        )}
                      </div>
                    </Card>
                    ))
                  })()}
                </div>
              </div>
            )}
            {showSearchHistory ? (
              <div>
                <h3 className="text-cozy-title mb-3">Recent Searches</h3>
                <div className="space-y-1">
                  {searchHistory.map(q => (
                    <button
                      key={q}
                      onClick={() => { setSearchQuery(q); performSearch(q); setShowSearchHistory(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white border border-linen-200 hover:bg-linen-50 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center bg-white rounded-xl p-1 border">
                  {(['places', 'lists', 'users'] as const).map(filter => {
                    const placeCount = (displayResults.places || []).length
                    const listCount = (displayResults.lists || []).length
                    const userCount = (displayResults.users || []).length
                    const label = filter === 'places' ? `Places (${placeCount})` : filter === 'lists' ? `Lists (${listCount})` : `People (${userCount})`
                    return (
                      <button key={filter} onClick={() => setActiveFilter(filter)} className={`flex-1 py-2 px-3 text-sm font-medium rounded-xl ${activeFilter === filter ? 'bg-sage-600 text-white' : ''}`}>
                        {label}
                      </button>
                    )
                  })}
                </div>

                {/* Google results for the current query (after results header/tabs) */}
                {searchQuery.trim() && (
                  <div className="my-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-serif font-semibold" style={{ color: '#2563eb' }}>Recommended from Google</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {(isSearching ? Array.from({ length: 6 }).map((_,i)=> (
                        <div key={`sk-${i}`} className="relative w-full rounded-2xl border border-linen-200 overflow-hidden bg-white animate-pulse">
                          <div className="w-full h-36 bg-linen-200" />
                          <div className="p-4">
                            <div className="h-4 bg-linen-200 rounded w-2/3 mb-2" />
                            <div className="h-3 bg-linen-200 rounded w-1/2" />
                          </div>
                        </div>
                      )) : (
                        googleQueryHubs
                        .filter(it => (activeFilters.length === 0) || (Array.isArray((it as any).tags) && (it as any).tags.some((t:string)=> activeFilters.includes(t))))
                        .slice(0, 8)
                        .map((item) => {
                        const price = typeof (item as any).priceLevel === 'number' ? '$'.repeat(Math.max(1, Math.min(4, (item as any).priceLevel))) : ''
                        const rating = typeof (item as any).rating === 'number' ? (item as any).rating.toFixed(1) : ''
                        const ratingCount = typeof (item as any).userRatingsTotal === 'number' ? ` (${(item as any).userRatingsTotal})` : ''
                        const ratingAndCount = rating ? `${rating} ★${ratingCount}` : ''
                        const meta = [ratingAndCount, price, (item as any).openNow ? 'Open now' : ''].filter(Boolean).join(' · ')
                        const images = Array.isArray((item as any).images) && (item as any).images.length > 0 ? (item as any).images : ((item as any).mainImage ? [(item as any).mainImage] : [])
                        return (
                          <div key={item.id} className="relative w-full rounded-2xl border border-linen-200 overflow-hidden bg-white cursor-pointer" onClick={()=>{ const d = distanceFromUserKm((item as any)?.coordinates?.lat, (item as any)?.coordinates?.lng); const metaLine = [meta, typeof d === 'number' ? `${d < 1 ? (d*1000).toFixed(0)+' m' : d.toFixed(1)+' km'}` : ''].filter(Boolean).join(' · '); setQuickView({ title: (item as any).name, subtitle: (item as any).address, image: (Array.isArray((item as any).images) && (item as any).images[0]) || (item as any).mainImage, meta: metaLine, type: ((item as any).source === 'google' || (item as any).googlePlaceId || (item as any).provider === 'google') ? 'external_place' : 'place', place: item }) }}>
                            <div className="pointer-events-none absolute -top-20 left-6 w-56 h-56 rounded-full bg-white/70 blur-3xl opacity-70" />
                            <div className="pointer-events-none absolute -bottom-24 right-8 w-52 h-52 rounded-full bg-blue-200/70 blur-3xl opacity-70" />
                            

                            {/* media */}
                            <div className="w-full h-36 bg-linen-100 relative">
                              {images.length > 1 ? (
                                <ImageCarousel images={images as any} className="h-36 w-full" />
                              ) : (
                                <img src={((images as any)[0] || (item as any).mainImage || '/assets/leaf.png')} alt={item.name} className="absolute inset-0 w-full h-full object-cover" onError={(e)=>{ (e.currentTarget as HTMLImageElement).src='/assets/leaf.png' }} />
                              )}
                              <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/25 to-transparent" />
                            </div>

                            {/* content */}
                            <div className="p-4 relative">
                              <div className="relative">
                                <h4 className="font-semibold text-blue-900 text-base text-center line-clamp-2">{item.name}</h4>
                                <p className="text-blue-700 text-[11px] text-center mt-1 line-clamp-1">{(item as any).address || ''}</p>
                                {meta && <p className="text-blue-900/80 text-[11px] text-center mt-2">{meta}</p>}
                                {Array.isArray((item as any).tags) && (item as any).tags.length > 0 && (
                                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                                    {normalizeExternalTags((item as any).tags).slice(0,4).map((t:string, i:number) => (
                                      <TagPill
                                        key={`${t}-${i}`}
                                        label={t}
                                        size="sm"
                                        selected={activeFilters.includes(t)}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setActiveFiltersState(prev => {
                                            const next = prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                                            // Trigger a search with updated filters if a query exists; otherwise show filtered recs
                                            if (searchQuery.trim()) {
                                              performSearch(searchQuery, { sortBy, tags: next })
                                            }
                                            return next
                                          })
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                                <div className="mt-3 flex items-center justify-center text-[11px] text-blue-900/80">Tap to preview</div>
                              </div>
                            </div>
                          </div>
                        )
                      }))
                    )}
                    </div>
                  </div>
                )}

                {error && <p className="text-red-500 text-center">{error}</p>}
                {displayResults.places.length === 0 && displayResults.lists.length === 0 && displayResults.users.length === 0 && !isSearching && (
                  <div className="text-center text-cozy-sub">No results. Try a different query or filters.</div>
                )}
                
                {activeFilter === 'places' && (
                  <>
                    <h3 className="text-cozy-title mb-2">Places</h3>
                    {displayResults.places.map((result) => {
                  const place = 'item' in result ? result.item : result;
                  return (
                    <div key={place.id} onClick={() => { if (isExternalPlace(place)) { setQuickView({ title: place.name, subtitle: (place as any).address, image: (place as any).mainImage, meta: (place.tags||[]).slice(0,3).map((t:string)=>`#${t}`).join(' '), type: 'external_place', place }); } else { handlePlaceClick(place) } }} className="p-4 bg-white rounded-xl border border-linen-200 cursor-pointer hover:bg-linen-50 transition">
                      <h4 className="text-cozy-title">{place.name}</h4>
                      <p className="text-cozy-sub line-clamp-1">{place.address}</p>
                      {'score' in result && <p className="text-xs text-purple-600">Score: {Math.round(result.score as number)}</p>}
                      {'reasons' in result && <p className="text-xs text-purple-600 mt-1">Why: {(result.reasons as string[] || []).join(', ')}</p>}
                    </div>
                  );
                    })}
                  </>
                )}

                {activeFilter === 'lists' && (
                  <>
                    <h3 className="text-cozy-title mb-2">Lists</h3>
                    {displayResults.lists.map((result) => {
                  const list = 'item' in result ? result.item : result;
                  return (
                    <div key={list.id} onClick={() => setQuickView({ title: list.name, subtitle: list.description, image: (list as any).coverImage, meta: (list.tags||[]).slice(0,3).map((t:string)=>`#${t}`).join(' '), type: 'list', list })} className="p-4 bg-white rounded-xl border border-linen-200 cursor-pointer hover:bg-linen-50 transition">
                      <h4 className="text-cozy-title">{list.name}</h4>
                      <p className="text-cozy-sub line-clamp-2">{list.description}</p>
                      {'score' in result && <p className="text-xs text-purple-600">Score: {Math.round(result.score as number)}</p>}
                      {'reasons' in result && <p className="text-xs text-purple-600 mt-1">Why: {(result.reasons as string[] || []).join(', ')}</p>}
                    </div>
                  );
                    })}
                  </>
                )}

                {activeFilter === 'users' && (
                  <>
                    <h3 className="text-cozy-title mb-2">People</h3>
                    {displayResults.users.map((result) => {
                    const user = 'item' in result ? result.item : result;
                    return (
                        <div key={user.id} onClick={() => handleUserClick(user)} className="p-4 bg-white rounded-xl border border-linen-200 cursor-pointer flex items-center gap-3 hover:bg-linen-50 transition">
                            <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
                            <div>
                                <h4 className="text-cozy-title">{user.name}</h4>
                                <p className="text-cozy-sub">@{user.username}</p>
                                {user.bio && <p className="text-cozy-meta mt-1 line-clamp-2">{user.bio}</p>}
                                {user.tags && user.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {user.tags.map((tag: string) => (
                                            <span key={tag} className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full">{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                    })}
                  </>
                )}
              </div>
            )}
            
            {/* Recent Finds Section */}
            {recentFinds.length > 0 && (
              <div className="mt-8">
                <h3 className="font-semibold mb-4 text-lg">Recent Finds</h3>
                <div className="space-y-3">
                  {recentFinds.slice(0, 5).map((find, index) => (
                    <div key={`${find.type}-${find.item.id}-${index}`} className="p-3 bg-white rounded-xl border border-linen-200 cursor-pointer hover:bg-linen-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-sage-100 flex items-center justify-center">
                          {find.type === 'place' && <MapIcon className="w-5 h-5 text-sage-600" />}
                          {find.type === 'list' && <BookmarkIcon className="w-5 h-5 text-sage-600" />}
                          {find.type === 'user' && <UserIcon className="w-5 h-5 text-sage-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">
                            {find.type === 'place' && find.item.name}
                            {find.type === 'list' && find.item.name}
                            {find.type === 'user' && find.item.name}
                          </h4>
                          <p className="text-sm text-gray-600 truncate">
                            {find.type === 'place' && find.item.address}
                            {find.type === 'list' && find.item.description}
                            {find.type === 'user' && `@${find.item.username}`}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (find.type === 'place') handlePlaceClick(find.item);
                            if (find.type === 'list') handleListClick(find.item);
                            if (find.type === 'user') handleUserClick(find.item);
                          }}
                          className="px-3 py-1 text-xs bg-sage-600 text-white rounded-full hover:bg-sage-700 transition-colors"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
    </div>
      {showCreateHubModal && (
        <CreateHubModal
          isOpen={showCreateHubModal}
          onClose={() => setShowCreateHubModal(false)}
          place={createHubSeed || undefined}
          onCreate={async (data) => {
            try {
              if (!currentUser) return
              const hubId = await firebaseDataService.createHub({ name: data.name, description: data.description || '', address: data.address, coordinates: data.coordinates } as any)
              if (hubId) {
                if (data.mainImage) { try { await firebaseDataService.setHubMainImage(hubId, data.mainImage) } catch {} }
                setShowCreateHubModal(false)
                const newHub: Hub = { id: hubId, name: data.name, description: data.description || '', tags: [], images: [], location: { address: data.address, lat: data.coordinates?.lat || 0, lng: data.coordinates?.lng || 0 }, googleMapsUrl: data.coordinates ? `https://www.google.com/maps/search/?api=1&query=${data.coordinates.lat},${data.coordinates.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.address)}`, mainImage: data.mainImage, posts: [], lists: [] }
                openHubModal(newHub, 'search-suggested-create')
              }
            } catch (e) { console.error('Failed to create hub from search suggestion', e) }
          }}
        />
      )}
    </div>
      {quickView && (
        <QuickViewModal
          isOpen={!!quickView}
          onClose={() => setQuickView(null)}
          title={quickView.title}
          subtitle={quickView.subtitle}
          image={quickView.image}
          meta={quickView.meta}
          badge={quickView.type === 'external_place' ? 'Google Place' : quickView.type === 'place' ? 'This Is Place' : quickView.type === 'list' ? 'List' : 'User'}
          chips={(() => {
            const chips: Array<{label: string; tone?: any}> = []
            if (quickView.type === 'external_place' || quickView.type === 'place') {
              const p: any = quickView.place || {}
              if (typeof p.rating === 'number') chips.push({ label: `${p.rating.toFixed(1)} ★`, tone: 'brand' })
              if (typeof p.userRatingsTotal === 'number') chips.push({ label: `${p.userRatingsTotal}`, tone: 'neutral' })
              if (typeof p.priceLevel === 'number') chips.push({ label: '$'.repeat(Math.max(1, Math.min(4, p.priceLevel))) })
              if (p.openNow === true) chips.push({ label: 'Open now', tone: 'success' })
            }
            return chips
          })()}
          actions={
            <>
              {quickView.type === 'place' && (
                <>
                  <button className="btn-primary text-sm" onClick={()=>{ if (quickView?.place) { handlePlaceClick(quickView.place) }}}>Open</button>
                  <button className="btn-secondary text-sm" onClick={()=>{ if (quickView?.place) { setSelectedPlace(quickView.place); setShowSaveModal(true); setQuickView(null) }}}>Save</button>
                  <button className="btn-secondary text-sm" onClick={()=>{ if (quickView?.place) { const p:any = quickView.place; const lat=p?.coordinates?.lat, lng=p?.coordinates?.lng; const url = (typeof lat==='number' && typeof lng==='number') ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address||quickView.subtitle||'')}`; window.open(url, '_blank'); }}}>Directions</button>
                  <button className="btn-secondary text-sm" onClick={()=> setQuickView(null)}>Close</button>
                </>
              )}
              {quickView.type === 'external_place' && (
                <>
                  <button className="btn-primary text-sm" onClick={()=>{ if (quickView?.place) { setCreateHubSeed({ name: (quickView.place as any).name, address: (quickView.place as any).address, coordinates: (quickView.place as any).coordinates, images: (quickView.place as any).images, mainImage: (quickView.place as any).mainImage, description: (quickView.place as any).description }); setShowCreateHubModal(true); setQuickView(null) }}}>Create Hub</button>
                  <button className="btn-secondary text-sm" onClick={()=>{ if (quickView?.place) { const p:any = quickView.place; const lat=p?.coordinates?.lat, lng=p?.coordinates?.lng; const url = (typeof lat==='number' && typeof lng==='number') ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address||quickView.subtitle||'')}`; window.open(url, '_blank'); }}}>Directions</button>
                  <button className="btn-secondary text-sm" onClick={()=> setQuickView(null)}>Close</button>
                </>
              )}
              {quickView.type === 'list' && (
                <>
                  <button className="btn-primary text-sm" onClick={()=>{ if (quickView?.list) { handleListClick(quickView.list) }}}>Open</button>
                  <button className="btn-secondary text-sm" onClick={()=> setQuickView(null)}>Close</button>
                </>
              )}
            </>
          }
        />
      )}
      {selectedPlace && (
        <SaveModal
          isOpen={showSaveModal}
          onClose={() => { setShowSaveModal(false); setSelectedPlace(null) }}
          place={selectedPlace}
          userLists={userOwnedLists}
          onSave={async (status, rating, listIds, note) => {
            try {
              if (!currentUser || !selectedPlace) return;
              const ids = Array.isArray(listIds) ? listIds : []
              for (const id of ids) {
                await firebaseDataService.savePlaceToList(selectedPlace.id, id, currentUser.id, note, undefined, status, rating);
              }
              await firebaseDataService.saveToAutoList(selectedPlace.id, currentUser.id, status, note, rating)
            } catch {}
            setShowSaveModal(false); setSelectedPlace(null);
          }}
          onCreateList={async (listData) => {
            try {
              if (!currentUser || !selectedPlace) return;
              const newListId = await firebaseDataService.createList({ ...listData, userId: currentUser.id, tags: listData.tags || [] });
              if (newListId) {
                await firebaseDataService.savePlaceToList(selectedPlace.id, newListId, currentUser.id, undefined, undefined, 'loved');
              }
            } catch {}
            setShowSaveModal(false); setSelectedPlace(null);
          }}
        />
      )}
    </>
  );
};

export default Search;
