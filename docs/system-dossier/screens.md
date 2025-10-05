# Screens

## Home (src/pages/Home.tsx)
**File:** `src/pages/Home.tsx:65-1413`

**Component building blocks:**
- `SearchAndFilter` (src/components/SearchAndFilter.tsx) - lines 849-869
- `AdvancedFiltersDrawer` (src/components/AdvancedFiltersDrawer.tsx) - lines 1320
- `SaveModal` (src/components/SaveModal.tsx) - lines 1303-1314
- `LocationSelectModal` (src/components/LocationSelectModal.tsx) - lines 1315-1319
- `CreatePost` (src/components/CreatePost.tsx) - lines 1321-1330
- `CommentsModal` (src/components/CommentsModal.tsx) - lines 1332-1342
- `ReplyModal` (src/components/ReplyModal.tsx) - lines 1345-1356
- `ShareModal` (src/components/ShareModal.tsx) - lines 1358-1365
- `CreateHubModal` (src/components/CreateHubModal.tsx) - lines 1367-1407
- `Card` (src/components/Card.tsx) - lines 920, 1010, 1090, 1200
- `Section` (src/components/Section.tsx) - lines 897, 1000, 1204
- `TagPill` (src/components/TagPill.tsx) - lines 25, 259, 142, 143

**Modals opened from this screen:**
- SaveModal (when saving places to lists)
- LocationSelectModal (when selecting location for nearby sorting)
- CreatePost (when creating new posts)
- CommentsModal (when viewing post comments)
- ReplyModal (when replying to posts)
- ShareModal (when sharing content)
- CreateHubModal (when creating hubs from Google suggestions)
- AdvancedFiltersDrawer (when applying advanced filters)

## Search (src/pages/Search.tsx)
**File:** `src/pages/Search.tsx:18-927`

**Component building blocks:**
- `SearchAndFilter` (src/components/SearchAndFilter.tsx) - lines 429-449
- `AdvancedFiltersDrawer` (src/components/AdvancedFiltersDrawer.tsx) - lines 477
- `CreateHubModal` (src/components/CreateHubModal.tsx) - lines 827-844
- `QuickViewModal` (src/components/QuickViewModal.tsx) - lines 847-893
- `SaveModal` (src/components/SaveModal.tsx) - lines 894-922
- `Card` (src/components/Card.tsx) - lines 571, 726, 743, 760, 788
- `TagPill` (src/components/TagPill.tsx) - lines 458-472, 484-492, 684-700
- `ImageCarousel` (src/components/ImageCarousel.tsx) - lines 668, 1244

**Modals opened from this screen:**
- CreateHubModal (when creating hubs from Google suggestions)
- QuickViewModal (when previewing places/lists/users)
- SaveModal (when saving places to lists)
- AdvancedFiltersDrawer (when applying advanced filters)

## Profile (src/pages/Profile.tsx)
**File:** `src/pages/Profile.tsx:43-1081`

**Component building blocks:**
- `SearchAndFilter` (src/components/SearchAndFilter.tsx) - lines 523-541
- `AdvancedFiltersDrawer` (src/components/AdvancedFiltersDrawer.tsx) - lines 543-549, 1070-1076
- `SaveModal` (src/components/SaveModal.tsx) - lines 908-920
- `LocationSelectModal` (src/components/LocationSelectModal.tsx) - lines 921-929
- `CreatePost` (src/components/CreatePost.tsx) - lines 930-937
- `UserMenuDropdown` (src/components/UserMenuDropdown.tsx) - lines 938-953
- `ListMenuDropdown` (src/components/ListMenuDropdown.tsx) - lines 955-1001
- `EditListModal` (src/components/EditListModal.tsx) - lines 1003-1028
- `PrivacyModal` (src/components/PrivacyModal.tsx) - lines 1030-1044
- `ConfirmModal` (src/components/ConfirmModal.tsx) - lines 1046-1064
- `GoogleMapsImportModal` (src/components/GoogleMapsImportModal.tsx) - lines 1065-1069
- `TagAutocomplete` (src/components/TagAutocomplete.tsx) - lines 623-637
- `TagPill` (src/components/TagPill.tsx) - lines 614-620, 732-738
- `Section` (src/components/Section.tsx) - lines 687, 821

**Modals opened from this screen:**
- SaveModal (when saving places to lists)
- LocationSelectModal (when selecting location for nearby sorting)
- CreatePost (when creating new posts)
- UserMenuDropdown (when accessing user menu)
- ListMenuDropdown (when managing lists)
- EditListModal (when editing list details)
- PrivacyModal (when changing list privacy)
- ConfirmModal (when confirming destructive actions)
- GoogleMapsImportModal (when importing from Google Maps)
- AdvancedFiltersDrawer (when applying advanced filters)

## ListView (src/pages/ListView.tsx)
**File:** `src/pages/ListView.tsx:23-41`

**Component building blocks:**
- Uses `firebaseListService.getPlacesForList` for data loading
- Imports from `../services/firebaseListService.js`

## PlaceHub (src/pages/PlaceHub.tsx)
**File:** `src/pages/PlaceHub.tsx`

**Component building blocks:**
- Hub-specific components and modals

## Other Pages
- **Auth.tsx** - Authentication screen
- **Demo.tsx** - Demo/development screen  
- **EditProfile.tsx** - Profile editing screen
- **Followers.tsx** - User followers list
- **Following.tsx** - User following list
- **Places.tsx** - Places listing screen
- **Reels.tsx** - Reels/feed screen
- **SavedLists.tsx** - Saved lists screen
- **Settings.tsx** - User settings screen
- **UserProfile.tsx** - Other user's profile screen
- **ViewAllLists.tsx** - All lists view screen

## GAP Analysis

**GAP: Missing screen documentation for:**
- Auth.tsx - Should document authentication flow and components
- Demo.tsx - Should document demo features and components
- EditProfile.tsx - Should document profile editing form and validation
- Followers.tsx - Should document followers list components
- Following.tsx - Should document following list components
- Places.tsx - Should document places listing and filtering
- Reels.tsx - Should document reels/feed components
- SavedLists.tsx - Should document saved lists management
- Settings.tsx - Should document settings form components
- UserProfile.tsx - Should document other user profile components
- ViewAllLists.tsx - Should document lists grid and pagination

**GAP: Missing component usage documentation for:**
- ImageCarousel usage in Search.tsx (lines 668, 1244)
- TagCloud usage in ListCard.tsx (lines 137-143)
- PlusDropdown usage in Navbar.tsx (lines 79-84)
- ListMenuDropdown usage in ListCard.tsx (lines 301-310)
