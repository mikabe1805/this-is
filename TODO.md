# Application Development Roadmap

This document outlines the planned features and development phases for the application.

## ✅ **RECENTLY COMPLETED FIXES**

### **Follow System Fix**
- [x] **Fixed Follow Button Persistence:**
    - [x] Added proper Firebase state checking when ProfileModal opens
    - [x] Implemented optimistic UI updates with Firebase state refresh
    - [x] Added error handling and state reversion on failed operations
    - [x] Follow button now correctly reflects actual following status
    - [x] Added comprehensive logging for debugging follow operations
    - [x] Applied same logic to Reels page follow buttons
    - [x] Verified UserProfile and Following pages already have correct implementation

### **Recent Finds Duplicates Fix**
- [x] **Fixed Duplicate Items in Recent Finds:**
    - [x] Added filtering logic to prevent duplicate items in search results
    - [x] Items are now moved to the top when clicked again instead of creating duplicates
    - [x] Applied fix to places, lists, and users in recent finds

### **ListModal Improvements (Latest)**
- [x] **Combined Posts and Places Display:**
    - [x] Unified posts and places under single "Places in this list" section
    - [x] Added proper status tags with consistent styling (Saved, Loved, Tried, Want)
    - [x] Added rating indicators for tried posts (Liked, Neutral, Disliked)
    - [x] Improved visual hierarchy and user experience

### **Blue Bottle Coffee Banner Fix**
- [x] **Fixed Inconsistent Banner Display:**
    - [x] Added fallback image handling for missing hub banners
    - [x] Ensured banner displays consistently across all contexts
    - [x] Added error handling for broken image URLs
    - [x] Banner now shows even when hubImage is empty or null

### **Comment Functionality Fix**
- [x] **Fixed Firebase Permissions Error:**
    - [x] Added missing Firestore rules for user comments subcollection
    - [x] Deployed updated Firestore rules
    - [x] Comments now work properly without permission errors

### **CreatePost Improvements**
- [x] **Fixed EXIF Error Handling:**
    - [x] Added proper error handling for EXIF data extraction
    - [x] Prevented crashes when EXIF library encounters issues
    - [x] Added fallback for undefined EXIF variables
- [x] **Google Places Integration:**
    - [x] Google Places Autocomplete is already integrated via AddressAutocomplete component
    - [x] Note: Google Maps API key needs to be configured in .env file for full functionality

## Phase 1: Solidify Core Functionality & Data Integrity

- [x] **Complete Mock Data Removal:**
    - [x] Systematically scan the entire codebase to find and replace any remaining mock data with live Firebase calls.
    - [x] Ensure all user-facing components (`Profile`, `Lists`, `Hubs`, etc.) are 100% powered by real data.

- [ ] **Add Comment Sections to All Hubs and Posts:**
    - [ ] **Hub Comments:**
        - [ ] Add comment section to HubModal component
        - [ ] Create comment posting functionality for hubs
        - [ ] Display comments in hub overview tab
        - [ ] Add comment count to hub display
    - [ ] **Post Comments:**
        - [ ] Enhance existing PostModal comment functionality
        - [ ] Add comment replies feature
        - [ ] Add comment likes and reactions
        - [ ] Improve comment UI/UX design
    - [ ] **List Comments:**
        - [ ] Add comment section to ListModal component
        - [ ] Allow users to comment on lists
        - [ ] Display list comments in list overview
    - [ ] **Comment Moderation:**
        - [ ] Add comment reporting functionality
        - [ ] Implement comment deletion for post authors
        - [ ] Add comment filtering and sorting options

- [x] **Enhance User Profiles & Lists:**
    - [ ] **Profile Banner Upload:**
        - [ ] Add a button to the `ProfileModal` and `EditProfile` page to upload a banner image.
        - [ ] Create a new function in `firebaseStorageService` to handle the upload.
        - [ ] Update the `User` type and `firebaseDataService` to store and retrieve the banner URL.
        - [ ] Display the banner in `ProfileModal` and the main `Profile` page.
    - [ ] **Add Location to Lists:**
        - [ ] Modify the `CreateListModal` and `EditListModal` to include an optional "Location" field (using Google Places Autocomplete for consistency).
        - [ ] Update the `List` type and `firebaseDataService` to handle the new location data.

