# User Flows

## Save→List Flow

```mermaid
graph TD
    A[User views place/hub] --> B[Click Save button]
    B --> C[SaveModal opens]
    C --> D[Select status: loved/tried/want]
    D --> E[Add optional note]
    E --> F[Select existing lists or create new]
    F --> G[Click Save]
    G --> H[firebaseDataService.savePlaceToList]
    H --> I[firebaseDataService.saveToAutoList]
    I --> J[Update UI with success]
    J --> K[Close modal]
    
    F --> L[Create new list]
    L --> M[CreateListModal opens]
    M --> N[Enter list name/description]
    N --> O[Set privacy: public/private/friends]
    O --> P[firebaseListService.createList]
    P --> Q[Add place to new list]
    Q --> R[Return to SaveModal]
    R --> G
```

**Handler Files:**
- `src/components/SaveModal.tsx:1-200` - Save modal UI and logic
- `src/services/firebaseDataService.ts:200-300` - savePlaceToList function
- `src/services/firebaseListService.ts:100-200` - createList function
- `src/components/CreateListModal.tsx:1-100` - Create list modal

## Promote Google→Hub Flow

```mermaid
graph TD
    A[User clicks Google Maps import] --> B[GoogleMapsImportModal opens]
    B --> C[Enter Google Maps URL]
    C --> D[Click Import]
    D --> E[functions/src/places.ts:extractEmbed]
    E --> F[Parse Google Maps data]
    F --> G[Extract place details]
    G --> H[Create Place document]
    H --> I[Create Hub document]
    I --> J[Update UI with new hub]
    J --> K[Close modal]
    
    E --> L[Error: Invalid URL]
    L --> M[Show error message]
    M --> C
    
    E --> N[Error: Place not found]
    N --> O[Show error message]
    O --> C
```

**Handler Files:**
- `src/components/GoogleMapsImportModal.tsx:1-200` - Import modal UI
- `functions/src/places.ts:1-100` - extractEmbed Cloud Function
- `src/services/firebaseDataService.ts:300-400` - Place creation logic

## Create Post Flow

```mermaid
graph TD
    A[User clicks Create Post] --> B[CreatePost modal opens]
    B --> C[Upload/take photo]
    C --> D[Add description]
    D --> E[Add tags]
    E --> F[Select location/hub]
    F --> G[Set privacy: public/private/friends]
    G --> H[Click Post]
    H --> I[firebaseDataService.createPost]
    I --> J[Upload images to Storage]
    J --> K[Create Post document]
    K --> L[Update Hub with new post]
    L --> M[Update user activity]
    M --> N[Close modal]
    N --> O[Refresh feed]
    
    F --> P[Create new hub]
    P --> Q[CreateHubModal opens]
    Q --> R[Enter hub details]
    R --> S[firebaseDataService.createPlace]
    S --> T[Return to CreatePost]
    T --> F
```

**Handler Files:**
- `src/components/CreatePost.tsx:1-300` - Create post modal
- `src/services/firebaseDataService.ts:400-500` - createPost function
- `src/services/firebaseStorageService.ts:1-100` - Image upload
- `src/components/CreateHubModal.tsx:1-200` - Create hub modal

## Global Search Flow

```mermaid
graph TD
    A[User enters search query] --> B[SearchAndFilter component]
    B --> C[firebaseDataService.performSearch]
    C --> D[Search places]
    C --> E[Search lists]
    C --> F[Search users]
    D --> G[Filter by location]
    E --> H[Filter by tags]
    F --> I[Filter by name]
    G --> J[Rank by relevance]
    H --> J
    I --> J
    J --> K[Display results]
    K --> L[User clicks result]
    L --> M[Open HubModal/ListModal/ProfileModal]
    
    B --> N[Apply filters]
    N --> O[Filter by distance]
    O --> P[Filter by tags]
    P --> Q[Filter by privacy]
    Q --> R[Re-run search]
    R --> J
```

**Handler Files:**
- `src/components/SearchAndFilter.tsx:1-200` - Search UI component
- `src/services/firebaseDataService.ts:500-600` - performSearch function
- `src/utils/searchAlgorithm.ts:1-100` - Search ranking logic
- `src/utils/intelligentSearchService.ts:1-100` - AI search integration

## Search-in-List Flow

