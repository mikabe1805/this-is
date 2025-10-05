# TODOs from Code

## TODO Comments Found

### 1. Map View Implementation
**File**: `src/pages/Search.tsx:450-452`
```typescript
<button type="button" onClick={() => console.log('Map view - coming soon!')} className="btn-primary text-sm">
  <MapIcon className="w-4 h-4" /><span>Map</span>
</button>
```
**TODO**: Implement map view functionality
**Priority**: Medium
**Estimated Effort**: 2-3 days

### 2. Comment Functionality
**File**: `src/pages/Home.tsx:808-824`
```typescript
const handleAddComment = (text: string) => {
  if (!selectedPost) return
  console.log('Adding comment to post:', selectedPost.id, 'Text:', text)
}

const handleLikeComment = (commentId: string) => {
  console.log('Liking comment:', commentId)
}

const handleReplyToComment = (commentId: string, text: string) => {
  console.log('Replying to comment:', commentId, 'Text:', text)
}

const handlePostReply = async (text: string, images?: string[]) => {
  if (!selectedPost) return
  console.log('Creating reply to post:', selectedPost.id, 'Text:', text, 'Images:', images)
}
```
**TODO**: Implement comment functionality
**Priority**: High
**Estimated Effort**: 3-4 days

### 3. Google Maps Import
**File**: `src/pages/Profile.tsx:502-508`
```typescript
const handleImportFromGoogleMaps = () => {
  setShowGoogleMapsImport(true)
}

const handleGoogleMapsImport = (importData: any) => {
  console.log('Importing from Google Maps:', importData)
}
```
**TODO**: Implement Google Maps import functionality
**Priority**: Medium
**Estimated Effort**: 2-3 days

### 4. Save Functionality
**File**: `src/pages/Profile.tsx:474-487`
```typescript
const handleSave = (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
  console.log('Saving place:', {
    place: selectedPlace,
    status,
    rating,
    listIds,
    note,
    autoSaveToList: `All ${status.charAt(0).toUpperCase() + status.slice(1)}`
  })
}

const handleCreateList = (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => {
  console.log('Creating new list:', listData, 'and saving place:', selectedPlace)
}
```
**TODO**: Implement save functionality
**Priority**: High
**Estimated Effort**: 2-3 days

### 5. Create Post Functionality
**File**: `src/pages/Profile.tsx:497-500`
```typescript
const handleCreatePost = (listId?: string) => {
  setCreatePostListId(listId || null)
  setShowCreatePost(true)
}
```
**TODO**: Implement create post functionality
**Priority**: High
**Estimated Effort**: 3-4 days

## FIXME Comments Found

### 1. TypeScript Ignore
**File**: `src/pages/Profile.tsx:718-720`
```typescript
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
listMenuButtonRef.current = e.currentTarget as HTMLButtonElement
```
**FIXME**: Remove TypeScript ignore and fix type issue
**Priority**: Low
**Estimated Effort**: 1 hour

### 2. Error Handling
**File**: `src/pages/Profile.tsx:1025-1027`
```typescript
} catch (e) {
  console.error('Failed to save list changes:', e)
}
```
**FIXME**: Improve error handling for list save failures
**Priority**: Medium
**Estimated Effort**: 2 hours

### 3. Error Handling
**File**: `src/pages/Profile.tsx:1037-1039`
```typescript
} catch (e) {
  console.error('Failed to update privacy:', e)
}
```
**FIXME**: Improve error handling for privacy update failures
**Priority**: Medium
**Estimated Effort**: 2 hours

### 4. Error Handling
**File**: `src/pages/Profile.tsx:1053-1055`
```typescript
} catch (e) {
  console.error('Failed to delete list:', e)
}
```
**FIXME**: Improve error handling for list deletion failures
**Priority**: Medium
**Estimated Effort**: 2 hours

## NOTE Comments Found

### 1. Botanical Accent Removal
**File**: `src/pages/Home.tsx:26`
```typescript
// BotanicalAccent removed for a cleaner, less decorative header
```
**NOTE**: Botanical accent component was removed
**Priority**: N/A
**Estimated Effort**: N/A

### 2. Botanical Accent Removal
**File**: `src/pages/Profile.tsx:28`
```typescript
// BotanicalAccent removed for minimal profile header
```
**NOTE**: Botanical accent component was removed
**Priority**: N/A
**Estimated Effort**: N/A

### 3. Suggested Hub Modal Path
**File**: `src/pages/Home.tsx:99`
```typescript
// SuggestedHubModal path removed in favor of direct Create Hub flow
```
**NOTE**: Suggested hub modal path was removed
**Priority**: N/A
**Estimated Effort**: N/A

### 4. Suggested Hub Modal Path
**File**: `src/pages/Home.tsx:1366`
```typescript
{/* SuggestedHubModal path removed */}
```
**NOTE**: Suggested hub modal path was removed
**Priority**: N/A
**Estimated Effort**: N/A

## GAP Analysis

### Missing TODO Management:
1. **No TODO tracking system** - Should implement issue tracking
2. **No priority assignment** - Should assign priorities to TODOs
3. **No effort estimation** - Should estimate effort for TODOs
4. **No progress tracking** - Should track TODO completion

### Recommended Actions:
1. **Implement TODO tracking** with GitHub Issues
2. **Assign priorities** to all TODOs
3. **Estimate effort** for all TODOs
4. **Track progress** on TODO completion

## TODO Prioritization

### High Priority (Critical):
1. **Comment functionality** - Core user engagement
2. **Save functionality** - Core user feature
3. **Create post functionality** - Core user feature

### Medium Priority (Important):
1. **Map view implementation** - User experience
2. **Google Maps import** - User convenience
3. **Error handling improvements** - Reliability

### Low Priority (Nice to Have):
1. **TypeScript fixes** - Code quality
2. **Documentation updates** - Developer experience

## Implementation Plan

### Phase 1: Critical Features
- Implement comment functionality
- Implement save functionality
- Implement create post functionality

### Phase 2: User Experience
- Implement map view
- Implement Google Maps import
- Improve error handling

### Phase 3: Code Quality
- Fix TypeScript issues
- Improve error handling
- Add documentation
