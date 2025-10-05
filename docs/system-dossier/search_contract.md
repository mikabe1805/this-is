# Search Contract

## Current Search Implementation

### Search Inputs
**File:** `src/hooks/useSearch.ts:20-38`
- **Query string**: Text input from user
- **Filters**: Tags, location, distance, privacy settings
- **Sort options**: Relevance, popularity, friends, nearby
- **Context**: User preferences, location, tags

### Search Outputs
**File:** `src/hooks/useSearch.ts:40-80`
- **Places**: Array of Place objects with relevance scores
- **Lists**: Array of List objects with relevance scores  
- **Users**: Array of User objects with relevance scores
- **Tags**: Array of Tag objects with relevance scores

### Tokenization
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

### Fuzzy/Typo Handling
**File:** `src/utils/searchAlgorithm.ts:239-271`
```typescript
const rankSearchResults = (results: any[], query: string) => {
  // Levenshtein distance for fuzzy matching
  const fuzzyScore = (str1: string, str2: string) => {
    const matrix = []
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    // ... Levenshtein implementation
  }
}
```

### Ranking Signals

#### Recency
**File:** `src/services/firebaseDataService.ts:844-900`
- **Weight**: 0.2
- **Implementation**: `createdAt` timestamp comparison
- **Usage**: Newer content ranked higher

#### Popularity  
**File:** `src/services/firebaseDataService.ts:844-900`
- **Weight**: 0.3
- **Implementation**: `likesCount`, `followersCount`, `postsCount`
- **Usage**: More popular content ranked higher

#### Proximity
**File:** `src/services/firebaseDataService.ts:844-900`
- **Weight**: 0.25
- **Implementation**: Haversine distance calculation
- **Usage**: Closer content ranked higher when location provided

#### Relevance
**File:** `src/services/firebaseDataService.ts:844-900`
- **Weight**: 0.25
- **Implementation**: Text matching, tag matching, semantic similarity
- **Usage**: More relevant content ranked higher

### Entity Types Searched
**File:** `src/services/firebaseDataService.ts:844-900`
1. **Hubs/Places**: Name, description, address, tags
2. **Lists**: Name, description, tags, places
3. **Users**: Name, username, bio, tags
4. **Tags**: Name, usage count

### Result Merging/Deduplication
**File:** `src/services/firebaseDataService.ts:844-900`
- **Google Place → Internal Hub**: Dedupe by `googlePlaceId`
- **Duplicate Places**: Dedupe by name + address
- **Duplicate Lists**: Dedupe by name + userId
- **Result Limits**: 20 places, 10 lists, 5 users per query

### Search Context Building
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

## Current Ranking Algorithm

### Score Calculation
**File:** `src/utils/searchAlgorithm.ts:239-271`
```typescript
const calculateScore = (item: any, query: string, context: any) => {
  let score = 0
  
  // Text matching (40% weight)
  const textMatch = fuzzyMatch(item.name, query) + fuzzyMatch(item.description, query)
  score += textMatch * 0.4
  
  // Tag matching (30% weight)
  const tagMatch = item.tags.filter(tag => query.includes(tag)).length
  score += tagMatch * 0.3
  
  // Popularity (20% weight)
  const popularity = (item.likes || 0) + (item.followers || 0)
  score += Math.log(popularity + 1) * 0.2
  
  // Recency (10% weight)
  const daysSinceCreated = (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  score += Math.max(0, 30 - daysSinceCreated) / 30 * 0.1
  
  return score
}
```

### Fuzzy Matching Implementation
**File:** `src/utils/searchAlgorithm.ts:65-109`
```typescript
const fuzzyMatch = (text: string, query: string) => {
  const textTokens = text.toLowerCase().split(/\s+/)
  const queryTokens = query.toLowerCase().split(/\s+/)
  
  let matchScore = 0
  for (const queryToken of queryTokens) {
    for (const textToken of textTokens) {
      const distance = levenshteinDistance(queryToken, textToken)
      const maxLength = Math.max(queryToken.length, textToken.length)
      const similarity = 1 - (distance / maxLength)
      
      if (similarity > 0.6) {
        matchScore += similarity
      }
    }
  }
  
  return matchScore / queryTokens.length
}
```

## Search Routes and Examples

### Global Search
**File:** `src/pages/Search.tsx:18-31`
```typescript
const { searchQuery, setSearchQuery, displayResults, isSearching, error, performSearch } = useSearch()
```

### List-Scoped Search
**File:** `src/pages/ListView.tsx:23-41`
```typescript
const { getPlacesForList } = firebaseListService
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

## GAP Analysis

### Missing Features:
1. **Semantic search** - No vector embeddings or semantic similarity
2. **Auto-complete** - No search suggestions as user types
3. **Search history** - No persistent search history
4. **Search analytics** - No tracking of search performance
5. **Advanced filters** - Limited filter options
6. **Search within results** - No refinement of existing results

### Suggested Improvements:
1. **Add semantic search layer** using OpenAI embeddings
2. **Implement auto-complete** with popular searches
3. **Add search history** with user preferences
4. **Track search analytics** for optimization
5. **Expand filter options** (price, rating, distance, etc.)
6. **Add search within results** functionality

### Implementation Priorities:
1. **High**: Semantic search for better relevance
2. **Medium**: Auto-complete for better UX
3. **Low**: Search analytics for optimization