- [x] **Test Search and Filtering Across All Pages:**
    - [x] Verify tag click navigation works correctly on all pages (Profile, ListCard, PlaceHub, etc.)
    - [x] Test filter count indicator displays properly on search page
    - [x] Ensure search results update correctly when filters are applied/removed
    - [x] Test URL parameter handling for tag filtering
    - [x] Verify filter state persists when navigating between pages
    - [x] Test edge cases (empty search results, multiple filters, etc.)

- [x] **Google Maps API Integration for Hub Creation:**
    - [x] Add Google Maps API for address entry when creating new hubs
    - [x] Create AddressAutocomplete component for hub creation
    - [x] Integrate with CreatePost component for new hub creation

- [x] **Tag Autocomplete Implementation:**
    - [x] Create reusable TagAutocomplete component
    - [x] Implement tag autocomplete in CreatePost component
    - [x] Add tag autocomplete to all components that need tag input
    - [x] Implement global tag management in Firebase
    - [x] Save new tags to Firebase when created by users
    - [x] Make tags searchable and available for all users

- [x] **Fix HubModal Avatar Issues:**
    - [x] Fix undefined userAvatar errors in HubModal
    - [x] Add fallback default avatar
    - [x] Add error handling for missing avatars
    - [x] Add comprehensive safety checks for all user data access

- [x] **Fix CreatePost Hub Search Issues:**
    - [x] Fix address property access errors in hub search results
    - [x] Add safety checks for hub data structure
    - [x] Ensure proper fallback values for missing hub data

- [x] **Hub Banner Image Management:**
    - [x] Implement automatic hub banner image updates based on most popular posts
    - [x] Update banner image when posts are liked/unliked
    - [x] Update banner image when new posts are created
    - [x] Create script to update all existing hub banner images
    - [x] Use first image from post with most likes as hub banner

- [x] **Fix HubModal Safety Issues:**
    - [x] Add comprehensive safety checks for hub data access
    - [x] Fix undefined hub.location.address errors
    - [x] Add fallback values for missing hub properties
    - [x] Ensure component handles undefined hub gracefully

- [x] **Fix ListModal Display Issues:**
    - [x] Fix missing usernames in list items
    - [x] Add post type indicators (loved/tried/want) with proper styling
    - [x] Add rating indicators for tried posts (liked/neutral/disliked)
    - [x] Replace mock userLists with real Firebase data
    - [x] Add safety checks for post images

- [x] **Fix Navigation and Modal Issues:**
    - [x] Fix closeListModal function not being exported from NavigationContext
    - [x] Fix SaveToListModal being used incorrectly in ListModal
    - [x] Implement proper list saving functionality in ListModal
    - [x] Add sorting functionality to HubModal posts (by likes and recent)
    - [x] Enrich posts with username information in getPostsForList

- [x] **Fix Save and Interaction Tracking Issues:**
    - [x] Fix save button in HubModal posts not working
    - [x] Fix PostModal showing wrong save modal (SavePostToListModal instead of SaveModal)
    - [x] Fix hub saving not updating list's hubs array
    - [x] Fix GlobalModals error when saving hubs with undefined location
    - [x] Add proper interaction tracking for save actions
    - [x] Ensure saved hubs appear in lists and recent searches

- [x] **Fix Post Display and Hub Banner Issues:**
    - [x] Fix posts showing "Anonymous" in HubModal (enrich getPostsForHub with user info)
    - [x] Fix SaveModal error with undefined tags.slice()
    - [x] Update hub banner images to use most popular post images
    - [x] Add debugging for save functionality to track issues

- [x] **Fix Save and List Display Issues:**
    - [x] Fix Google Maps API error (address cannot be mixed with establishment types)
    - [x] Implement Friends' Lists section in HubModal
    - [x] Fix list items not appearing after saving (update getPlacesForList to use hubs array)
    - [x] Add getFriendsListsContainingHub function for proper friends logic

- [x] **Fix Recent Searches and Comments Issues:**
    - [x] Fix recent searches not being saved to Firebase when users interact with results
    - [x] Implement "View all comments" functionality in HubModal (simple alert for now)
    - [x] Add comment count to the "View all comments" button
    - [x] Update search history when users click on search results

