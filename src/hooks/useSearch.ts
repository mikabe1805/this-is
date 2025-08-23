import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { firebaseDataService, type FirebaseSearchData } from '../services/firebaseDataService';
import { aiSearchService } from '../services/aiSearchService';
import { searchIntelligently, type IntelligentSearchResult, type SearchContext } from '../utils/intelligentSearchService';
import { useFilters } from '../contexts/FiltersContext';

export const useSearch = () => {
  const { currentUser: authUser } = useAuth();
  const { filters } = useFilters();
  const [searchQuery, setSearchQuery] = useState('');
  const [displayResults, setDisplayResults] = useState<IntelligentSearchResult | FirebaseSearchData>({
    places: [], lists: [], users: [], posts: [], totalResults: { places: 0, lists: 0, users: 0, posts: 0 }
  });
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);

  useEffect(() => {
    const loadSearchContext = async () => {
      if (!authUser) {
        setContextLoading(false);
        return;
      }
      try {
        setContextLoading(true);
        const context = await firebaseDataService.buildSearchContext(authUser.id);
        setSearchContext(context);
      } catch (err) {
        console.error("Failed to build search context:", err);
        setError("Could not initialize search.");
      } finally {
        setContextLoading(false);
      }
    };
    loadSearchContext();
  }, [authUser]);

  const performSearch = useCallback(async (query: string, options: { sortBy?: string, tags?: string[] } = {}) => {
    setIsSearching(true);
    setError('');

    try {
      let results;
      // Merge global advanced filters into the search options
      const mergedOptions: any = {
        ...options,
        radius: typeof filters.distanceKm === 'number' ? filters.distanceKm : undefined,
        location: filters.location ? `${filters.location.lat},${filters.location.lng}` : undefined,
        priceRange: Array.isArray(filters.priceLevels) && filters.priceLevels.length > 0 ? filters.priceLevels.map(String) : undefined,
        openNow: !!filters.openNow
      };

      if (aiSearchService.isAISearchEnabled() && searchContext) {
        results = await searchIntelligently(query, searchContext, mergedOptions);
      } else {
        results = await firebaseDataService.performSearch(query, mergedOptions);
      }
      setDisplayResults(results);
    } catch (err) {
      console.error("Search failed:", err);
      setError("An error occurred during the search.");
    } finally {
      setIsSearching(false);
    }
  }, [searchContext, filters]);

  return {
    searchQuery,
    setSearchQuery,
    displayResults,
    isSearching,
    error,
    performSearch,
    contextLoading
  };
};
