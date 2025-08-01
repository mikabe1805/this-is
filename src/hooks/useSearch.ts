import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { firebaseDataService, type FirebaseSearchData } from '../services/firebaseDataService';
import { aiSearchService } from '../services/aiSearchService';
import { searchIntelligently, type IntelligentSearchResult, type SearchContext } from '../utils/intelligentSearchService';

export const useSearch = () => {
  const { currentUser: authUser } = useAuth();
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
        const context = await firebaseDataService.buildSearchContext(authUser.uid);
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

  const performSearch = useCallback(async (query: string, useAI: boolean) => {
    if (!query.trim()) {
      setDisplayResults({ places: [], lists: [], users: [], posts: [], totalResults: { places: 0, lists: 0, users: 0, posts: 0 } });
      return;
    }
    setIsSearching(true);
    setError('');

    try {
      let results;
      if (useAI && aiSearchService.isAISearchEnabled() && searchContext) {
        results = await searchIntelligently(query, searchContext);
      } else {
        results = await firebaseDataService.performSearch(query);
      }
      setDisplayResults(results);
    } catch (err) {
      console.error("Search failed:", err);
      setError("An error occurred during the search.");
    } finally {
      setIsSearching(false);
    }
  }, [searchContext]);

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
