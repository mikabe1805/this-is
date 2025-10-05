# Search Routes Examples

## Global Search Examples

### Basic Search
**File:** `src/pages/Search.tsx:18-31`
```typescript
const { searchQuery, setSearchQuery, displayResults, isSearching, error, performSearch } = useSearch()

// Perform search with query
performSearch("coffee shops", { sortBy: 'relevant', tags: [] })
```

### Search with Filters
**File:** `src/pages/Search.tsx:429-449`
```typescript
<SearchAndFilter 
  placeholder="Search..." 
  value={searchQuery} 
  onChange={handleSearchInputChange} 
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
  onApplyFilters={() => performSearch(searchQuery, { sortBy, tags: activeFilters })}
/>
```

### Search with Location
**File:** `src/pages/Search.tsx:195-248`
```typescript
// Load Google recommendations tied to the current query
useEffect(() => {
  const fetchGoogleForQuery = async () => {
    try {
      if (isSearching) return;
      const q = searchQuery.trim();
      if (!q) { setGoogleQueryHubs([]); return; }
      
      // Resolve location (prefer already resolved)
      let loc = usedLocation;
      if (!loc && 'geolocation' in navigator) {
        await new Promise<void>(resolve => navigator.geolocation.getCurrentPosition(
          p => { loc = { lat: p.coords.latitude, lng: p.coords.longitude }; resolve(); }, 
          () => resolve(), 
          { timeout: 4000 }
        ));
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
      
      setGoogleQueryHubs(filtered);
    } catch {
      setGoogleQueryHubs([]);
    }
  };
  fetchGoogleForQuery();
}, [searchQuery, isSearching, displayResults, usedLocation]);
```

## List-Scoped Search Examples

### Search Within List
**File:** `src/pages/ListView.tsx:23-41`
```typescript
const { getPlacesForList } = firebaseListService

// Get places for a specific list
const places = await getPlacesForList(listId)
```

### Profile List Search
**File:** `src/pages/Profile.tsx:311-327`
```typescript
const filteredLists = useMemo(() => userLists.filter(list => {
  if ((list.tags || []).includes('auto-generated')) return false
  if (deferredSearch.trim()) {
    const q = deferredSearch.toLowerCase()
    const matches =
      list.name.toLowerCase().includes(q) ||
      (list.description || '').toLowerCase().includes(q) ||
      (list.tags || []).some(t => t.toLowerCase().includes(q))
    if (!matches) return false
  }
  if (selectedTags.length > 0) {
    const hasTag = selectedTags.some(tag => (list.tags || []).map(t=>t.toLowerCase()).includes(tag.toLowerCase()))
    if (!hasTag) return false
  }
  if (activeFilters.length === 0) return true
  return activeFilters.some(f => (list.tags || []).includes(f))
}), [userLists, deferredSearch, activeFilters, selectedTags])
```

## Search Hook Usage Examples

### useSearch Hook
**File:** `src/hooks/useSearch.ts:20-38`
```typescript
const buildSearchContext = async (userId: string) => {
  const user = await firebaseDataService.getCurrentUser(userId)
  const preferences = await firebaseDataService.getUserPreferences(userId)
  const location = await getCurrentLocation()
  
  return {
    user,
    preferences,
    location,
    tags: user.tags || [],
    interests: preferences.favoriteCategories || []
  }
}
```

### Search Performance
**File:** `src/hooks/useSearch.ts:40-80`
```typescript
const performSearch = async (query: string, options: SearchOptions = {}) => {
  setIsSearching(true)
  setError(null)
  
  try {
    const context = await buildSearchContext(currentUser.id)
    const results = await firebaseDataService.performSearch(query, {
      ...options,
      context,
      limit: 20
    })
    
    setDisplayResults(results)
  } catch (error) {
    setError('Search failed. Please try again.')
    console.error('Search error:', error)
  } finally {
    setIsSearching(false)
  }
}
```

## Search Service Examples

### Firebase Data Service Search
**File:** `src/services/firebaseDataService.ts:844-900`
```typescript
const performSearch = async (query: string, options: SearchOptions = {}) => {
  const { context, limit = 20, sortBy = 'relevant' } = options
  
  // Search across multiple collections
  const [places, lists, users, tags] = await Promise.all([
    searchPlaces(query, context, limit),
    searchLists(query, context, limit),
    searchUsers(query, context, limit),
    searchTags(query, context, limit)
  ])
  
  // Rank and merge results
  const rankedResults = rankSearchResults([...places, ...lists, ...users, ...tags], query)
  
  return {
    places: rankedResults.filter(r => r.type === 'place').slice(0, 20),
    lists: rankedResults.filter(r => r.type === 'list').slice(0, 10),
    users: rankedResults.filter(r => r.type === 'user').slice(0, 5),
    tags: rankedResults.filter(r => r.type === 'tag').slice(0, 5)
  }
}
```

### Search Algorithm
**File:** `src/utils/searchAlgorithm.ts:65-109`
```typescript
const parseSearchQuery = (query: string) => {
  // Split by whitespace and special characters
  const tokens = query.toLowerCase().split(/[\s,.-]+/).filter(Boolean)
  // Remove stop words
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
  return tokens.filter(token => !stopWords.includes(token))
}
```

## Search Context Examples

### User Context
**File:** `src/pages/Search.tsx:115-193`
```typescript
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
        await new Promise<void>(resolve => navigator.geolocation.getCurrentPosition(
          p => { loc = { lat: p.coords.latitude, lng: p.coords.longitude }; resolve(); }, 
          () => resolve(), 
          { timeout: 4000 }
        ));
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
```

## Search Results Examples

### Display Results
**File:** `src/pages/Search.tsx:720-778`
```typescript
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
```

### Search History
**File:** `src/pages/Search.tsx:602-616`
```typescript
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
  // ... search results
)}
```
