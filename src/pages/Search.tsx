import { useState } from 'react';
import { MapIcon } from '@heroicons/react/24/outline';
import SearchAndFilter from '../components/SearchAndFilter';
import type { Hub, Place, List, User } from '../types/index.js';
import { useNavigation } from '../contexts/NavigationContext.tsx';
import { useSearch } from '../hooks/useSearch'; // Import the new hook

const Search = () => {
  const { openHubModal, openListModal, openProfileModal } = useNavigation();
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
  const useIntelligentSearch = true; // Always use intelligent search
  const [searchHistory, setSearchHistory] = useState(['Coffee', 'Tacos', 'Parks']);
  const [searchTimeoutId, setSearchTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (searchTimeoutId) clearTimeout(searchTimeoutId);
    if (!value.trim()) {
      setShowSearchHistory(true);
    } else {
      setShowSearchHistory(false);
      setSearchTimeoutId(setTimeout(() => performSearch(value, useIntelligentSearch), 500));
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeoutId) clearTimeout(searchTimeoutId);
    if (searchQuery.trim()) {
      if (!searchHistory.includes(searchQuery)) {
        setSearchHistory([searchQuery, ...searchHistory.slice(0, 9)]);
      }
      performSearch(searchQuery, useIntelligentSearch);
    }
  };
  
  const handlePlaceClick = (place: Place) => {
    const hub: Hub = { id: place.id, name: place.name, description: ``, tags: place.tags, images: [], location: { address: place.address, lat: 0, lng: 0 }, googleMapsUrl: '', mainImage: '', posts: [], lists: [] };
    openHubModal(hub, 'search');
  };

  const handleListClick = (list: List) => openListModal(list, 'search');
  const handleUserClick = (user: User) => openProfileModal(user.id, 'search');


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
              { key: 'popular', label: 'Most Popular' },
              { key: 'friends', label: 'Most Liked by Friends' },
              { key: 'nearby', label: 'Closest to Location' },
            ]}
            filterOptions={[]}
            availableTags={['cozy', 'trendy', 'quiet', 'local', 'charming', 'authentic', 'chill']}
            sortBy={'relevant'}
            setSortBy={() => {}}
            activeFilters={[]}
            setActiveFilters={() => {}}
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
                {searchHistory.map(q => <button key={q} onClick={() => { setSearchQuery(q); performSearch(q, useIntelligentSearch); setShowSearchHistory(false); }} className="block w-full text-left p-2 rounded-lg hover:bg-linen-100">{q}</button>)}
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
          </>
        )}
      </div>
    </div>
  );
};

export default Search;