- [x] **Fix Hub Banner and EXIF Issues:**
    - [x] Fix hub banner update script to handle posts without createdAt field
    - [x] Fix EXIF.js error when extracting location from photos
    - [x] Add proper error handling for EXIF data extraction
    - [x] Ensure hub banners are updated with most popular post images

- [x] **Add Hub Description to HubModal:**
    - [x] Add hub description section to HubModal overview tab
    - [x] Style description section to match the app's aesthetic
    - [x] Only show description section if hub has a description

- [x] **Fix ListModal Display Issues:**
    - [x] Fix ListModal not showing saved places and posts
    - [x] Add places section to ListModal to display saved hubs
    - [x] Update item count to include both posts and places
    - [x] Ensure proper navigation from saved places to hub modals
    - [x] Fix Firebase permissions error when fetching places for lists
    - [x] Add proper error handling for authentication issues

## Phase 2: Geolocation & Intelligent Content Association

- [ ] **Core Geolocation & Map Integration:**
    - [ ] Integrate a map library (like Google Maps or Leaflet) into a new `Map.tsx` page.
    - [ ] Fetch and display the user's saved places and lists on the map.
    - [ ] Implement basic map interactions (panning, zooming, clicking on a pin to see a pop-up with a link to the Hub/List).

- [ ] **Automatic Hub Association from Photos:**
    - [ ] **EXIF Data Extraction:** When a user uploads a photo in `CreatePost.tsx`, extract GPS coordinates from the image's EXIF data.
    - [ ] **Reverse Geocoding:** Use a service (like Google's Geocoding API) to convert those coordinates into a potential address or place name.
    - [ ] **Hub Matching Algorithm:**
        - [ ] Query your Firebase `hubs` collection for hubs near the photo's location.
        - [ ] Present the user with a list of potential hubs to associate the post with, with the most likely match pre-selected.
        - [ ] Allow the user to confirm or search for a different hub.

- [ ] **Screenshot-based Hub Association:**
    - [ ] **Image Analysis:** When a user uploads a screenshot, use a cloud vision API (like Google Cloud Vision) to perform OCR (Optical Character Recognition) and logo detection.
    - [ ] **Intelligent Search:** Use the extracted text (place name, address, etc.) to perform a targeted search against your `hubs` collection and the Google Places API.
    - [ ] **User Confirmation:** Just like with the photo location, present the user with the most likely hub and allow them to confirm.

## Phase 3: Advanced Algorithms & AI-Powered Features

- [ ] **Location-Aware Discovery Algorithm:**
    - [ ] Modify `discoveryAlgorithm.ts` to factor in:
        - [ ] The user's current location (if shared).
        - [ ] The locations associated with the user's lists.
        - [ ] The locations of the user's saved places.
    - [ ] The algorithm should now recommend a mix of content based on user preferences and what's geographically relevant.

- [ ] **AI-Generated Hub Descriptions:**
    - [ ] Create a new cloud function (in `functions/src`) that triggers when a new post is added to a hub.
    - [ ] **Content Aggregation:** The function will gather text from all posts within that hub.
    - [ ] **AI Summarization:** Pass the aggregated text to a generative AI model (like Gemini) to create a concise, engaging summary for the hub's description.
    - [ ] **Google Maps Fallback:** If a hub has no posts, the function will fetch its description from the Google Places API and use that instead.

- [ ] **Import Lists from Google Maps:**
    - [ ] **Authentication & Permissions:** Use Firebase Authentication to securely connect to a user's Google account and request permission to access their Google Maps lists.
    - [ ] **Data Parsing:** Fetch the user's public or specified Google Maps lists and parse the place data.
    - [ ] **List Creation Flow:** For each imported list, create a new list in your app. For each place in the Google Maps list, either find a matching hub in your database or create a new one.
    - [ ] **User Review:** Allow the user to review the imported lists and places before finalizing the import.

- [ ] **"Influences" Algorithm:**
    - [ ] Define the metrics that contribute to a user's influence score (e.g., number of followers, likes received, saves on their posts/lists).
    - [ ] Create a cloud function that periodically calculates and updates the `influences` score for each user.
    - [ ] Display the influence score on user profiles.

## Phase 4: Collaboration & Social Features

- [ ] **Collaborative Lists:**
    - [ ] Allow multiple users to have admin/editor access to a single list.
    - [ ] Develop a system for inviting collaborators.
    - [ ] Implement granular permissions (e.g., view only, can add places, can edit list details).