```mermaid
graph TD
    A[User opens ListView] --> B[Display list places]
    B --> C[User enters search query]
    C --> D[Filter places in list]
    D --> E[Display filtered results]
    E --> F[User clicks place]
    F --> G[Open HubModal]
    G --> H[Show place details]
    H --> I[User can save to other lists]
    
    C --> J[Clear search]
    J --> B
    
    E --> K[No results found]
    K --> L[Show "No places found" message]
    L --> C
```

**Handler Files:**
- `src/pages/ListView.tsx:1-200` - List view page
- `src/components/ListCard.tsx:1-300` - List display component
- `src/services/firebaseListService.ts:200-300` - getPlacesForList function

## Auth Flow

```mermaid
graph TD
    A[User opens app] --> B[Check authentication state]
    B --> C{User authenticated?}
    C -->|No| D[Show login screen]
    D --> E[User enters email/password]
    E --> F[firebaseDataService.signUp/signIn]
    F --> G{Success?}
    G -->|Yes| H[Set user context]
    G -->|No| I[Show error message]
    I --> E
    H --> J[Navigate to Home]
    
    C -->|Yes| J
    J --> K[Load user data]
    K --> L[Load friends activity]
    L --> M[Load discovery items]
    M --> N[Display home feed]
    
    B --> O[User clicks logout]
    O --> P[firebaseDataService.signOut]
    P --> Q[Clear user context]
    Q --> D
```

**Handler Files:**
- `src/contexts/AuthContext.tsx:1-200` - Authentication context
- `src/services/firebaseDataService.ts:100-200` - Auth functions
- `src/pages/Home.tsx:1-100` - Home page with auth checks

## Upload Flow

```mermaid
graph TD
    A[User selects image] --> B[Image preview]
    B --> C[firebaseStorageService.uploadImage]
    C --> D[Compress image]
    D --> E[Generate unique filename]
    E --> F[Upload to Firebase Storage]
    F --> G{Upload successful?}
    G -->|Yes| H[Return image URL]
    G -->|No| I[Show error message]
    I --> J[Retry upload]
    J --> C
    
    H --> K[Update UI with image]
    K --> L[User can add description]
    L --> M[User can add tags]
    M --> N[User can set privacy]
    N --> O[Submit post]
    O --> P[Create Post document]
    P --> Q[Update Hub with new post]
    Q --> R[Refresh feed]
    
    C --> S[Image too large]
    S --> T[Show compression options]
    T --> U[User selects compression]
    U --> D
```

**Handler Files:**
- `src/services/firebaseStorageService.ts:1-200` - Image upload service
- `src/components/CreatePost.tsx:200-300` - Image upload UI
- `src/services/firebaseDataService.ts:400-500` - Post creation logic

## Additional Flows

### Like/Unlike Flow
```mermaid
graph TD
    A[User clicks like button] --> B[Check if already liked]
    B --> C{Already liked?}
    C -->|Yes| D[Remove like]
    C -->|No| E[Add like]
    D --> F[firebaseDataService.unlikePost]
    E --> G[firebaseDataService.likePost]
    F --> H[Update UI]
    G --> H
    H --> I[Update like count]
```

**Handler Files:**
- `src/components/PostModal.tsx:200-300` - Like button logic
- `src/services/firebaseDataService.ts:600-700` - Like/unlike functions

### Follow/Unfollow Flow
```mermaid
graph TD
    A[User views profile] --> B[Click follow button]
    B --> C[firebaseDataService.followUser]
    C --> D[Update user's followers]
    D --> E[Update target's following]
    E --> F[Update UI]
    F --> G[Show success message]
```

**Handler Files:**
- `src/components/ProfileModal.tsx:1-200` - Profile display
- `src/services/firebaseDataService.ts:700-800` - Follow/unfollow functions

### Comment Flow
```mermaid
graph TD
    A[User views post] --> B[Click comment button]
    B --> C[PostModal opens]
    C --> D[User types comment]
    D --> E[Click Post Comment]
    E --> F[firebaseDataService.postComment]
    F --> G[Create comment document]
    G --> H[Update post comment count]
    H --> I[Display new comment]
    I --> J[Close modal]
```

**Handler Files:**
- `src/components/PostModal.tsx:300-400` - Comment UI
- `src/services/firebaseDataService.ts:800-900` - Comment functions