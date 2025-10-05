# Known Bugs

## User-Reported Bugs

### 1. Create List Exits Save Flow
**Description**: When creating a new list during the save flow, the user is unexpectedly exited from the save modal
**Steps to Reproduce**:
1. Navigate to a place/hub
2. Click "Save" button
3. Click "Create new list" option
4. Fill out list details and submit
5. User is returned to the place view instead of the save modal

**Suspected Code Locus**: `src/components/SaveModal.tsx:12-21`
**Impact**: High - Breaks core user flow
**Status**: Unconfirmed

### 2. Missing Banner Image
**Description**: Hub banner images are not displaying properly
**Steps to Reproduce**:
1. Navigate to any hub page
2. Banner image area shows placeholder or broken image
3. Image URL exists but fails to load

**Suspected Code Locus**: `src/pages/PlaceHub.tsx`
**Impact**: Medium - Visual issue
**Status**: Unconfirmed

### 3. List Search Nonfunctional
**Description**: Search within lists is not working properly
**Steps to Reproduce**:
1. Navigate to a list view
2. Enter search query in the search box
3. Results are not filtered or no results shown

**Suspected Code Locus**: `src/pages/ListView.tsx:23-41`
**Impact**: High - Core functionality broken
**Status**: Unconfirmed

### 4. Floating Action Bar Overlap
**Description**: Floating action buttons overlap with content on mobile
**Steps to Reproduce**:
1. Open app on mobile device
2. Navigate to any page with floating action buttons
3. Buttons overlap with page content

**Suspected Code Locus**: `src/components/Navbar.tsx:38-43`
**Impact**: Medium - UI issue
**Status**: Unconfirmed

### 5. Google Suggestion Not Replaced
**Description**: Google place suggestions are not being replaced with internal hubs
**Steps to Reproduce**:
1. Search for a place
2. Select a Google suggestion
3. Create hub from suggestion
4. Google suggestion still appears in search results

**Suspected Code Locus**: `src/pages/Search.tsx:634-713`
**Impact**: Medium - Search experience issue
**Status**: Unconfirmed

## Code-Identified Issues

### 6. Memory Leak in Image Carousel
**File**: `src/components/ImageCarousel.tsx`
**Issue**: Event listeners not properly cleaned up
**Impact**: Medium - Performance issue
**Status**: Unconfirmed

### 7. Race Condition in Search
**File**: `src/hooks/useSearch.ts:40-80`
**Issue**: Multiple search requests can cause race conditions
**Impact**: Medium - Search reliability
**Status**: Unconfirmed

### 8. Missing Error Boundaries
**File**: `src/App.tsx:296-311`
**Issue**: No error boundaries implemented
**Impact**: High - App crashes
**Status**: Unconfirmed

### 9. Inconsistent State Management
**File**: `src/contexts/NavigationContext.tsx:47-66`
**Issue**: State updates can cause inconsistent UI state
**Impact**: Medium - UI consistency
**Status**: Unconfirmed

### 10. Missing Loading States
**File**: `src/pages/Home.tsx:898-1000`
**Issue**: No loading states for async operations
**Impact**: Low - UX issue
**Status**: Unconfirmed

## Performance Issues

### 11. Large Bundle Size
**File**: `package.json:21-31`
**Issue**: Bundle size is too large for mobile
**Impact**: High - Performance
**Status**: Unconfirmed

### 12. Image Loading Performance
**File**: `src/services/firebaseStorageService.ts:151-159`
**Issue**: Images not optimized for mobile
**Impact**: Medium - Performance
**Status**: Unconfirmed

### 13. Search Performance
**File**: `src/services/firebaseDataService.ts:844-900`
**Issue**: Search queries are slow
**Impact**: Medium - Performance
**Status**: Unconfirmed

## Accessibility Issues

### 14. Missing Focus Indicators
**File**: `src/components/Button.tsx:9`
**Issue**: Buttons lack proper focus indicators
**Impact**: High - Accessibility
**Status**: Unconfirmed

### 15. Missing ARIA Labels
**File**: `src/pages/Profile.tsx:575-581`
**Issue**: Icon buttons lack ARIA labels
**Impact**: High - Accessibility
**Status**: Unconfirmed

### 16. Color Contrast Issues
**File**: `src/components/PostModal.tsx:162-175`
**Issue**: Text contrast insufficient
**Impact**: Medium - Accessibility
**Status**: Unconfirmed

## Security Issues

### 17. Missing Input Validation
**File**: `src/services/firebaseDataService.ts:844-900`
**Issue**: User inputs not properly validated
**Impact**: High - Security
**Status**: Unconfirmed

### 18. No Rate Limiting
**File**: `src/hooks/useSearch.ts:40-80`
**Issue**: No rate limiting on API calls
**Impact**: Medium - Security
**Status**: Unconfirmed

### 19. Missing CSRF Protection
**File**: `src/contexts/AuthContext.tsx:42-76`
**Issue**: No CSRF protection implemented
**Impact**: Medium - Security
**Status**: Unconfirmed

## GAP Analysis

### Missing Bug Tracking:
1. **No bug tracking system** - Should implement issue tracking
2. **No automated testing** - Should add unit/integration tests
3. **No error monitoring** - Should add error tracking
4. **No performance monitoring** - Should add performance tracking

### Recommended Actions:
1. **Implement bug tracking** with GitHub Issues
2. **Add automated testing** with Jest/React Testing Library
3. **Add error monitoring** with Sentry
4. **Add performance monitoring** with Firebase Performance
