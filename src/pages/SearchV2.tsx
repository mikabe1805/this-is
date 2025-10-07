import { useState, useEffect, useRef } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  MapIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import CardShell from '../components/ui/CardShell';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { firebaseDataService } from '../services/firebaseDataService';
import { getPredictions, beginPlacesSession, endPlacesSession } from '../services/google/places';
import type { Place, List, User } from '../types/index.js';

interface SearchResult {
  hubs: Place[];
  lists: List[];
  people: User[];
  recommended: Place[];
}

const SearchV2 = () => {
  const { currentUser } = useAuth();
  const { openHubModal, openListModal, openProfileModal } = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult>({
    hubs: [],
    lists: [],
    people: [],
    recommended: []
  });
  const [showMap, setShowMap] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['hubs', 'recommended']));
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load tags
        const tags = await firebaseDataService.getPopularTags(20);
        setAvailableTags(tags.slice(0, 12));

        // Load recommended hubs
        if (currentUser) {
          const recommended = await firebaseDataService.getSuggestedPlaces({ limit: 6 });
          setResults(prev => ({ ...prev, recommended }));
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    loadInitialData();
    beginPlacesSession();

    return () => {
      endPlacesSession();
    };
  }, [currentUser]);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      // Reset to initial state
      const recommended = currentUser 
        ? await firebaseDataService.getSuggestedPlaces({ limit: 6 })
        : [];
      setResults({ hubs: [], lists: [], people: [], recommended });
      return;
    }

    setIsSearching(true);
    try {
      // Search Firebase data
      const [hubs, lists, people] = await Promise.all([
        firebaseDataService.searchPlaces(query, { limit: 6 }),
        firebaseDataService.searchLists(query, { limit: 4 }),
        firebaseDataService.searchUsers(query, { limit: 4 })
      ]);

      // Autocomplete predictions (only if typing, not on details requests)
      const predictions = await getPredictions(query);
      
      setResults({ 
        hubs: hubs || [], 
        lists: lists || [], 
        people: people || [],
        recommended: []
      });
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    // Debounce search (600ms)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (value.length >= 3 || value.length === 0) {
        performSearch(value);
      }
    }, 600);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddToTags = async (hub: Place) => {
    try {
      if (!currentUser) return;
      
      // Add the hub's tags to the user's favorite categories
      const hubTags = hub.tags || [];
      const prefs = await firebaseDataService.getUserPreferences(currentUser.id);
      const currentFavorites = (prefs?.favoriteCategories || []) as string[];
      
      const newFavorites = Array.from(new Set([...currentFavorites, ...hubTags]));
      await firebaseDataService.updateUserPreferences(currentUser.id, {
        favoriteCategories: newFavorites
      });

      // TODO: Show toast notification
      console.log('Added to your tags!');
    } catch (error) {
      console.error('Failed to add tags:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-bark-50 via-sand-50 to-bark-100">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-bark-50/90 backdrop-blur-md border-b border-bark-200">
        <div className="max-w-2xl mx-auto p-4">
          {/* Search Bar */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search places, lists, or people..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-bark-200 bg-white text-stone-900 placeholder-bark-500 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:border-transparent"
                aria-label="Search"
              />
            </div>
            <button 
              className="p-3 rounded-xl bg-bark-100 hover:bg-bark-200 transition-colors"
              aria-label="Filters"
            >
              <FunnelIcon className="w-5 h-5 text-bark-700" />
            </button>
            <button
              onClick={() => setShowMap(!showMap)}
              className={`p-3 rounded-xl transition-colors ${
                showMap 
                  ? 'bg-moss-500 text-white' 
                  : 'bg-bark-100 text-bark-700 hover:bg-bark-200'
              }`}
              aria-label={showMap ? 'Hide map' : 'Show map'}
            >
              <MapIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Tags Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedTags.includes(tag)
                    ? 'bg-moss-500 text-white shadow-sm'
                    : 'bg-bark-100 text-bark-700 hover:bg-bark-200'
                }`}
                aria-label={`Filter by ${tag}`}
                aria-pressed={selectedTags.includes(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Container */}
      <div className="max-w-2xl mx-auto p-4 space-y-6 pb-24">
        {/* Hubs Section */}
        {(results.hubs.length > 0 || searchQuery) && (
          <Section
            title="Hubs"
            count={results.hubs.length}
            isExpanded={expandedSections.has('hubs')}
            onToggle={() => toggleSection('hubs')}
            onSeeAll={() => {/* TODO: Navigate to filtered view */}}
          >
            {results.hubs.length > 0 ? (
              <div className="space-y-3">
                {results.hubs.map(hub => (
                  <CardShell 
                    key={hub.id} 
                    variant="glass" 
                    className="glass--light p-4 cursor-pointer hover:shadow-soft transition-all"
                    onClick={() => openHubModal(hub.id)}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={hub.mainImage || '/assets/leaf.png'}
                        alt={hub.name}
                        className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/assets/leaf.png';
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-bark-900 leading-tight mb-1">
                          {hub.name}
                        </h3>
                        <p className="text-bark-600 text-sm flex items-center gap-1 truncate">
                          <span>📍</span>
                          {hub.address}
                        </p>
                        {hub.tags && hub.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {hub.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-moss-100 text-moss-700">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardShell>
                ))}
              </div>
            ) : (
              <EmptyState message="No hubs found" />
            )}
          </Section>
        )}

        {/* Lists Section */}
        {(results.lists.length > 0 || searchQuery) && (
          <Section
            title="Lists"
            count={results.lists.length}
            isExpanded={expandedSections.has('lists')}
            onToggle={() => toggleSection('lists')}
            onSeeAll={() => {/* TODO: Navigate to filtered view */}}
          >
            {results.lists.length > 0 ? (
              <div className="space-y-3">
                {results.lists.map(list => (
                  <CardShell 
                    key={list.id} 
                    variant="solid" 
                    className="p-4 cursor-pointer hover:shadow-soft transition-all"
                    onClick={() => openListModal(list.id)}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={list.coverImage || '/assets/leaf.png'}
                        alt={list.name}
                        className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/assets/leaf.png';
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-bark-900 leading-tight mb-1">
                          {list.name}
                        </h3>
                        <p className="text-bark-600 text-sm line-clamp-2">
                          {list.description || 'No description'}
                        </p>
                        <p className="text-bark-600 text-xs mt-1">
                          {list.placeIds?.length || 0} places
                        </p>
                      </div>
                    </div>
                  </CardShell>
                ))}
              </div>
            ) : (
              <EmptyState message="No lists found" />
            )}
          </Section>
        )}

        {/* People Section */}
        {(results.people.length > 0 || searchQuery) && (
          <Section
            title="People"
            count={results.people.length}
            isExpanded={expandedSections.has('people')}
            onToggle={() => toggleSection('people')}
            onSeeAll={() => {/* TODO: Navigate to filtered view */}}
          >
            {results.people.length > 0 ? (
              <div className="space-y-3">
                {results.people.map(person => (
                  <CardShell 
                    key={person.id} 
                    variant="solid" 
                    className="p-4 cursor-pointer hover:shadow-soft transition-all"
                    onClick={() => openProfileModal(person.id)}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={person.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${person.id}`}
                        alt={person.name}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-bark-900 leading-tight">
                          {person.name}
                        </h3>
                        <p className="text-bark-600 text-sm">
                          @{person.username}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Follow user
                        }}
                        className="pill pill--primary"
                        aria-label={`Follow ${person.name}`}
                      >
                        Follow
                      </button>
                    </div>
                  </CardShell>
                ))}
              </div>
            ) : (
              <EmptyState message="No people found" />
            )}
          </Section>
        )}

        {/* Recommended Hubs */}
        {results.recommended.length > 0 && (
          <Section
            title="Recommended hubs for you"
            count={results.recommended.length}
            isExpanded={expandedSections.has('recommended')}
            onToggle={() => toggleSection('recommended')}
          >
            <div className="space-y-3">
              {results.recommended.map(hub => (
                <CardShell 
                  key={hub.id} 
                  variant="solid" 
                  className="p-4"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={hub.mainImage || '/assets/leaf.png'}
                      alt={hub.name}
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/assets/leaf.png';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-bark-900 leading-tight mb-1">
                        {hub.name}
                      </h3>
                      <p className="text-bark-600 text-sm flex items-center gap-1 truncate">
                        <span>📍</span>
                        {hub.address}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => openHubModal(hub.id)}
                          className="pill pill--quiet flex-1"
                          aria-label={`View ${hub.name}`}
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleAddToTags(hub)}
                          className="pill pill--quiet flex-1"
                          aria-label="Add to your tags"
                        >
                          Add to tags
                        </button>
                      </div>
                    </div>
                  </div>
                </CardShell>
              ))}
            </div>
          </Section>
        )}

        {/* Loading State */}
        {isSearching && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-moss-500 border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
};

// Section Component
function Section({ 
  title, 
  count, 
  isExpanded = true, 
  onToggle, 
  onSeeAll, 
  children 
}: { 
  title: string; 
  count?: number; 
  isExpanded?: boolean; 
  onToggle?: () => void; 
  onSeeAll?: () => void; 
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 group"
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title} section`}
          aria-expanded={isExpanded}
        >
          <h2 className="text-lg font-semibold text-stone-900">
            {title}
            {typeof count === 'number' && (
              <span className="text-stone-500 ml-2">({count})</span>
            )}
          </h2>
          <ChevronRightIcon 
            className={`w-5 h-5 text-stone-500 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        </button>
        {onSeeAll && count && count > 0 && (
          <button
            onClick={onSeeAll}
            className="text-sm text-moss-600 hover:text-moss-700 font-medium"
            aria-label={`See all ${title.toLowerCase()}`}
          >
            See all
          </button>
        )}
      </div>
      {isExpanded && children}
    </div>
  );
}

// Empty State Component
function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-stone-500 text-sm">{message}</p>
    </div>
  );
}

export default SearchV2;
