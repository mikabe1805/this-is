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

  const [activeFilter, setActiveFilter] = useState<'all' | 'places' | 'lists' | 'users'>('all');
  const [showSearchHistory, setShowSearchHistory] = useState(true);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchTimeoutId, setSearchTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [sortBy, setSortBy] = useState('relevant');
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
          const items = [...(recs || []), ...externalHubs].slice(0, 12);
          const freq: Record<string, number> = {};
          items.forEach(p => (p.tags || []).forEach(t => { const k = t.toLowerCase(); freq[k] = (freq[k] || 0) + 1; }));
          const top = Object.entries(freq).sort((a,b)=> b[1]-a[1])[0]?.[0];
          if (top && prefs && !(prefs as any)?.userTags?.includes(top)) {
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
    <div className="relative min-h-full overflow-x-hidden bg-linen-50">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-linen-texture opacity-80 mix-blend-multiply"></div>
      </div>
      <div className="relative z-10 bg-white/90 border-b px-6 py-4">
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
          <button type="button" onClick={() => console.log('Map view - coming soon!')} className="px-4 py-2 rounded-full font-semibold shadow-botanical flex items-center gap-2 bg-sage-500 text-white hover:bg-sage-600 transition-colors">
            <MapIcon className="w-4 h-4" /><span>Map</span>
          </button>
        </form>
      </div>
      <AdvancedFiltersDrawer isOpen={showAdvanced} onClose={()=>setShowAdvanced(false)} onApply={()=>{ if (searchQuery.trim()) performSearch(searchQuery, { sortBy, tags: activeFilters }); }} />

      <div className="relative z-10 p-4">
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
                      className="ml-2 px-3 py-1.5 rounded-full bg-sage-500 text-white hover:bg-sage-600"
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
                  {(() => {
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
                    <div key={p.id} className="bg-white/80 border border-linen-200 rounded-2xl p-4 shadow-soft hover:shadow-cozy transition">
                      <div className="flex items-start gap-3">
                        <img src={(p as any).mainImage || '/assets/leaf.png'} alt={p.name} className="w-16 h-16 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-charcoal-800 truncate">{p.name}</h4>
                            <span className="text-xs text-charcoal-500">{(p.tags||[]).slice(0,2).map(t=>`#${t}`).join(' ')}</span>
                          </div>
                          <div className="text-sm text-charcoal-600 line-clamp-1">{p.address}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-3">
                        <button onClick={() => handlePlaceClick(p)} className="px-3 py-1.5 rounded-full text-sm bg-sage-500 text-white hover:bg-sage-600">View</button>
                        {currentUser && (
                          <button onClick={async (e) => { e.stopPropagation(); await firebaseDataService.markPlaceNotInterested(currentUser.id, p.id); setRecommendedHubs(prev=>prev.filter(x=>x.id!==p.id)); setExternalHubs(prev=>prev.filter(x=>x.id!==p.id)); }} className="px-3 py-1.5 rounded-full text-sm bg-linen-100 text-charcoal-700 border border-linen-200 hover:bg-linen-200">Not interested</button>
                        )}
                      </div>
                    </div>
                    ))
                  })()}
                </div>
              </div>
            )}
            {showSearchHistory ? (
              <div>
                <h3 className="font-semibold mb-2">Recent Searches</h3>
                {searchHistory.map(q => <button key={q} onClick={() => { setSearchQuery(q); performSearch(q); setShowSearchHistory(false); }} className="block w-full text-left p-2 rounded-lg hover:bg-linen-100">{q}</button>)}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center bg-white/60 rounded-2xl p-1 shadow-soft border">
                  {(['all', 'places', 'lists', 'users'] as const).map(filter => (
                    <button key={filter} onClick={() => setActiveFilter(filter)} className={`flex-1 py-2 px-3 text-sm font-medium rounded-xl ${activeFilter === filter ? 'bg-sage-500 text-white' : ''}`}>
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Google results for the current query (after results header/tabs) */}
                {searchQuery.trim() && googleQueryHubs.length > 0 && (
                  <div className="my-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-serif font-semibold" style={{ color: '#2563eb' }}>Recommended from Google</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {googleQueryHubs
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
                          <div key={item.id} className="relative w-full rounded-3xl shadow-xl border border-white/30 ring-1 ring-white/50 overflow-hidden" style={{ background: 'linear-gradient(145deg, rgba(248,252,255,0.9), rgba(221,236,255,0.65))', backdropFilter: 'blur(28px) saturate(1.32)' }}>
                            <div className="pointer-events-none absolute -top-20 left-6 w-56 h-56 rounded-full bg-white/70 blur-3xl opacity-70" />
                            <div className="pointer-events-none absolute -bottom-24 right-8 w-52 h-52 rounded-full bg-blue-200/70 blur-3xl opacity-70" />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-blue-200/20" />
                            <div className="pointer-events-none absolute -top-10 -left-20 w-[160%] h-14 bg-gradient-to-r from-white/10 via-white/70 to-white/10 opacity-60 blur-xl transform -rotate-6" />
                            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 w-2/3 h-10 rounded-full bg-white/15 blur-md" />

                            {/* media */}
                            <div className="w-full h-40 bg-gradient-to-br from-blue-200/30 to-blue-100/20 relative">
                              {images.length > 1 ? (
                                <ImageCarousel images={images as any} className="h-40 w-full" />
                              ) : (
                                <img src={((images as any)[0] || (item as any).mainImage || '/assets/leaf.png')} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                              )}
                              <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/25 to-transparent" />
                            </div>

                            {/* content */}
                            <div className="p-4 relative">
                              <div className="absolute inset-2 rounded-2xl bg-white/18 border border-white/30 shadow-inner pointer-events-none" />
                              <div className="relative">
                                <h4 className="font-semibold text-blue-900 text-base text-center line-clamp-2">{item.name}</h4>
                                <p className="text-blue-700 text-[11px] text-center mt-1 line-clamp-1">{(item as any).address || ''}</p>
                                {meta && <p className="text-blue-900/80 text-[11px] text-center mt-2">{meta}</p>}
                                <div className="mt-3 flex items-center justify-center">
                                  <button onClick={() => handlePlaceClick(item)} className="px-3 py-1.5 rounded-full text-xs bg-blue-600 text-white hover:bg-blue-700">Create Hub</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {error && <p className="text-red-500 text-center">{error}</p>}
                {displayResults.places.length === 0 && displayResults.lists.length === 0 && displayResults.users.length === 0 && !isSearching && <div>No results.</div>}
                
                {['all', 'places'].includes(activeFilter) && displayResults.places.map((result) => {
                  const place = 'item' in result ? result.item : result;
                  return (
                    <div key={place.id} onClick={() => handlePlaceClick(place)} className="p-4 bg-white/70 rounded-2xl shadow-soft cursor-pointer">
                      <h4 className="font-semibold">{place.name}</h4>
                      <p className="text-sm">{place.address}</p>
                      {'score' in result && <p className="text-xs text-purple-600">Score: {Math.round(result.score as number)}</p>}
                      {'reasons' in result && <p className="text-xs text-purple-600 mt-1">Why: {(result.reasons as string[] || []).join(', ')}</p>}
                    </div>
                  );
                })}

                {['all', 'lists'].includes(activeFilter) && displayResults.lists.map((result) => {
                  const list = 'item' in result ? result.item : result;
                  return (
                    <div key={list.id} onClick={() => handleListClick(list)} className="p-4 bg-white/70 rounded-2xl shadow-soft cursor-pointer">
                      <h4 className="font-semibold">{list.name}</h4>
                      <p className="text-sm">{list.description}</p>
                      {'score' in result && <p className="text-xs text-purple-600">Score: {Math.round(result.score as number)}</p>}
                      {'reasons' in result && <p className="text-xs text-purple-600 mt-1">Why: {(result.reasons as string[] || []).join(', ')}</p>}
                    </div>
                  );
                })}

                {['all', 'users'].includes(activeFilter) && displayResults.users.map((result) => {
                    const user = 'item' in result ? result.item : result;
                    return (
                        <div key={user.id} onClick={() => handleUserClick(user)} className="p-4 bg-white/70 rounded-2xl shadow-soft cursor-pointer flex items-center space-x-3">
                            <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full" />
                            <div>
                                <h4 className="font-semibold">{user.name}</h4>
                                <p className="text-sm text-gray-500">@{user.username}</p>
                                {user.bio && <p className="text-sm mt-1">{user.bio}</p>}
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
              </div>
            )}
            
            {/* Recent Finds Section */}
            {recentFinds.length > 0 && (
              <div className="mt-8">
                <h3 className="font-semibold mb-4 text-lg">Recent Finds</h3>
                <div className="space-y-3">
                  {recentFinds.slice(0, 5).map((find, index) => (
                    <div key={`${find.type}-${find.item.id}-${index}`} className="p-3 bg-white/60 rounded-xl shadow-soft cursor-pointer hover:bg-white/80 transition-colors">
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
                          className="px-3 py-1 text-xs bg-sage-500 text-white rounded-full hover:bg-sage-600 transition-colors"
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
    </div>
  );
};

export default Search;
