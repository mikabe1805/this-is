### Repository map (this.is)

- Root tooling
  - package.json: 1-49
  - vite.config.ts: 1-7
  - tailwind.config.cjs: 1-229
  - postcss.config.js: 1-6
  - firebase.json: 1-92
  - firestore.rules: 1-141
  - firestore.indexes.json: 1-181
  - storage.rules: 1-53
  - eslint.config.js
  - tsconfig.json, tsconfig.app.json, tsconfig.node.json

- Frontend app (Vite + React + TS)
  - src/main.tsx: 1-13 (bootstraps React with BrowserRouter)
  - src/App.tsx: routes/UI composition and providers; routes: 296-311; providers: 363-385
  - src/index.css: design tokens/utilities: 8-17 (CSS vars), 26-58 (components), 219-384 (mobile)
  - src/assets/ (images)
  - src/components/ (UI components) e.g., SaveModal.tsx (12-21 props), CreatePost.tsx (13-18 props)
  - src/pages/ (screens) e.g., Search.tsx (18-31 hook usage), ListView.tsx (23-41 imports/state)
  - src/contexts/
    - AuthContext.tsx: 42-76 (signUp), 90-102 (onAuthStateChanged), 104-118 (provider value)
    - NavigationContext.tsx: 47-66 (state), 79-112 (openHubModal), 114-134 (openListModal), 136-154 (openProfileModal), 194-213 (goBack)
    - FiltersContext.tsx: 19-27 (defaults), 31-41 (provider), 44-48 (hook)
    - ModalContext.tsx: 39-78 (modal API)
  - src/hooks/
    - useSearch.ts: 20-38 (build context), 40-80 (performSearch)
  - src/services/
    - firebaseDataService.ts: performSearch 844-900; savePlaceToList 1544-1612; getSuggestedPlaces 2111-2156
    - firebaseListService.ts: createList 19-51; getPlacesForList 67-164
    - firebasePostService.ts: createPost 14-52; savePostToList 85-115
    - firebaseStorageService.ts: uploadPostImages 151-159
  - src/firebase/config.ts: env init 8-17; emulators 31-41
  - src/types/index.ts: User 1-11; Place 13-28; List 63-84; Post 30-49; Hub 122-137
  - src/utils/
    - intelligentSearchService.ts: performSearch 115-207
    - searchAlgorithm.ts: parseSearchQuery 65-109; rankSearchResults 239-271

- Cloud Functions (Node 22, TypeScript)
  - functions/src/index.ts: extractEmbed 347-384; extractEmbedCallable 386-403; re-exports 405-409
  - functions/src/places.ts: suggestPlaces 4-130; geocodeLocation 132-170
  - functions/src/content-enrichment.ts: onPostCreatedUpdateHub 62-71; onPostUpdatedMaybeUpdateHub 73-86; onListPlaceCreated 88-96; onListPlaceDeleted 98-106
  - functions/src/analytics-cleanup.ts: scheduledanalyticscleanup 6-31
  - functions/src/influences.ts: calculateInfluenceScores 6-37
  - functions/package.json: 1-27

- Firebase hosting/tooling
  - firebase.json: hosting rewrites 9-26; functions predeploy 80-85; apphosting blocks 45-68
  - public/ and dist/ (built assets)

- Scripts (database utilities)
  - scripts/*.js; scripts/package.json 1-31

GAP: No server frameworks beyond Firebase Functions. If added, place under `server/` with its own `package.json` and CI.
