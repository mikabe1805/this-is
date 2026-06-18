import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { firebaseDataService, type FirebaseSearchData } from '../services/firebaseDataService';
import { aiSearchService } from '../services/aiSearchService';
// Heavy AI-search code path is lazy-loaded — most users never trigger it
// (gated by aiSearchService.isAISearchEnabled()), and pulling it into the
// Search route's chunk bloats the page even when the path is dead.
import type { IntelligentSearchResult, SearchContext } from '../utils/intelligentSearchService';
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
  const requestIdRef = useRef(0);

  useEffect(() => {
    const loadSearchContext = async () => {
      // The search context is consumed ONLY by the AI path
      // (aiSearchService.isAISearchEnabled()). In the shipping build (no OpenAI
      // key) that path is dead, so skip the 4 Firestore reads it would cost on
      // every Search-screen open.
      if (!authUser || !aiSearchService.isAISearchEnabled()) {
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
    const reqId = ++requestIdRef.current;
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
        // Dynamic import: only fetch the intelligent-search bundle when the
        // feature is actually on AND the path is taken.
        const { searchIntelligently } = await import('../utils/intelligentSearchService');
        results = await searchIntelligently(query, searchContext, mergedOptions);
      } else {
        results = await firebaseDataService.performSearch(query, mergedOptions);
      }
      // Exclude current user from people results and clamp fields for readability
      if (results && Array.isArray((results as any).users) && authUser) {
        (results as any).users = (results as any).users.filter((u: any) => {
          const item = 'item' in u ? u.item : u;
          return item?.id !== authUser.id;
        });
      }
      if (results && Array.isArray((results as any).places)) {
        (results as any).places = (results as any).places.slice(0, 50);
      }
      if (results && Array.isArray((results as any).lists)) {
        (results as any).lists = (results as any).lists.slice(0, 50);
      }
      if (reqId !== requestIdRef.current) {
        // Stale result, ignore
        return;
      }
      setDisplayResults(results);
    } catch (err) {
      console.error("Search failed:", err);
      if (reqId === requestIdRef.current) {
        setError("An error occurred during the search.");
      }
    } finally {
      if (reqId === requestIdRef.current) {
        setIsSearching(false);
      }
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
