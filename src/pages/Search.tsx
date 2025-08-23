import { useState, useEffect } from 'react';
import { MapIcon, BookmarkIcon, UserIcon } from '@heroicons/react/24/outline';
import { useLocation } from 'react-router-dom';
import SearchAndFilter from '../components/SearchAndFilter';
import type { Hub, Place, List, User } from '../types/index.js';
import { useNavigation } from '../contexts/NavigationContext.tsx';
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

      <div className="relative z-10 p-4">
        {isSearching ? (
          <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-moss-600 mx-auto"></div><p className="mt-2">Searching...</p></div>
        ) : (
          <>
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
